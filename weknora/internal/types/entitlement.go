package types

import "time"

// ConsumerPlan is the single persisted identifier for a tenant's current plan.
type ConsumerPlan string

type OpenRouterCreditsStatus string

const (
	ConsumerPlanFree ConsumerPlan = "free"
	ConsumerPlanPlus ConsumerPlan = "plus"
	ConsumerPlanPro  ConsumerPlan = "pro"
	ConsumerPlanMax  ConsumerPlan = "max"

	OpenRouterCreditsAvailable     OpenRouterCreditsStatus = "available"
	OpenRouterCreditsUnavailable   OpenRouterCreditsStatus = "unavailable"
	OpenRouterCreditsUnprovisioned OpenRouterCreditsStatus = "unprovisioned"
	OpenRouterCreditsPending       OpenRouterCreditsStatus = "pending"

	CheapestChatModelID            = "builtin-deepseek-v4-flash"
	CheapestEmbeddingModelID       = PlatformKnowledgeBaseEmbeddingModelID
	CheapestRerankModelID          = "builtin-openrouter-rerank"
	CheapestVisionModelID          = PlatformKnowledgeBaseVLMModelID
	CheapestSpeechModelID          = PlatformKnowledgeBaseASRModelID
	consumerGiB              int64 = 1024 * 1024 * 1024
)

// ConsumerPlanLimits is deliberately current-state only. Zero content limits
// mean "no plan-specific cap"; existing platform and storage checks still apply.
type ConsumerPlanLimits struct {
	Plan                      ConsumerPlan `json:"plan"`
	StorageBytes              int64        `json:"storage_bytes"`
	MonthlyOpenRouterMicrousd int64        `json:"monthly_openrouter_microusd"`
	MaxKnowledgeBases         int64        `json:"max_knowledge_bases"`
	MaxDocumentsPerKB         int64        `json:"max_documents_per_kb"`
	VideoUpload               bool         `json:"video_upload"`
}

type ConsumerEntitlement struct {
	ConsumerPlanLimits
	PlanStatus                  string `json:"plan_status"`
	StorageUsed                 int64  `json:"storage_used"`
	OpenRouterUsedMicrousd      int64  `json:"openrouter_used_microusd"`
	OpenRouterRemainingMicrousd int64  `json:"openrouter_remaining_microusd"`
	// Provider-backed usage is kept separate from the consumer-facing
	// allowance projection. OpenRouter reports lifetime key usage/remaining;
	// the consumer fields above are the current plan period after our plan
	// boundary is applied. These fields are intentionally not serialized by
	// generic entitlement responses; operator projections may expose them
	// under explicit provider_* names.
	OpenRouterProviderUsedMicrousd      int64                   `json:"-"`
	OpenRouterProviderRemainingMicrousd int64                   `json:"-"`
	OpenRouterResetsAt                  *time.Time              `json:"openrouter_resets_at,omitempty"`
	OpenRouterCreditsStatus             OpenRouterCreditsStatus `json:"openrouter_credits_status"`
	PaddleCustomerID                    string                  `json:"-"`
	PaddleSubscriptionID                string                  `json:"-"`
	PaddleBillingPeriod                 string                  `json:"-"`
	PaddleCurrentPeriodEnd              *time.Time              `json:"-"`
	OpenRouterCreditPeriodEnd           *time.Time              `json:"-"`
}

func NormalizeConsumerPlan(plan ConsumerPlan) ConsumerPlan {
	switch plan {
	case ConsumerPlanPlus, ConsumerPlanPro, ConsumerPlanMax:
		return plan
	default:
		return ConsumerPlanFree
	}
}

func LimitsForConsumerPlan(plan ConsumerPlan) ConsumerPlanLimits {
	switch NormalizeConsumerPlan(plan) {
	case ConsumerPlanPlus:
		return ConsumerPlanLimits{Plan: ConsumerPlanPlus, StorageBytes: 10 * consumerGiB, MonthlyOpenRouterMicrousd: 1_250_000, VideoUpload: true}
	case ConsumerPlanPro:
		return ConsumerPlanLimits{Plan: ConsumerPlanPro, StorageBytes: 30 * consumerGiB, MonthlyOpenRouterMicrousd: 2_500_000, VideoUpload: true}
	case ConsumerPlanMax:
		return ConsumerPlanLimits{Plan: ConsumerPlanMax, StorageBytes: 100 * consumerGiB, MonthlyOpenRouterMicrousd: 5_000_000, VideoUpload: true}
	default:
		return ConsumerPlanLimits{Plan: ConsumerPlanFree, StorageBytes: consumerGiB, MonthlyOpenRouterMicrousd: 400_000, MaxKnowledgeBases: 1, MaxDocumentsPerKB: 10}
	}
}

func EffectiveConsumerPlan(tenant *Tenant) ConsumerPlan {
	if tenant == nil {
		return ConsumerPlanFree
	}
	plan := NormalizeConsumerPlan(tenant.Plan)
	if plan == ConsumerPlanFree || tenant.PlanStatus == "" || tenant.PlanStatus == "active" || tenant.PlanStatus == "trialing" || tenant.PlanStatus == "past_due" {
		return plan
	}
	return ConsumerPlanFree
}

// EffectiveConsumerPlanAt applies the time-bounded part of Paddle's past_due
// grace policy. A failed renewal keeps paid access only through the last
// provider-confirmed paid term; it can never extend that boundary by itself.
func EffectiveConsumerPlanAt(tenant *Tenant, at time.Time) ConsumerPlan {
	plan := EffectiveConsumerPlan(tenant)
	if plan == ConsumerPlanFree || tenant == nil || tenant.PlanStatus != "past_due" {
		return plan
	}
	var paidTermEnd *time.Time
	switch tenant.PaddleBillingPeriod {
	case "monthly":
		paidTermEnd = tenant.OpenRouterCreditPeriodEnd
	case "yearly":
		paidTermEnd = tenant.PaddleCurrentPeriodEnd
	}
	if paidTermEnd == nil || !paidTermEnd.After(at.UTC()) {
		return ConsumerPlanFree
	}
	return plan
}

func ConsumerPlanAllowsModel(plan ConsumerPlan, model *Model) bool {
	if model == nil {
		return false
	}
	if NormalizeConsumerPlan(plan) != ConsumerPlanFree {
		return true
	}
	allowedID := map[ModelType]string{
		ModelTypeKnowledgeQA: CheapestChatModelID,
		ModelTypeEmbedding:   CheapestEmbeddingModelID,
		ModelTypeRerank:      CheapestRerankModelID,
		ModelTypeVLLM:        CheapestVisionModelID,
		ModelTypeASR:         CheapestSpeechModelID,
	}[model.Type]
	return allowedID != "" && model.ID == allowedID
}
