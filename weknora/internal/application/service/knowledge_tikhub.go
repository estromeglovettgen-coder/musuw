package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/Tencent/WeKnora/internal/infrastructure/docparser"
	"github.com/Tencent/WeKnora/internal/infrastructure/tikhub"
	"github.com/Tencent/WeKnora/internal/types"
	secutils "github.com/Tencent/WeKnora/internal/utils"
)

var errTikHubNotConfigured = errors.New("TikHub social import is not configured")
var errSocialVideoNotAllowed = errors.New("current plan does not support social video import")

func socialImportFailureReason(err error) string {
	switch {
	case errors.Is(err, errTikHubNotConfigured):
		return "not_configured"
	case strings.Contains(err.Error(), "VLM"):
		return "vlm_not_configured"
	case errors.Is(err, errSocialVideoNotAllowed):
		return "video_not_allowed"
	case strings.Contains(err.Error(), "upload limit"):
		return "artifact_too_large"
	case strings.Contains(err.Error(), "security validation"):
		return "unsafe_media_url"
	default:
		return "provider_or_processing_error"
	}
}

func socialImportPublicMessage(err error) string {
	switch socialImportFailureReason(err) {
	case "not_configured":
		return "Social link import is not configured"
	case "vlm_not_configured":
		return "Social video import requires a configured VLM model"
	case "video_not_allowed":
		return "Current plan does not support social video import"
	case "artifact_too_large":
		return "Social media exceeds the configured upload limit"
	case "unsafe_media_url":
		return "Social media URL failed security validation"
	default:
		return "Social link import failed"
	}
}

// resumeMaterializedTikHubArtifact makes a redelivered task consume the file
// checkpoint already stored on Knowledge. This is deliberately best-effort,
// not an exactly-once billing claim, but it closes the normal downstream
// retry/reparse path without adding a second queue or provider state table.
func resumeMaterializedTikHubArtifact(payload *types.DocumentProcessPayload, knowledge *types.Knowledge) bool {
	if payload == nil || knowledge == nil || strings.TrimSpace(payload.URL) == "" || strings.TrimSpace(knowledge.FilePath) == "" {
		return false
	}
	route, _, err := ParseSocialShareInput(payload.URL)
	if err != nil || route == nil {
		return false
	}
	payload.URL = ""
	payload.FilePath = knowledge.FilePath
	payload.FileName = knowledge.FileName
	payload.FileType = knowledge.FileType
	return true
}

// prepareTikHubArtifact recognizes a supported social work, makes the single
// provider fetch, and materializes its normalized result as a real file. Once
// it returns handled=true, payload.URL is empty, so the existing pipeline sees
// either an ordinary Markdown document or an ordinary video instead of sending
// the social page to WebParser.
func (s *knowledgeService) prepareTikHubArtifact(
	ctx context.Context,
	payload *types.DocumentProcessPayload,
	kb *types.KnowledgeBase,
	knowledge *types.Knowledge,
	eff types.EffectiveProcessConfig,
) (bool, []docparser.StoredImage, error) {
	if payload == nil || strings.TrimSpace(payload.URL) == "" {
		return false, nil, nil
	}

	route, _, err := ParseSocialShareInput(payload.URL)
	if err != nil {
		return true, nil, err
	}
	if route == nil {
		return false, nil, nil
	}
	if s.tikhubImporter == nil {
		return true, nil, errTikHubNotConfigured
	}

	result, err := s.tikhubImporter.Fetch(ctx, *route)
	if err != nil {
		return true, nil, fmt.Errorf("TikHub social import failed for %s: %w", route.Platform, err)
	}

	var content []byte
	var resolvedImages []docparser.StoredImage
	switch result.Kind {
	case tikhub.ResultDocument:
		markdown := strings.TrimSpace(result.Markdown)
		// Resolve provider images before saving the source Markdown. This keeps
		// expiring/signed CDN URLs out of the durable artifact and makes reparse
		// consume the stored copies instead of calling TikHub again.
		if s.imageResolver != nil && len(result.ImageURLs) > 0 {
			fileSvc := s.resolveFileService(ctx, kb)
			if fileSvc == nil {
				return true, nil, errors.New("social artifact storage is not configured")
			}
			updated, images, _ := s.imageResolver.ResolveRemoteImages(ctx, markdown, fileSvc, payload.TenantID)
			markdown = dropUnresolvedSocialImageLines(updated, result.ImageURLs)
			resolvedImages = images
		}
		content = []byte(markdown)
		if len(content) == 0 {
			return true, nil, errors.New("TikHub document response contained no content")
		}
		result.FileType = "md"
	case tikhub.ResultVideo:
		if !eff.VLMConfig.IsEnabled() {
			return true, nil, errors.New("social video import requires a configured VLM model")
		}
		if !socialVideoUploadAllowed(ctx) {
			return true, nil, errSocialVideoNotAllowed
		}
		content, err = downloadTikHubMedia(ctx, result.MediaURL, s.tikhubMediaClient)
		if err != nil {
			return true, nil, err
		}
		result.FileType = normalizeFileExtension(result.FileType)
		if !IsVideoType(result.FileType) {
			result.FileType = "mp4"
		}
	default:
		return true, nil, errors.New("TikHub response contained an unsupported content kind")
	}

	maxBytes := secutils.GetMaxFileSize()
	if int64(len(content)) > maxBytes {
		return true, nil, fmt.Errorf("social artifact exceeds the configured %d MB upload limit", secutils.GetMaxFileSizeMB())
	}
	fileName := tikHubArtifactFileName(*route, result)
	fileSvc := s.resolveFileService(ctx, kb)
	if fileSvc == nil {
		return true, nil, errors.New("social artifact storage is not configured")
	}
	// This file is the knowledge source and retry checkpoint, not scratch data.
	filePath, err := fileSvc.SaveBytes(ctx, content, payload.TenantID, fileName, false)
	if err != nil {
		return true, nil, fmt.Errorf("failed to persist social artifact: %w", err)
	}

	payload.URL = ""
	payload.FilePath = filePath
	payload.FileName = fileName
	payload.FileType = result.FileType
	knowledge.FilePath = filePath
	knowledge.FileName = fileName
	knowledge.FileType = result.FileType
	knowledge.FileSize = int64(len(content))
	if strings.TrimSpace(result.Title) != "" && (strings.TrimSpace(knowledge.Title) == "" || knowledge.Title == knowledge.Source) {
		knowledge.Title = strings.TrimSpace(result.Title)
	}
	if strings.TrimSpace(result.Description) != "" {
		knowledge.Description = strings.TrimSpace(result.Description)
	}
	knowledge.UpdatedAt = time.Now()
	if err := s.repo.UpdateKnowledge(ctx, knowledge); err != nil {
		_ = fileSvc.DeleteFile(ctx, filePath)
		return true, nil, fmt.Errorf("failed to persist social artifact state: %w", err)
	}
	return true, resolvedImages, nil
}

