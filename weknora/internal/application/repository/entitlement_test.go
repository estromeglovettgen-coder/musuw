package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecordOpenRouterCostRollsMonthAndAccumulates(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{
		Name:                   "metered",
		Status:                 "active",
		Plan:                   types.ConsumerPlanFree,
		OpenRouterUsageMonth:   "2026-07",
		OpenRouterUsedMicrousd: 900_000,
	}
	require.NoError(t, db.Create(tenant).Error)

	used, err := repo.RecordOpenRouterCost(context.Background(), tenant.ID, time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC), 125)
	require.NoError(t, err)
	assert.Equal(t, int64(125), used)

	used, err = repo.RecordOpenRouterCost(context.Background(), tenant.ID, time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC), 75)
	require.NoError(t, err)
	assert.Equal(t, int64(200), used)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, "2026-08", stored.OpenRouterUsageMonth)
	assert.Equal(t, int64(200), stored.OpenRouterUsedMicrousd)
}

func TestApplyConsumerPlanUpdatesQuotaAndIgnoresOlderBillingEvent(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{Name: "subscriber", Status: "active"}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "evt-new", time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1")
	require.NoError(t, err)
	assert.True(t, applied)

	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanFree, "canceled", "evt-old", time.Date(2026, 8, 15, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1")
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, int64(40*1024*1024*1024), stored.StorageQuota)
}
