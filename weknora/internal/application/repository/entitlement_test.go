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
	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "monthly", "evt-new", time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1", &periodEnd, &periodEnd)
	require.NoError(t, err)
	assert.True(t, applied)

	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanFree, "canceled", "", "evt-old", time.Date(2026, 8, 15, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1", nil, nil)
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, int64(40*1024*1024*1024), stored.StorageQuota)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, periodEnd, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestApplyCanceledConsumerPlanRestoresFreeStorageQuota(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	paidTermEnd := time.Now().UTC().AddDate(1, 0, 0)
	tenant := &types.Tenant{Name: "subscriber", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleCurrentPeriodEnd: &paidTermEnd}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "canceled", "", "evt-canceled", time.Now(), "ctm_1", "sub_1", nil, nil)
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
	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "paused", "yearly", "evt-paused", pausedAt, "ctm_1", "sub_1", nil, nil)
	require.NoError(t, err)
	assert.True(t, applied)

	resumedAt := pausedAt.Add(time.Second)
	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "yearly", "evt-resumed", resumedAt, "ctm_1", "sub_1", nil, nil)
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
	applied, err := repo.AdvancePaddleCurrentPeriod(context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_1", "sub_1", "yearly", newer)
	require.NoError(t, err)
	assert.True(t, applied)

	applied, err = repo.AdvancePaddleCurrentPeriod(context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_1", "sub_1", "yearly", initial)
	require.NoError(t, err)
	assert.False(t, applied)

	applied, err = repo.AdvancePaddleCurrentPeriod(context.Background(), tenant.ID, types.ConsumerPlanPro, "ctm_1", "sub_replaced", "yearly", newer.AddDate(1, 0, 0))
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, newer, stored.PaddleCurrentPeriodEnd.UTC())
}

func TestApplyConsumerPlanCannotRollBackConfirmedPaidTerm(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	oldTermEnd := time.Date(2026, 8, 28, 9, 30, 0, 0, time.UTC)
	newTermEnd := oldTermEnd.AddDate(1, 0, 0)
	tenant := &types.Tenant{Name: "annual", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active", PaddleCurrentPeriodEnd: &newTermEnd}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "yearly", "evt-updated", time.Now().UTC(), "ctm_1", "sub_1", nil, nil)
	require.NoError(t, err)
	assert.True(t, applied)

	evenLaterEvent := time.Now().UTC().Add(time.Second)
	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "yearly", "evt-old-period", evenLaterEvent, "ctm_1", "sub_1", nil, &oldTermEnd)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	require.NotNil(t, stored.PaddleCurrentPeriodEnd)
	assert.Equal(t, newTermEnd, stored.PaddleCurrentPeriodEnd.UTC())
}
