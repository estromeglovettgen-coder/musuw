package service

import (
	"context"
	"fmt"
	"io"
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

	fileReader, err := s.resolveFileServiceForPath(ctx, kb, payload.FilePath).GetFile(ctx, payload.FilePath)
	if err != nil {
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "failed to get video", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to get video: %v", err)
	}
	defer fileReader.Close()
	videoBytes, err := io.ReadAll(fileReader)
	if err != nil {
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "failed to read video", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to read video: %v", err)
	}

	model, err := s.modelService.GetVLMModel(ctx, eff.VLMConfig.ModelID)
	if err != nil {
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "failed to load video model", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "failed to load video model: %v", err)
	}

	markdown, err := vlm.PredictVideo(ctx, model, videoBytes, mimeType, buildVideoUnderstandingPrompt(ctx, eff.VLMConfig))
	if err != nil {
		logger.Errorf(ctx, "[Video] native understanding failed for %s: %v", knowledge.ID, err)
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "video understanding failed: "+err.Error(), err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "video understanding failed: %v", err)
	}
	markdown = strings.TrimSpace(markdown)
	if markdown == "" {
		err = fmt.Errorf("video understanding returned empty content")
		s.failStage(ctx, knowledge.ID, types.StageDocReader,
			werrors.ErrCodeDocReaderParseFailed, "video understanding returned empty content", err)
		return s.failKnowledge(ctx, knowledge, isLastRetry, "video understanding returned empty content")
	}

	s.endStage(ctx, knowledge.ID, types.StageDocReader, types.JSONMap{
		"text_length": len(markdown),
		"video_bytes": len(videoBytes),
		"model":       model.GetModelName(),
	})
	return &types.ReadResult{
		MarkdownContent: markdown,
		Metadata: map[string]string{
			"source_type": "video",
			"video_model": model.GetModelName(),
		},
	}, nil
}
