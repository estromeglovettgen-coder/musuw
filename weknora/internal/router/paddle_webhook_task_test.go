package router

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/hibiken/asynq"
)

type paddleWebhookEntitlementStub struct {
	interfaces.EntitlementService
	applyCalls     int
	refreshCalls   int
	applyPayload   types.PaddleWebhookTaskPayload
	refreshPayload types.PaddleWebhookTaskPayload
	applyErr       error
	refreshErr     error
}

func (s *paddleWebhookEntitlementStub) ApplyConsumerPlan(
	_ context.Context,
	tenantID uint64,
	plan types.ConsumerPlan,
	status, billingPeriod, eventID string,
	occurredAt time.Time,
	customerID, subscriptionID string,
	eventPeriodEnd *time.Time,
) (bool, error) {
	s.applyCalls++
	s.applyPayload = types.PaddleWebhookTaskPayload{
		TenantID: tenantID, Plan: plan, Status: status, BillingPeriod: billingPeriod,
		EventID: eventID, OccurredAt: occurredAt, CustomerID: customerID,
		SubscriptionID: subscriptionID, EventPeriodEnd: eventPeriodEnd,
	}
	return s.applyErr == nil, s.applyErr
}

func (s *paddleWebhookEntitlementStub) RefreshPaidAllowance(
	_ context.Context,
	tenantID uint64,
	plan types.ConsumerPlan,
	billingPeriod string,
	eventID string,
	occurredAt time.Time,
	customerID, subscriptionID string,
	periodEnd time.Time,
) (bool, error) {
	s.refreshCalls++
	s.refreshPayload = types.PaddleWebhookTaskPayload{
		TenantID: tenantID, Plan: plan, BillingPeriod: billingPeriod, EventID: eventID, OccurredAt: occurredAt,
		CustomerID: customerID, SubscriptionID: subscriptionID,
		EventPeriodEnd: &periodEnd,
	}
	return s.refreshErr == nil, s.refreshErr
}

func paddleWebhookTestPayload(operation types.PaddleWebhookTaskOperation) types.PaddleWebhookTaskPayload {
	periodEnd := time.Date(2026, time.August, 26, 0, 0, 0, 0, time.UTC)
	return types.PaddleWebhookTaskPayload{
		TenantID:       7,
		Operation:      operation,
		Plan:           types.ConsumerPlanPro,
		Status:         "active",
		BillingPeriod:  "monthly",
		EventID:        "evt_test",
		OccurredAt:     time.Date(2026, time.August, 25, 0, 0, 0, 0, time.UTC),
		CustomerID:     "ctm_test",
		SubscriptionID: "sub_test",
		EventPeriodEnd: &periodEnd,
	}
}

func TestPaddleWebhookTaskHandlerAppliesConsumerPlan(t *testing.T) {
	stub := &paddleWebhookEntitlementStub{}
	handler := NewPaddleWebhookTaskHandler(stub)
	payload := paddleWebhookTestPayload(types.PaddleWebhookTaskOperationApplyConsumerPlan)
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	if err := handler.Handle(context.Background(), asynq.NewTask(types.TypePaddleWebhook, body)); err != nil {
		t.Fatalf("Handle returned error: %v", err)
	}
	if stub.applyCalls != 1 || stub.refreshCalls != 0 {
		t.Fatalf("calls = apply:%d refresh:%d", stub.applyCalls, stub.refreshCalls)
	}
	if stub.applyPayload.EventID != payload.EventID || stub.applyPayload.Plan != payload.Plan {
		t.Fatalf("unexpected apply payload: %+v", stub.applyPayload)
	}
}

func TestPaddleWebhookTaskHandlerRefreshesPaidAllowance(t *testing.T) {
	stub := &paddleWebhookEntitlementStub{}
	handler := NewPaddleWebhookTaskHandler(stub)
	payload := paddleWebhookTestPayload(types.PaddleWebhookTaskOperationRefreshPaidAllowance)
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	if err := handler.Handle(context.Background(), asynq.NewTask(types.TypePaddleWebhook, body)); err != nil {
		t.Fatalf("Handle returned error: %v", err)
	}
	if stub.applyCalls != 0 || stub.refreshCalls != 1 {
		t.Fatalf("calls = apply:%d refresh:%d", stub.applyCalls, stub.refreshCalls)
	}
	if stub.refreshPayload.EventID != payload.EventID || stub.refreshPayload.EventPeriodEnd == nil {
		t.Fatalf("unexpected refresh payload: %+v", stub.refreshPayload)
	}
}

func TestPaddleWebhookTaskHandlerPropagatesServiceError(t *testing.T) {
	want := errors.New("temporary entitlement failure")
	stub := &paddleWebhookEntitlementStub{applyErr: want}
	payload := paddleWebhookTestPayload(types.PaddleWebhookTaskOperationApplyConsumerPlan)
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	err = NewPaddleWebhookTaskHandler(stub).Handle(context.Background(), asynq.NewTask(types.TypePaddleWebhook, body))
	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want %v", err, want)
	}
}

func TestPaddleWebhookTaskHandlerRejectsMalformedPayload(t *testing.T) {
	stub := &paddleWebhookEntitlementStub{}
	err := NewPaddleWebhookTaskHandler(stub).Handle(
		context.Background(),
		asynq.NewTask(types.TypePaddleWebhook, []byte(`{"tenant_id":7,"event_id":"evt_test"}`)),
	)
	if err == nil {
		t.Fatal("expected malformed payload error")
	}
	if stub.applyCalls != 0 || stub.refreshCalls != 0 {
		t.Fatal("malformed payload must not call entitlement service")
	}
}

func TestNewPaddleWebhookTaskUsesBillingQueueAndBoundedRetry(t *testing.T) {
	payload := paddleWebhookTestPayload(types.PaddleWebhookTaskOperationApplyConsumerPlan)
	task, err := NewPaddleWebhookTask(payload)
	if err != nil {
		t.Fatalf("NewPaddleWebhookTask returned error: %v", err)
	}
	if task.Type() != types.TypePaddleWebhook {
		t.Fatalf("task type = %q", task.Type())
	}

	options := PaddleWebhookTaskOptions(payload)
	var queue string
	var maxRetry *int
	var timeout time.Duration
	for _, option := range options {
		switch option.Type() {
		case asynq.QueueOpt:
			queue, _ = option.Value().(string)
		case asynq.MaxRetryOpt:
			value, _ := option.Value().(int)
			maxRetry = &value
		case asynq.TimeoutOpt:
			timeout, _ = option.Value().(time.Duration)
		}
	}
	if queue != types.QueueBilling {
		t.Fatalf("queue = %q, want %q", queue, types.QueueBilling)
	}
	if maxRetry == nil || *maxRetry <= 0 || *maxRetry > PaddleWebhookTaskMaxRetry {
		t.Fatalf("max retry = %v, want bounded positive retry", maxRetry)
	}
	if timeout <= 0 || timeout > PaddleWebhookTaskTimeout {
		t.Fatalf("timeout = %s, want bounded timeout", timeout)
	}
	if string(task.Payload()) == "" {
		t.Fatal("expected serialized payload")
	}
}
