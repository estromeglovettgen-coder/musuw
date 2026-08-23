package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/logger"
	modelopenrouter "github.com/Tencent/WeKnora/internal/models/openrouter"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type entitlementRepoStub struct {
	mu     sync.Mutex
	tenant *types.Tenant
}

func (s *entitlementRepoStub) GetTenantEntitlement(context.Context, uint64) (*types.Tenant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
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

func (s *entitlementRepoStub) SetOpenRouterCredentialsIfAbsent(_ context.Context, _ uint64, credentials *types.OpenRouterCredentials, creditPeriodEnd time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.tenant.Credentials != nil && s.tenant.Credentials.OpenRouter != nil {
		return false, nil
	}
	if s.tenant.Credentials == nil {
		s.tenant.Credentials = &types.CredentialsConfig{}
	}
	copy := *credentials
	s.tenant.Credentials.OpenRouter = &copy
	value := creditPeriodEnd.UTC()
	s.tenant.OpenRouterCreditPeriodEnd = &value
	return true, nil
}

func (s *entitlementRepoStub) ApplyConsumerPlan(_ context.Context, _ uint64, plan types.ConsumerPlan, status, billingPeriod, _ string, _ time.Time, customerID, subscriptionID string, creditPeriodEnd, paddlePeriodEnd *time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tenant.Plan = plan
	if status == "" {
		status = "active"
	}
	s.tenant.PlanStatus = status
	s.tenant.PaddleBillingPeriod = billingPeriod
	s.tenant.PaddleCustomerID = customerID
	s.tenant.PaddleSubscriptionID = subscriptionID
	if types.EffectiveConsumerPlan(s.tenant) == types.ConsumerPlanFree && status != "paused" {
		s.tenant.PaddleCurrentPeriodEnd = nil
	} else if paddlePeriodEnd != nil && (s.tenant.PaddleCurrentPeriodEnd == nil || paddlePeriodEnd.After(s.tenant.PaddleCurrentPeriodEnd.UTC())) {
		value := paddlePeriodEnd.UTC()
		s.tenant.PaddleCurrentPeriodEnd = &value
	}
	s.tenant.OpenRouterCreditPeriodEnd = creditPeriodEnd
	return true, nil
}

func (s *entitlementRepoStub) AdvanceOpenRouterCreditPeriod(_ context.Context, _ uint64, periodEnd time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.tenant.OpenRouterCreditPeriodEnd != nil && !periodEnd.After(*s.tenant.OpenRouterCreditPeriodEnd) {
		return false, nil
	}
	value := periodEnd.UTC()
	s.tenant.OpenRouterCreditPeriodEnd = &value
	return true, nil
}

func (s *entitlementRepoStub) AdvancePaddleCurrentPeriod(_ context.Context, _ uint64, plan types.ConsumerPlan, customerID, subscriptionID, billingPeriod string, periodEnd time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if types.EffectiveConsumerPlan(s.tenant) != plan || s.tenant.PaddleCustomerID != customerID ||
		s.tenant.PaddleSubscriptionID != subscriptionID || s.tenant.PaddleBillingPeriod != billingPeriod {
		return false, nil
	}
	if s.tenant.PaddleCurrentPeriodEnd != nil && !periodEnd.After(s.tenant.PaddleCurrentPeriodEnd.UTC()) {
		return false, nil
	}
	value := periodEnd.UTC()
	s.tenant.PaddleCurrentPeriodEnd = &value
	return true, nil
}

type keyManagerStub struct {
	mu           sync.Mutex
	created      *modelopenrouter.ManagedKey
	info         *modelopenrouter.KeyInfo
	getDelay     time.Duration
	createCalls  int
	updateLimit  int64
	updateCalls  int
	monthlyReset bool
	createReset  bool
	createLimit  int64
	updateErr    error
}

func (s *keyManagerStub) CreateKey(_ context.Context, _ string, limit int64, monthlyReset bool) (*modelopenrouter.ManagedKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.createCalls++
	s.createLimit = limit
	s.createReset = monthlyReset
	if s.info == nil {
		s.info = &modelopenrouter.KeyInfo{Hash: s.created.Hash, LimitMicrousd: limit, LimitRemainingMicrousd: limit, MonthlyReset: monthlyReset}
	}
	return s.created, nil
}
func (s *keyManagerStub) UpdateKeyLimit(_ context.Context, _ string, limit int64, monthlyReset bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.updateCalls++
	s.updateLimit = limit
	s.monthlyReset = monthlyReset
	if s.info != nil {
		s.info.LimitMicrousd = limit
		remaining := limit - s.info.UsageMicrousd
		if remaining < 0 {
			remaining = 0
		}
		s.info.LimitRemainingMicrousd = remaining
		s.info.MonthlyReset = monthlyReset
	}
	return s.updateErr
}

func TestFreeAllowanceRefreshesOnRegistrationAnniversaryWithoutStacking(t *testing.T) {
	createdAt := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	previousPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID:                        7,
		Plan:                      types.ConsumerPlanFree,
		PlanStatus:                "active",
		CreatedAt:                 createdAt,
		OpenRouterCreditPeriodEnd: &previousPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		Hash:                   "hash-7",
		LimitMicrousd:          1_000_000,
		LimitRemainingMicrousd: 400_000,
		UsageMicrousd:          600_000,
	}}
	svc := newEntitlementService(repo, manager)

	// Returning after several missed boundaries grants one current allowance,
	// not one allowance for every inactive month.
	current, err := svc.Current(entitlementContext(7, "user-123"), time.Date(2026, 12, 15, 12, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Equal(t, int64(1_600_000), manager.updateLimit)
	assert.Equal(t, 1, manager.updateCalls)
	assert.Equal(t, int64(1_000_000), current.OpenRouterRemainingMicrousd)
	assert.Zero(t, current.OpenRouterUsedMicrousd)
	require.NotNil(t, current.OpenRouterResetsAt)
	assert.Equal(t, time.Date(2026, 12, 28, 9, 30, 0, 0, time.UTC), current.OpenRouterResetsAt.UTC())
	require.NotNil(t, repo.tenant.OpenRouterCreditPeriodEnd)
	assert.Equal(t, time.Date(2026, 12, 28, 9, 30, 0, 0, time.UTC), repo.tenant.OpenRouterCreditPeriodEnd.UTC())
}

func TestFreeAllowanceKeepsEndOfMonthRegistrationAnchor(t *testing.T) {
	createdAt := time.Date(2026, 1, 31, 8, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 2, 28, 8, 0, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanFree, PlanStatus: "active", CreatedAt: createdAt,
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{LimitMicrousd: 1_000_000, UsageMicrousd: 250_000}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.Current(entitlementContext(7, "user-123"), time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	require.NotNil(t, repo.tenant.OpenRouterCreditPeriodEnd)
	assert.Equal(t, time.Date(2026, 3, 31, 8, 0, 0, 0, time.UTC), repo.tenant.OpenRouterCreditPeriodEnd.UTC())
}

func TestMonthlyPaidAllowanceWaitsForConfirmedRenewal(t *testing.T) {
	periodEnd := time.Now().UTC().Add(-time.Minute)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 500_000}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.ErrorIs(t, err, errAllowanceRenewalPending)
	assert.Zero(t, manager.updateCalls)
}

func TestCurrentMarksAllowanceRenewalAsPending(t *testing.T) {
	periodEnd := time.Now().UTC().Add(-time.Minute)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 500_000}}
	svc := newEntitlementService(repo, manager)

	current, err := svc.Current(entitlementContext(7, "user-123"), time.Now().UTC())
	require.NoError(t, err)
	require.NotNil(t, current)
	assert.Equal(t, types.OpenRouterCreditsPending, current.OpenRouterCreditsStatus)
	assert.Zero(t, current.OpenRouterRemainingMicrousd)
	assert.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanPro).MonthlyOpenRouterMicrousd, current.OpenRouterUsedMicrousd)
	assert.Zero(t, manager.updateCalls)
}

