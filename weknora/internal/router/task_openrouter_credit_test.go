package router

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Tencent/WeKnora/internal/models/openrouter"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/require"
)

type openRouterCreditRepoStub struct {
	interfaces.KnowledgeRepository
	knowledgeID string
	updates     map[string]interface{}
}

func (r *openRouterCreditRepoStub) UpdateKnowledgeColumns(
	_ context.Context,
	knowledgeID string,
	updates map[string]interface{},
) error {
	r.knowledgeID = knowledgeID
	r.updates = updates
	return nil
}

type openRouterCreditKnowledgeServiceStub struct {
	interfaces.KnowledgeService
	repo interfaces.KnowledgeRepository
}

func (s *openRouterCreditKnowledgeServiceStub) GetRepository() interfaces.KnowledgeRepository {
	return s.repo
}

func TestOpenRouterCreditExhaustionStopsRetryAndMarksKnowledge(t *testing.T) {
	repo := &openRouterCreditRepoStub{}
	ks := &openRouterCreditKnowledgeServiceStub{repo: repo}
	middleware := openRouterCreditExhaustionMiddleware(ks, nil)
	handler := middleware(asynq.HandlerFunc(func(context.Context, *asynq.Task) error {
		return &openrouter.CreditExhaustedError{StatusCode: 402}
	}))

	payload, err := json.Marshal(map[string]interface{}{
		"knowledge_id": "knowledge-credit-test",
	})
	require.NoError(t, err)
	task := asynq.NewTask(types.TypeDocumentProcess, payload)

	err = handler.ProcessTask(context.Background(), task)
	require.Error(t, err)
	require.True(t, errors.Is(err, asynq.SkipRetry))
	require.True(t, openrouter.IsCreditExhausted(err))
	require.Equal(t, "knowledge-credit-test", repo.knowledgeID)
	require.Equal(t, types.ParseStatusFailed, repo.updates["parse_status"])
	require.Equal(t, openRouterCreditExhaustedMessage, repo.updates["error_message"])
}

func TestOpenRouterCreditExhaustionSkipsRetryWithoutRegressingCompletedEnrichment(t *testing.T) {
	repo := &openRouterCreditRepoStub{}
	ks := &openRouterCreditKnowledgeServiceStub{repo: repo}
	middleware := openRouterCreditExhaustionMiddleware(ks, nil)
	handler := middleware(asynq.HandlerFunc(func(context.Context, *asynq.Task) error {
		return &openrouter.CreditExhaustedError{StatusCode: 402}
	}))

	payload, err := json.Marshal(map[string]interface{}{
		"knowledge_id": "knowledge-enrichment-test",
	})
	require.NoError(t, err)
	task := asynq.NewTask(types.TypeSummaryGeneration, payload)

	err = handler.ProcessTask(context.Background(), task)
	require.Error(t, err)
	require.True(t, errors.Is(err, asynq.SkipRetry))
	require.Empty(t, repo.knowledgeID)
	require.Nil(t, repo.updates)
}
