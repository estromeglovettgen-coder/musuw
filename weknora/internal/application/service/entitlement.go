package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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
	used := types.EffectiveOpenRouterUsage(tenant, at)
	remaining := limits.MonthlyOpenRouterMicrousd - used

	keyRef, err := s.repo.GetOpenRouterKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if keyRef != nil && s.keys != nil {
		if info, keyErr := s.keys.GetKey(ctx, keyRef.KeyHash); keyErr == nil {
			used = info.UsageMonthlyMicrousd
			remaining = info.LimitRemainingMicrousd
		} else {
			logger.Warnf(ctx, "OpenRouter managed-key usage lookup failed for tenant %d: %v", tenantID, keyErr)
		}
	}
	if remaining < 0 {
		remaining = 0
	}
	return &types.ConsumerEntitlement{
		ConsumerPlanLimits:          limits,
		PlanStatus:                  tenant.PlanStatus,
		StorageUsed:                 tenant.StorageUsed,
		OpenRouterUsedMicrousd:      used,
		OpenRouterRemainingMicrousd: remaining,
		OpenRouterUsageMonth:        types.OpenRouterUsageMonth(at),
	}, nil
}

func (s *entitlementService) PreflightOpenRouter(ctx context.Context, at time.Time, estimateMicrousd int64) error {
	if estimateMicrousd <= 0 {
		return nil
	}
	current, err := s.Current(ctx, at)
	if err != nil {
		return err
	}
	if estimateMicrousd > current.OpenRouterRemainingMicrousd {
		return apperrors.NewTooManyRequestsError("OpenRouter monthly credit is insufficient; upgrade your plan or wait for next month")
	}
	return nil
}

// RecordOpenRouterCost remains only for compatibility with pre-provider-key
// rows. Provider-managed key limits are the hard spend authority.
func (s *entitlementService) RecordOpenRouterCost(ctx context.Context, at time.Time, costMicrousd int64) (int64, error) {
	return s.repo.RecordOpenRouterCost(ctx, types.MustTenantIDFromContext(ctx), at, costMicrousd)
}

func (s *entitlementService) OpenRouterAPIKey(ctx context.Context) (string, error) {
	tenantID := types.MustTenantIDFromContext(ctx)
	stored, err := s.repo.GetOpenRouterKey(ctx, tenantID)
	if err != nil {
		return "", err
	}
	if stored != nil {
		return decryptOpenRouterTenantKey(stored)
	}
	if s.keys == nil {
		return "", fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured")
	}

	tenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return "", err
	}
	limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(tenant)).MonthlyOpenRouterMicrousd
	created, err := s.keys.CreateKey(ctx, fmt.Sprintf("musuw-tenant-%d", tenantID), limit)
	if err != nil {
		return "", err
	}

	aesKey := utils.GetAESKey()
	if aesKey == nil {
		_ = s.keys.DeleteKey(ctx, created.Hash)
		return "", fmt.Errorf("SYSTEM_AES_KEY must contain exactly 32 bytes before provisioning OpenRouter tenant keys")
	}
	ciphertext, err := utils.EncryptAESGCM(created.Key, aesKey)
	if err != nil {
		_ = s.keys.DeleteKey(ctx, created.Hash)
		return "", fmt.Errorf("encrypt OpenRouter tenant key: %w", err)
	}
	candidate := &types.OpenRouterTenantKey{
		TenantID:      tenantID,
		KeyHash:       created.Hash,
		KeyCiphertext: ciphertext,
	}
	inserted, err := s.repo.SetOpenRouterKeyIfAbsent(ctx, candidate)
	if err != nil {
		_ = s.keys.DeleteKey(ctx, created.Hash)
		return "", err
	}
	if inserted {
		return created.Key, nil
	}

	// Another request/replica won the first-use race. Delete our orphaned
	// provider key and use the durable winner.
	if deleteErr := s.keys.DeleteKey(ctx, created.Hash); deleteErr != nil {
		logger.Warnf(ctx, "failed to delete raced OpenRouter key %s: %v", created.Hash, deleteErr)
	}
	stored, err = s.repo.GetOpenRouterKey(ctx, tenantID)
	if err != nil {
		return "", err
	}
	if stored == nil {
		return "", fmt.Errorf("OpenRouter tenant key provisioning race completed without a durable key")
	}
	return decryptOpenRouterTenantKey(stored)
}

func decryptOpenRouterTenantKey(stored *types.OpenRouterTenantKey) (string, error) {
	if stored == nil || stored.KeyCiphertext == "" {
		return "", fmt.Errorf("OpenRouter tenant key is not configured")
	}
	plain, err := utils.DecryptStoredSecret(stored.KeyCiphertext)
	if err != nil {
		return "", fmt.Errorf("decrypt OpenRouter tenant key: %w", err)
	}
	if plain == "" {
		return "", fmt.Errorf("OpenRouter tenant key is empty")
	}
	return plain, nil
}

func (s *entitlementService) OpenRouterUserID(ctx context.Context) string {
	// OpenRouter's `user` field is attribution, not the spend boundary.
	// Keep it stable for the same human across workspaces. Tenant-level spend
	// isolation is handled separately by the per-personal-tenant child key.
	userID, _ := types.UserIDFromContext(ctx)
	if userID == "" {
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
	stored, err := s.repo.GetOpenRouterKey(ctx, tenantID)
	if err != nil || stored == nil {
		return applied, err
	}
	if s.keys == nil {
		return applied, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured; cannot synchronize the tenant spend limit")
	}
	currentTenant, err := s.repo.GetTenantEntitlement(ctx, tenantID)
	if err != nil {
		return applied, err
	}
	limit := types.LimitsForConsumerPlan(types.EffectiveConsumerPlan(currentTenant)).MonthlyOpenRouterMicrousd
	if err := s.keys.UpdateKeyLimit(ctx, stored.KeyHash, limit); err != nil {
		return applied, fmt.Errorf("synchronize OpenRouter tenant key limit: %w", err)
	}
	return applied, nil
}