func dropUnresolvedSocialImageLines(markdown string, imageURLs []string) string {
	lines := strings.Split(markdown, "\n")
	kept := lines[:0]
	for _, line := range lines {
		drop := false
		for _, imageURL := range imageURLs {
			if imageURL != "" && strings.Contains(line, imageURL) {
				drop = true
				break
			}
		}
		if !drop {
			kept = append(kept, line)
		}
	}
	return strings.TrimSpace(strings.Join(kept, "\n"))
}

func socialVideoUploadAllowed(ctx context.Context) bool {
	tenant, ok := types.TenantInfoFromContext(ctx)
	if !ok || tenant == nil || tenant.Plan == "" {
		return true
	}
	return types.LimitsForConsumerPlan(types.EffectiveConsumerPlanAt(tenant, time.Now().UTC())).VideoUpload
}

func tikHubArtifactFileName(route tikhub.Route, result tikhub.Result) string {
	ext := normalizeFileExtension(result.FileType)
	if ext == "" {
		if result.Kind == tikhub.ResultDocument {
			ext = "md"
		} else {
			ext = "mp4"
		}
	}
	name := filepath.Base(strings.TrimSpace(result.FileName))
	if name == "" || name == "." || name == string(filepath.Separator) {
		id := strings.TrimSpace(route.ObjectID)
		if id == "" {
			id = "shared-work"
		}
		name = string(route.Platform) + "-" + id + "." + ext
	}
	name = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, name)
	name = strings.Trim(name, ".-")
	if name == "" {
		name = "social-work." + ext
	}
	if normalizeFileExtension(filepath.Ext(name)) == "" {
		name += "." + ext
	}
	return name
}

// downloadTikHubMedia intentionally uses a different HTTP client from the
// provider API client: the TikHub bearer token must never reach a returned CDN
// URL. In production (injectedClient == nil), every hop is validated by the
// repository's SSRF-safe dialer and redirect policy. Tests may inject a local
// transport to exercise the byte/materialization contract without public I/O.
func downloadTikHubMedia(ctx context.Context, mediaURL string, injectedClient *http.Client) ([]byte, error) {
	if strings.TrimSpace(mediaURL) == "" {
		return nil, errors.New("TikHub video response contained no media URL")
	}
	client := injectedClient
	if client == nil {
		if err := secutils.ValidateURLForSSRF(mediaURL); err != nil {
			return nil, errors.New("TikHub media URL failed security validation")
		}
		client = secutils.NewSSRFSafeHTTPClient(secutils.SSRFSafeHTTPClientConfig{
			Timeout:      60 * time.Second,
			MaxRedirects: 5,
		})
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return nil, errors.New("failed to create TikHub media request")
	}
	req.Header.Set("Accept", "video/*, application/octet-stream")
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("failed to fetch TikHub media")
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("TikHub media server returned HTTP %d", resp.StatusCode)
	}

	maxBytes := secutils.GetMaxFileSize()
	if resp.ContentLength > maxBytes {
		return nil, fmt.Errorf("social video exceeds the configured %d MB upload limit", secutils.GetMaxFileSizeMB())
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0]))
	if contentType != "" && !strings.HasPrefix(contentType, "video/") && contentType != "application/octet-stream" && contentType != "binary/octet-stream" {
		return nil, fmt.Errorf("TikHub media response has unsupported content type %q", contentType)
	}
	limited := &io.LimitedReader{R: resp.Body, N: maxBytes + 1}
	content, err := io.ReadAll(limited)
	if err != nil {
		return nil, errors.New("failed to read TikHub media")
	}
	if int64(len(content)) > maxBytes {
		return nil, fmt.Errorf("social video exceeds the configured %d MB upload limit", secutils.GetMaxFileSizeMB())
	}
	if len(content) == 0 {
		return nil, errors.New("TikHub media response was empty")
	}
	return content, nil
}
