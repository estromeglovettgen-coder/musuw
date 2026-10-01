package agent

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/Tencent/WeKnora/internal/event"
	"github.com/Tencent/WeKnora/internal/models/chat"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/require"
)

// The external model request must reserve enough output to finish the answer,
// even when the saved results of a 50-round run no longer fit in the window.
// Exercise the real terminal loop and its streamed/persisted completion data.
func TestExecuteLoop_FinalSynthesisReservesOutputWithLongToolHistory(t *testing.T) {
	const answer = "根据已检索资料整理的答案。"
	model := &mockChat{responses: []mockResponse{{chunks: []types.StreamResponse{{
		ResponseType: types.ResponseTypeAnswer, Content: answer, Done: true, FinishReason: "stop",
	}}}}}
	engine := newTestEngine(t, model, withMaxIterations(50), func(cfg *types.AgentConfig) {
		cfg.MaxContextTokens = 24_000
	})
	state := &types.AgentState{CurrentRound: 50}
	for i := 0; i < 50; i++ {
		state.RoundSteps = append(state.RoundSteps, types.AgentStep{
			Iteration: i,
			ToolCalls: []types.ToolCall{{
				ID: fmt.Sprintf("lookup-%d", i), Name: "test_lookup",
				Result: &types.ToolResult{Success: true, Output: strings.Repeat("早期检索资料内容。", 1500)},
			}},
		})
	}
	const latestFact = "Latest verified fact: the project starts on Friday."
	state.RoundSteps[49].ToolCalls[0].Result.Output = latestFact
	original := state.RoundSteps[0].ToolCalls[0].Result.Output
	var streamed strings.Builder
	var completed []event.AgentCompleteData
	engine.eventBus.On(event.EventAgentFinalAnswer, func(_ context.Context, evt event.Event) error {
		streamed.WriteString(evt.Data.(event.AgentFinalAnswerData).Content)
		return nil
	})
	engine.eventBus.On(event.EventAgentComplete, func(_ context.Context, evt event.Event) error {
		completed = append(completed, evt.Data.(event.AgentCompleteData))
		return nil
	})

	result, err := engine.executeLoop(
		t.Context(), state, "请根据资料整理项目安排", emptyMessages(), nil, "session", "message",
	)
	require.NoError(t, err)
	require.Len(t, model.opts, 1)
	require.Equal(t, 4096, model.opts[0].MaxCompletionTokens, "input size must not starve final answer output")
	require.LessOrEqual(
		t, engine.tokenEstimator.EstimateMessages(
			model.calls[0],
		)+model.opts[0].MaxCompletionTokens+4096, 24_000,
	)
	require.Contains(t, fmt.Sprint(model.calls[0]), latestFact, "retain the newest retrieved evidence")
	require.Contains(
		t, fmt.Sprint(
			model.calls[0],
		), "请根据资料整理项目安排", "never truncate the user's request",
	)
	require.Equal(
		t, original, state.RoundSteps[0].ToolCalls[0].Result.Output, "compaction must not mutate saved tool results",
	)
	require.True(t, result.IsComplete)
	require.Equal(t, answer, result.FinalAnswer)
	require.Equal(t, answer, streamed.String())
	require.Len(t, completed, 1)
	require.Equal(t, answer, completed[0].FinalAnswer)
	require.Equal(t, 50, completed[0].TotalSteps)
}

func TestExecuteLoop_FinalSynthesisRecoversFromReasoningOnly(t *testing.T) {
	model := &mockChat{responses: []mockResponse{
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeThinking, Content: "reasoning only", Done: true,
				},
			},
		},
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeAnswer, Content: "Recovered final answer.", Done: true,
				},
			},
		},
	}}
	engine := newTestEngine(t, model, withMaxIterations(1))
	var answer strings.Builder
	engine.eventBus.On(event.EventAgentFinalAnswer, func(_ context.Context, evt event.Event) error {
		answer.WriteString(evt.Data.(event.AgentFinalAnswerData).Content)
		return nil
	})
	state, err := engine.executeLoop(
		t.Context(), &types.AgentState{
			CurrentRound: 1,
		}, "question", emptyMessages(), nil, "session", "message",
	)
	require.NoError(t, err)
	require.True(t, state.IsComplete)
	require.Equal(t, "Recovered final answer.", state.FinalAnswer)
	require.Equal(t, state.FinalAnswer, answer.String())
	require.Len(t, model.opts, 2)
	require.NotNil(t, model.opts[1].Thinking)
	require.False(t, *model.opts[1].Thinking, "empty synthesis recovery must request visible answer text")
}

