package repository

import (
	"context"
	"fmt"
	"strings"
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

func (r *entitlementRepository) ResolvePaddleSubscription(ctx context.Context, customerID, subscriptionID string) (*types.PaddleSubscriptionBinding, error) {
	customerID = strings.TrimSpace(customerID)
	subscriptionID = strings.TrimSpace(subscriptionID)
	if customerID == "" || subscriptionID == "" {
		return nil, nil
	}
	var tenants []types.Tenant
	if err := r.db.WithContext(ctx).
		Where("paddle_customer_id = ? AND paddle_subscription_id = ?", customerID, subscriptionID).
		Limit(2).
		Find(&tenants).Error; err != nil {
		return nil, err
	}
	if len(tenants) == 0 {
		return nil, nil
	}
	if len(tenants) != 1 {
		return nil, fmt.Errorf("Paddle customer/subscription binding is ambiguous")
	}
	tenant := tenants[0]
	return &types.PaddleSubscriptionBinding{
		TenantID:       tenant.ID,
		Plan:           types.NormalizeConsumerPlan(tenant.Plan),
		Status:         tenant.PlanStatus,
		BillingPeriod:  tenant.PaddleBillingPeriod,
		CustomerID:     tenant.PaddleCustomerID,
		SubscriptionID: tenant.PaddleSubscriptionID,
	}, nil
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

func (r *entitlementRepository) ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, creditPeriodEnd, paddlePeriodEnd *time.Time) (bool, error) {
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
		currentCustomerID := strings.TrimSpace(tenant.PaddleCustomerID)
		currentSubscriptionID := strings.TrimSpace(tenant.PaddleSubscriptionID)
		incomingCustomerID := strings.TrimSpace(customerID)
		incomingSubscriptionID := strings.TrimSpace(subscriptionID)
		newInitialPaidActivation := (types.NormalizeConsumerPlan(tenant.Plan) == types.ConsumerPlanFree || tenant.PlanStatus == "canceled") &&
			effectivePlan != types.ConsumerPlanFree && status == "active" && incomingCustomerID != "" && incomingSubscriptionID != "" &&
			paddlePeriodEnd != nil && !paddlePeriodEnd.IsZero() && paddlePeriodEnd.After(occurredAt)
		// Repeat the service ownership check while the tenant row is locked. Two
		// replicas may both observe a free tenant before either initial webhook
		// commits; the later event must not replace the first bound subscription.
		if !newInitialPaidActivation &&
			((currentCustomerID != "" && incomingCustomerID != currentCustomerID) ||
				(currentSubscriptionID != "" && incomingSubscriptionID != currentSubscriptionID)) {
			return nil
		}
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
		if effectivePlan == types.ConsumerPlanFree && status != "paused" {
			updates["paddle_current_period_end"] = nil
		} else if paddlePeriodEnd != nil && !paddlePeriodEnd.IsZero() &&
			(tenant.PaddleCurrentPeriodEnd == nil || paddlePeriodEnd.After(tenant.PaddleCurrentPeriodEnd.UTC())) {
			value := paddlePeriodEnd.UTC()
			updates["paddle_current_period_end"] = &value
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

// AdvanceOpenRouterCreditPeriod is the only local allowance-period marker.
// When eventID is present, the Paddle event cursor and period advance in the
// same row transaction so an older adjustment cannot roll back a paid renewal.
func (r *entitlementRepository) AdvanceOpenRouterCreditPeriod(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, periodEnd time.Time) (bool, error) {
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
			plan = types.NormalizeConsumerPlan(plan)
			if plan == types.ConsumerPlanFree || types.EffectiveConsumerPlan(&tenant) != plan ||
				billingPeriod != "monthly" || tenant.PaddleBillingPeriod != billingPeriod ||
				strings.TrimSpace(tenant.PaddleCustomerID) != strings.TrimSpace(customerID) ||
				strings.TrimSpace(tenant.PaddleSubscriptionID) != strings.TrimSpace(subscriptionID) {
				return nil
			}
		}
		periodEnd = periodEnd.UTC()
		if tenant.OpenRouterCreditPeriodEnd != nil && !periodEnd.After(tenant.OpenRouterCreditPeriodEnd.UTC()) {
			return nil
		}
		updates := map[string]any{"open_router_credit_period_end": periodEnd}
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

// AdvancePaddleCurrentPeriod records only a newer provider-confirmed service
// period and advances the Paddle event cursor in the same row transaction. No
// local billing ledger is needed.
func (r *entitlementRepository) AdvancePaddleCurrentPeriod(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, customerID, subscriptionID, billingPeriod, eventID string, occurredAt, periodEnd time.Time) (bool, error) {
	applied := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tenant types.Tenant
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&tenant, tenantID).Error; err != nil {
			return err
		}
		if eventID != "" && (tenant.PaddleLastEventID == eventID || (tenant.PaddleLastEventAt != nil && !occurredAt.After(*tenant.PaddleLastEventAt))) {
			return nil
		}
		plan = types.NormalizeConsumerPlan(plan)
		if plan == types.ConsumerPlanFree || types.EffectiveConsumerPlan(&tenant) != plan ||
			tenant.PaddleBillingPeriod != billingPeriod || billingPeriod != "yearly" ||
			strings.TrimSpace(tenant.PaddleCustomerID) != strings.TrimSpace(customerID) ||
			strings.TrimSpace(tenant.PaddleSubscriptionID) != strings.TrimSpace(subscriptionID) {
			return nil
		}
		periodEnd = periodEnd.UTC()
		if tenant.PaddleCurrentPeriodEnd != nil && !periodEnd.After(tenant.PaddleCurrentPeriodEnd.UTC()) {
			return nil
		}
		updates := map[string]any{"paddle_current_period_end": periodEnd}
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
