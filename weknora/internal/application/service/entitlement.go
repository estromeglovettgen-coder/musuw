package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Tencent/WeKnora/internal/logger"
	modelopenrouter "github.com/Tencent/WeKnora/internal/models/openrouter"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/Tencent/WeKnora/internal/utils"
)

type entitlementService struct {
	repo           interfaces.EntitlementRepository
	keys           modelopenrouter.KeyManager
	allowanceLocks sync.Map
}

var (
	errAllowanceRenewalPending = errors.New("allowance renewal is awaiting payment confirmation")
	errSubscriptionPaused      = errors.New("subscription is paused")
)

func NewEntitlementService(repo interfaces.EntitlementRepository) interfaces.EntitlementService {
	return newEntitlementService(repo, modelopenrouter.NewKeyManagerFromEnv())
}

func newEntitlementService(repo interfaces.EntitlementRepository, keys modelopenrouter.KeyManager) interfaces.EntitlementService {
	return &entitlementService{repo: repo, keys: keys}
}

func (s *entitlementService) lockAllowance(tenantID uint64) func() {
	value, _ := s.allowanceLocks.LoadOrStore(tenantID, &sync.Mutex{})
	mu := value.(*sync.Mutex)
	mu.Lock()
	return mu.Unlock
}

func (s *entitlementService) Current(ctx context.Context, at time.Time) (*types.ConsumerEntitlement, error) {
	tenantID := types.MustTenantIDFromContext(ctx)
	unlock := s.lockAllowance(tenantID)
	defer unlock()
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	plan := types.EffectiveConsumerPlan(tenant)
	limits := types.LimitsForConsumerPlan(plan)
	current := &types.ConsumerEntitlement{
		ConsumerPlanLimits:      limits,
		PlanStatus:              tenant.PlanStatus,
		StorageUsed:             tenant.StorageUsed,
		OpenRouterCreditsStatus: types.OpenRouterCreditsUnprovisioned,
		PaddleCustomerID:        tenant.PaddleCustomerID,
		PaddleSubscriptionID:    tenant.PaddleSubscriptionID,
	}
	current.OpenRouterResetsAt = entitlementResetAt(tenant, plan, at)

	credentials := openRouterCredentialsFromTenant(tenant)
	if credentials == nil {
		return current, nil
	}
	if strings.TrimSpace(credentials.APIKey) == "" || strings.TrimSpace(credentials.KeyHash) == "" || s.keys == nil {
		current.OpenRouterCreditsStatus = types.OpenRouterCreditsUnavailable
		return current, nil
	}
	info, err := s.ensureAllowanceCurrent(ctx, tenant, at)
	if err != nil {
		if errors.Is(err, errAllowanceRenewalPending) {
			current.OpenRouterUsedMicrousd = limits.MonthlyOpenRouterMicrousd
			current.OpenRouterRemainingMicrousd = 0
			current.OpenRouterCreditsStatus = types.OpenRouterCreditsAvailable
			return current, nil
		}
		logger.Warnf(ctx, "OpenRouter managed-key usage lookup failed for tenant %d: %v", tenantID, err)
		current.OpenRouterCreditsStatus = types.OpenRouterCreditsUnavailable
		return current, nil
	}
	// ensureAllowanceCurrent may advance a free/yearly tenant to its next
	// personal period. Return that new boundary in the same response.
	current.OpenRouterResetsAt = entitlementResetAt(tenant, plan, at)
	remaining := clampMicrousd(info.LimitRemainingMicrousd, 0, limits.MonthlyOpenRouterMicrousd)
	current.OpenRouterUsedMicrousd = limits.MonthlyOpenRouterMicrousd - remaining
	current.OpenRouterRemainingMicrousd = remaining
	current.OpenRouterCreditsStatus = types.OpenRouterCreditsAvailable
	logger.Infof(ctx, "OpenRouter managed-key usage resolved tenant_id=%d allowance_microusd=%d used_microusd=%d remaining_microusd=%d monthly_reset=%t",
		tenantID, limits.MonthlyOpenRouterMicrousd, current.OpenRouterUsedMicrousd, remaining, info.MonthlyReset)
	return current, nil
}