func TestAnnualPaidAllowanceStopsAtVerifiedPaidTermEnd(t *testing.T) {
	now := time.Now().UTC()
	creditPeriodEnd := now.Add(24 * time.Hour)
	paidTermEnd := now.Add(-time.Minute)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "past_due", PaddleBillingPeriod: "yearly",
		PaddleCurrentPeriodEnd: &paidTermEnd, OpenRouterCreditPeriodEnd: &creditPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 500_000,
	}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.ErrorIs(t, err, errAllowanceRenewalPending)
	assert.Zero(t, manager.updateCalls)
}

func TestAnnualPaidAllowanceWithUnknownPaidTermFailsClosed(t *testing.T) {
	now := time.Now().UTC()
	creditPeriodEnd := now.Add(24 * time.Hour)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "yearly",
		OpenRouterCreditPeriodEnd: &creditPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 500_000,
	}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.ErrorIs(t, err, errAllowanceRenewalPending)
	assert.Zero(t, manager.updateCalls)
}

func TestPaidAllowanceWithUnknownBillingPeriodFailsClosedBeforeCreditBoundary(t *testing.T) {
	creditPeriodEnd := time.Now().UTC().Add(24 * time.Hour)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active",
		OpenRouterCreditPeriodEnd: &creditPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{LimitMicrousd: 2_500_000}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.ErrorIs(t, err, errAllowanceRenewalPending)
}

