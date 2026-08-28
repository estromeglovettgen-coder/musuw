package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyConsumerPlanUpdatesQuotaAndIgnoresOlderBillingEvent(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{Name: "subscriber", Status: "active"}
	require.NoError(t, db.Create(tenant).Error)

	periodEnd := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "monthly", "evt-new", time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1", &periodEnd, &periodEnd, 2_500_000)
	require.NoError(t, err)
	assert.True(t, applied)

	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanFree, "canceled", "", "evt-old", time.Date(2026, 8, 15, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1", nil, nil, 0)
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanPro).StorageBytes, stored.StorageQuota)
	assert.Equal(t, int64(2_500_000), stored.OpenRouterDesiredLimitMicrousd)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, periodEnd, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestApplyConsumerPlanCannotReplaceConcurrentInitialSubscription(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{Name: "subscriber", Status: "active"}
	require.NoError(t, db.Create(tenant).Error)

	firstAt := time.Date(2026, 8, 28, 12, 0, 0, 0, time.UTC)
	firstEnd := firstAt.AddDate(0, 1, 0)
	applied, err := repo.ApplyConsumerPlan(
		context.Background(), tenant.ID, types.ConsumerPlanPlus, "active", "monthly",
		"evt-first", firstAt, "ctm_1", "sub_first", &firstEnd, &firstEnd, 1_250_000,
	)
	require.NoError(t, err)
	require.True(t, applied)

	secondAt := firstAt.Add(time.Second)
	secondEnd := secondAt.AddDate(0, 1, 0)
	applied, err = repo.ApplyConsumerPlan(
		context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "monthly",
		"evt-second", secondAt, "ctm_1", "sub_second", &secondEnd, &secondEnd, 2_500_000,
	)
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPlus, stored.Plan)
	assert.Equal(t, "sub_first", stored.PaddleSubscriptionID)
	assert.Equal(t, "evt-first", stored.PaddleLastEventID)
}

func TestResolvePaddleSubscriptionRequiresExactUnambiguousBinding(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	bound := &types.Tenant{
		Name: "bound", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		PaddleBillingPeriod: "yearly", PaddleCustomerID: "ctm_bound", PaddleSubscriptionID: "sub_bound",
	}
	require.NoError(t, db.Create(bound).Error)

	binding, err := repo.ResolvePaddleSubscription(context.Background(), "ctm_bound", "sub_bound")
	require.NoError(t, err)
	require.NotNil(t, binding)
	assert.Equal(t, bound.ID, binding.TenantID)
	assert.Equal(t, types.ConsumerPlanPro, binding.Plan)
	assert.Equal(t, "yearly", binding.BillingPeriod)

	binding, err = repo.ResolvePaddleSubscription(context.Background(), "ctm_other", "sub_bound")
	require.NoError(t, err)
	assert.Nil(t, binding)

	duplicate := &types.Tenant{
		Name: "duplicate", Status: "active", Plan: types.ConsumerPlanPlus, PlanStatus: "active",
		PaddleBillingPeriod: "monthly", PaddleCustomerID: "ctm_bound", PaddleSubscriptionID: "sub_bound",
	}
	require.NoError(t, db.Create(duplicate).Error)
	binding, err = repo.ResolvePaddleSubscription(context.Background(), "ctm_bound", "sub_bound")
	assert.Error(t, err)
	assert.Nil(t, binding)
}

func TestApplyCanceledConsumerPlanRestoresFreeStorageQuota(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	paidTermEnd := time.Now().UTC().AddDate(1, 0, 0)
	tenant := &types.Tenant{Name: "subscriber", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleCurrentPeriodEnd: &paidTermEnd}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "canceled", "", "evt-canceled", time.Now(), "ctm_1", "sub_1", nil, nil, 0)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, "canceled", stored.PlanStatus)
	assert.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanFree).StorageBytes, stored.StorageQuota)
	assert.Nil(t, stored.PaddleCurrentPeriodEnd)
}