// CurrentForTenant is the explicit-tenant form used by platform operations.
// Reusing Current keeps the provider lookup, period refresh, clamping, and
// fail-closed status in one implementation. The caller's identity remains in
// ctx for audit/log attribution; only the target tenant context value changes.
func (s *entitlementService) CurrentForTenant(ctx context.Context, tenantID uint64, at time.Time) (*types.ConsumerEntitlement, error) {
	if tenantID == 0 {
		return nil, fmt.Errorf("tenant ID must be positive")
	}
	return s.Current(context.WithValue(ctx, types.TenantIDContextKey, tenantID), at)
}

// SetOpenRouterRemainingForTenant adjusts the existing OpenRouter-managed
// child key's remaining allowance without adding a local usage counter. The
// absolute provider limit is lifetime usage plus the requested remainder,
// exactly as the normal entitlement path does. Requests are bounded by the
// effective plan allowance and cannot mutate Paddle or the persisted plan.
func (s *entitlementService) SetOpenRouterRemainingForTenant(ctx context.Context, tenantID uint64, remainingMicrousd int64) (*types.ConsumerEntitlement, error) {
	if tenantID == 0 {
		return nil, fmt.Errorf("tenant ID must be positive")
	}
	if remainingMicrousd < 0 {
		return nil, fmt.Errorf("remaining OpenRouter credits cannot be negative")
	}

	requestCtx := context.WithValue(ctx, types.TenantIDContextKey, tenantID)
	unlock := s.lockAllowance(tenantID)
	tenant, err := s.repo.GetTenantEntitlement(requestCtx, tenantID)
	if err != nil {
		unlock()
		return nil, err
	}
	plan := types.EffectiveConsumerPlan(tenant)
	allowance := types.LimitsForConsumerPlan(plan).MonthlyOpenRouterMicrousd
	if remainingMicrousd > allowance {
		unlock()
		return nil, fmt.Errorf("remaining OpenRouter credits cannot exceed current plan allowance")
	}
	stored := openRouterCredentialsFromTenant(tenant)
	if stored == nil || strings.TrimSpace(stored.KeyHash) == "" {
		unlock()
		return nil, fmt.Errorf("OpenRouter tenant credentials are unavailable")
	}
	if s.keys == nil {
		unlock()
		return nil, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured")
	}

	// Normalize the provider state first. This preserves the existing paid-term
	// and free-anniversary gates instead of letting an operator accidentally
	// open an unpaid period by changing a stale key.
	info, err := s.ensureAllowanceCurrent(requestCtx, tenant, time.Now().UTC())
	if err != nil {
		unlock()
		return nil, err
	}
	targetLimit := info.UsageMicrousd + remainingMicrousd
	// OpenRouter rejects a zero absolute limit. A zero remaining value is
	// therefore exact only when lifetime usage is already positive; otherwise
	// fail closed instead of silently granting one micro-dollar.
	if targetLimit <= 0 {
		unlock()
		return nil, fmt.Errorf("remaining OpenRouter credits must be positive when provider usage is zero")
	}
	if err := s.keys.UpdateKeyLimit(requestCtx, stored.KeyHash, targetLimit, false); err != nil {
		unlock()
		return nil, fmt.Errorf("update OpenRouter tenant credit limit: %w", err)
	}
	unlock()

	return s.CurrentForTenant(requestCtx, tenantID, time.Now().UTC())
}

