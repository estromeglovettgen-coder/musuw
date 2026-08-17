package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
)

type entitlementService struct {
	repo interfaces.EntitlementRepository
}

func NewEntitlementService(repo interfaces.EntitlementRepository) interfaces.EntitlementService {
	return &entitlementService{repo: repo}
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

func (s *entitlementService) RecordOpenRouterCost(ctx context.Context, at time.Time, costMicrousd int64) (int64, error) {
	return s.repo.RecordOpenRouterCost(ctx, types.MustTenantIDFromContext(ctx), at, costMicrousd)
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
	return s.repo.ApplyConsumerPlan(ctx, tenantID, plan, status, eventID, occurredAt, customerID, subscriptionID)
}
