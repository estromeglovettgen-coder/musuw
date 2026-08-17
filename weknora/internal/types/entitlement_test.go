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

func TestEffectiveOpenRouterUsageResetsOnUTCMonth(t *testing.T) {
	tenant := &Tenant{OpenRouterUsageMonth: "2026-07", OpenRouterUsedMicrousd: 900_000}
	assert.Equal(t, int64(0), EffectiveOpenRouterUsage(tenant, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)))

	tenant.OpenRouterUsageMonth = "2026-08"
	assert.Equal(t, int64(900_000), EffectiveOpenRouterUsage(tenant, time.Date(2026, 8, 31, 23, 59, 0, 0, time.UTC)))
}

func TestFreeModelAllowlist(t *testing.T) {
	assert.True(t, ConsumerPlanAllowsModel(ConsumerPlanFree, &Model{ID: CheapestChatModelID, Type: ModelTypeKnowledgeQA}))
	assert.True(t, ConsumerPlanAllowsModel(ConsumerPlanFree, &Model{ID: PlatformKnowledgeBaseEmbeddingModelID, Type: ModelTypeEmbedding}))
	assert.False(t, ConsumerPlanAllowsModel(ConsumerPlanFree, &Model{ID: "builtin-deepseek-v4-pro", Type: ModelTypeKnowledgeQA}))
	assert.True(t, ConsumerPlanAllowsModel(ConsumerPlanPlus, &Model{ID: "builtin-deepseek-v4-pro", Type: ModelTypeKnowledgeQA}))
}

func TestEstimateParseMicrousd(t *testing.T) {
	assert.Equal(t, int64(10_000), EstimateParseMicrousd(1))
	assert.Equal(t, int64(10_000), EstimateParseMicrousd(1024*1024))
	assert.Equal(t, int64(20_000), EstimateParseMicrousd(1024*1024+1))
}
