package config

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestPromptTemplatesUseMusuwBranding(t *testing.T) {
	templates, err := loadPromptTemplates(filepath.Join("..", "..", "config"))
	if err != nil {
		t.Fatalf("load prompt templates: %v", err)
	}

	groups := [][]PromptTemplate{
		templates.SystemPrompt,
		templates.ContextTemplate,
		templates.Rewrite,
		templates.Fallback,
		templates.GenerateSessionTitle,
		templates.GenerateSummary,
		templates.KeywordsExtraction,
		templates.AgentSystemPrompt,
		templates.GraphExtraction,
		templates.GenerateQuestions,
		templates.IntentPrompts,
	}

	foundMusuw, foundDidiRen := false, false
	for _, group := range groups {
		for _, template := range group {
			if strings.Contains(strings.ToLower(template.Content), "weknora") || strings.Contains(strings.ToLower(template.Content), "tencent") || strings.Contains(template.Content, "腾讯") {
				t.Fatalf("template %q still contains legacy branding", template.ID)
			}
			foundMusuw = foundMusuw || strings.Contains(template.Content, "Musuw")
			foundDidiRen = foundDidiRen || strings.Contains(template.Content, "地底人")
		}
	}
	if !foundMusuw || !foundDidiRen {
		t.Fatalf("prompt templates must identify the product as Musuw by 地底人; foundMusuw=%v foundDidiRen=%v", foundMusuw, foundDidiRen)
	}
}
