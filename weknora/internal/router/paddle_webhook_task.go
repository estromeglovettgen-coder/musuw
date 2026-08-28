package router

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/Tencent/WeKnora/internal/utils"
	"github.com/hibiken/asynq"
)

const (
	// Keep billing retries bounded: provider events are replayable and the
	// entitlement service's durable event guard makes a later replay safe.
	PaddleWebhookTaskMaxRetry = types.PaddleWebhookTaskMaxRetry
	PaddleWebhookTaskTimeout  = types.PaddleWebhookTaskTimeout
)

// NewPaddleWebhookTask serializes only the canonical, secret-free projection.
// Callers must pass PaddleWebhookTaskOptions(payload) when enqueueing it.
func NewPaddleWebhookTask(payload types.PaddleWebhookTaskPayload) (*asynq.Task, error) {
	if err := payload.Validate(); err != nil {
		return nil, err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal paddle webhook task: %w", err)
	}
	return asynq.NewTask(types.TypePaddleWebhook, body), nil
}

// PaddleWebhookTaskOptions keeps queue, bounded retry/timeout, and short-term
// deterministic dedupe in one place for every producer (Redis and Lite).
func PaddleWebhookTaskOptions(payload types.PaddleWebhookTaskPayload) []asynq.Option {
	options := []asynq.Option{
		asynq.Queue(types.QueueBilling),
		asynq.MaxRetry(PaddleWebhookTaskMaxRetry),
		asynq.Timeout(PaddleWebhookTaskTimeout),
	}
	if taskID := utils.PaddleWebhookTaskID(payload.EventID); taskID != "" {
		options = append(options, asynq.TaskID(taskID))
	}
	return options
}

type paddleWebhookTaskHandler struct {
	entitlements interfaces.EntitlementService
	operations   interfaces.PaddleBillingOperationRepository
}

// NewPaddleWebhookTaskHandler constructs the worker-side execution adapter.
// It deliberately depends on the existing entitlement service interface; no
// second billing service or repository path is introduced.
func NewPaddleWebhookTaskHandler(entitlements interfaces.EntitlementService, operations ...interfaces.PaddleBillingOperationRepository) interfaces.TaskHandler {
	handler := &paddleWebhookTaskHandler{entitlements: entitlements}
	if len(operations) > 0 {
		handler.operations = operations[0]
	}
	return handler
}

func (h *paddleWebhookTaskHandler) Handle(ctx context.Context, task *asynq.Task) error {
	if h == nil || h.entitlements == nil {
		return fmt.Errorf("paddle webhook task entitlement service is unavailable")
	}
	if task == nil {
		return fmt.Errorf("paddle webhook task is nil")
	}
	var payload types.PaddleWebhookTaskPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("decode paddle webhook task: %w", err)
	}
	if err := payload.Validate(); err != nil {
		return err
	}

	var (
		applied bool
		err     error
	)
	switch payload.Operation {
	case types.PaddleWebhookTaskOperationApplyConsumerPlan:
		applied, err = h.entitlements.ApplyConsumerPlan(
			ctx,
			payload.TenantID,
			payload.Plan,
			payload.Status,
			payload.BillingPeriod,
			payload.EventID,
			payload.OccurredAt,
			payload.CustomerID,
			payload.SubscriptionID,
			payload.EventPeriodEnd,
		)
	case types.PaddleWebhookTaskOperationRefreshPaidAllowance:
		// Validate guarantees the period is present for this operation.
		applied, err = h.entitlements.RefreshPaidAllowance(
			ctx,
			payload.TenantID,
			payload.Plan,
			payload.BillingPeriod,
			payload.EventID,
			payload.OccurredAt,
			payload.CustomerID,
			payload.SubscriptionID,
			*payload.EventPeriodEnd,
		)
	default:
		// Kept for exhaustiveness if the DTO grows without updating this switch.
		return fmt.Errorf("paddle webhook task operation %q is invalid", payload.Operation)
	}
	if err != nil {
		return fmt.Errorf("execute paddle webhook task operation=%s: %w", payload.Operation, err)
	}
	if applied && h.operations != nil && payload.BillingOperationType != "" {
		result, marshalErr := json.Marshal(map[string]string{
			"event_id":        payload.EventID,
			"event_type":      payload.EventType,
			"subscription_id": payload.SubscriptionID,
		})
		if marshalErr != nil {
			return fmt.Errorf("encode Paddle billing operation result: %w", marshalErr)
		}
		if _, finishErr := h.operations.FinishMatchingActive(
			ctx, payload.TenantID, payload.BillingOperationType, payload.BillingOperationKey, payload.PriceID,
			payload.SubscriptionID, types.PaddleBillingOperationSucceeded, string(result), "",
		); finishErr != nil {
			return fmt.Errorf("complete Paddle billing operation: %w", finishErr)
		}
	}
	logger.Infof(ctx,
		"Paddle billing task processed operation=%s tenant_id=%d event_id=%s applied=%t",
		payload.Operation, payload.TenantID, payload.EventID, applied,
	)
	return nil
}