func (s *entitlementService) OpenRouterAPIKey(ctx context.Context) (string, error) {
	tenantID := types.MustTenantIDFromContext(ctx)
	unlock := s.lockAllowance(tenantID)
	defer unlock()
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return "", err
	}
	if tenant.PlanStatus == "paused" {
		return "", errSubscriptionPaused
	}
	now := time.Now().UTC()
	plan := types.EffectiveConsumerPlan(tenant)
	if paidPlanAccessUnavailable(tenant, plan, now) {
		return "", errAllowanceRenewalPending
	}
	if stored := openRouterCredentialsFromTenant(tenant); stored != nil {
		if strings.TrimSpace(stored.APIKey) == "" || strings.TrimSpace(stored.KeyHash) == "" {
			logger.Warnf(ctx, "OpenRouter tenant credentials are incomplete tenant_id=%d", tenantID)
			return "", fmt.Errorf("OpenRouter tenant credentials are incomplete")
		}
		if s.keys == nil {
			return "", fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured; cannot enforce the tenant spend limit")
		}
		if tenant.OpenRouterCreditPeriodEnd == nil || !tenant.OpenRouterCreditPeriodEnd.After(now) {
			if _, err := s.ensureAllowanceCurrent(ctx, tenant, now); err != nil {
				return "", err
			}
		}
		return stored.APIKey, nil
	}
	if s.keys == nil {
		logger.Warnf(ctx, "OpenRouter tenant key provisioning unavailable tenant_id=%d reason=management_key_not_configured", tenantID)
		return "", fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured")
	}
	if utils.GetAESKey() == nil {
		logger.Warnf(ctx, "OpenRouter tenant key provisioning unavailable tenant_id=%d reason=system_aes_key_invalid", tenantID)
		return "", fmt.Errorf("SYSTEM_AES_KEY must contain exactly 32 bytes before provisioning OpenRouter tenant keys")
	}

	limit := types.LimitsForConsumerPlan(plan).MonthlyOpenRouterMicrousd
	creditPeriodEnd := initialCreditPeriodEnd(tenant, plan, tenant.PaddleBillingPeriod, time.Now().UTC(), nil)
	logger.Infof(ctx, "OpenRouter tenant key provisioning started tenant_id=%d monthly_limit_microusd=%d", tenantID, limit)
	created, err := s.keys.CreateKey(ctx, fmt.Sprintf("musuw-tenant-%d", tenantID), limit, false)
	if err != nil {
		logger.Warnf(ctx, "OpenRouter tenant key provisioning failed tenant_id=%d: %v", tenantID, err)
		return "", err
	}
	candidate := &types.OpenRouterCredentials{APIKey: created.Key, KeyHash: created.Hash}
	inserted, err := s.repo.SetOpenRouterCredentialsIfAbsent(ctx, tenantID, candidate, creditPeriodEnd)
	if err != nil {
		if deleteErr := s.keys.DeleteKey(ctx, created.Hash); deleteErr != nil {
			logger.Errorf(ctx, "OpenRouter orphaned tenant key cleanup failed tenant_id=%d: %v", tenantID, deleteErr)
			return "", errors.Join(
				err,
				fmt.Errorf("delete orphaned OpenRouter key: %w", deleteErr),
			)
		}
		logger.Warnf(ctx, "OpenRouter tenant key persistence failed tenant_id=%d: %v", tenantID, err)
		return "", err
	}
	if inserted {
		logger.Infof(ctx, "OpenRouter tenant key provisioning completed tenant_id=%d", tenantID)
		return created.Key, nil
	}

	// Another request/replica won first-use provisioning. Delete the orphaned
	// provider key and use the durable winner from the tenant credentials JSONB.
	if deleteErr := s.keys.DeleteKey(ctx, created.Hash); deleteErr != nil {
		logger.Errorf(ctx, "OpenRouter raced tenant key cleanup failed tenant_id=%d: %v", tenantID, deleteErr)
		return "", fmt.Errorf("delete raced OpenRouter key: %w", deleteErr)
	}
	logger.Infof(ctx, "OpenRouter tenant key provisioning race resolved tenant_id=%d", tenantID)
	tenant, err = s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return "", err
	}
	stored := openRouterCredentialsFromTenant(tenant)
	if stored == nil || strings.TrimSpace(stored.APIKey) == "" || strings.TrimSpace(stored.KeyHash) == "" {
		return "", fmt.Errorf("OpenRouter tenant key provisioning race completed without durable credentials")
	}
	return stored.APIKey, nil
}

