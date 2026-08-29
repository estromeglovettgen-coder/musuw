package service

import (
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/require"
)

func TestLiteRejectsFAQKnowledgeBaseCreationAndCopies(t *testing.T) {
	t.Setenv("MUSUW_PRODUCT_EDITION", "lite")
	repo := newFakeKBRepo()
	svc := newPR3KBService(repo, &fakeRegistry{registered: map[string]struct{}{}}, &fakeOwnership{})
	ctx := ctxWithTenant(1)

	_, err := svc.CreateKnowledgeBase(ctx, &types.KnowledgeBase{
		Name: "faq",
		Type: types.KnowledgeBaseTypeFAQ,
	})
	require.ErrorContains(t, err, "FAQ")

	repo.rows["faq-source"] = &types.KnowledgeBase{
		ID:       "faq-source",
		Name:     "faq source",
		Type:     types.KnowledgeBaseTypeFAQ,
		TenantID: 1,
	}
	_, _, err = svc.CopyKnowledgeBase(ctx, "faq-source", "")
	require.ErrorContains(t, err, "FAQ")

	_, err = svc.DuplicateKnowledgeBase(ctx, "faq-source")
	require.ErrorContains(t, err, "FAQ")
}

func TestStandardKeepsNativeFAQKnowledgeBaseCreation(t *testing.T) {
	t.Setenv("MUSUW_PRODUCT_EDITION", "standard")
	repo := newFakeKBRepo()
	svc := newPR3KBService(repo, &fakeRegistry{registered: map[string]struct{}{}}, &fakeOwnership{})

	_, err := svc.CreateKnowledgeBase(ctxWithTenant(1), &types.KnowledgeBase{
		Name: "faq",
		Type: types.KnowledgeBaseTypeFAQ,
	})
	require.NoError(t, err)
}
