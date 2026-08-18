package interfaces

import (
	"context"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
)

type EntitlementRepository interface {
	GetTenantEntitlement(ctx context.Context, tenantID uint64) (*types.Tenant, error)
	GetOpenRouterKey(ctx context.Context, tenantID uint64) (*types.OpenRouterTenantKey, error)
	SetOpenRouterKeyIfAbsent(ctx context.Context, key *types.OpenRouterTenantKey) (bool, error)
	RecordOpenRouterCost(ctx context.Context, tenantID uint64, at time.Time, costMicrousd int64) (int64, error)
	ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, eventID string, occurredAt time.Time, customerID, subscriptionID string) (bool, error)
}

type EntitlementService interface {
	Current(ctx context.Context, at time.Time) (*types.ConsumerEntitlement, error)
	PreflightOpenRouter(ctx context.Context, at time.Time, estimateMicrousd int64) error
	RecordOpenRouterCost(ctx context.Context, at time.Time, costMicrousd int64) (int64, error)
	OpenRouterAPIKey(ctx context.Context) (string, error)
	OpenRouterUserID(ctx context.Context) string
	ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, eventID string, occurredAt time.Time, customerID, subscriptionID string) (bool, error)
}