func TestAnnualPaidAllowanceRefreshesInsideVerifiedPaidTerm(t *testing.T) {
	at := time.Date(2026, 9, 29, 9, 30, 0, 0, time.UTC)
	creditPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	paidTermEnd := time.Date(2027, 8, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "yearly",
		PaddleCurrentPeriodEnd: &paidTermEnd, OpenRouterCreditPeriodEnd: &creditPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 100_000, UsageMicrousd: 900_000,
	}}
	svc := newEntitlementService(repo, manager)

	current, err := svc.Current(entitlementContext(7, "user-123"), at)
	require.NoError(t, err)
	assert.Equal(t, int64(3_400_000), manager.updateLimit)
	assert.Equal(t, int64(2_500_000), current.OpenRouterRemainingMicrousd)
	assert.Equal(t, 1, manager.updateCalls)
}

func TestApplyAnnualConsumerPlanPersistsVerifiedPaidTerm(t *testing.T) {
	activatedAt := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	paidTermEnd := time.Date(2027, 8, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanFree, PlanStatus: "active",
	}}
	svc := newEntitlementService(repo, nil)

	applied, err := svc.ApplyConsumerPlan(context.Background(), 7, types.ConsumerPlanPro, "active", "yearly", "evt-annual", activatedAt, "ctm_1", "sub_1", &paidTermEnd)
	require.NoError(t, err)
	assert.True(t, applied)
	require.NotNil(t, repo.tenant.PaddleCurrentPeriodEnd)
	assert.Equal(t, paidTermEnd, repo.tenant.PaddleCurrentPeriodEnd.UTC())
	require.NotNil(t, repo.tenant.OpenRouterCreditPeriodEnd)
	assert.Equal(t, time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC), repo.tenant.OpenRouterCreditPeriodEnd.UTC())
}

func TestApplyConsumerPlanIgnoresInitialPaidStateWithoutConfirmedPeriod(t *testing.T) {
	now := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanFree, PlanStatus: "active",
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		UsageMicrousd: 600_000, LimitMicrousd: 1_000_000, LimitRemainingMicrousd: 400_000,
	}}
	svc := newEntitlementService(repo, manager)

	applied, err := svc.ApplyConsumerPlan(
		context.Background(), 7, types.ConsumerPlanPro, "active", "monthly",
		"evt-unconfirmed", now, "ctm_new", "sub_new", nil,
	)
	require.NoError(t, err)
	assert.False(t, applied)
	assert.Zero(t, manager.updateCalls)
	assert.Equal(t, types.ConsumerPlanFree, repo.tenant.Plan)
	assert.Empty(t, repo.tenant.PaddleCustomerID)
	assert.Empty(t, repo.tenant.PaddleSubscriptionID)
	assert.Empty(t, repo.tenant.PaddleBillingPeriod)
	assert.Nil(t, repo.tenant.PaddleCurrentPeriodEnd)
	assert.Nil(t, repo.tenant.OpenRouterCreditPeriodEnd)
}

func TestPausedAnnualResumePreservesAllowanceAndPaidTerm(t *testing.T) {
	now := time.Now().UTC()
	creditPeriodEnd := now.AddDate(0, 1, 0)
	paidTermEnd := now.AddDate(1, 0, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "yearly",
		PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1",
		OpenRouterCreditPeriodEnd: &creditPeriodEnd, PaddleCurrentPeriodEnd: &paidTermEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 1_000_000}}
	svc := newEntitlementService(repo, manager)

	applied, err := svc.ApplyConsumerPlan(context.Background(), 7, types.ConsumerPlanPro, "paused", "yearly", "evt-paused", now, "ctm_1", "sub_1", nil)
	require.NoError(t, err)
	assert.True(t, applied)
	assert.Equal(t, types.ConsumerPlanFree, types.EffectiveConsumerPlan(repo.tenant))
	assert.Equal(t, 0, manager.updateCalls)
	_, err = svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.ErrorIs(t, err, errSubscriptionPaused)

	applied, err = svc.ApplyConsumerPlan(context.Background(), 7, types.ConsumerPlanPro, "active", "yearly", "evt-resumed", now.Add(time.Second), "ctm_1", "sub_1", nil)
	require.NoError(t, err)
	assert.True(t, applied)
	assert.Equal(t, types.ConsumerPlanPro, types.EffectiveConsumerPlan(repo.tenant))
	assert.Equal(t, 0, manager.updateCalls)
	key, err := svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.NoError(t, err)
	assert.Equal(t, "sk-child", key)
	require.NotNil(t, repo.tenant.OpenRouterCreditPeriodEnd)
	assert.Equal(t, creditPeriodEnd, repo.tenant.OpenRouterCreditPeriodEnd.UTC())
	require.NotNil(t, repo.tenant.PaddleCurrentPeriodEnd)
	assert.Equal(t, paidTermEnd, repo.tenant.PaddleCurrentPeriodEnd.UTC())
}

