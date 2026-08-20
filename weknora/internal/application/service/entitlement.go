package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

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
	logger.Infof(ctx, "OpenRouter managed-key usage resolved tenant_id=%d limit_microusd=%d used_microusd=%d remaining_microusd=%d",
		tenantID, info.LimitMicrousd, info.UsageMonthlyMicrousd, info.LimitRemainingMicrousd)
	return current, nil
}

func (s *entitlementService) OpenRouterAPIKey(ctx context.Context) (string, error) {
	tenantID := types.MustTenantIDFromContext(ctx)
	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return "", err
	}
	if stored := openRouterCredentialsFromTenant(tenant); stored != nil {
		if strings.TrimSpace(stored.APIKey) == "" || strings.TrimSpace(stored.KeyHash) == "" {
			logger.Warnf(ctx, "OpenRouter tenant credentials are incomplete tenant_id=%d", tenantID)
			return "", fmt.Errorf("OpenRouter tenant credentials are incomplete")
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

	limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(tenant)).MonthlyOpenRouterMicrousd
	logger.Infof(ctx, "OpenRouter tenant key provisioning started tenant_id=%d monthly_limit_microusd=%d", tenantID, limit)
	created, err := s.keys.CreateKey(ctx, fmt.Sprintf("musuw-tenant-%d", tenantID), limit)
	if err != nil {
		logger.Warnf(ctx, "OpenRouter tenant key provisioning failed tenant_id=%d: %v", tenantID, err)
		return "", err
	}
	candidate := &types.OpenRouterCredentials{APIKey: created.Key, KeyHash: created.Hash}
	inserted, err := s.repo.SetOpenRouterCredentialsIfAbsent(ctx, tenantID, candidate)
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

	stored := openRouterCredentialsFromTenant(tenant)
	if stored != nil && strings.TrimSpace(stored.KeyHash) != "" {
		if s.keys == nil {
			return false, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured; cannot synchronize the tenant spend limit")
		}
		target := &types.Tenant{Plan: plan, PlanStatus: status}
		limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(target)).MonthlyOpenRouterMicrousd
		if err := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, limit); err != nil {
			logger.Warnf(ctx, "OpenRouter tenant spend limit synchronization failed tenant_id=%d target_microusd=%d: %v", tenantID, limit, err)
			return false, fmt.Errorf("synchronize OpenRouter tenant key limit: %w", err)
		}
		logger.Infof(ctx, "OpenRouter tenant spend limit synchronized tenant_id=%d target_microusd=%d", tenantID, limit)
	}

	applied, err := s.repo.ApplyConsumerPlan(ctx, tenantID, plan, status, eventID, occurredAt, customerID, subscriptionID)
	if err == nil && applied {
		logger.Infof(ctx, "Consumer plan applied tenant_id=%d plan=%s status=%s", tenantID, plan, status)
		return true, nil
	}
	// A concurrent newer webhook may have won the DB lock, or the DB write may
	// have failed after the provider update. Re-apply the durable DB plan to the
	// provider so there is no second ledger or reconciliation subsystem.
	if stored != nil && strings.TrimSpace(stored.KeyHash) != "" {
		if syncErr := s.syncOpenRouterLimitFromTenant(ctx, tenantID, stored.KeyHash); syncErr != nil {
			if err != nil {
				return false, errors.Join(err, syncErr)
			}
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
	limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(tenant)).MonthlyOpenRouterMicrousd
	if err := s.keys.UpdateKeyLimit(ctx, keyHash, limit); err != nil {
		return fmt.Errorf("restore OpenRouter tenant key limit from durable plan: %w", err)
	}
	return nil
}
