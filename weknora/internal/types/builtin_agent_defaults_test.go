package types

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestBuiltinQuickAnswerUsesManagedV4FlashDefaults(t *testing.T) {
	configPath := filepath.Join("..", "..", "config", "builtin_agents.yaml")
	data, err := os.ReadFile(configPath)
	require.NoError(t, err)

	var file builtinAgentsFile
	require.NoError(t, yaml.Unmarshal(data, &file))

	var quick *BuiltinAgentEntry
	for i := range file.BuiltinAgents {
		if file.BuiltinAgents[i].ID == BuiltinQuickAnswerID {
			quick = &file.BuiltinAgents[i]
			break
		}
	}
	require.NotNil(t, quick)

	for locale, localized := range quick.I18n {
		assert.Equalf(t, "V4 Flash", localized.Name, "locale %s must expose the managed quick mode name", locale)
	}

	cfg := quick.Config
	assert.Equal(t, AgentModeQuickAnswer, cfg.AgentMode)
	assert.Equal(t, "builtin-deepseek-v4-flash", cfg.ModelID)
	assert.Equal(t, "builtin-deepseek-v4-flash", cfg.QueryUnderstandModelID)
	require.NotNil(t, cfg.Thinking)
	assert.False(t, *cfg.Thinking)

	assert.Equal(t, "default_kb", cfg.SystemPromptID)
	assert.Empty(t, cfg.SystemPrompt, "the existing prompt template must be referenced, not copied into builtin_agents.yaml")

	assert.True(t, cfg.MultiTurnEnabled)
	assert.Equal(t, 20, cfg.HistoryTurns)

	assert.True(t, cfg.WebSearchEnabled)
	assert.Equal(t, 5, cfg.WebSearchMaxResults)
	assert.True(t, cfg.WebFetchEnabled)
	assert.Equal(t, 2, cfg.WebFetchTopN)

	assert.True(t, cfg.EnableQueryExpansion)
	assert.Equal(t, 10, cfg.EmbeddingTopK)
	assert.InDelta(t, 0.30, cfg.KeywordThreshold, 0.0001)
	assert.InDelta(t, 0.50, cfg.VectorThreshold, 0.0001)

	assert.True(t, cfg.ImageUploadEnabled)
	assert.True(t, cfg.AudioUploadEnabled)
	assert.True(t, cfg.AttachmentImageUnderstanding)
	assert.Equal(t, "builtin-openrouter-vlm", cfg.VLMModelID)
	assert.Equal(t, "builtin-openrouter-asr", cfg.ASRModelID)
	require.NotNil(t, cfg.CitationEnabled)
	assert.True(t, *cfg.CitationEnabled)
}

func TestBuiltinQuickAnswerPromptReferenceExists(t *testing.T) {
	promptPath := filepath.Join("..", "..", "config", "prompt_templates", "agent_system_prompt.yaml")
	data, err := os.ReadFile(promptPath)
	require.NoError(t, err)

	var file struct {
		Templates []struct {
			ID   string `yaml:"id"`
			Mode string `yaml:"mode"`
			I18n map[string]struct {
				Name string `yaml:"name"`
			} `yaml:"i18n"`
			Content string `yaml:"content"`
		} `yaml:"templates"`
	}
	require.NoError(t, yaml.Unmarshal(data, &file))

	for _, template := range file.Templates {
		if template.ID != "hybrid_rag_wiki_agent" {
			continue
		}
		assert.Equal(t, "smart-reasoning", template.Mode)
		assert.Equal(t, "Wiki + RAG 混合智能体", template.I18n["zh-CN"].Name)
		assert.NotEmpty(t, template.Content)
		return
	}
	t.Fatal("hybrid_rag_wiki_agent prompt template not found")
}

func TestBuiltinSmartReasoningEnablesV4ProFullToolAccess(t *testing.T) {
	configPath := filepath.Join("..", "..", "config", "builtin_agents.yaml")
	data, err := os.ReadFile(configPath)
	require.NoError(t, err)

	var file builtinAgentsFile
	require.NoError(t, yaml.Unmarshal(data, &file))

	var smart *BuiltinAgentEntry
	for i := range file.BuiltinAgents {
		if file.BuiltinAgents[i].ID == BuiltinSmartReasoningID {
			smart = &file.BuiltinAgents[i]
			break
		}
	}
	require.NotNil(t, smart)
	for locale, localized := range smart.I18n {
		assert.Equalf(t, "V4 Pro", localized.Name, "locale %s must expose the managed pro mode name", locale)
	}

	cfg := smart.Config
	assert.Equal(t, AgentModeSmartReasoning, cfg.AgentMode)
	assert.Equal(t, "builtin-deepseek-v4-pro", cfg.ModelID)
	assert.Equal(t, "builtin-deepseek-v4-pro", cfg.QueryUnderstandModelID)
	require.NotNil(t, cfg.Thinking)
	assert.True(t, *cfg.Thinking)
	assert.Equal(t, "hybrid_rag_wiki_agent", cfg.SystemPromptID)
	assert.Empty(t, cfg.SystemPrompt)
	require.NotNil(t, cfg.CitationEnabled)
	assert.True(t, *cfg.CitationEnabled)
	assert.True(t, cfg.WebSearchEnabled)
	assert.Equal(t, 5, cfg.WebSearchMaxResults)
	assert.True(t, cfg.WebFetchEnabled)
	assert.Equal(t, 2, cfg.WebFetchTopN)
	assert.Equal(t, "all", cfg.MCPSelectionMode)
	assert.Equal(t, "all", cfg.SkillsSelectionMode)
	assert.True(t, cfg.ImageUploadEnabled)
	assert.True(t, cfg.AudioUploadEnabled)
	assert.True(t, cfg.AttachmentImageUnderstanding)
	assert.Equal(t, "builtin-openrouter-vlm", cfg.VLMModelID)
	assert.Equal(t, "builtin-openrouter-asr", cfg.ASRModelID)

	for _, tool := range []string{
		"thinking", "todo_write",
		"knowledge_search", "grep_chunks", "list_knowledge_chunks",
		"query_knowledge_graph", "get_document_info", "database_query",
		"data_analysis", "data_schema",
		"wiki_search", "wiki_read_page", "wiki_read_source_doc", "wiki_read_issue",
	} {
		assert.Contains(t, smart.Config.AllowedTools, tool)
	}
	for _, writeTool := range []string{
		"wiki_flag_issue", "wiki_update_issue", "wiki_write_page",
		"wiki_replace_text", "wiki_rename_page", "wiki_delete_page",
	} {
		assert.Contains(t, cfg.AllowedTools, writeTool)
	}
	assert.NotContains(t, cfg.AllowedTools, "execute_skill_script", "skill scripts are enabled by skills_selection_mode, not the regular tool whitelist")
}
