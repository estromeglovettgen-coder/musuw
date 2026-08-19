package service

import (
	"context"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/require"
)

func TestProvisionTenantRefusesDuplicateWhenStoredCredentialsAreIncomplete(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "0123456789abcdef0123456789abcdef")
	repo := &tenantLifecycleRepoStub{}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)
	tenant := &types.Tenant{
		ID:     42,
		Name:   "Personal",
		Status: "active",
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			KeyHash: "hash-existing",
		}},
	}

	err := svc.provisionOpenRouterTenantKey(context.Background(), tenant)
	require.Error(t, err)
	require.Contains(t, err.Error(), "refusing duplicate provider key")
	require.Empty(t, keys.creates)
}

func TestDeleteTenantKeyUsesHashEvenWhenInferenceKeyCannotBeRead(t *testing.T) {
	repo := &tenantLifecycleRepoStub{tenant: &types.Tenant{
		ID:     42,
		Name:   "Personal",
		Status: "suspended",
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			KeyHash: "hash-existing",
		}},
	}}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)

	tenant, err := repo.GetTenantByID(context.Background(), 42)
	require.NoError(t, err)
	require.NoError(t, svc.deleteOpenRouterTenantKey(context.Background(), tenant))
	require.Equal(t, []string{"hash-existing"}, keys.deletes)
	require.Nil(t, repo.tenant.Credentials.OpenRouter)
}

func TestDeleteTenantKeyRefusesUnidentifiableProviderCredential(t *testing.T) {
	repo := &tenantLifecycleRepoStub{}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)
	tenant := &types.Tenant{
		ID:          42,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{}},
	}

	err := svc.deleteOpenRouterTenantKey(context.Background(), tenant)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no key hash")
	require.Empty(t, keys.deletes)
}