func TestCancelAfterPauseStartsFullFreeAllowance(t *testing.T) {
	now := time.Now().UTC()
	creditPeriodEnd := now.AddDate(0, 1, 0)
	paidTermEnd := now.AddDate(1, 0, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "paused", PaddleBillingPeriod: "yearly",
		PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1",
		OpenRouterCreditPeriodEnd: &creditPeriodEnd, PaddleCurrentPeriodEnd: &paidTermEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		UsageMicrousd: 2_000_000, LimitMicrousd: 2_200_000, LimitRemainingMicrousd: 200_000,
	}}
	svc := newEntitlementService(repo, manager)

	applied, err := svc.ApplyConsumerPlan(context.Background(), 7, types.ConsumerPlanFree, "canceled", "yearly", "evt-canceled", now, "ctm_1", "sub_1", nil)
	require.NoError(t, err)
	assert.True(t, applied)
	assert.Equal(t, int64(3_000_000), manager.updateLimit)
	assert.Equal(t, 1, manager.updateCalls)
	assert.Nil(t, repo.tenant.PaddleCurrentPeriodEnd)
}

func TestPaidAllowanceWithUnknownBillingPeriodFailsClosed(t *testing.T) {
	periodEnd := time.Now().UTC().Add(-time.Minute)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanMax, PlanStatus: "active",
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{LimitMicrousd: 5_000_000, LimitRemainingMicrousd: 500_000}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.OpenRouterAPIKey(entitlementContext(7, "user-123"))
	require.ErrorIs(t, err, errAllowanceRenewalPending)
	assert.Zero(t, manager.updateCalls)
}

func TestRecurringPaidAllowanceRefreshesOncePerPeriod(t *testing.T) {
	oldPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	newPeriodEnd := time.Date(2026, 10, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1", OpenRouterCreditPeriodEnd: &oldPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 100_000, UsageMicrousd: 900_000,
	}}
	svc := newEntitlementService(repo, manager)

	applied, err := svc.RefreshPaidAllowance(context.Background(), 7, types.ConsumerPlanPro, "evt-renew", oldPeriodEnd, "ctm_1", "sub_1", newPeriodEnd)
	require.NoError(t, err)
	assert.True(t, applied)
	assert.Equal(t, int64(3_400_000), manager.updateLimit)
	assert.Equal(t, 1, manager.updateCalls)

	applied, err = svc.RefreshPaidAllowance(context.Background(), 7, types.ConsumerPlanPro, "evt-renew-duplicate", oldPeriodEnd, "ctm_1", "sub_1", newPeriodEnd)
	require.NoError(t, err)
	assert.False(t, applied)
	assert.Equal(t, 1, manager.updateCalls)
}

func TestAnnualRecurringCompletionAdvancesPaidTermWithoutGrantingAllowance(t *testing.T) {
	oldPaidTermEnd := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	newPaidTermEnd := time.Date(2027, 8, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "past_due", PaddleBillingPeriod: "yearly",
		PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1", PaddleCurrentPeriodEnd: &oldPaidTermEnd,
	}}
	svc := newEntitlementService(repo, nil)

	applied, err := svc.RefreshPaidAllowance(context.Background(), 7, types.ConsumerPlanPro, "evt-renew", oldPaidTermEnd, "ctm_1", "sub_1", newPaidTermEnd)
	require.NoError(t, err)
	assert.True(t, applied)
	require.NotNil(t, repo.tenant.PaddleCurrentPeriodEnd)
	assert.Equal(t, newPaidTermEnd, repo.tenant.PaddleCurrentPeriodEnd.UTC())

	applied, err = svc.RefreshPaidAllowance(context.Background(), 7, types.ConsumerPlanPro, "evt-renew-duplicate", oldPaidTermEnd, "ctm_1", "sub_1", newPaidTermEnd)
	require.NoError(t, err)
	assert.False(t, applied)
}