// ensureAllowanceCurrent keeps one provider-managed key on the tenant's own
// monthly cycle. Free and yearly plans refresh lazily on the first read/use
// after their boundary, with yearly refreshes capped by Paddle's verified paid
// term. Monthly subscriptions wait for Paddle's paid recurring transaction
// webhook, so unused credit cannot leak into an unpaid period.
func (s *entitlementService) ensureAllowanceCurrent(ctx context.Context, tenant *types.Tenant, at time.Time) (*modelopenrouter.KeyInfo, error) {
	if tenant != nil && tenant.PlanStatus == "paused" {
		return nil, errSubscriptionPaused
	}
	at = at.UTC()
	plan := types.EffectiveConsumerPlan(tenant)
	if paidPlanAccessUnavailable(tenant, plan, at) {
		return nil, errAllowanceRenewalPending
	}
	stored := openRouterCredentialsFromTenant(tenant)
	if stored == nil || strings.TrimSpace(stored.KeyHash) == "" || s.keys == nil {
		return nil, fmt.Errorf("OpenRouter tenant credentials are unavailable")
	}
	info, err := s.keys.GetKey(ctx, stored.KeyHash)
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, fmt.Errorf("OpenRouter tenant key lookup returned no state")
	}

	allowance := types.LimitsForConsumerPlan(plan).MonthlyOpenRouterMicrousd
	periodEnd := tenant.OpenRouterCreditPeriodEnd
	// A paid tenant may predate the billing-period column. Treat an unknown
	// period like monthly (webhook-gated), not yearly (self-refreshing), so a
	// missing migration value can never grant an unpaid allowance.
	if periodEnd != nil && !periodEnd.After(at) && plan != types.ConsumerPlanFree && tenant.PaddleBillingPeriod != "yearly" {
		return info, errAllowanceRenewalPending
	}

	targetPeriodEnd := periodEnd
	targetLimit := info.LimitMicrousd
	if periodEnd == nil {
		value := initialCreditPeriodEnd(tenant, plan, tenant.PaddleBillingPeriod, at, nil)
		targetPeriodEnd = &value
		// Existing keys may still use OpenRouter's UTC-calendar reset. Preserve
		// their current remaining credit while moving them to the personal cycle.
		remaining := clampMicrousd(info.LimitRemainingMicrousd, 0, allowance)
		targetLimit = info.UsageMicrousd + remaining
	} else if !periodEnd.After(at) {
		value := nextPersonalCreditPeriodEnd(*periodEnd, at)
		if plan == types.ConsumerPlanFree && !tenant.CreatedAt.IsZero() {
			value = monthlyBoundaryAfter(tenant.CreatedAt, at)
		}
		targetPeriodEnd = &value
		// Skipped inactive periods never stack. The current period starts with
		// exactly one plan allowance above lifetime provider usage.
		targetLimit = info.UsageMicrousd + allowance
	} else if info.MonthlyReset {
		remaining := clampMicrousd(info.LimitRemainingMicrousd, 0, allowance)
		targetLimit = info.UsageMicrousd + remaining
	}

	providerChanged := info.LimitMicrousd != targetLimit || info.MonthlyReset
	prior := *info
	if providerChanged {
		if err := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, targetLimit, false); err != nil {
			return nil, fmt.Errorf("synchronize OpenRouter personal credit period: %w", err)
		}
		info.LimitMicrousd = targetLimit
		info.LimitRemainingMicrousd = clampMicrousd(targetLimit-info.UsageMicrousd, 0, allowance)
		info.MonthlyReset = false
	}

	if targetPeriodEnd != nil && (periodEnd == nil || targetPeriodEnd.After(periodEnd.UTC())) {
		applied, persistErr := s.repo.AdvanceOpenRouterCreditPeriod(ctx, tenant.ID, targetPeriodEnd.UTC())
		if persistErr != nil {
			if providerChanged {
				if restoreErr := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, prior.LimitMicrousd, prior.MonthlyReset); restoreErr != nil {
					return nil, errors.Join(persistErr, fmt.Errorf("restore OpenRouter key after credit-period persistence failure: %w", restoreErr))
				}
			}
			return nil, persistErr
		}
		if applied {
			value := targetPeriodEnd.UTC()
			tenant.OpenRouterCreditPeriodEnd = &value
		}
		logger.Infof(ctx, "OpenRouter personal credit period advanced tenant_id=%d period_end=%s applied=%t", tenant.ID, targetPeriodEnd.UTC().Format(time.RFC3339), applied)
	}
	return info, nil
}

