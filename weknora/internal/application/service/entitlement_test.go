package service

import (
	"context"
	"testing"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type entitlementRepoStub struct {
	tenant *types.Tenant
	used   int64
}

func (s *entitlementRepoStub) GetTenantEntitlement(context.Context, uint64) (*types.Tenant, error) {
	copy := *s.tenant
	return &copy, nil
}

func (s *entitlementRepoStub) RecordOpenRouterCost(_ context.Context, _ uint64, _ time.Time, cost int64) (int64, error) {
	s.used += cost
	return s.used, nil
}

func (s *entitlementRepoStub) ApplyConsumerPlan(context.Context, uint64, types.ConsumerPlan, string, string, time.Time, string, string) (bool, error) {
	return true, nil
}

func entitlementContext(tenantID uint64, userID string) context.Context {
	ctx := context.WithValue(context.Background(), types.TenantIDContextKey, tenantID)
	return context.WithValue(ctx, types.UserIDContextKey, userID)
}

func TestEntitlementServiceCurrentAndPreflight(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID:                     7,
		Plan:                   types.ConsumerPlanPlus,
		PlanStatus:             "active",
		StorageUsed:            123,
		OpenRouterUsageMonth:   "2026-08",
		OpenRouterUsedMicrousd: 1_249_500,
	}}
	svc := NewEntitlementService(repo)
	ctx := entitlementContext(7, "user-123")

	current, err := svc.Current(ctx, now)
	require.NoError(t, err)
	assert.Equal(t, types.ConsumerPlanPlus, current.Plan)
	assert.Equal(t, int64(500), current.OpenRouterRemainingMicrousd)
	require.NoError(t, svc.PreflightOpenRouter(ctx, now, 500))

	err = svc.PreflightOpenRouter(ctx, now, 501)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, apperrors.ErrTooManyRequests, appErr.Code)
}

func TestEntitlementServiceOpenRouterUserIDIsStableAndOpaque(t *testing.T) {
	svc := NewEntitlementService(&entitlementRepoStub{tenant: &types.Tenant{ID: 7}})
	ctx := entitlementContext(7, "user@example.com")
	a := svc.OpenRouterUserID(ctx)
	b := svc.OpenRouterUserID(ctx)
	assert.Equal(t, a, b)
	assert.NotContains(t, a, "user@example.com")
	assert.Contains(t, a, "musuw_")
}

func TestEntitlementServiceOpenRouterUserIDIsStableAcrossTenants(t *testing.T) {
	svc := NewEntitlementService(&entitlementRepoStub{tenant: &types.Tenant{ID: 7}})
	const userID = "same-user"
	a := svc.OpenRouterUserID(entitlementContext(7, userID))
	b := svc.OpenRouterUserID(entitlementContext(99, userID))

	assert.NotEmpty(t, a)
	assert.Equal(t, a, b)
	assert.Empty(t, svc.OpenRouterUserID(entitlementContext(7, "")))
}
