package service

import (
	"context"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/types"
)

func effectivePlanFromContext(ctx context.Context) (types.ConsumerPlan, bool) {
	tenant, ok := types.TenantInfoFromContext(ctx)
	if !ok || tenant == nil || tenant.Plan == "" {
		return types.ConsumerPlanFree, false
	}
	return types.EffectiveConsumerPlan(tenant), true
}

func (s *knowledgeBaseService) checkCreateKnowledgeBaseEntitlement(ctx context.Context) error {
	plan, ok := effectivePlanFromContext(ctx)
	if !ok {
		return nil
	}
	limits := types.LimitsForConsumerPlan(plan)
	if limits.MaxKnowledgeBases == 0 {
		return nil
	}
	tenantID := types.MustTenantIDFromContext(ctx)
	rows, err := s.repo.ListKnowledgeBasesByTenantID(ctx, tenantID)
	if err != nil {
		return err
	}
	if int64(len(rows)) >= limits.MaxKnowledgeBases {
		return apperrors.NewForbiddenError("Free plan supports one knowledge base; upgrade to create another")
	}
	return nil
}

func (s *knowledgeService) checkCreateKnowledgeEntitlement(ctx context.Context, kbID, fileType string, fileBytes int64) error {
	tenant, ok := types.TenantInfoFromContext(ctx)
	if !ok || tenant == nil || tenant.Plan == "" {
		return nil
	}
	plan := types.EffectiveConsumerPlan(tenant)
	limits := types.LimitsForConsumerPlan(plan)
	if IsVideoType(fileType) && !limits.VideoUpload {
		return apperrors.NewForbiddenError("Free plan does not support video upload")
	}
	if limits.MaxDocumentsPerKB > 0 {
		count, err := s.repo.CountKnowledgeByKnowledgeBaseID(ctx, tenant.ID, kbID)
		if err != nil {
			return err
		}
		if count >= limits.MaxDocumentsPerKB {
			return apperrors.NewForbiddenError("Free plan supports ten documents per knowledge base; upgrade to add more")
		}
	}
	used := types.EffectiveOpenRouterUsage(tenant, time.Now())
	remaining := limits.MonthlyOpenRouterMicrousd - used
	if types.EstimateParseMicrousd(fileBytes) > remaining {
		return apperrors.NewTooManyRequestsError("OpenRouter monthly credit is insufficient to parse this document")
	}
	return nil
}

func (s *modelService) consumerPlanAllowsModel(ctx context.Context, model *types.Model) (bool, error) {
	plan, ok := effectivePlanFromContext(ctx)
	if ok {
		return types.ConsumerPlanAllowsModel(plan, model), nil
	}
	if s.entitlement == nil {
		return true, nil
	}
	current, err := s.entitlement.Current(ctx, time.Now())
	if err != nil {
		return false, err
	}
	return types.ConsumerPlanAllowsModel(current.Plan, model), nil
}
