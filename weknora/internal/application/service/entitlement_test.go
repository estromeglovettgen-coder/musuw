package service

import (
	"context"
	"testing"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	modelopenrouter "github.com/Tencent/WeKnora/internal/models/openrouter"
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
	if s.tenant.Credentials != nil {
		credentials := *s.tenant.Credentials
		if s.tenant.Credentials.OpenRouter != nil {
			openrouter := *s.tenant.Credentials.OpenRouter
			credentials.OpenRouter = &openrouter
		}
		copy.Credentials = &credentials
	}
	return &copy, nil
}

func (s *entitlementRepoStub) SetOpenRouterCredentialsIfAbsent(_ context.Context, _ uint64, credentials *types.OpenRouterCredentials) (bool, error) {
	if s.tenant.Credentials != nil && s.tenant.Credentials.OpenRouter != nil {
		return false, nil
	}
	if s.tenant.Credentials == nil {
		s.tenant.Credentials = &types.CredentialsConfig{}
	}
	copy := *credentials
	s.tenant.Credentials.OpenRouter = &copy
	return true, nil
}

func (s *entitlementRepoStub) RecordOpenRouterCost(_ context.Context, _ uint64, _ time.Time, cost int64) (int64, error) {
	s.used += cost
	return s.used, nil
}

func (s *entitlementRepoStub) ApplyConsumerPlan(_ context.Context, _ uint64, plan types.ConsumerPlan, status, _ string, _ time.Time, _, _ string) (bool, error) {
	s.tenant.Plan = plan
	if status == "" {
		status = "active"
	}
	s.tenant.PlanStatus = status
	return true, nil
}

type keyManagerStub struct {
	created     *modelopenrouter.ManagedKey
	info        *modelopenrouter.KeyInfo
	createCalls int
	updateLimit int64
}

func (s *keyManagerStub) CreateKey(context.Context, string, int64) (*modelopenrouter.ManagedKey, error) {
	s.createCalls++
	return s.created, nil
}
func (s *keyManagerStub) UpdateKeyLimit(_ context.Context, _ string, limit int64) error {
	s.updateLimit = limit
	return nil
}
func (s *keyManagerStub) GetKey(context.Context, string) (*modelopenrouter.KeyInfo, error) {
	return s.info, nil
}
func (s *keyManagerStub) DeleteKey(context.Context, string) error { return nil }

func entitlementContext(tenantID uint64, userID string) context.Context {
	ctx := context.WithValue(context.Background(), types.TenantIDContextKey, tenantID)
	return context.WithValue(ctx, types.UserIDContextKey, userID)
}

func TestEntitlementServiceDoesNotUseLegacyUsageWhenProviderKeyIsAbsent(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID:                     7,
		Plan:                   types.ConsumerPlanPlus,
		PlanStatus:             "active",
		StorageUsed:            123,
		OpenRouterUsageMonth:   "2026-08",
		OpenRouterUsedMicrousd: 1_249_500,
	}}
	svc := newEntitlementService(repo, nil)
	ctx := entitlementContext(7, "user-123")

	current, err := svc.Current(ctx, now)
	require.NoError(t, err)
	assert.Equal(t, types.ConsumerPlanPlus, current.Plan)
	assert.Equal(t, types.OpenRouterCreditsUnprovisioned, current.OpenRouterCreditsStatus)
	assert.Zero(t, current.OpenRouterUsedMicrousd)
	assert.Zero(t, current.OpenRouterRemainingMicrousd)
}

func TestEntitlementServiceProvisionsProviderLimitedTenantKey(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "0123456789abcdef0123456789abcdef")
	repo := &entitlementRepoStub{tenant: &types.Tenant{ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active"}}
	manager := &keyManagerStub{created: &modelopenrouter.ManagedKey{Key: "sk-child", Hash: "hash-7"}}
	svc := newEntitlementService(repo, manager)
	ctx := entitlementContext(7, "user-123")

	key, err := svc.OpenRouterAPIKey(ctx)
	require.NoError(t, err)
	assert.Equal(t, "sk-child", key)
	require.NotNil(t, repo.tenant.Credentials)
	require.NotNil(t, repo.tenant.Credentials.OpenRouter)
	assert.Equal(t, "hash-7", repo.tenant.Credentials.OpenRouter.KeyHash)
	assert.Equal(t, "sk-child", repo.tenant.Credentials.OpenRouter.APIKey)
	assert.Equal(t, 1, manager.createCalls)

	key, err = svc.OpenRouterAPIKey(ctx)
	require.NoError(t, err)
	assert.Equal(t, "sk-child", key)
	assert.Equal(t, 1, manager.createCalls)
}

func TestEntitlementServiceUsesProviderUsageAndSynchronizesPlanLimit(t *testing.T) {
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID:         7,
		Plan:       types.ConsumerPlanPlus,
		PlanStatus: "active",
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		Hash:                   "hash-7",
		LimitMicrousd:          1_250_000,
		LimitRemainingMicrousd: 1_000_000,
		UsageMonthlyMicrousd:   250_000,
	}}
	svc := newEntitlementService(repo, manager)
	ctx := entitlementContext(7, "user-123")

	current, err := svc.Current(ctx, time.Now())
	require.NoError(t, err)
	assert.Equal(t, types.OpenRouterCreditsAvailable, current.OpenRouterCreditsStatus)
	assert.Equal(t, int64(250_000), current.OpenRouterUsedMicrousd)
	assert.Equal(t, int64(1_000_000), current.OpenRouterRemainingMicrousd)
	assert.Equal(t, int64(1_250_000), current.MonthlyOpenRouterMicrousd)
	// Local request-price estimates no longer gate an otherwise-positive official balance.
	require.NoError(t, svc.PreflightOpenRouter(ctx, time.Now(), 99_000_000))

	manager.info.LimitRemainingMicrousd = 0
	err = svc.PreflightOpenRouter(ctx, time.Now(), 1)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, apperrors.ErrTooManyRequests, appErr.Code)

	_, err = svc.ApplyConsumerPlan(ctx, 7, types.ConsumerPlanPro, "active", "evt-1", time.Now(), "customer", "sub")
	require.NoError(t, err)
	assert.Equal(t, int64(2_500_000), manager.updateLimit)
}

func TestEntitlementServiceOpenRouterUserIDIsStableAcrossTenants(t *testing.T) {
	repo := &entitlementRepoStub{tenant: &types.Tenant{ID: 7}}
	svc := newEntitlementService(repo, nil)
	const userID = "same-user"
	a := svc.OpenRouterUserID(entitlementContext(7, userID))
	b := svc.OpenRouterUserID(entitlementContext(99, userID))

	assert.NotEmpty(t, a)
	assert.Equal(t, a, b)
	assert.NotContains(t, a, userID)
	assert.Contains(t, a, "musuw_")
	assert.Empty(t, svc.OpenRouterUserID(entitlementContext(7, "")))
}
