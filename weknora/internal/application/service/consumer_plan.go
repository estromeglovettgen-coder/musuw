package service

import (
	"context"
	"strings"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/types"
)

func effectivePlanFromContext(ctx context.Context) (types.ConsumerPlan, bool) {
	tenant, ok := types.TenantInfoFromContext(ctx)
	if !ok || tenant == nil || tenant.Plan == "" {
		return types.ConsumerPlanFree, false
	}
	return types.EffectiveConsumerPlanAt(tenant, time.Now().UTC()), true
}

func effectiveStorageQuota(tenant *types.Tenant, at time.Time) int64 {
	if tenant == nil {
		return 0
	}
	quota := tenant.StorageQuota
	if types.EffectiveConsumerPlan(tenant) != types.ConsumerPlanFree && types.EffectiveConsumerPlanAt(tenant, at) == types.ConsumerPlanFree {
		freeQuota := types.LimitsForConsumerPlan(types.ConsumerPlanFree).StorageBytes
		if quota <= 0 || quota > freeQuota {
			return freeQuota
		}
	}
	return quota
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
	plan := types.EffectiveConsumerPlanAt(tenant, time.Now().UTC())
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
	// OpenRouter's provider-managed key is the monthly spend authority. Request
	// byte size is not a reliable price oracle for parser/model calls, so the
	// product no longer rejects uploads using a local file-cost estimate.
	_ = fileBytes
	return nil
}

func (s *modelService) consumerPlanAllowsModel(ctx context.Context, model *types.Model) (bool, error) {
	// SystemAdmin maintains the shared platform model catalog and therefore
	// bypasses consumer restrictions.
	if types.IsSystemAdminFromContext(ctx) {
		return true, nil
	}

	// Musuw consumers never own arbitrary model infrastructure. Regardless of
	// paid plan, runtime inference must resolve to a platform builtin model that
	// is routed through OpenRouter. This turns the hidden custom-model UI into a
	// backend invariant: a manually inserted/custom remote/Ollama model cannot be
	// used by a C-end tenant even if some mutation route is accidentally exposed.
	if model == nil || !model.IsBuiltin || !strings.EqualFold(strings.TrimSpace(model.Parameters.Provider), "openrouter") {
		return false, nil
	}

	plan, ok := effectivePlanFromContext(ctx)
	if ok {
		if plan == types.ConsumerPlanFree && model != nil && model.Type != types.ModelTypeEmbedding && s.consumerResolver != nil {
			return s.consumerResolver.AllowsFreeConsumerModel(ctx, model)
		}
		return types.ConsumerPlanAllowsModel(plan, model), nil
	}
	if s.entitlement == nil {
		return true, nil
	}
	current, err := s.entitlement.Current(ctx, time.Now())
	if err != nil {
		return false, err
	}
	plan = types.NormalizeConsumerPlan(current.Plan)
	if plan == types.ConsumerPlanFree && model != nil && model.Type != types.ModelTypeEmbedding && s.consumerResolver != nil {
		return s.consumerResolver.AllowsFreeConsumerModel(ctx, model)
	}
	return types.ConsumerPlanAllowsModel(plan, model), nil
}