func openRouterCredentialsFromTenant(tenant *types.Tenant) *types.OpenRouterCredentials {
	if tenant == nil || tenant.Credentials == nil {
		return nil
	}
	return tenant.Credentials.OpenRouter
}

func (s *entitlementService) OpenRouterUserID(ctx context.Context) string {
	// OpenRouter's user field is attribution, not the spend boundary. Keep the
	// same human stable across workspaces; the per-tenant child key isolates spend.
	userID, _ := types.UserIDFromContext(ctx)
	if strings.TrimSpace(userID) == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(userID))
	return "musuw_" + hex.EncodeToString(sum[:12])
}

func (s *entitlementService) ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, billingPeriod, eventID string, occurredAt time.Time, customerID, subscriptionID string, eventPeriodEnd *time.Time) (bool, error) {
	unlock := s.lockAllowance(tenantID)
	defer unlock()
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return false, err
	}
	if eventID != "" && (tenant.PaddleLastEventID == eventID ||
		(tenant.PaddleLastEventAt != nil && !occurredAt.After(*tenant.PaddleLastEventAt))) {
		logger.Infof(ctx, "Consumer plan event ignored as duplicate or stale tenant_id=%d", tenantID)
		return false, nil
	}
	plan = types.NormalizeConsumerPlan(plan)
	if strings.TrimSpace(status) == "" {
		status = "active"
	}
	target := &types.Tenant{Plan: plan, PlanStatus: status}
	targetPlan := types.EffectiveConsumerPlan(target)
	pausingSamePlan := status == "paused" && plan != types.ConsumerPlanFree && types.NormalizeConsumerPlan(tenant.Plan) == plan
	resumingSamePlan := tenant.PlanStatus == "paused" && targetPlan != types.ConsumerPlanFree && types.NormalizeConsumerPlan(tenant.Plan) == targetPlan
	if targetPlan == types.ConsumerPlanFree && !pausingSamePlan {
		billingPeriod = ""
	} else if billingPeriod != "monthly" && billingPeriod != "yearly" {
		return false, fmt.Errorf("Paddle billing period is invalid")
	}
	creditPeriodEnd := nextCreditPeriodEnd(tenant, targetPlan, billingPeriod, occurredAt, eventPeriodEnd)
	if (pausingSamePlan || resumingSamePlan) && tenant.OpenRouterCreditPeriodEnd != nil {
		value := tenant.OpenRouterCreditPeriodEnd.UTC()
		creditPeriodEnd = &value
	}
	paddlePeriodEnd := nextPaddlePeriodEnd(targetPlan, eventPeriodEnd)

	stored := openRouterCredentialsFromTenant(tenant)
	var priorInfo *modelopenrouter.KeyInfo
	providerChanged := false
	if stored != nil && strings.TrimSpace(stored.KeyHash) != "" && !pausingSamePlan && !resumingSamePlan {
		if s.keys == nil {
			return false, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured; cannot synchronize the tenant spend limit")
		}
		priorInfo, err = s.keys.GetKey(ctx, stored.KeyHash)
		if err != nil {
			return false, fmt.Errorf("read OpenRouter tenant key before plan change: %w", err)
		}
		if priorInfo == nil {
			return false, fmt.Errorf("OpenRouter tenant key lookup returned no state")
		}
		limit, monthlyReset := keyLimitForPlanChange(tenant, targetPlan, billingPeriod, priorInfo)
		if targetPlan == types.ConsumerPlanFree && status == "canceled" {
			limit = priorInfo.UsageMicrousd + types.LimitsForConsumerPlan(types.ConsumerPlanFree).MonthlyOpenRouterMicrousd
			monthlyReset = false
		}
		if priorInfo.LimitMicrousd != limit || priorInfo.MonthlyReset != monthlyReset {
			if err := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, limit, monthlyReset); err != nil {
				logger.Warnf(ctx, "OpenRouter tenant spend limit synchronization failed tenant_id=%d target_microusd=%d: %v", tenantID, limit, err)
				return false, fmt.Errorf("synchronize OpenRouter tenant key limit: %w", err)
			}
			providerChanged = true
		}
		logger.Infof(ctx, "OpenRouter tenant spend limit synchronized tenant_id=%d target_microusd=%d monthly_reset=%t", tenantID, limit, monthlyReset)
	}

	applied, err := s.repo.ApplyConsumerPlan(ctx, tenantID, plan, status, billingPeriod, eventID, occurredAt, customerID, subscriptionID, creditPeriodEnd, paddlePeriodEnd)
	if err == nil && applied {
		logger.Infof(ctx, "Consumer plan applied tenant_id=%d plan=%s status=%s billing_period=%s", tenantID, plan, status, billingPeriod)
		return true, nil
	}
	if err != nil && providerChanged && priorInfo != nil {
		if restoreErr := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, priorInfo.LimitMicrousd, priorInfo.MonthlyReset); restoreErr != nil {
			return false, errors.Join(err, fmt.Errorf("restore OpenRouter tenant key after plan persistence failure: %w", restoreErr))
		}
	}
	// A concurrent newer webhook may have won the DB lock. Re-apply the durable
	// plan shape without introducing a reconciler or a second usage ledger.
	if err == nil && !applied && providerChanged && stored != nil && strings.TrimSpace(stored.KeyHash) != "" {
		if syncErr := s.syncOpenRouterLimitFromTenant(ctx, tenantID, stored.KeyHash); syncErr != nil {
			return false, syncErr
		}
	}
	return false, err
}

