package interfaces

import (
	"context"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
)

type EntitlementRepository interface {
	GetTenantEntitlement(ctx context.Context, tenantID uint64) (*types.Tenant, error)
	ResolvePaddleSubscription(ctx context.Context, customerID, subscriptionID string) (*types.PaddleSubscriptionBinding, error)
	SetOpenRouterCredentialsIfAbsent(ctx context.Context, tenantID uint64, credentials *types.OpenRouterCredentials, creditPeriodEnd time.Time) (bool, error)
	ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, creditPeriodEnd, paddlePeriodEnd *time.Time) (bool, error)
	AdvanceOpenRouterCreditPeriod(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, periodEnd time.Time) (bool, error)
	AdvancePaddleCurrentPeriod(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, customerID, subscriptionID, billingPeriod, eventID string, occurredAt, periodEnd time.Time) (bool, error)
}

type EntitlementService interface {
	Current(ctx context.Context, at time.Time) (*types.ConsumerEntitlement, error)
	// CurrentForTenant is the same provider-backed snapshot for a platform
	// operator targeting an explicit tenant. It never returns provider
	// credentials or creates a second usage ledger.
	CurrentForTenant(ctx context.Context, tenantID uint64, at time.Time) (*types.ConsumerEntitlement, error)
	OpenRouterAPIKey(ctx context.Context) (string, error)
	OpenRouterUserID(ctx context.Context) string
	// SetOpenRouterRemainingForTenant changes only the existing provider-managed
	// child key's remaining allowance. The provider lifetime usage remains the
	// authority; callers cannot exceed the fixed Max plan allowance.
	SetOpenRouterRemainingForTenant(ctx context.Context, tenantID uint64, remainingMicrousd int64) (*types.ConsumerEntitlement, error)
	ResolvePaddleSubscription(ctx context.Context, customerID, subscriptionID string) (*types.PaddleSubscriptionBinding, error)
	ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, creditPeriodEnd *time.Time) (bool, error)
	RefreshPaidAllowance(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, periodEnd time.Time) (bool, error)
}
