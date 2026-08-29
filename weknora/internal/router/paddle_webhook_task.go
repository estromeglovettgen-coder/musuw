package router

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
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

// PaddleWebhookTaskOptions keeps queue and bounded retry/timeout in one place
// for every producer (Redis and Lite). Deliveries intentionally receive unique
// queue IDs: an archived failed task must never make a later Paddle redelivery
// look like success. Durable event-id/occurred-at guards provide idempotency.
func PaddleWebhookTaskOptions(payload types.PaddleWebhookTaskPayload) []asynq.Option {
	return []asynq.Option{
		asynq.Queue(types.QueueBilling),
		asynq.MaxRetry(PaddleWebhookTaskMaxRetry),
		asynq.Timeout(PaddleWebhookTaskTimeout),
	}
}

type paddleWebhookTaskHandler struct {
	entitlements interfaces.EntitlementService
	operations   interfaces.PaddleBillingOperationRepository
}

// checkoutEntitlementMatches verifies the durable provider identity after a
// checkout event was already applied by an earlier lifecycle event. Paddle can
// deliver subscription.activated before subscription.created; in that order
// the created task is intentionally stale, but its operation may still need to
// be settled. The durable binding is the same tenant/customer/subscription and
// catalog identity used by the HTTP webhook path, so this does not introduce a
// second entitlement state machine or allow an old checkout to finish.
func (h *paddleWebhookTaskHandler) checkoutEntitlementMatches(ctx context.Context, payload types.PaddleWebhookTaskPayload) (bool, error) {
	if h == nil || h.entitlements == nil || payload.BillingOperationType != types.PaddleBillingOperationCheckout ||
		payload.EventType != "subscription.created" {
		return false, nil
	}
	customerID := strings.TrimSpace(payload.CustomerID)
	subscriptionID := strings.TrimSpace(payload.SubscriptionID)
	if customerID == "" || subscriptionID == "" {
		return false, nil
	}
	binding, err := h.entitlements.ResolvePaddleSubscription(ctx, customerID, subscriptionID)
	if err != nil {
		return false, fmt.Errorf("resolve Paddle checkout binding for operation settlement: %w", err)
	}
	if binding == nil || binding.TenantID != payload.TenantID ||
		strings.TrimSpace(binding.CustomerID) != customerID ||
		strings.TrimSpace(binding.SubscriptionID) != subscriptionID ||
		types.NormalizeConsumerPlan(binding.Plan) != types.NormalizeConsumerPlan(payload.Plan) ||
		strings.TrimSpace(binding.Status) != strings.TrimSpace(payload.Status) ||
		strings.TrimSpace(binding.BillingPeriod) != strings.TrimSpace(payload.BillingPeriod) {
		return false, nil
	}
	return true, nil
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
	// A signed Paddle event proves the provider-side change, but a checkout or
	// upgrade operation is complete only after the corresponding entitlement is
	// durably applied. ApplyConsumerPlan returns true for both a fresh write and
	// an exact durable event replay. A false result normally means the event was
	// stale or did not own the tenant binding. The one ordering exception is a
	// stale subscription.created after subscription.activated already committed:
	// checkoutEntitlementMatches below proves that exact current binding before
	// allowing the existing operation repository to settle it. Every other false
	// result remains retryable through the bounded queue/dead-letter path.
	if h.operations != nil && payload.BillingOperationType != "" {
		settleAllowed := applied
		if !settleAllowed {
			// A later subscription.created can be stale after an earlier
			// subscription.activated already committed the exact entitlement. Only
			// that current durable binding may authorize checkout settlement; every
			// other stale/mismatched event remains retryable.
			var bindingErr error
			settleAllowed, bindingErr = h.checkoutEntitlementMatches(ctx, payload)
			if bindingErr != nil {
				return bindingErr
			}
			if !settleAllowed {
				return fmt.Errorf("complete Paddle billing operation: entitlement was not durably applied")
			}
		}
		result, marshalErr := json.Marshal(map[string]string{
			"event_id":        payload.EventID,
			"event_type":      payload.EventType,
			"subscription_id": payload.SubscriptionID,
		})
		if marshalErr != nil {
			return fmt.Errorf("encode Paddle billing operation result: %w", marshalErr)
		}
		settled, finishErr := h.operations.FinishMatchingActive(
			ctx, payload.TenantID, payload.BillingOperationType, payload.BillingOperationKey, payload.PriceID,
			payload.TransactionID, payload.SubscriptionID, types.PaddleBillingOperationSucceeded, string(result), "",
		)
		if finishErr != nil {
			return fmt.Errorf("complete Paddle billing operation: %w", finishErr)
		}
		if !settled {
			return fmt.Errorf("complete Paddle billing operation: signed event does not match the active operation")
		}
	}
	logger.Infof(ctx,
		"Paddle billing task processed operation=%s tenant_id=%d event_id=%s applied=%t",
		payload.Operation, payload.TenantID, payload.EventID, applied,
	)
	return nil
}
