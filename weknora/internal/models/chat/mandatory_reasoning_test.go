package chat

import (
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Custom agents and background consumers still pass legacy Thinking=false.
// Exercise the saved-model factory and the final request, not just a strategy
// constructed by the test: the model capability must survive both boundaries.
func TestSavedOpenRouterModelPreservesMandatoryReasoning(t *testing.T) {
	cases := []struct {
		name      string
		mandatory bool
		opts      *ChatOptions
		want      string
	}{
		{"mandatory legacy off uses configured minimum", true, &ChatOptions{Thinking: ptrBool(false)}, "low"},
		{"mandatory explicit none uses configured minimum", true, &ChatOptions{ReasoningEffort: "none"}, "low"},
		{"mandatory normalized none uses configured minimum", true, &ChatOptions{ReasoningEffort: " NONE "}, "low"},
		{"mandatory absent options uses configured minimum", true, nil, "low"},
		{"mandatory empty options uses configured minimum", true, &ChatOptions{}, "low"},
		{
			"explicit effort wins over legacy off", true,
			&ChatOptions{Thinking: ptrBool(false), ReasoningEffort: "low"}, "low",
		},
		{"mandatory legacy on remains enabled", true, &ChatOptions{Thinking: ptrBool(true)}, "low"},
		{"optional default is the configured minimum", false, &ChatOptions{}, "low"},
		{"optional enabled is the configured minimum", false, &ChatOptions{Thinking: ptrBool(true)}, "low"},
		{"optional legacy off remains disabled", false, &ChatOptions{Thinking: ptrBool(false)}, "none"},
		{"optional explicit none remains disabled", false, &ChatOptions{ReasoningEffort: "none"}, "none"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			model := &types.Model{
				ID: "saved-reasoning-model", Name: "openai/gpt-6-astra", Source: types.ModelSourceRemote,
				Parameters: types.ModelParameters{
					Provider: "openrouter",
					Reasoning: types.ReasoningParameters{
						Supported: true, Mandatory: tc.mandatory, DefaultEffort: "low",
					},
				},
			}
			client, err := NewRemoteAPIChat(ConfigFromModel(model, "", ""))
			require.NoError(t, err)
			var original ChatOptions
			if tc.opts != nil {
				original = *tc.opts
			}
			for _, stream := range []bool{false, true} {
				body, _, _, err := client.buildOutbound([]Message{{Role: "user", Content: "reply OK"}}, tc.opts, stream)
				require.NoError(t, err)
				request, ok := body.(map[string]any)
				require.True(t, ok)
				if tc.want == "" {
					assert.NotContains(t, request, "reasoning", "use the mandatory model's own default")
				} else {
					assert.Equal(t, map[string]any{"effort": tc.want}, request["reasoning"])
				}
				if tc.opts != nil {
					assert.Equal(t, original, *tc.opts, "shared caller options must not be mutated")
				}
			}
		})
	}
}