func TestConcurrentRecurringDeliveriesMutateProviderOnlyOnce(t *testing.T) {
	oldPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	newPeriodEnd := time.Date(2026, 10, 28, 9, 30, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1", OpenRouterCreditPeriodEnd: &oldPeriodEnd,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{
		info: &modelopenrouter.KeyInfo{
			LimitMicrousd: 2_500_000, LimitRemainingMicrousd: 100_000, UsageMicrousd: 900_000,
		},
		getDelay: 20 * time.Millisecond,
	}
	svc := newEntitlementService(repo, manager)

	const deliveries = 12
	var wg sync.WaitGroup
	results := make(chan bool, deliveries)
	errs := make(chan error, deliveries)
	for i := 0; i < deliveries; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			applied, err := svc.RefreshPaidAllowance(context.Background(), 7, types.ConsumerPlanPro, fmt.Sprintf("evt-renew-%d", index), oldPeriodEnd, "ctm_1", "sub_1", newPeriodEnd)
			results <- applied
			errs <- err
		}(i)
	}
	wg.Wait()
	close(results)
	close(errs)

	appliedCount := 0
	for applied := range results {
		if applied {
			appliedCount++
		}
	}
	for err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, 1, appliedCount)
	assert.Equal(t, 1, manager.updateCalls)
}

func (s *keyManagerStub) GetKey(context.Context, string) (*modelopenrouter.KeyInfo, error) {
	time.Sleep(s.getDelay)
	s.mu.Lock()
	defer s.mu.Unlock()
	copy := *s.info
	return &copy, nil
}
func (s *keyManagerStub) DeleteKey(context.Context, string) error { return nil }

func entitlementContext(tenantID uint64, userID string) context.Context {
	ctx := context.WithValue(context.Background(), types.TenantIDContextKey, tenantID)
	return context.WithValue(ctx, types.UserIDContextKey, userID)
}

func TestEntitlementServiceReportsUnprovisionedWhenProviderKeyIsAbsent(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID:          7,
		Plan:        types.ConsumerPlanPlus,
		PlanStatus:  "active",
		StorageUsed: 123,
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

func TestEntitlementServiceReadsAnotherTenantThroughPlatformContext(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	periodEnd := now.AddDate(0, 1, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active", PaddleBillingPeriod: "monthly", StorageUsed: 321,
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		Hash: "hash-7", LimitMicrousd: 1_250_000, LimitRemainingMicrousd: 900_000, UsageMicrousd: 350_000,
	}}
	svc := newEntitlementService(repo, manager)

	current, err := svc.CurrentForTenant(context.Background(), 7, now)
	require.NoError(t, err)
	assert.Equal(t, int64(321), current.StorageUsed)
	assert.Equal(t, int64(350_000), current.OpenRouterUsedMicrousd)
	assert.Equal(t, int64(900_000), current.OpenRouterRemainingMicrousd)
	assert.Equal(t, int64(350_000), current.OpenRouterProviderUsedMicrousd)
	assert.Equal(t, int64(900_000), current.OpenRouterProviderRemainingMicrousd)
}

func TestEntitlementServiceAdjustsProviderRemainingWithoutLocalLedger(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	periodEnd := now.AddDate(0, 1, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{
		Hash: "hash-7", LimitMicrousd: 1_250_000, LimitRemainingMicrousd: 900_000, UsageMicrousd: 350_000,
	}}
	svc := newEntitlementService(repo, manager)

	current, err := svc.SetOpenRouterRemainingForTenant(context.Background(), 7, 700_000)
	require.NoError(t, err)
	assert.Equal(t, int64(1_050_000), manager.updateLimit)
	assert.False(t, manager.monthlyReset)
	assert.Equal(t, int64(700_000), current.OpenRouterRemainingMicrousd)
	assert.Equal(t, int64(550_000), current.OpenRouterUsedMicrousd)
}

