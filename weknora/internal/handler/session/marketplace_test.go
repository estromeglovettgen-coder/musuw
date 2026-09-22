package session

import (
	"context"
	stderrs "errors"
	"net/http"
	"testing"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/require"
)

type marketplaceAccessStub struct {
	interfaces.MarketplaceService
	access *types.MarketplaceAccess
	err    error
}

func TestMarketplaceRequestReportsVerificationOutageWithoutAskingBuyerToPayAgain(t *testing.T) {
	ctx := context.WithValue(context.Background(), types.TenantIDContextKey, uint64(41))
	h := &Handler{marketplaceService: &marketplaceAccessStub{err: stderrs.New("database is unavailable")}}
	_, _, err := h.resolveMarketplaceRequest(ctx, &CreateKnowledgeQARequest{MarketplaceProductID: "product"})
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, http.StatusServiceUnavailable, appErr.HTTPCode)
}

func (s *marketplaceAccessStub) AuthorizeAccess(_ context.Context, tenantID uint64, productID string, _ time.Time) (*types.MarketplaceAccess, error) {
	if tenantID != 41 || productID != "product" {
		return nil, types.ErrMarketplaceForbidden
	}
	return s.access, s.err
}

func TestMarketplaceRequestBindsApprovedAgentAndBuyerIdentity(t *testing.T) {
	ctx := context.WithValue(context.Background(), types.TenantIDContextKey, uint64(41))
	access := &types.MarketplaceAccess{ProductID: "product", SourceTenantID: 99,
		Agent: &types.CustomAgent{ID: "approved-agent", TenantID: 99, Config: types.CustomAgentConfig{
			SystemPrompt: "approved prompt", KBSelectionMode: "all", MCPSelectionMode: "all",
		}}, KnowledgeBaseIDs: []string{"approved-kb"}, DefaultModelID: types.MarketplaceDefaultModelID}
	h := &Handler{marketplaceService: &marketplaceAccessStub{access: access}}
	req := &CreateKnowledgeQARequest{MarketplaceProductID: "product"}
	gotCtx, agent, err := h.resolveMarketplaceRequest(ctx, req)
	require.NoError(t, err)
	require.Equal(t, uint64(41), types.MustTenantIDFromContext(gotCtx))
	require.Equal(t, "approved prompt", agent.Config.SystemPrompt)
	require.Equal(t, "selected", agent.Config.KBSelectionMode)
	require.Equal(t, []string{"approved-kb"}, req.KnowledgeBaseIDs)
	require.Equal(t, "approved-agent", req.AgentID)
	require.Equal(t, types.MarketplaceDefaultModelID, req.SummaryModelID)
	require.Zero(t, req.AgentSourceTenantID)
	require.Equal(t, "none", agent.Config.MCPSelectionMode)
	require.Equal(t, "all", access.Agent.Config.KBSelectionMode, "runtime must not mutate saved configuration")
}

func TestMarketplaceRequestDeniesExpiredAndInjectedTargets(t *testing.T) {
	ctx := context.WithValue(context.Background(), types.TenantIDContextKey, uint64(41))
	stub := &marketplaceAccessStub{err: types.ErrMarketplaceForbidden}
	h := &Handler{marketplaceService: stub}
	_, _, err := h.resolveMarketplaceRequest(ctx, &CreateKnowledgeQARequest{MarketplaceProductID: "product"})
	require.Error(t, err)
	stub.err = nil
	stub.access = &types.MarketplaceAccess{ProductID: "product", SourceTenantID: 99,
		Agent: &types.CustomAgent{ID: "approved-agent", TenantID: 99}, KnowledgeBaseIDs: []string{"approved-kb"}}
	for _, req := range []*CreateKnowledgeQARequest{
		{MarketplaceProductID: "product", AgentID: "other-agent"},
		{MarketplaceProductID: "product", KnowledgeBaseIDs: []string{"other-kb"}},
		{MarketplaceProductID: "product", KnowledgeIds: []string{"other-doc"}},
		{MarketplaceProductID: "product", MCPServiceIDs: []string{"source-secret-tool"}},
		{MarketplaceProductID: "product", AgentSourceTenantID: 99},
	} {
		_, _, err = h.resolveMarketplaceRequest(ctx, req)
		require.Error(t, err)
	}
}
