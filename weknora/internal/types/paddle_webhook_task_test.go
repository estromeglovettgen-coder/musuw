package types

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestPaddleWebhookTaskPayloadValidate(t *testing.T) {
	periodEnd := time.Date(2026, time.August, 26, 0, 0, 0, 0, time.UTC)
	base := PaddleWebhookTaskPayload{
		TenantID:       7,
		Operation:      PaddleWebhookTaskOperationApplyConsumerPlan,
		Plan:           ConsumerPlanPro,
		Status:         "active",
		BillingPeriod:  "monthly",
		EventID:        "evt_test",
		OccurredAt:     time.Date(2026, time.August, 25, 0, 0, 0, 0, time.UTC),
		CustomerID:     "ctm_test",
		SubscriptionID: "sub_test",
		EventPeriodEnd: &periodEnd,
	}

	if err := base.Validate(); err != nil {
		t.Fatalf("valid apply payload rejected: %v", err)
	}

	refresh := base
	refresh.Operation = PaddleWebhookTaskOperationRefreshPaidAllowance
	if err := refresh.Validate(); err != nil {
		t.Fatalf("valid refresh payload rejected: %v", err)
	}

	cases := []struct {
		name string
		edit func(*PaddleWebhookTaskPayload)
	}{
		{"missing tenant", func(p *PaddleWebhookTaskPayload) { p.TenantID = 0 }},
		{"missing event id", func(p *PaddleWebhookTaskPayload) { p.EventID = "" }},
		{"missing occurred at", func(p *PaddleWebhookTaskPayload) { p.OccurredAt = time.Time{} }},
		{"unknown operation", func(p *PaddleWebhookTaskPayload) { p.Operation = "unknown" }},
		{"unknown plan", func(p *PaddleWebhookTaskPayload) { p.Plan = "enterprise" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payload := base
			tc.edit(&payload)
			if err := payload.Validate(); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}

	refresh.EventPeriodEnd = nil
	if err := refresh.Validate(); err == nil {
		t.Fatal("refresh payload without period end should be rejected")
	}
}

func TestPaddleWebhookTaskPayloadDoesNotCarrySecrets(t *testing.T) {
	payload := PaddleWebhookTaskPayload{
		TenantID:      7,
		Operation:     PaddleWebhookTaskOperationApplyConsumerPlan,
		Plan:          ConsumerPlanPro,
		Status:        "active",
		BillingPeriod: "monthly",
		EventID:       "evt_test",
		OccurredAt:    time.Date(2026, time.August, 25, 0, 0, 0, 0, time.UTC),
	}
	encodedBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	encoded := string(encodedBytes)
	for _, forbidden := range []string{"signature", "secret", "authorization", "paddle-signature"} {
		if strings.Contains(strings.ToLower(encoded), forbidden) {
			t.Fatalf("payload contains forbidden field %q: %s", forbidden, encoded)
		}
	}
}
