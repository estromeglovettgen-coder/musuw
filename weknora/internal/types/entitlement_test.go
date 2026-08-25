package types

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestPlanLimits(t *testing.T) {
	tests := []struct {
		plan          ConsumerPlan
		storageGiB    int64
		creditsMicros int64
		maxKBs        int64
		maxDocs       int64
		video         bool
	}{
		{ConsumerPlanFree, 5, 1_000_000, 1, 10, false},
		{ConsumerPlanPlus, 20, 1_250_000, 0, 0, true},
		{ConsumerPlanPro, 40, 2_500_000, 0, 0, true},
		{ConsumerPlanMax, 80, 5_000_000, 0, 0, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.plan), func(t *testing.T) {
			got := LimitsForConsumerPlan(tt.plan)
			assert.Equal(t, tt.storageGiB*1024*1024*1024, got.StorageBytes)
			assert.Equal(t, tt.creditsMicros, got.MonthlyOpenRouterMicrousd)
			assert.Equal(t, tt.maxKBs, got.MaxKnowledgeBases)
			assert.Equal(t, tt.maxDocs, got.MaxDocumentsPerKB)
			assert.Equal(t, tt.video, got.VideoUpload)
		})
	}
}

func TestFreeModelAllowlist(t *testing.T) {
	assert.True(t, ConsumerPlanAllowsModel(ConsumerPlanFree, &Model{ID: CheapestChatModelID, Type: ModelTypeKnowledgeQA}))
	assert.True(t, ConsumerPlanAllowsModel(ConsumerPlanFree, &Model{ID: PlatformKnowledgeBaseEmbeddingModelID, Type: ModelTypeEmbedding}))
	assert.False(t, ConsumerPlanAllowsModel(ConsumerPlanFree, &Model{ID: "builtin-deepseek-v4-pro", Type: ModelTypeKnowledgeQA}))
	assert.True(t, ConsumerPlanAllowsModel(ConsumerPlanPlus, &Model{ID: "builtin-deepseek-v4-pro", Type: ModelTypeKnowledgeQA}))
}

func TestEffectiveConsumerPlanAtBoundsPastDueGraceByConfirmedTerm(t *testing.T) {
	now := time.Now().UTC()
	future := now.Add(time.Hour)
	past := now.Add(-time.Hour)
	assert.Equal(t, ConsumerPlanPro, EffectiveConsumerPlanAt(&Tenant{
		Plan: ConsumerPlanPro, PlanStatus: "past_due", PaddleBillingPeriod: "yearly", PaddleCurrentPeriodEnd: &future,
	}, now))
	assert.Equal(t, ConsumerPlanFree, EffectiveConsumerPlanAt(&Tenant{
		Plan: ConsumerPlanPro, PlanStatus: "past_due", PaddleBillingPeriod: "yearly", PaddleCurrentPeriodEnd: &past,
	}, now))
	assert.Equal(t, ConsumerPlanFree, EffectiveConsumerPlanAt(&Tenant{
		Plan: ConsumerPlanPro, PlanStatus: "past_due",
	}, now))
	assert.Equal(t, ConsumerPlanPro, EffectiveConsumerPlanAt(&Tenant{
		Plan: ConsumerPlanPro, PlanStatus: "past_due", PaddleBillingPeriod: "monthly",
		PaddleCurrentPeriodEnd: &past, OpenRouterCreditPeriodEnd: &future,
	}, now))
	assert.Equal(t, ConsumerPlanFree, EffectiveConsumerPlanAt(&Tenant{
		Plan: ConsumerPlanPro, PlanStatus: "past_due", PaddleBillingPeriod: "monthly",
		PaddleCurrentPeriodEnd: &future, OpenRouterCreditPeriodEnd: &past,
	}, now))
}
