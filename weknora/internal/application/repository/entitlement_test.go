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
	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "active", "monthly", "evt-new", time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1", &periodEnd)
	require.NoError(t, err)
	assert.True(t, applied)

	applied, err = repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanFree, "canceled", "", "evt-old", time.Date(2026, 8, 15, 12, 0, 0, 0, time.UTC), "ctm_1", "sub_1", nil)
	require.NoError(t, err)
	assert.False(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, int64(40*1024*1024*1024), stored.StorageQuota)
}

func TestApplyCanceledConsumerPlanRestoresFreeStorageQuota(t *testing.T) {
	db := setupTestDB(t)
	repo := NewEntitlementRepository(db)
	tenant := &types.Tenant{Name: "subscriber", Status: "active", Plan: types.ConsumerPlanPro, PlanStatus: "active"}
	require.NoError(t, db.Create(tenant).Error)

	applied, err := repo.ApplyConsumerPlan(context.Background(), tenant.ID, types.ConsumerPlanPro, "canceled", "", "evt-canceled", time.Now(), "ctm_1", "sub_1", nil)
	require.NoError(t, err)
	assert.True(t, applied)

	var stored types.Tenant
	require.NoError(t, db.First(&stored, tenant.ID).Error)
	assert.Equal(t, types.ConsumerPlanPro, stored.Plan)
	assert.Equal(t, "canceled", stored.PlanStatus)
	assert.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanFree).StorageBytes, stored.StorageQuota)
}
