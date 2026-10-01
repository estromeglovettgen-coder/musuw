package agent

import (
	"context"
	"fmt"
	"strings"
	"time"

	agenttools "github.com/Tencent/WeKnora/internal/agent/tools"
	"github.com/Tencent/WeKnora/internal/common"
	"github.com/Tencent/WeKnora/internal/event"
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/models/chat"
	"github.com/Tencent/WeKnora/internal/searchutil"
	"github.com/Tencent/WeKnora/internal/types"
)

func finalAnswerImageRequirement(hasRetrievedImage bool) string {
	if !hasRetrievedImage {
		return ""
	}
	return `
5. Retrieved tool results contain Markdown images. Unless the user explicitly requested text-only output or every image is clearly unrelated, the final answer MUST include at least one relevant Markdown image copied verbatim from the tool results. Preserve its complete URL exactly. Use ASCII half-width parentheses exactly as ![alt](url) and never use full-width （ or ）. Place the image immediately after the paragraph it supports. When multiple images support different sections, distribute them across those sections instead of stopping after the first image.
6. Before finishing, silently verify that the answer contains a Markdown image when requirement 5 applies.`
}

// streamFinalAnswerToEventBus streams the final answer generation through EventBus
func (e *AgentEngine) streamFinalAnswerToEventBus(
	ctx context.Context,
	query string,
	state *types.AgentState,
	sessionID string,
) error {
	totalToolCalls := countTotalToolCalls(state.RoundSteps)
	logger.Infof(ctx, "[Agent][FinalAnswer] Synthesizing from %d steps, %d tool calls",
		len(state.RoundSteps), totalToolCalls)
	common.PipelineInfo(ctx, "Agent", "final_answer_start", map[string]interface{}{
		"session_id":   sessionID,
		"query_len":    len(query),
		"steps":        len(state.RoundSteps),
		"tool_results": totalToolCalls,
	})

	// Build messages with all context
	systemPrompt := e.buildSystemPrompt(ctx)
	userTurn := e.RenderUserTurnContent(sessionID, query)

	messages := []chat.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userTurn},
	}

	// Add all tool call results as context
	toolResultCount := 0
	hasRetrievedImage := false
	for stepIdx, step := range state.RoundSteps {
		for toolIdx, toolCall := range step.ToolCalls {
			toolResultCount++
			if searchutil.MarkdownImageRegex.MatchString(toolCall.Result.Output) {
				hasRetrievedImage = true
			}
			modelOutput := e.modelContext.ModelToolResultForTool(toolCall.Name, toolCall.Result)
			messages = append(messages, chat.Message{
				Role:    "user",
				Content: fmt.Sprintf("Tool %s returned: %s", toolCall.Name, modelOutput),
			})
			logger.Debugf(ctx, "[Agent][FinalAnswer] Added tool result [Step-%d][Tool-%d]: %s (output: %d chars)",
				stepIdx+1, toolIdx+1, toolCall.Name, len(toolCall.Result.Output))
		}
	}

	logger.Debugf(ctx, "[Agent][FinalAnswer] Built context: %d messages, %d tool results",
		len(messages), toolResultCount)

	imageRequirement := finalAnswerImageRequirement(hasRetrievedImage)

	// Add final answer prompt
	finalPrompt := fmt.Sprintf(`Based on the above tool call results, generate a complete answer for the user's question.

User question: %s

Requirements:
1. Answer based on the actually retrieved content
2. Organize the answer in a structured format
3. If information is insufficient, honestly state so
4. IMPORTANT: Respond in the same language as the user's question
%s

Now generate the final answer:`, query, imageRequirement)

	messages = append(messages, chat.Message{
		Role:    "user",
		Content: finalPrompt,
	})

	messages, budget, err := e.prepareFinalAnswerContext(messages)
	if err != nil {
		return err
	}
	answerID := generateEventID("answer")
	for attempt := 0; attempt < 2; attempt++ {
		logger.Infof(ctx,
			"[Agent][FinalAnswer] Prepared context: prompt_tokens=%d output_tokens=%d messages=%d attempt=%d",
			e.tokenEstimator.EstimateMessages(messages), budget, len(messages), attempt+1)
		opts := &chat.ChatOptions{
			Temperature:         e.config.Temperature,
			MaxTokens:           budget,
			MaxCompletionTokens: budget,
		}
		if attempt > 0 {
			thinking := false
			opts.Thinking = &thinking
		}
		splitter := agenttools.NewThinkStreamSplitter()
		var visibleAnswer strings.Builder
		emitAnswer := func(content string) {
			if content == "" || (visibleAnswer.Len() == 0 && strings.TrimSpace(content) == "") {
				return
			}
			visibleAnswer.WriteString(content)
			_ = e.eventBus.Emit(ctx, event.Event{
				ID: answerID, Type: event.EventAgentFinalAnswer, SessionID: sessionID,
				Data: event.AgentFinalAnswerData{Content: content},
			})
		}
		llmResult, err := e.streamLLMToEventBus(ctx, messages, opts, func(chunk *types.StreamResponse, _ string) {
			if chunk.ResponseType == types.ResponseTypeThinking {
				return
			}
			_, answer := splitter.Feed(chunk.Content)
			emitAnswer(answer)
		})
		// Count recovery calls too; their usage is still part of this turn.
		if llmResult != nil && llmResult.Usage != nil {
			state.TurnUsage.Accumulate(*llmResult.Usage)
		}
		if err != nil {
			return fmt.Errorf("final answer generation failed: %w", err)
		}
		_, tail := splitter.Flush()
		emitAnswer(tail)
		fullAnswer := visibleAnswer.String()
		if strings.TrimSpace(fullAnswer) != "" {
			state.FinalAnswer = fullAnswer
			// Emit done only after confirming the stream produced an answer.
			// Empty/whitespace streams must not stop the frontend before recovery.
			_ = e.eventBus.Emit(ctx, event.Event{
				ID: answerID, Type: event.EventAgentFinalAnswer, SessionID: sessionID,
				Data: event.AgentFinalAnswerData{Done: true},
			})
			common.PipelineInfo(ctx, "Agent", "final_answer_done", map[string]interface{}{
				"session_id": sessionID, "answer_len": len(fullAnswer),
			})
			return nil
		}

		if attempt == 0 {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			logger.Warn(ctx, "[Agent][FinalAnswer] Empty answer; retrying once without reasoning")
			messages = append([]chat.Message(nil), messages...)
			messages[len(messages)-1].Content += "\nPlease provide your complete answer now " +
				"as plain text, not reasoning."
			messages, budget, err = e.prepareFinalAnswerContext(messages)
			if err != nil {
				return err
			}
		}
	}
	return fmt.Errorf("final answer generation returned no visible content after recovery")
}

