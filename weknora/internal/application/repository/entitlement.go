package repository

import (
	"context"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type entitlementRepository struct {
	db *gorm.DB
}

func NewEntitlementRepository(db *gorm.DB) interfaces.EntitlementRepository {
	return &entitlementRepository{db: db}
}

func (r *entitlementRepository) GetTenantEntitlement(ctx context.Context, tenantID uint64) (*types.Tenant, error) {
	var tenant types.Tenant
	if err := r.db.WithContext(ctx).First(&tenant, tenantID).Error; err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *entitlementRepository) RecordOpenRouterCost(ctx context.Context, tenantID uint64, at time.Time, costMicrousd int64) (int64, error) {
	if costMicrousd <= 0 {
		var tenant types.Tenant
		if err := r.db.WithContext(ctx).Select("open_router_usage_month", "open_router_used_microusd").First(&tenant, tenantID).Error; err != nil {
			return 0, err
		}
		return types.EffectiveOpenRouterUsage(&tenant, at), nil
	}
	var used int64
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tenant types.Tenant
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&tenant, tenantID).Error; err != nil {
			return err
		}
		month := types.OpenRouterUsageMonth(at)
		if tenant.OpenRouterUsageMonth != month {
			tenant.OpenRouterUsageMonth = month
			tenant.OpenRouterUsedMicrousd = 0
		}
		tenant.OpenRouterUsedMicrousd += costMicrousd
		used = tenant.OpenRouterUsedMicrousd
		return tx.Model(&types.Tenant{}).Where("id = ?", tenantID).Updates(map[string]any{
			"open_router_usage_month":   tenant.OpenRouterUsageMonth,
			"open_router_used_microusd": tenant.OpenRouterUsedMicrousd,
		}).Error
	})
	return used, err
}

func (r *entitlementRepository) ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, eventID string, occurredAt time.Time, customerID, subscriptionID string) (bool, error) {
	applied := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tenant types.Tenant
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&tenant, tenantID).Error; err != nil {
			return err
		}
		if eventID != "" {
			if tenant.PaddleLastEventID == eventID || (tenant.PaddleLastEventAt != nil && !occurredAt.After(*tenant.PaddleLastEventAt)) {
				return nil
			}
		}
		plan = types.NormalizeConsumerPlan(plan)
		if status == "" {
			status = "active"
		}
		limits := types.LimitsForConsumerPlan(plan)
		updates := map[string]any{
			"plan":                   plan,
			"plan_status":            status,
			"storage_quota":          limits.StorageBytes,
			"paddle_customer_id":     customerID,
			"paddle_subscription_id": subscriptionID,
		}
		if eventID != "" {
			updates["paddle_last_event_id"] = eventID
			updates["paddle_last_event_at"] = occurredAt.UTC()
		}
		if err := tx.Model(&types.Tenant{}).Where("id = ?", tenantID).Updates(updates).Error; err != nil {
			return err
		}
		applied = true
		return nil
	})
	return applied, err
}