func TestExecuteLoop_FinalSynthesisEmptyFailsBeforeCompletion(t *testing.T) {
	response := mockResponse{
		chunks: []types.StreamResponse{
			{
				ResponseType: types.ResponseTypeThinking, Content: "reasoning only", Done: true,
			},
		},
	}
	model := &mockChat{responses: []mockResponse{response, response}}
	engine := newTestEngine(t, model, withMaxIterations(1))
	var terminal []event.EventType
	for _, kind := range []event.EventType{event.EventError, event.EventAgentComplete} {
		engine.eventBus.On(kind, func(_ context.Context, evt event.Event) error {
			terminal = append(terminal, evt.Type)
			return nil
		})
	}
	state, err := engine.executeLoop(
		t.Context(), &types.AgentState{
			CurrentRound: 1,
		}, "question", emptyMessages(), nil, "session", "message",
	)
	require.Error(t, err, "empty synthesis is not successful completion")
	require.False(t, state.IsComplete)
	require.Equal(
		t, []event.EventType{
			event.EventError, event.EventAgentComplete,
		}, terminal, "failure must reach the stream before its terminal completion",
	)
	require.Len(t, model.opts, 2, "only one empty-answer recovery attempt is allowed")
}

func TestExecuteLoop_DegradedSynthesisCannotSucceedWithEmptyAnswer(t *testing.T) {
	response := mockResponse{
		chunks: []types.StreamResponse{
			{
				ResponseType: types.ResponseTypeThinking, Content: "reasoning only", Done: true,
			},
		},
	}
	model := &mockChat{responses: []mockResponse{
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeError, Content: "provider rejected the request", Done: true,
				},
			},
		},
		response, response,
	}}
	engine := newTestEngine(t, model, withMaxIterations(50))
	state := &types.AgentState{CurrentRound: 1, RoundSteps: []types.AgentStep{{
		Iteration: 0, ToolCalls: []types.ToolCall{
			{
				Name: "test_lookup", Result: &types.ToolResult{
					Success: true, Output: "retrieved evidence",
				},
			},
		},
	}}}
	result, err := engine.executeLoop(t.Context(), state, "question", emptyMessages(), nil, "session", "message")
	require.ErrorContains(t, err, "synthesis also failed")
	require.False(t, result.IsComplete)
	require.Len(t, result.RoundSteps, 1, "retain the work already performed")
}

func TestFinalSynthesisReviewInlineThinkingRecoveryDoesNotPolluteStream(t *testing.T) {
	model := &mockChat{responses: []mockResponse{
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeAnswer, Content: "<thi",
				}, {
					ResponseType: types.ResponseTypeAnswer, Content: "nk>private reasoning</think>", Done: true,
				},
			},
		},
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeAnswer, Content: "Recovered visible answer.", Done: true,
				},
			},
		},
	}}
	engine := newTestEngine(t, model, withMaxIterations(1))
	var live strings.Builder
	engine.eventBus.On(event.EventAgentFinalAnswer, func(_ context.Context, evt event.Event) error {
		live.WriteString(evt.Data.(event.AgentFinalAnswerData).Content)
		return nil
	})
	state, err := engine.executeLoop(
		t.Context(), &types.AgentState{
			CurrentRound: 1,
		}, "question", emptyMessages(), nil, "session", "message",
	)
	require.NoError(t, err)
	require.Equal(t, "Recovered visible answer.", state.FinalAnswer)
	require.Equal(t, state.FinalAnswer, live.String(), "streamed and saved visible answer must agree")
}

type finalSynthesisCancelChat struct {
	*mockChat
	cancel   context.CancelFunc
	attempts int
}

func (m *finalSynthesisCancelChat) ChatStream(
	ctx context.Context, _ []chat.Message, _ *chat.ChatOptions,
) (<-chan types.StreamResponse, error) {
	m.attempts++
	if m.attempts == 1 {
		m.cancel()
		return nil, context.Canceled
	}
	return nil, fmt.Errorf("post-cancellation model request: %w", ctx.Err())
}

func TestFinalSynthesisReviewCancellationDoesNotStartDegradedSynthesis(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	model := &finalSynthesisCancelChat{mockChat: &mockChat{}, cancel: cancel}
	engine := newTestEngine(t, model, withMaxIterations(50))
	state := &types.AgentState{
		CurrentRound: 1, RoundSteps: []types.AgentStep{
			{
				Iteration: 0, ToolCalls: []types.ToolCall{
					{
						Name: "test_lookup", Result: &types.ToolResult{
							Success: true, Output: "saved evidence",
						},
					},
				},
			},
		},
	}
	_, err := engine.executeLoop(ctx, state, "question", emptyMessages(), nil, "session", "message")
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, 1, model.attempts, "user stop must not initiate a new model request")
}

