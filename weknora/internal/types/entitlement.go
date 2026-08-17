package types

import "time"

// ConsumerPlan is the single persisted identifier for a tenant's current plan.
type ConsumerPlan string

const (
	ConsumerPlanFree ConsumerPlan = "free"
	ConsumerPlanPlus ConsumerPlan = "plus"
	ConsumerPlanPro  ConsumerPlan = "pro"
	ConsumerPlanMax  ConsumerPlan = "max"

	CheapestChatModelID            = "builtin-openrouter-qwen-flash"
	CheapestEmbeddingModelID       = PlatformKnowledgeBaseEmbeddingModelID
	CheapestRerankModelID          = "builtin-openrouter-rerank"
	CheapestVisionModelID          = PlatformKnowledgeBaseVLMModelID
	CheapestSpeechModelID          = PlatformKnowledgeBaseASRModelID
	consumerGiB              int64 = 1024 * 1024 * 1024
	parseEstimateMiB         int64 = 1024 * 1024
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
	OpenRouterUsageMonth        string `json:"openrouter_usage_month"`
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
		return ConsumerPlanLimits{Plan: ConsumerPlanPlus, StorageBytes: 20 * consumerGiB, MonthlyOpenRouterMicrousd: 1_250_000, VideoUpload: true}
	case ConsumerPlanPro:
		return ConsumerPlanLimits{Plan: ConsumerPlanPro, StorageBytes: 40 * consumerGiB, MonthlyOpenRouterMicrousd: 2_500_000, VideoUpload: true}
	case ConsumerPlanMax:
		return ConsumerPlanLimits{Plan: ConsumerPlanMax, StorageBytes: 80 * consumerGiB, MonthlyOpenRouterMicrousd: 5_000_000, VideoUpload: true}
	default:
		return ConsumerPlanLimits{Plan: ConsumerPlanFree, StorageBytes: 5 * consumerGiB, MonthlyOpenRouterMicrousd: 1_000_000, MaxKnowledgeBases: 1, MaxDocumentsPerKB: 10}
	}
}

func EffectiveConsumerPlan(tenant *Tenant) ConsumerPlan {
	if tenant == nil {
		return ConsumerPlanFree
	}
	plan := NormalizeConsumerPlan(tenant.Plan)
	if plan == ConsumerPlanFree || tenant.PlanStatus == "" || tenant.PlanStatus == "active" || tenant.PlanStatus == "trialing" {
		return plan
	}
	return ConsumerPlanFree
}

func OpenRouterUsageMonth(at time.Time) string {
	return at.UTC().Format("2006-01")
}

func EffectiveOpenRouterUsage(tenant *Tenant, at time.Time) int64 {
	if tenant == nil || tenant.OpenRouterUsageMonth != OpenRouterUsageMonth(at) || tenant.OpenRouterUsedMicrousd < 0 {
		return 0
	}
	return tenant.OpenRouterUsedMicrousd
}

func EstimateParseMicrousd(fileBytes int64) int64 {
	if fileBytes <= 0 {
		return 10_000
	}
	blocks := (fileBytes + parseEstimateMiB - 1) / parseEstimateMiB
	return blocks * 10_000
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