func TestPausedAnnualPlanPreservesConfirmedTermForResume(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	paidTermEnd := time.Now().UTC().AddDate(0, 6, 0)
	tenant := &types.Tenant{
		Name: "subscriber", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		PaddleBillingPeriod: "yearly", PaddleCurrentPeriodEnd: &paidTermEnd,
	}
	require.NoError(t, db.Create(tenant).Error)

	pausedAt := time.Now().UTC()
	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "paused", "yearly", "evt-paused", pausedAt, "ctm_1", "sub_1", nil, nil, 0)
	require.NoError(t, err)
	assert.True(t, applied)

	resumedAt := pausedAt.Add(time.Second)
	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "yearly", "evt-resumed", resumedAt, "ctm_1", "sub_1", nil, nil, 0)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, types.EffectiveConsumerPlan(&stored))
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, paidTermEnd, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestAdvancePaddleCurrentPeriodOnlyMovesForward(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	initial := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	tenant := &types.Tenant{Name: "annual", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "past_due", PaddleCurrentPeriodEnd: &initial}
	require.NoError(t, db.Create(tenant).Error)

	newer := initial.AddDate(1, 0, 0)
	tenant.PaddleCustomerID = "ctm_1"
	tenant.PaddleSubscriptionID = "sub_1"
	tenant.PaddleBillingPeriod = "yearly"
	require.NoError(t, db.Save(tenant).Error)
	applied, err := repo.AdvancePaddleCurrentPeriod(context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_1", "sub_1", "yearly", "", time.Time{}, newer)
	require.NoError(t, err)
	assert.True(t, applied)

	applied, err = repo.AdvancePaddleCurrentPeriod(context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_1", "sub_1", "yearly", "", time.Time{}, initial)
	require.NoError(t, err)
	assert.False(t, applied)

	applied, err = repo.AdvancePaddleCurrentPeriod(context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_1", "sub_replaced", "yearly", "", time.Time{}, newer.AddDate(1, 0, 0))
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, newer, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestNewerRecurringPeriodPreventsOlderRefundRollback(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	oldPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	renewedAt := time.Date(2026, 9, 28, 10, 0, 0, 0, time.UTC)
	newPeriodEnd := oldPeriodEnd.AddDate(0, 1, 0)
	tenant := &types.Tenant{
		Name: "subscriber", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		PaddleBillingPeriod: "monthly", PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1",
		OpenRouterCreditPeriodEnd: &oldPeriodEnd,
	}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.AdvanceOpenRouterCreditPeriod(
		context.Background(), tenant.ID, types.ConsumerPlanPro, "monthly", "evt-renewed", renewedAt,
		"ctm_1", "sub_1", newPeriodEnd, 2_500_000,
	)
	require.NoError(t, err)
	assert.True(t, applied)

	olderRefundAt := renewedAt.Add(-time.Minute)
	applied, err = repo.ApplyConsumerPlan(
		context.Background(), tenant.ID, types.ConsumerPlanFree, "refunded", "", "evt-old-refund", olderRefundAt,
		"ctm_1", "sub_1", nil, nil, 0,
	)
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, "active", stored.PlanStatus)
	assert.Empty(t, stored.PaddleLastEventID, "renewals must not advance the lifecycle cursor")
	require.NotNil(t, stored.PaddleLastRenewalAt)
	assert.Equal(t, renewedAt, stored.PaddleLastRenewalAt.UTC())
	require.NotNil(t, stored.OpenRouterCreditPeriodEnd)
	assert.Equal(t, newPeriodEnd, stored.OpenRouterCreditPeriodEnd.UTC())
}

func TestRenewalIgnoresNewerLifecycleCursor(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	renewedAt := time.Date(2026, 9, 28, 10, 0, 0, 0, time.UTC)
	lifecycleAt := renewedAt.Add(time.Hour)
	oldPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	newPeriodEnd := oldPeriodEnd.AddDate(0, 1, 0)
	tenant := &types.Tenant{
		Name: "monthly", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		PaddleBillingPeriod: "monthly", PaddleCustomerID: "ctm_monthly", PaddleSubscriptionID: "sub_monthly",
		PaddleLastEventID: "evt-lifecycle", PaddleLastEventAt: &lifecycleAt,
		OpenRouterCreditPeriodEnd: &oldPeriodEnd,
	}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.AdvanceOpenRouterCreditPeriod(
		context.Background(), tenant.ID, types.ConsumerPlanPro, "monthly", "evt-renewal", renewedAt,
		"ctm_monthly", "sub_monthly", newPeriodEnd, 2_500_000,
	)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, "evt-lifecycle", stored.PaddleLastEventID)
	require.NotNil(t, stored.PaddleLastEventAt)
	assert.Equal(t, lifecycleAt, stored.PaddleLastEventAt.UTC())
	require.NotNil(t, stored.PaddleLastRenewalAt)
	assert.Equal(t, renewedAt, stored.PaddleLastRenewalAt.UTC())
	assert.Equal(t, newPeriodEnd, stored.OpenRouterCreditPeriodEnd.UTC())
}

func TestAnnualRenewalIgnoresNewerLifecycleCursor(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	renewedAt := time.Date(2026, 9, 28, 10, 0, 0, 0, time.UTC)
	lifecycleAt := renewedAt.Add(time.Hour)
	oldPeriodEnd := time.Date(2026, 9, 28, 9, 30, 0, 0, time.UTC)
	newPeriodEnd := oldPeriodEnd.AddDate(1, 0, 0)
	tenant := &types.Tenant{
		Name: "annual", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		PaddleBillingPeriod: "yearly", PaddleCustomerID: "ctm_annual", PaddleSubscriptionID: "sub_annual",
		PaddleLastEventID: "evt-lifecycle", PaddleLastEventAt: &lifecycleAt,
		PaddleCurrentPeriodEnd: &oldPeriodEnd,
	}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.AdvancePaddleCurrentPeriod(
		context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_annual", "sub_annual", "yearly", "evt-renewal", renewedAt, newPeriodEnd,
	)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, "evt-lifecycle", stored.PaddleLastEventID)
	require.NotNil(t, stored.PaddleLastRenewalAt)
	assert.Equal(t, renewedAt, stored.PaddleLastRenewalAt.UTC())
	assert.Equal(t, newPeriodEnd, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestLifecycleEventAtOrBeforeRenewalIsIgnored(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	renewedAt := time.Date(2026, 9, 28, 10, 0, 0, 0, time.UTC)
	creditPeriodEnd := renewedAt.AddDate(0, 1, 0)
	tenant := &types.Tenant{
		Name: "subscriber", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		PaddleBillingPeriod: "monthly", PaddleCustomerID: "ctm_1", PaddleSubscriptionID: "sub_1",
		PaddleLastRenewalAt: &renewedAt, OpenRouterCreditPeriodEnd: &creditPeriodEnd,
	}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(
		context.Background(), tenant.ID, types.ConsumerPlanPro, "past_due", "monthly", "evt-old-lifecycle", renewedAt,
		"ctm_1", "sub_1", nil, nil, 0,
	)
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, "active", stored.PlanStatus)
	assert.Empty(t, stored.PaddleLastEventID)
}

func TestApplyConsumerPlanCannotRollBackConfirmedPaidTerm(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	oldTermEnd := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	newTermEnd := oldTermEnd.AddDate(1, 0, 0)
	tenant := &types.Tenant{Name: "annual", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleCurrentPeriodEnd: &newTermEnd}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "yearly", "evt-updated", time.Now().UTC(), "ctm_1", "sub_1", nil, nil, 2_500_000)
	require.NoError(t, err)
	assert.True(t, applied)

	evenLaterEvent := time.Now().UTC().Add(time.Second)
	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "yearly", "evt-old-period", evenLaterEvent, "ctm_1", "sub_1", nil, &oldTermEnd, 2_500_000)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, newTermEnd, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestOpenRouterDesiredLimitBootstrapsExactlyOnce(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{Name: "legacy", Status: "active"}
	require.NoError(t, db.Create(tenant).Error)

	inserted, err := repo.SetOpenRouterDesiredLimitIfUnset(context.Background(), tenant.ID, 1_750_000)
	require.NoError(t, err)
	assert.True(t, inserted)
	inserted, err = repo.SetOpenRouterDesiredLimitIfUnset(context.Background(), tenant.ID, 2_500_000)
	require.NoError(t, err)
	assert.False(t, inserted)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, int64(1_750_000), stored.OpenRouterDesiredLimitMicrousd)
}

