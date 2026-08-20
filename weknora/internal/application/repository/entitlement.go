package repository

import (
	"context"
	"fmt"
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

// SetOpenRouterCredentialsIfAbsent installs the first provider-managed key for
// a tenant without replacing any other provider credentials. The row lock makes
// first-use provisioning safe when multiple requests or replicas race.
func (r *entitlementRepository) SetOpenRouterCredentialsIfAbsent(ctx context.Context, tenantID uint64, credentials *types.OpenRouterCredentials, creditPeriodEnd time.Time) (bool, error) {
	if credentials == nil || credentials.APIKey == "" || credentials.KeyHash == "" {
		return false, fmt.Errorf("OpenRouter tenant credentials are incomplete")
	}
	inserted := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tenant types.Tenant
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&tenant, tenantID).Error; err != nil {
			return err
		}
		if tenant.Credentials != nil && tenant.Credentials.OpenRouter != nil {
			return nil
		}
		merged := types.CredentialsConfig{}
		if tenant.Credentials != nil {
			merged = *tenant.Credentials
		}
		copy := *credentials
		merged.OpenRouter = &copy
		if err := tx.Model(&types.Tenant{}).Where("id = ?", tenantID).Updates(map[string]any{
			"credentials":                   &merged,
			"open_router_credit_period_end": creditPeriodEnd.UTC(),
		}).Error; err != nil {
			return err
		}
		inserted = true
		return nil
	})
	return inserted, err
}

func (r *entitlementRepository) ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, creditPeriodEnd *time.Time) (bool, error) {
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
		effectivePlan := types.EffectiveConsumerPlan(&types.Tenant{Plan: plan, PlanStatus: status})
		limits := types.LimitsForConsumerPlan(effectivePlan)
		updates := map[string]any{
			"plan":                          plan,
			"plan_status":                   status,
			"storage_quota":                 limits.StorageBytes,
			"paddle_customer_id":            customerID,
			"paddle_subscription_id":        subscriptionID,
			"paddle_billing_period":         billingPeriod,
			"open_router_credit_period_end": creditPeriodEnd,
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

// AdvanceOpenRouterCreditPeriod is the only local idempotency marker for
// allowance refreshes. OpenRouter remains the usage ledger.
func (r *entitlementRepository) AdvanceOpenRouterCreditPeriod(ctx context.Context, tenantID uint64, periodEnd time.Time) (bool, error) {
	applied := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tenant types.Tenant
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&tenant, tenantID).Error; err != nil {
			return err
		}
		periodEnd = periodEnd.UTC()
		if tenant.OpenRouterCreditPeriodEnd != nil && !periodEnd.After(tenant.OpenRouterCreditPeriodEnd.UTC()) {
			return nil
		}
		if err := tx.Model(&types.Tenant{}).Where("id = ?", tenantID).Update("open_router_credit_period_end", periodEnd).Error; err != nil {
			return err
		}
		applied = true
		return nil
	})
	return applied, err
}
