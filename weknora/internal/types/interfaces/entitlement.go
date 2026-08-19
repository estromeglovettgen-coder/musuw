package interfaces

import (
	"context"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
)

type EntitlementRepository interface {
	GetTenantEntitlement(ctx context.Context, tenantID uint64) (*types.Tenant, error)
	SetOpenRouterCredentialsIfAbsent(ctx context.Context, tenantID uint64, credentials *types.OpenRouterCredentials) (bool, error)
	ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, eventID string, occurredAt time.Time, customerID, subscriptionID string) (bool, error)
}

type EntitlementService interface {
	Current(ctx context.Context, at time.Time) (*types.ConsumerEntitlement, error)
	OpenRouterAPIKey(ctx context.Context) (string, error)
	OpenRouterUserID(ctx context.Context) string
	ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, eventID string, occurredAt time.Time, customerID, subscriptionID string) (bool, error)
}