func TestFinalSynthesisReviewCompactionPreservesCompleteRetrievedImage(t *testing.T) {
	const imageURL = "https://review.invalid/only-relevant-image.png"
	const image = "![only relevant image](" + imageURL + ")"
	output := strings.Repeat(
		"middle evidence padding ", 9000,
	) + image + strings.Repeat(
		"trailing evidence padding ", 9000,
	)
	model := &mockChat{
		responses: []mockResponse{
			{
				chunks: []types.StreamResponse{
					{
						ResponseType: types.ResponseTypeAnswer, Content: "answer", Done: true,
					},
				},
			},
		},
	}
	engine := newTestEngine(
		t, model, withMaxIterations(
			1,
		), func(cfg *types.AgentConfig) { cfg.MaxContextTokens = 24000 },
	)
	state := &types.AgentState{
		CurrentRound: 1, RoundSteps: []types.AgentStep{
			{
				Iteration: 0, ToolCalls: []types.ToolCall{
					{
						Name: "test_lookup", Result: &types.ToolResult{
							Success: true, Output: output,
						},
					},
				},
			},
		},
	}
	_, err := engine.executeLoop(
		t.Context(), state, "show the relevant image", emptyMessages(), nil, "session", "message",
	)
	require.NoError(t, err)
	got := fmt.Sprint(model.calls[0])
	require.Contains(t, got, "MUST include at least one relevant Markdown image")
	require.Contains(t, got, image, "the model must receive a complete image to fulfill the preserved requirement")
	require.Equal(t, output, state.RoundSteps[0].ToolCalls[0].Result.Output)
}

func TestFinalSynthesisReviewRecoveryUsageIsAccumulative(t *testing.T) {
	model := &mockChat{responses: []mockResponse{
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeThinking, Content: "reason", Done: true, Usage: &types.TokenUsage{
						PromptTokens: 10, CompletionTokens: 20, TotalTokens: 30,
					},
				},
			},
		},
		{
			chunks: []types.StreamResponse{
				{
					ResponseType: types.ResponseTypeAnswer, Content: "answer", Done: true, Usage: &types.TokenUsage{
						PromptTokens: 40, CompletionTokens: 50, TotalTokens: 90,
					},
				},
			},
		},
	}}
	engine := newTestEngine(t, model, withMaxIterations(1))
	state, err := engine.executeLoop(
		t.Context(), &types.AgentState{
			CurrentRound: 1,
		}, "question", emptyMessages(), nil, "session", "message",
	)
	require.NoError(t, err)
	require.Equal(t, 120, state.TurnUsage.TotalTokens)
	require.Equal(t, 50, state.TurnUsage.PromptTokens)
	require.Equal(t, 70, state.TurnUsage.CompletionTokens)
}

type finalSynthesisPartialCancelChat struct {
	*mockChat
	cancel context.CancelFunc
}

func (m *finalSynthesisPartialCancelChat) ChatStream(
	ctx context.Context, messages []chat.Message, opts *chat.ChatOptions,
) (<-chan types.StreamResponse, error) {
	m.cancel()
	return m.mockChat.ChatStream(ctx, messages, opts)
}

func TestFinalSynthesisReviewCancellationPreservesPartialStepAndUsage(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	model := &finalSynthesisPartialCancelChat{
		mockChat: &mockChat{
			responses: []mockResponse{
				{
					chunks: []types.StreamResponse{
						{
							ResponseType: types.ResponseTypeAnswer,
							Content:      "partial work before stop",
							Done:         true, Usage: &types.TokenUsage{
								PromptTokens: 100, CompletionTokens: 20, TotalTokens: 120,
							},
						},
					},
				},
			},
		}, cancel: cancel,
	}
	engine := newTestEngine(t, model, withMaxIterations(50))
	state := &types.AgentState{
		CurrentRound: 1, RoundSteps: []types.AgentStep{
			{
				Iteration: 0, ToolCalls: []types.ToolCall{
					{
						Name: "test_lookup", Result: &types.ToolResult{
							Success: true, Output: "saved evidence",
						},
					},
				},
			},
		},
	}
	result, _ := engine.executeLoop(ctx, state, "question", emptyMessages(), nil, "session", "message")
	require.False(t, result.IsComplete)
	require.Empty(t, result.FinalAnswer)
	require.Len(t, model.opts, 1, "do not start another model request after stop")
	require.Equal(t, 120, result.TurnUsage.TotalTokens, "the stopped request still incurred reported usage")
	require.Len(t, result.RoundSteps, 2, "persist partial thinking from stopped round along with prior work")
	require.Equal(t, "partial work before stop", result.RoundSteps[1].Thought)
}