func (s *entitlementService) syncOpenRouterLimitFromTenant(ctx context.Context, tenantID uint64, keyHash string) error {
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("reload durable consumer plan: %w", err)
	}
	info, err := s.keys.GetKey(ctx, keyHash)
	if err != nil {
		return fmt.Errorf("read OpenRouter tenant key for durable restore: %w", err)
	}
	plan := types.EffectiveConsumerPlan(tenant)
	limit, monthlyReset := keyLimitForPlanChange(tenant, plan, tenant.PaddleBillingPeriod, info)
	if err := s.keys.UpdateKeyLimit(ctx, keyHash, limit, monthlyReset); err != nil {
		return fmt.Errorf("restore OpenRouter tenant key limit from durable plan: %w", err)
	}
	return nil
}

func (s *entitlementService) RefreshPaidAllowance(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, eventID string, occurredAt time.Time, customerID, subscriptionID string, periodEnd time.Time) (bool, error) {
	unlock := s.lockAllowance(tenantID)
	defer unlock()
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return false, err
	}
	plan = types.NormalizeConsumerPlan(plan)
	if eventID == "" || periodEnd.IsZero() || !periodEnd.After(occurredAt) {
		return false, fmt.Errorf("Paddle recurring transaction has an invalid billing period")
	}
	if types.EffectiveConsumerPlan(tenant) != plan || plan == types.ConsumerPlanFree ||
		(tenant.PaddleBillingPeriod != "monthly" && tenant.PaddleBillingPeriod != "yearly") ||
		strings.TrimSpace(tenant.PaddleCustomerID) != strings.TrimSpace(customerID) ||
		strings.TrimSpace(tenant.PaddleSubscriptionID) != strings.TrimSpace(subscriptionID) {
		return false, fmt.Errorf("Paddle recurring transaction does not match the active tenant subscription")
	}
	periodEnd = periodEnd.UTC()
	if tenant.PaddleBillingPeriod == "yearly" {
		applied, err := s.repo.AdvancePaddleCurrentPeriod(ctx, tenantID, plan, customerID, subscriptionID, "yearly", periodEnd)
		if err != nil {
			return false, err
		}
		logger.Infof(ctx, "Annual paid term confirmed tenant_id=%d event_id=%s period_end=%s applied=%t", tenantID, eventID, periodEnd.Format(time.RFC3339), applied)
		return applied, nil
	}
	if tenant.OpenRouterCreditPeriodEnd != nil && !periodEnd.After(tenant.OpenRouterCreditPeriodEnd.UTC()) {
		logger.Infof(ctx, "Paid allowance event ignored for existing billing period tenant_id=%d event_id=%s", tenantID, eventID)
		return false, nil
	}

	stored := openRouterCredentialsFromTenant(tenant)
	var priorInfo *modelopenrouter.KeyInfo
	providerChanged := false
	if stored != nil && strings.TrimSpace(stored.KeyHash) != "" {
		if s.keys == nil {
			return false, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured; cannot refresh the tenant spend limit")
		}
		priorInfo, err = s.keys.GetKey(ctx, stored.KeyHash)
		if err != nil {
			return false, fmt.Errorf("read OpenRouter tenant key before allowance refresh: %w", err)
		}
		if priorInfo == nil {
			return false, fmt.Errorf("OpenRouter tenant key lookup returned no state")
		}
		allowance := types.LimitsForConsumerPlan(plan).MonthlyOpenRouterMicrousd
		targetLimit := priorInfo.UsageMicrousd + allowance
		if priorInfo.LimitMicrousd != targetLimit || priorInfo.MonthlyReset {
			if err := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, targetLimit, false); err != nil {
				return false, fmt.Errorf("refresh OpenRouter tenant allowance: %w", err)
			}
			providerChanged = true
		}
	}

	applied, err := s.repo.AdvanceOpenRouterCreditPeriod(ctx, tenantID, periodEnd)
	if err != nil && providerChanged && priorInfo != nil {
		if restoreErr := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, priorInfo.LimitMicrousd, priorInfo.MonthlyReset); restoreErr != nil {
			return false, errors.Join(err, fmt.Errorf("restore OpenRouter tenant key after allowance persistence failure: %w", restoreErr))
		}
	}
	if err != nil {
		return false, err
	}
	logger.Infof(ctx, "Paid allowance event processed tenant_id=%d event_id=%s period_end=%s applied=%t", tenantID, eventID, periodEnd.Format(time.RFC3339), applied)
	return applied, nil
}

