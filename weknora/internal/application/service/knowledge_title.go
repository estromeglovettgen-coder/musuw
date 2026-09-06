package service

import (
	"context"
	"errors"
	"strings"

	"github.com/Tencent/WeKnora/internal/types"
)

// conciseAnalysisTitle normalizes a title that came from an existing parser or
// model analysis result. Video analysis already emits a Markdown heading, so
// this helper only extracts and bounds that heading; it never calls an LLM.
func conciseAnalysisTitle(raw string) string {
	title := strings.TrimSpace(raw)
	if title == "" {
		return ""
	}
	if strings.ContainsAny(title, "\r\n") {
		title = firstMarkdownTitle(title)
	}
	title = strings.Join(strings.Fields(title), " ")
	title = strings.TrimSpace(strings.Trim(title, "\"'#*`“”‘’"))
	if title == "" {
		return ""
	}
	if clean, rejected := sanitizeGeneratedTitle(title); !rejected {
		return clean
	}
	// Do not turn a URL or Markdown link into a knowledge title. This also
	// protects the caller when a parser accidentally echoes the source URL.
	lower := strings.ToLower(title)
	if strings.Contains(lower, "http://") ||
		strings.Contains(lower, "https://") ||
		strings.Contains(lower, "www.") ||
		strings.Contains(title, "](") {
		return ""
	}
	runes := []rune(title)
	if len(runes) > maxSessionTitleRunes {
		return string(runes[:maxSessionTitleRunes-1]) + "…"
	}
	return ""
}

func automaticURLKnowledgeTitle(knowledge *types.Knowledge) bool {
	if knowledge == nil || !strings.EqualFold(strings.TrimSpace(knowledge.Type), "url") {
		return false
	}
	source := strings.TrimSpace(knowledge.Source)
	if source == "" {
		return false
	}
	title := strings.TrimSpace(knowledge.Title)
	return title == "" || title == source
}

// updateKnowledgeTitleFromAnalysis converges an automatically titled URL
// knowledge row onto the title already present in a parser/VLM result. The
// repository evaluates the source/title guard in the UPDATE itself so a manual
// rename that landed while parsing is preserved.
func (s *knowledgeService) updateKnowledgeTitleFromAnalysis(
	ctx context.Context,
	knowledge *types.Knowledge,
	result *types.ReadResult,
) error {
	if !automaticURLKnowledgeTitle(knowledge) || result == nil {
		return nil
	}
	candidate := ""
	if result.Metadata != nil {
		candidate = result.Metadata["title"]
	}
	if strings.TrimSpace(candidate) == "" {
		candidate = firstMarkdownTitle(result.MarkdownContent)
	}
	candidate = conciseAnalysisTitle(candidate)
	if candidate == "" ||
		candidate == strings.TrimSpace(knowledge.Title) ||
		candidate == strings.TrimSpace(knowledge.Source) {
		return nil
	}
	if s == nil || s.repo == nil {
		return errors.New("knowledge title repository is not configured")
	}
	updated, err := s.repo.UpdateURLKnowledgeTitleIfAutomatic(
		ctx,
		knowledge.TenantID,
		knowledge.ID,
		knowledge.Source,
		candidate,
	)
	if err != nil {
		return err
	}
	if updated {
		knowledge.Title = candidate
	}
	return nil
}
