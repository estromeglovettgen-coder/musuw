package service

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"strings"

	werrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/models/vlm"
	"github.com/Tencent/WeKnora/internal/types"
)

const videoUnderstandingPrompt = `<system_prompt>
You are a factual video understanding assistant. Convert the supplied video into searchable Markdown in the requested language.
</system_prompt>

<instructions>
1. Start with a concise title and summary.
2. Record important visual events in chronological order with timestamps when they can be determined.
3. Transcribe spoken content and visible on-screen text as accurately as possible.
4. Identify people, objects, actions, locations, and relationships only when supported by the video.
5. Do not invent missing details or output reasoning. Output Markdown only.
</instructions>`

func buildVideoUnderstandingPrompt(ctx context.Context, cfg types.VLMConfig) string {
	language := strings.TrimSpace(cfg.DescriptionLanguage)
	if language == "" {
		language = types.LanguageNameFromContext(ctx)
	}
	prompt := fmt.Sprintf("%s\n\n<output_language>%s</output_language>", videoUnderstandingPrompt, language)
	return types.AppendCustomPromptInstructions(prompt, cfg.CustomInstructions, "video_understanding")
}

func (s *knowledgeService) convertVideo(
	ctx context.Context,
	payload types.DocumentProcessPayload,
	kb *types.KnowledgeBase,
	knowledge *types.Knowledge,
	eff types.EffectiveProcessConfig,
	isLastRetry bool,
) (*types.ReadResult, error) {
	mimeType := videoMIMEType(payload.FileType)
	if mimeType == "" {
		return s.failKnowledge(ctx, knowledge, isLastRetry, "unsupported video type: %s", payload.FileType)
	}

	model, err := s.modelService.GetVLMModel(ctx, eff.VLMConfig.ModelID)
	if err != nil {
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "failed to load video model", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to load video model: %v", err)
	}

	fileService := s.resolveFileServiceForPath(ctx, kb, payload.FilePath)
	if fileService == nil {
		err := fmt.Errorf("video storage service is not configured")
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "failed to load video storage", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to load video storage: %v", err)
	}

	prompt := buildVideoUnderstandingPrompt(ctx, eff.VLMConfig)
	videoSource := "base64"
	var videoBytes []byte
	var markdown string

	// Object storage implementations can return a signed HTTP(S) URL. Pass it
	// directly to explicitly URL-capable OpenRouter models so large videos never
	// take the read-all -> Base64 path. A local:// URL is intentionally treated
	// as unavailable and falls back to the existing bounded inline path.
	if vlm.SupportsVideoURL(model) {
		videoURL, urlErr := fileService.GetFileURL(ctx, payload.FilePath)
		if urlErr == nil && isUsableVideoURL(videoURL) {
			videoSource = "url"
			markdown, err = vlm.PredictVideoURL(ctx, model, videoURL, mimeType, prompt)
		} else {
			if urlErr != nil {
				logger.Warnf(
					ctx,
					"[Video] URL transport unavailable for %s, falling back to inline video: %v",
					knowledge.ID,
					urlErr,
				)
			} else {
				logger.Warnf(
					ctx,
					"[Video] storage returned a non-HTTP URL for %s, falling back to inline video",
					knowledge.ID,
				)
			}
		}
	}

	if videoSource == "base64" {
		fileReader, readErr := fileService.GetFile(ctx, payload.FilePath)
		if readErr != nil {
			s.failStage(ctx, knowledge.ID, types.StageDocReader,
				werrors.ErrCodeDocReaderParseFailed, "failed to get video", readErr)
			return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to get video: %v", readErr)
		}
		// Keep the inline fallback bounded even when an object was uploaded with
		// the larger video limit. Reading one byte past the raw ceiling lets the
		// VLM return its precise encoded-size error without buffering a 300 MB
		// object that cannot be sent inline.
		videoBytes, err = io.ReadAll(io.LimitReader(fileReader, int64(vlm.MaxInlineVideoBytes)+1))
		closeErr := fileReader.Close()
		if err == nil {
			err = closeErr
		}
		if err != nil {
			s.failStage(ctx, knowledge.ID, types.StageDocReader,
				werrors.ErrCodeDocReaderParseFailed, "failed to read video", err)
			return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to read video: %v", err)
		}
		markdown, err = vlm.PredictVideo(ctx, model, videoBytes, mimeType, prompt)
	}

	if err != nil {
		logger.Errorf(ctx, "[Video] native understanding failed for %s: %v", knowledge.ID, err)
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "video understanding failed: "+err.Error(), err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "video understanding failed: %w", err)
	}
	markdown = strings.TrimSpace(markdown)
	if markdown == "" {
		err = fmt.Errorf("video understanding returned empty content")
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "video understanding returned empty content", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "video understanding returned empty content")
	}

	s.endStage(ctx, knowledge.ID, types.StageDocReader, types.JSONMap{
		"text_length":  len(markdown),
		"video_bytes":  len(videoBytes),
		"video_source": videoSource,
		"model":        model.GetModelName(),
	})
	return &types.ReadResult{
		MarkdownContent: markdown,
		Metadata: map[string]string{
			"source_type":      "video",
			"video_model":      model.GetModelName(),
			"video_input_mode": videoSource,
		},
	}, nil
}

func isUsableVideoURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	return err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}