func entitlementResetAt(tenant *types.Tenant, plan types.ConsumerPlan, at time.Time) *time.Time {
	if tenant != nil && tenant.OpenRouterCreditPeriodEnd != nil {
		value := tenant.OpenRouterCreditPeriodEnd.UTC()
		return &value
	}
	value := initialCreditPeriodEnd(tenant, plan, "", at, nil)
	return &value
}

func paidPlanAccessUnavailable(tenant *types.Tenant, plan types.ConsumerPlan, at time.Time) bool {
	if tenant == nil || plan == types.ConsumerPlanFree {
		return false
	}
	switch tenant.PaddleBillingPeriod {
	case "monthly":
		return tenant.OpenRouterCreditPeriodEnd == nil || !tenant.OpenRouterCreditPeriodEnd.After(at.UTC())
	case "yearly":
		return tenant.PaddleCurrentPeriodEnd == nil || !tenant.PaddleCurrentPeriodEnd.After(at.UTC())
	default:
		return true
	}
}

func nextPaddlePeriodEnd(targetPlan types.ConsumerPlan, eventPeriodEnd *time.Time) *time.Time {
	if targetPlan == types.ConsumerPlanFree {
		return nil
	}
	if eventPeriodEnd != nil && !eventPeriodEnd.IsZero() {
		value := eventPeriodEnd.UTC()
		return &value
	}
	return nil
}

