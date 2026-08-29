package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/require"
)

type visibleStrategyCreateStub struct {
	interfaces.KnowledgeBaseService
	called bool
}

func (s *visibleStrategyCreateStub) CreateKnowledgeBase(_ context.Context, kb *types.KnowledgeBase) (*types.KnowledgeBase, error) {
	s.called = true
	kb.ID = "kb-new"
	kb.TenantID = 1
	return kb, nil
}

func createKnowledgeBaseRequest(t *testing.T, edition, body string) (*httptest.ResponseRecorder, bool) {
	t.Helper()
	originalEdition := Edition
	Edition = edition
	t.Cleanup(func() { Edition = originalEdition })

	svc := &visibleStrategyCreateStub{}
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/knowledge-bases", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	newCreateKBRouter(svc).ServeHTTP(w, req)
	return w, svc.called
}

func TestLiteCreateKnowledgeBaseRejectsHiddenGraphOnlyAtHTTPBoundary(t *testing.T) {
	w, called := createKnowledgeBaseRequest(t, "lite", `{
		"name":"hidden-graph-only",
		"type":"document",
		"indexing_strategy":{"graph_enabled":true}
	}`)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.False(t, called)
}

func TestLiteCreateKnowledgeBaseAcceptsVisibleRAGOrWiki(t *testing.T) {
	for name, strategy := range map[string]string{
		"rag":  `{"vector_enabled":true}`,
		"wiki": `{"wiki_enabled":true}`,
	} {
		t.Run(name, func(t *testing.T) {
			w, called := createKnowledgeBaseRequest(t, "lite", `{"name":"configured","type":"document","indexing_strategy":`+strategy+`}`)
			require.Equal(t, http.StatusCreated, w.Code)
			require.True(t, called)
		})
	}
}

func TestStandardCreateKnowledgeBaseKeepsGraphOnlyHTTPContract(t *testing.T) {
	w, called := createKnowledgeBaseRequest(t, "standard", `{
		"name":"standard-graph-only",
		"type":"document",
		"indexing_strategy":{"graph_enabled":true}
	}`)

	require.Equal(t, http.StatusCreated, w.Code)
	require.True(t, called)
}
