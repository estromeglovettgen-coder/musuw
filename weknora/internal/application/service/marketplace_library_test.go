package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/application/repository"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/require"
)

func TestMarketplaceLibraryKeepsPaidHistoryLockedWithoutCreatingGrants(t *testing.T) {
	db := marketplaceServiceTestDB(t)
	svc := NewMarketplaceService(repository.NewMarketplaceRepository(db), nil,
		repository.NewKnowledgeBaseRepository(db), repository.NewCustomAgentRepository(db), nil)
	now, past, future := time.Now().UTC(), time.Now().Add(-time.Hour), time.Now().Add(time.Hour)
	for _, id := range []string{"usable", "expired", "refunded", "unpaid", "foreign", "free"} {
		amount := int64(100)
		if id == "free" {
			amount = 0
		}
		require.NoError(t, db.Create(&types.MarketplaceProduct{
			ID: id, Title: id, Description: "Public description", Status: "unpublished",
			MonthlyAmount: amount, YearlyAmount: amount * 10, PublishedTenantID: 99,
			PlatformAgentID: "agent-" + id, PlatformKnowledgeBaseIDs: types.StringArray{"kb-" + id},
			KnowledgeBaseNames: types.StringArray{"Published " + id},
			Contact:            "private contact",
			AgentSnapshot:      types.CustomAgentConfig{SystemPrompt: "private persona"},
		}).Error)
		require.NoError(t, db.Create(&types.KnowledgeBase{
			ID: "kb-" + id, TenantID: 99, Name: "Published " + id,
			IndexingStrategy: types.IndexingStrategy{WikiEnabled: true},
		}).Error)
		sub := &types.MarketplaceSubscription{
			ID: "sub-" + id, ProductID: id, TenantID: 7, UserID: "buyer", OperationKey: id,
			Status: "active", PaidThrough: &future, LastPaymentAt: &now, CancelAtPeriodEnd: true,
		}
		switch id {
		case "expired":
			sub.PaidThrough = &past
		case "refunded":
			sub.Status, sub.PaidThrough = "refunded", nil
		case "unpaid":
			sub.Status, sub.LastPaymentAt = "checkout_created", nil
		case "foreign":
			sub.TenantID = 8
		case "free":
			continue
		}
		require.NoError(t, db.Create(sub).Error)
	}
	// An earlier canceled term must not create a second card or override the
	// current still-paid term. All source data belongs to a different tenant.
	require.NoError(t, db.Create(&types.MarketplaceSubscription{
		ID: "old", TenantID: 7, UserID: "buyer", ProductID: "usable", OperationKey: "old",
		Status: "canceled", LastPaymentAt: &past, CreatedAt: past,
	}).Error)
	buyer := marketplaceIdentity(7, "buyer", false)
	rows, err := svc.Library(buyer)
	require.NoError(t, err)
	require.Len(t, rows, 3)
	byProduct := map[string]*types.MarketplaceLibraryEntry{}
	for _, row := range rows {
		byProduct[row.ProductID] = row
	}
	require.True(t, byProduct["usable"].CanRead, "unlisted and period-end-cancel still retain the paid term")
	require.True(t, byProduct["usable"].CancelAtPeriodEnd)
	require.True(t, byProduct["usable"].WikiEnabled)
	require.False(t, byProduct["expired"].CanRead)
	require.False(t, byProduct["refunded"].CanRead)
	encoded, err := json.Marshal(rows)
	require.NoError(t, err)
	for _, secret := range []string{"private contact", "private persona", "tenant_id", "source_tenant", "config"} {
		require.NotContains(t, string(encoded), secret)
	}
	var count int64
	require.NoError(t, db.Model(&types.MarketplaceSubscription{}).Count(&count).Error)
	require.Equal(t, int64(6), count, "listing must not materialize grants/subscriptions")
	// Previous paid history keeps the card, but does not pay for a new current term.
	require.NoError(t, db.Model(&types.MarketplaceSubscription{}).
		Where("id = ?", "sub-usable").Update("last_payment_at", nil).Error)
	rows, err = svc.Library(buyer)
	require.NoError(t, err)
	require.Len(t, rows, 3)
	for _, row := range rows {
		if row.ProductID == "usable" {
			require.False(t, row.CanRead, "library projection must agree with the paid-only Wiki gate")
		}
	}
	_, err = svc.Library(context.Background())
	require.ErrorIs(t, err, types.ErrMarketplaceForbidden)
}
