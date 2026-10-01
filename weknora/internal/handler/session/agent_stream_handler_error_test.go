package session

import (
	"context"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/event"
	"github.com/Tencent/WeKnora/internal/models/openrouter"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/require"
)

type errorCaptureStreamManager struct {
	events []interfaces.StreamEvent
}

func (s *errorCaptureStreamManager) AppendEvent(_ context.Context, _, _ string, evt interfaces.StreamEvent) error {
	s.events = append(s.events, evt)
	return nil
}

func (s *errorCaptureStreamManager) GetEvents(context.Context, string, string, int) ([]interfaces.StreamEvent, int, error) {
	return nil, 0, nil
}

func TestAgentStreamErrorCarriesStableBillingCode(t *testing.T) {
	manager := &errorCaptureStreamManager{}
	h := NewAgentStreamHandler(
		context.Background(), "session", "assistant", "request", 1, time.Now(), nil, manager, event.NewEventBus(), nil,
	)

	err := h.handleError(context.Background(), event.Event{
		ID:        "error-event",
		Type:      event.EventError,
		SessionID: "session",
		Data: event.ErrorData{
			Error:     "billing confirmation pending",
			ErrorCode: openrouter.AllowanceRenewalPendingCode,
			Stage:     "agent_execution",
			SessionID: "session",
		},
	})
	require.NoError(t, err)
	require.Len(t, manager.events, 1)
	require.Equal(t, openrouter.AllowanceRenewalPendingCode, manager.events[0].Data["error_code"])
	require.Equal(t, "agent_execution", manager.events[0].Data["stage"])
}

func TestAgentStreamFailedSynthesisPersistsVisibleFailure(t *testing.T) {
	ctx := context.WithValue(t.Context(), types.LanguageContextKey, "zh-CN")
	manager := &errorCaptureStreamManager{}
	message := &types.Message{ID: "assistant"}
	h := NewAgentStreamHandler(
		ctx, "session", "assistant", "request", 1, time.Now(), message, manager, event.NewEventBus(), nil,
	)
	require.NoError(t, h.handleError(ctx, event.Event{
		ID: "error", Type: event.EventError,
		Data: event.ErrorData{
			Error: "final answer generation returned no visible content after recovery", Stage: "agent_execution",
		},
	}))
	require.NoError(t, h.handleComplete(ctx, event.Event{
		ID: "complete", Type: event.EventAgentComplete,
		Data: event.AgentCompleteData{MessageID: "assistant", TotalSteps: 50},
	}))
	require.Equal(
		t, "生成失败，请重试。", message.Content, "reloading a failed turn must not produce a blank answer",
	)
	require.True(t, message.IsFallback)
	require.True(t, message.IsCompleted, "the turn ended, although synthesis did not succeed")
	require.Len(t, manager.events, 2, "do not append a synthetic answer after the terminal error")
	require.Equal(t, types.ResponseTypeError, manager.events[0].Type)
	require.Equal(t, types.ResponseTypeComplete, manager.events[1].Type)
}
