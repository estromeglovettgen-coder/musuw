package session

import (
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/require"
)

func TestPlatformTitleResolvedInServiceOnlyForPlatformModes(t *testing.T) {
	tests := []struct {
		name  string
		mode  qaMode
		agent *types.CustomAgent
		want  bool
	}{
		{name: "normal platform", mode: qaModeNormal, want: true},
		{name: "agent platform smart", mode: qaModeAgent, agent: &types.CustomAgent{ID: types.BuiltinSmartReasoningID}, want: true},
		{name: "agent platform quick", mode: qaModeAgent, agent: &types.CustomAgent{ID: types.BuiltinQuickAnswerID}, want: true},
		{name: "normal custom agent", mode: qaModeNormal, agent: &types.CustomAgent{ID: "custom-quick-looking"}, want: false},
		{name: "agent custom", mode: qaModeAgent, agent: &types.CustomAgent{ID: "custom-agent"}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, platformTitleResolvedInService(tt.mode, tt.agent))
		})
	}
}