func TestOpenRouterDesiredLimitCanBeUpdatedForOperatorReplay(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{Name: "operator", Status: "active", OpenRouterDesiredLimitMicrousd: 1_250_000}
	require.NoError(t, db.Create(tenant).Error)

	updated, err := repo.SetOpenRouterDesiredLimit(context.Background(), tenant.ID, 2_150_000)
	require.NoError(t, err)
	assert.True(t, updated)
	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, int64(2_150_000), stored.OpenRouterDesiredLimitMicrousd)
}

func TestRevocationKeepsExistingOpenRouterDesiredLimit(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	paidThrough := time.Now().UTC().AddDate(0, 1, 0)
	tenant := &types.Tenant{
		Name: "revoked", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active",
		OpenRouterDesiredLimitMicrousd: 2_150_000, PaddleCurrentPeriodEnd: &paidThrough,
	}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(
		context.Background(), tenant.ID, types.ConsumerPlanFree, "refunded", "", "evt-refund",
		time.Now().UTC(), "ctm_1", "sub_1", nil, nil, 0,
	)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanFree, types.EffectiveConsumerPlan(&stored))
	assert.Equal(t, "refunded", stored.PlanStatus)
	assert.Equal(t, int64(2_150_000), stored.OpenRouterDesiredLimitMicrousd)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, paidThrough.Unix(), stored.PaddleCurrentPeriodEnd.Unix())
}