// Reserve the configured answer budget before fitting retrieved content into
// the remaining window. Shrinking output to one token cannot produce an answer.
// Only result messages may be compacted/dropped; never truncate the user's
// request, system instructions, or the final-answer instructions.
func (e *AgentEngine) prepareFinalAnswerContext(messages []chat.Message) ([]chat.Message, int, error) {
	budget := e.getCompletionTokenBudget()
	if e.config.MaxContextTokens <= 0 {
		return messages, budget, nil
	}
	inputBudget := e.config.MaxContextTokens - contextSafetyTokens - budget
	if e.tokenEstimator.EstimateMessages(messages) <= inputBudget {
		return messages, budget, nil
	}

	last := len(messages) - 1
	fixed := []chat.Message{messages[0], messages[1], messages[last]}
	toolBudget := inputBudget - e.tokenEstimator.EstimateMessages(fixed)
	if toolBudget < 0 {
		return nil, 0, fmt.Errorf(
			"final answer context cannot fit the user request and %d output tokens in the %d-token window",
			budget, e.config.MaxContextTokens,
		)
	}
	indexes := make([]int, 0, max(last-2, 0))
	for i := 2; i < last; i++ {
		indexes = append(indexes, i)
	}
	messages, _ = trimToolResultMessages(messages, indexes, e.tokenEstimator, toolBudget)
	// Even compact markers have a cost. If they alone exceed the remaining
	// window, omit oldest standalone results until the fixed input fits.
	for len(messages) > 3 && e.tokenEstimator.EstimateMessages(messages) > inputBudget {
		messages = append(append([]chat.Message(nil), messages[:2]...), messages[3:]...)
	}
	// Image instructions must describe the context actually sent, not an
	// image that existed only in an omitted result.
	hasImage := false
	for _, msg := range messages[2 : len(messages)-1] {
		hasImage = hasImage || searchutil.MarkdownImageRegex.MatchString(msg.Content)
	}
	if !hasImage {
		messages = append([]chat.Message(nil), messages...)
		messages[len(messages)-1].Content = strings.ReplaceAll(
			messages[len(messages)-1].Content, finalAnswerImageRequirement(true), "",
		)
	}
	return messages, budget, nil
}

// handleMaxIterations generates a final answer when the agent loop exhausted all iterations
// without the LLM producing a natural stop. It marks state.IsComplete = true.
func (e *AgentEngine) handleMaxIterations(
	ctx context.Context, query string, state *types.AgentState, sessionID string,
) error {
	logger.Info(ctx, "Reached max iterations, generating final answer")
	common.PipelineWarn(ctx, "Agent", "max_iterations_reached", map[string]interface{}{
		"iterations": state.CurrentRound,
		"max":        e.config.MaxIterations,
	})

	// Stream final answer generation through EventBus
	if err := e.streamFinalAnswerToEventBus(ctx, query, state, sessionID); err != nil {
		logger.Errorf(ctx, "Failed to synthesize final answer: %v", err)
		common.PipelineError(ctx, "Agent", "final_answer_failed", map[string]interface{}{
			"error": err.Error(),
		})
		return err
	}
	state.IsComplete = true
	return nil
}

// emitCompletionEvent emits the EventAgentComplete event with execution summary.
func (e *AgentEngine) emitCompletionEvent(
	ctx context.Context, state *types.AgentState, sessionID, messageID string, startTime time.Time,
) {
	// Convert knowledge refs to interface{} slice for event data
	knowledgeRefsInterface := make([]interface{}, 0, len(state.KnowledgeRefs))
	for _, ref := range state.KnowledgeRefs {
		knowledgeRefsInterface = append(knowledgeRefsInterface, ref)
	}

	_ = e.eventBus.Emit(ctx, event.Event{
		ID:        generateEventID("complete"),
		Type:      event.EventAgentComplete,
		SessionID: sessionID,
		Data: event.AgentCompleteData{
			FinalAnswer:     state.FinalAnswer,
			KnowledgeRefs:   knowledgeRefsInterface,
			AgentSteps:      state.RoundSteps, // Include detailed execution steps for message storage
			Usage:           turnUsage(state),
			TotalSteps:      len(state.RoundSteps),
			TotalDurationMs: time.Since(startTime).Milliseconds(),
			MessageID:       messageID, // Include message ID for proper message update
		},
	})

	logger.Infof(ctx, "Agent execution completed in %d rounds", state.CurrentRound)
}

// turnUsage returns the turn's aggregated LLM usage, or nil when no round
// reported usage so the field stays absent from the completion event and the
// persisted message alike.
func turnUsage(state *types.AgentState) *types.TokenUsage {
	if state == nil || state.TurnUsage.TotalTokens == 0 {
		return nil
	}
	usage := state.TurnUsage
	return &usage
}