func nextCreditPeriodEnd(tenant *types.Tenant, targetPlan types.ConsumerPlan, billingPeriod string, at time.Time, eventPeriodEnd *time.Time) *time.Time {
	if tenant != nil && types.EffectiveConsumerPlan(tenant) != types.ConsumerPlanFree && targetPlan != types.ConsumerPlanFree && tenant.OpenRouterCreditPeriodEnd != nil {
		value := tenant.OpenRouterCreditPeriodEnd.UTC()
		return &value
	}
	value := initialCreditPeriodEnd(tenant, targetPlan, billingPeriod, at, eventPeriodEnd)
	return &value
}

func initialCreditPeriodEnd(tenant *types.Tenant, plan types.ConsumerPlan, billingPeriod string, at time.Time, eventPeriodEnd *time.Time) time.Time {
	at = at.UTC()
	if plan != types.ConsumerPlanFree && billingPeriod == "monthly" && eventPeriodEnd != nil && !eventPeriodEnd.IsZero() {
		return eventPeriodEnd.UTC()
	}
	anchor := at
	if plan == types.ConsumerPlanFree && tenant != nil && !tenant.CreatedAt.IsZero() {
		anchor = tenant.CreatedAt.UTC()
	}
	return monthlyBoundaryAfter(anchor, at)
}

func nextPersonalCreditPeriodEnd(currentEnd, at time.Time) time.Time {
	return monthlyBoundaryAfter(currentEnd.UTC(), at.UTC())
}

// monthlyBoundaryAfter returns the first registration/activation anniversary
// strictly after at. Free plans always use the tenant creation timestamp as the
// original anchor, avoiding January/February drift without a scheduler.
func monthlyBoundaryAfter(anchor, at time.Time) time.Time {
	anchor = anchor.UTC()
	at = at.UTC()
	months := (at.Year()-anchor.Year())*12 + int(at.Month()-anchor.Month())
	if months < 1 {
		months = 1
	}
	candidate := addMonthsClamped(anchor, months)
	if !candidate.After(at) {
		candidate = addMonthsClamped(anchor, months+1)
	}
	return candidate
}

func addMonthsClamped(anchor time.Time, months int) time.Time {
	first := time.Date(anchor.Year(), anchor.Month()+time.Month(months), 1, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
	lastDay := time.Date(first.Year(), first.Month()+1, 0, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC).Day()
	day := anchor.Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(first.Year(), first.Month(), day, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
}

func keyLimitForPlanChange(tenant *types.Tenant, targetPlan types.ConsumerPlan, billingPeriod string, info *modelopenrouter.KeyInfo) (int64, bool) {
	targetAllowance := types.LimitsForConsumerPlan(targetPlan).MonthlyOpenRouterMicrousd
	if info == nil {
		return targetAllowance, false
	}
	oldPlan := types.EffectiveConsumerPlan(tenant)
	oldAllowance := types.LimitsForConsumerPlan(oldPlan).MonthlyOpenRouterMicrousd
	// Starting a paid plan or moving to a lower tier starts one clean target
	// allowance. Only a same-cycle paid upgrade preserves what was already used.
	if oldPlan != targetPlan && (oldPlan == types.ConsumerPlanFree || targetAllowance <= oldAllowance) {
		return info.UsageMicrousd + targetAllowance, false
	}
	used := oldAllowance - clampMicrousd(info.LimitRemainingMicrousd, 0, oldAllowance)
	if info.MonthlyReset {
		used = clampMicrousd(info.UsageMonthlyMicrousd, 0, oldAllowance)
	}
	remaining := targetAllowance - used
	if remaining < 0 {
		remaining = 0
	}
	return info.UsageMicrousd + remaining, false
}

func clampMicrousd(value, minimum, maximum int64) int64 {
	if value < minimum {
		return minimum
	}
	if value > maximum {
		return maximum
	}
	return value
}
