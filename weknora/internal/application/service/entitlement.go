package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/logger"
	modelopenrouter "github.com/Tencent/WeKnora/internal/models/openrouter"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/Tencent/WeKnora/internal/utils"
)

type entitlementService struct {
	repo interfaces.EntitlementRepository
	keys modelopenrouter.KeyManager
}

func NewEntitlementService(repo interfaces.EntitlementRepository) interfaces.EntitlementService {
	return newEntitlementService(repo, modelopenrouter.NewKeyManagerFromEnv())
}

func newEntitlementService(repo interfaces.EntitlementRepository, keys modelopenrouter.KeyManager) interfaces.EntitlementService {
	return &entitlementService{repo: repo, keys: keys}
}

func (s *entitlementService) Current(ctx context.Context, at time.Time) (*types.ConsumerEntitlement, error) {
	tenantID := types.MustTenantIDFromContext(ctx)
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
		OpenRouterUsageMonth:    types.OpenRouterUsageMonth(at),
		OpenRouterCreditsStatus: types.OpenRouterCreditsUnprovisioned,
	}

	credentials := openRouterCredentialsFromTenant(tenant)
	if credentials == nil {
		return current, nil
	}
	if strings.TrimSpace(credentials.APIKey) == "" || strings.TrimSpace(credentials.KeyHash) == "" || s.keys == nil {
		current.OpenRouterCreditsStatus = types.OpenRouterCreditsUnavailable
		return current, nil
	}
	info, err := s.keys.GetKey(ctx, credentials.KeyHash)
	if err != nil {
		logger.Warnf(ctx, "OpenRouter managed-key usage lookup failed for tenant %d: %v", tenantID, err)
		current.OpenRouterCreditsStatus = types.OpenRouterCreditsUnavailable
		return current, nil
	}
	current.MonthlyOpenRouterMicrousd = info.LimitMicrousd
	current.OpenRouterUsedMicrousd = info.UsageMonthlyMicrousd
	current.OpenRouterRemainingMicrousd = info.LimitRemainingMicrousd
	current.OpenRouterCreditsStatus = types.OpenRouterCreditsAvailable
	return current, nil
}

// PreflightOpenRouter remains as a compatibility boundary for callers that have
// not yet been removed. It intentionally ignores the local price estimate and
// only rejects when the provider's official remaining balance is exhausted.
func (s *entitlementService) PreflightOpenRouter(ctx context.Context, at time.Time, _ int64) error {
	current, err := s.Current(ctx, at)
	if err != nil {
		return err
	}
	if current.OpenRouterCreditsStatus == types.OpenRouterCreditsAvailable && current.OpenRouterRemainingMicrousd <= 0 {
		return apperrors.NewTooManyRequestsError("OpenRouter monthly credit is exhausted; upgrade your plan or wait for next month")
	}
	return nil
}

// RecordOpenRouterCost remains only for rollback compatibility. The active
// OpenRouter transport never calls it; provider-managed key metadata is the
// monthly spend authority.
func (s *entitlementService) RecordOpenRouterCost(ctx context.Context, at time.Time, costMicrousd int64) (int64, error) {
	return s.repo.RecordOpenRouterCost(ctx, types.MustTenantIDFromContext(ctx), at, costMicrousd)
}

func (s *entitlementService) OpenRouterAPIKey(ctx context.Context) (string, error) {
	tenantID := types.MustTenantIDFromContext(ctx)
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return "", err
	}
	if stored := openRouterCredentialsFromTenant(tenant); stored != nil {
		if strings.TrimSpace(stored.APIKey) == "" || strings.TrimSpace(stored.KeyHash) == "" {
			return "", fmt.Errorf("OpenRouter tenant credentials are incomplete")
		}
		return stored.APIKey, nil
	}
	if s.keys == nil {
		return "", fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured")
	}
	if utils.GetAESKey() == nil {
		return "", fmt.Errorf("SYSTEM_AES_KEY must contain exactly 32 bytes before provisioning OpenRouter tenant keys")
	}

	limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(tenant)).MonthlyOpenRouterMicrousd
	created, err := s.keys.CreateKey(ctx, fmt.Sprintf("musuw-tenant-%d", tenantID), limit)
	if err != nil {
		return "", err
	}
	candidate := &types.OpenRouterCredentials{APIKey: created.Key, KeyHash: created.Hash}
	inserted, err := s.repo.SetOpenRouterCredentialsIfAbsent(ctx, tenantID, candidate)
	if err != nil {
		_ = s.keys.DeleteKey(ctx, created.Hash)
		return "", err
	}
	if inserted {
		return created.Key, nil
	}

	// Another request/replica won first-use provisioning. Delete the orphaned
	// provider key and use the durable winner from the tenant credentials JSONB.
	if deleteErr := s.keys.DeleteKey(ctx, created.Hash); deleteErr != nil {
		logger.Warnf(ctx, "failed to delete raced OpenRouter key %s: %v", created.Hash, deleteErr)
	}
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

func (s *entitlementService) ApplyConsumerPlan(ctx context.Context, tenantID uint64, plan types.ConsumerPlan, status, eventID string, occurredAt time.Time, customerID, subscriptionID string) (bool, error) {
	applied, err := s.repo.ApplyConsumerPlan(ctx, tenantID, plan, status, eventID, occurredAt, customerID, subscriptionID)
	if err != nil {
		return false, err
	}
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return applied, err
	}
	stored := openRouterCredentialsFromTenant(tenant)
	if stored == nil || strings.TrimSpace(stored.KeyHash) == "" {
		return applied, nil
	}
	if s.keys == nil {
		return applied, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured; cannot synchronize the tenant spend limit")
	}
	limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(tenant)).MonthlyOpenRouterMicrousd
	if err := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, limit); err != nil {
		return applied, fmt.Errorf("synchronize OpenRouter tenant key limit: %w", err)
	}
	return applied, nil
}