func TestEntitlementServiceAllowsBoundedMaxCompensationForLowerPlan(t *testing.T) {
	periodEnd := time.Now().UTC().AddDate(0, 1, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{Hash: "hash-7", LimitMicrousd: 1_250_000, LimitRemainingMicrousd: 1_250_000}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.SetOpenRouterRemainingForTenant(context.Background(), 7, 5_000_000)
	require.NoError(t, err)
	assert.Equal(t, int64(5_000_000), manager.updateLimit)
	assert.Equal(t, 1, manager.updateCalls)
}

func TestEntitlementServiceRejectsRemainingAboveMaxAllowance(t *testing.T) {
	periodEnd := time.Now().UTC().AddDate(0, 1, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active", PaddleBillingPeriod: "monthly",
		OpenRouterCreditPeriodEnd: &periodEnd,
		Credentials:               &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-child", KeyHash: "hash-7"}},
	}}
	manager := &keyManagerStub{info: &modelopenrouter.KeyInfo{Hash: "hash-7", LimitMicrousd: 1_250_000, LimitRemainingMicrousd: 1_250_000}}
	svc := newEntitlementService(repo, manager)

	_, err := svc.SetOpenRouterRemainingForTenant(context.Background(), 7, 5_000_001)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot exceed the Max plan allowance")
	assert.Zero(t, manager.updateCalls)
}

func TestEntitlementServiceProvisionsProviderLimitedTenantKey(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "0123456789abcdef0123456789abcdef")
	previousLogFormat := os.Getenv("LOG_FORMAT")
	t.Setenv("LOG_FORMAT", "%msg")
	logger.ConfigureFromEnv()
	var logs bytes.Buffer
	logger.SetOutput(&logs)
	t.Cleanup(func() {
		_ = os.Setenv("LOG_FORMAT", previousLogFormat)
		logger.ConfigureFromEnv()
	})
	paidPeriodEnd := time.Now().UTC().AddDate(0, 1, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active", PaddleBillingPeriod: "monthly", OpenRouterCreditPeriodEnd: &paidPeriodEnd,
	}}
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
	assert.False(t, manager.createReset)
	assert.Equal(t, int64(1_250_000), manager.createLimit)
	require.NotNil(t, repo.tenant.OpenRouterCreditPeriodEnd)
	assert.Contains(t, logs.String(), "OpenRouter tenant key provisioning started tenant_id=7 monthly_limit_microusd=1250000")
	assert.Contains(t, logs.String(), "OpenRouter tenant key provisioning completed tenant_id=7")
	assert.NotContains(t, logs.String(), "sk-child")
	assert.NotContains(t, logs.String(), "hash-7")

	key, err = svc.OpenRouterAPIKey(ctx)
	require.NoError(t, err)
	assert.Equal(t, "sk-child", key)
	assert.Equal(t, 1, manager.createCalls)
}

func TestEntitlementServiceUsesProviderUsageAndSynchronizesPlanLimit(t *testing.T) {
	paidPeriodEnd := time.Now().UTC().AddDate(0, 1, 0)
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active", PaddleBillingPeriod: "monthly", OpenRouterCreditPeriodEnd: &paidPeriodEnd,
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

	periodEnd := time.Now().AddDate(0, 1, 0)
	_, err = svc.ApplyConsumerPlan(ctx, 7, types.ConsumerPlanPro, "active", "monthly", "evt-1", time.Now(), "customer", "sub", &periodEnd)
	require.NoError(t, err)
	assert.Equal(t, int64(2_250_000), manager.updateLimit)
}

func TestApplyConsumerPlanDoesNotGrantPlanWhenProviderLimitUpdateFails(t *testing.T) {
	repo := &entitlementRepoStub{tenant: &types.Tenant{
		ID:         7,
		Plan:       types.ConsumerPlanFree,
		PlanStatus: "active",
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-child", KeyHash: "hash-7",
		}},
	}}
	manager := &keyManagerStub{
		info:      &modelopenrouter.KeyInfo{LimitMicrousd: 1_000_000, LimitRemainingMicrousd: 1_000_000, MonthlyReset: true},
		updateErr: errors.New("provider unavailable"),
	}
	svc := newEntitlementService(repo, manager)

	periodEnd := time.Now().AddDate(0, 1, 0)
	applied, err := svc.ApplyConsumerPlan(context.Background(), 7, types.ConsumerPlanPro, "active", "monthly", "evt-1", time.Now(), "customer", "sub", &periodEnd)
	require.Error(t, err)
	assert.False(t, applied)
	assert.Equal(t, types.ConsumerPlanFree, repo.tenant.Plan)
	assert.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanPro).MonthlyOpenRouterMicrousd, manager.updateLimit)
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
