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
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	secutils "github.com/Tencent/WeKnora/internal/utils"
)

var (
	errTikHubNotConfigured   = errors.New("TikHub social import is not configured")
	errSocialVideoNotAllowed = errors.New("current plan does not support social video import")
)

func cleanupTikHubResolvedImages(ctx context.Context, fileSvc interfaces.FileService, images []docparser.StoredImage) {
	if fileSvc == nil {
		return
	}
	for _, image := range images {
		if imagePath := strings.TrimSpace(image.ServingURL); imagePath != "" {
			if deleteErr := fileSvc.DeleteFile(ctx, imagePath); deleteErr != nil {
				logger.Warnf(ctx, "Failed to clean social image after source materialization failure, path: %s, error: %v", imagePath, deleteErr)
			}
		}
	}
}

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
	var media *tikHubMediaStream
	var resolvedImages []docparser.StoredImage
	// ResolveRemoteImages can persist image copies before the source artifact
	// itself is admitted. Keep one compensation hook in scope for every
	// post-resolution, pre-claim exit (empty content, size limit, storage
	// lookup/save failure, and the source claim branches below).
	cleanupResolvedImages := func() {}
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
			cleanupResolvedImages = func() {
				cleanupTikHubResolvedImages(ctx, fileSvc, resolvedImages)
			}
			updated, images, _ := s.imageResolver.ResolveRemoteImages(ctx, markdown, fileSvc, payload.TenantID)
			markdown = dropUnresolvedSocialImageLines(updated, result.ImageURLs)
			resolvedImages = images
		}
		content = []byte(markdown)
		if len(content) == 0 {
			cleanupResolvedImages()
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
		media, err = downloadTikHubMedia(ctx, result.MediaURL, s.tikhubMediaClient)
		if err != nil {
			return true, nil, err
		}
		defer func() {
			if closeErr := media.Close(); closeErr != nil {
				logger.Warnf(ctx, "Failed to close TikHub media stream: %v", closeErr)
			}
		}()
		result.FileType = normalizeFileExtension(result.FileType)
		if !IsVideoType(result.FileType) {
			result.FileType = "mp4"
		}
	default:
		return true, nil, errors.New("TikHub response contained an unsupported content kind")
	}

	maxBytes := secutils.GetMaxFileSize()
	if result.Kind == tikhub.ResultVideo {
		maxBytes = secutils.GetMaxVideoFileSizeBytes()
	}
	if media == nil && int64(len(content)) > maxBytes {
		cleanupResolvedImages()
		if result.Kind == tikhub.ResultVideo {
			return true, nil, fmt.Errorf("social video exceeds the configured %d byte upload limit", maxBytes)
		}
		return true, nil, fmt.Errorf("social artifact exceeds the configured %d MB upload limit", secutils.GetMaxFileSizeMB())
	}
	fileName := tikHubArtifactFileName(*route, result)
	fileSvc := s.resolveFileService(ctx, kb)
	if fileSvc == nil {
		cleanupResolvedImages()
		return true, nil, errors.New("social artifact storage is not configured")
	}
	// This file is the knowledge source and retry checkpoint, not scratch data.
	var filePath string
	var fileSize int64
	if media != nil {
		streamer, ok := fileSvc.(interfaces.StreamingFileService)
		if !ok {
			cleanupResolvedImages()
			return true, nil, errors.New("social video storage backend does not support streaming uploads")
		}
		filePath, err = streamer.SaveReader(
			ctx,
			media,
			media.contentLength,
			payload.TenantID,
			fileName,
			media.contentType,
			false,
		)
		if err != nil {
			if strings.TrimSpace(filePath) != "" {
				_ = fileSvc.DeleteFile(ctx, filePath)
			}
			cleanupResolvedImages()
			return true, nil, fmt.Errorf("failed to persist social artifact: %w", err)
		}
		fileSize = media.bytesRead
		if fileSize == 0 {
			if deleteErr := fileSvc.DeleteFile(ctx, filePath); deleteErr != nil {
				logger.Warnf(ctx, "Failed to clean empty social video, path: %s, error: %v", filePath, deleteErr)
			}
			cleanupResolvedImages()
			return true, nil, errors.New("TikHub media response was empty")
		}
		if fileSize > maxBytes {
			if deleteErr := fileSvc.DeleteFile(ctx, filePath); deleteErr != nil {
				logger.Warnf(ctx, "Failed to clean oversized social video, path: %s, error: %v", filePath, deleteErr)
			}
			cleanupResolvedImages()
			return true, nil, fmt.Errorf("social video exceeds the configured %d byte upload limit", maxBytes)
		}
	} else {
		fileSize = int64(len(content))
		filePath, err = fileSvc.SaveBytes(ctx, content, payload.TenantID, fileName, false)
	}
	if err != nil {
		cleanupResolvedImages()
		return true, nil, fmt.Errorf("failed to persist social artifact: %w", err)
	}

	// Build a copy so a failed paired row/counter mutation cannot publish a
	// path to an object that we immediately delete. The caller only receives
	// the materialized payload after the database and tenant usage commit.
	updatedKnowledge := new(types.Knowledge)
	*updatedKnowledge = *knowledge
	updatedKnowledge.FilePath = filePath
	updatedKnowledge.FileName = fileName
	updatedKnowledge.FileType = result.FileType
	updatedKnowledge.FileSize = fileSize
	if strings.TrimSpace(result.Title) != "" && (strings.TrimSpace(knowledge.Title) == "" || knowledge.Title == knowledge.Source) {
		updatedKnowledge.Title = strings.TrimSpace(result.Title)
	}
	if strings.TrimSpace(result.Description) != "" {
		updatedKnowledge.Description = strings.TrimSpace(result.Description)
	}
	updatedKnowledge.UpdatedAt = time.Now()
	tenantInfo, _ := types.TenantInfoFromContext(ctx)
	storageQuota := effectiveStorageQuota(tenantInfo, time.Now().UTC())
	currentKnowledge, claimed, claimErr := s.repo.ClaimKnowledgeSourceWithStorage(ctx, updatedKnowledge, storageQuota)
	if claimErr != nil {
		if deleteErr := fileSvc.DeleteFile(ctx, filePath); deleteErr != nil {
			logger.Warnf(ctx, "Failed to clean social artifact after source claim failure, path: %s, error: %v", filePath, deleteErr)
		}
		cleanupResolvedImages()
		return true, nil, fmt.Errorf("failed to persist social artifact state: %w", claimErr)
	}
	if currentKnowledge == nil {
		if deleteErr := fileSvc.DeleteFile(ctx, filePath); deleteErr != nil {
			logger.Warnf(ctx, "Failed to clean social artifact after empty source claim, path: %s, error: %v", filePath, deleteErr)
		}
		cleanupResolvedImages()
		return true, nil, errors.New("social artifact source claim returned no knowledge")
	}
	if !claimed && filePath != currentKnowledge.FilePath {
		if deleteErr := fileSvc.DeleteFile(ctx, filePath); deleteErr != nil {
			logger.Warnf(ctx, "Failed to clean losing social artifact, path: %s, winner: %s, error: %v", filePath, currentKnowledge.FilePath, deleteErr)
		}
		cleanupResolvedImages()
	}

	*knowledge = *currentKnowledge
	payload.URL = ""
	payload.FilePath = currentKnowledge.FilePath
	payload.FileName = currentKnowledge.FileName
	payload.FileType = currentKnowledge.FileType
	if currentKnowledge.ParseStatus == types.ParseStatusCancelled || currentKnowledge.ParseStatus == types.ParseStatusDeleting {
		// The source claim is durable and already accounted. Stop this stale
		// worker before it can send the winner through conversion/indexing; the
		// cancellation/deletion lifecycle owns the persisted row from here. The
		// source artifact is retained for that lifecycle, while image copies have
		// no chunk ImageInfo yet and must be released now.
		cleanupResolvedImages()
		return true, nil, nil
	}
	if !claimed {
		// A losing worker's image copies are not part of the winner's source
		// artifact. Returning them would enqueue multimodal work against objects
		// that this worker just discarded (or that belong to another checkpoint).
		return true, nil, nil
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
type tikHubMediaStream struct {
	reader        *io.LimitedReader
	closer        io.Closer
	contentLength int64
	contentType   string
	bytesRead     int64
}

func (s *tikHubMediaStream) Read(p []byte) (int, error) {
	n, err := s.reader.Read(p)
	if n > 0 {
		s.bytesRead += int64(n)
	}
	return n, err
}

func (s *tikHubMediaStream) Close() error {
	if s == nil || s.closer == nil {
		return nil
	}
	return s.closer.Close()
}

func downloadTikHubMedia(
	ctx context.Context,
	mediaURL string,
	injectedClient *http.Client,
) (*tikHubMediaStream, error) {
	if strings.TrimSpace(mediaURL) == "" {
		return nil, errors.New("TikHub video response contained no media URL")
	}
	client := injectedClient
	if client == nil {
		if err := secutils.ValidateURLForSSRF(mediaURL); err != nil {
			return nil, errors.New("TikHub media URL failed security validation")
		}
		client = secutils.NewSSRFSafeHTTPClient(secutils.SSRFSafeHTTPClientConfig{
			// A 300 MB video cannot reliably finish inside the old 60-second
			// whole-request timeout on ordinary uplinks. Keep one bounded timeout
			// below the document-processing deadline without introducing a custom
			// downloader or resumable-download state machine.
			Timeout:      10 * time.Minute,
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
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("TikHub media server returned HTTP %d", resp.StatusCode)
	}

	maxBytes := secutils.GetMaxVideoFileSizeBytes()
	if resp.ContentLength > maxBytes {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("social video exceeds the configured %d byte upload limit", maxBytes)
	}
	contentType := strings.ToLower(
		strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0]),
	)
	if contentType != "" &&
		!strings.HasPrefix(contentType, "video/") &&
		contentType != "application/octet-stream" &&
		contentType != "binary/octet-stream" {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("TikHub media response has unsupported content type %q", contentType)
	}
	return &tikHubMediaStream{
		reader: &io.LimitedReader{R: resp.Body, N: maxBytes + 1},
		closer: resp.Body,
		// Do not forward a remote Content-Length as the storage request length.
		// A CDN can lie or truncate that header; -1 forces providers to consume
		// the bounded reader so the post-copy byte count remains authoritative.
		contentLength: -1,
		contentType:   contentType,
	}, nil
}
