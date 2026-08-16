package session

import (
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildQARequestCarriesExplicitThinkingOverride(t *testing.T) {
	disabled := false
	req := (&qaRequestContext{
		thinking:         &disabled,
		assistantMessage: &types.Message{},
	}).buildQARequest()

	require.NotNil(t, req.Thinking)
	assert.False(t, *req.Thinking)
}
