package service

import (
	"context"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/stretchr/testify/require"
)

type tenantProvisionRepoStub struct {
	tenantLifecycleRepoStub
	tenants []*types.Tenant
}

func (r *tenantProvisionRepoStub) ListTenants(context.Context) ([]*types.Tenant, error) {
	out := make([]*types.Tenant, 0, len(r.tenants))
	for _, tenant := range r.tenants {
		out = append(out, cloneTenantForLifecycleTest(tenant))
	}
	return out, nil
}

func (r *tenantProvisionRepoStub) UpdateTenant(_ context.Context, tenant *types.Tenant) error {
	for i, current := range r.tenants {
		if current != nil && current.ID == tenant.ID {
			r.tenants[i] = cloneTenantForLifecycleTest(tenant)
			return nil
		}
	}
	return nil
}

func TestProvisionExistingOpenRouterTenantKeysIsExplicitAndBestEffort(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "0123456789abcdef0123456789abcdef")
	repo := &tenantProvisionRepoStub{tenants: []*types.Tenant{
		{ID: 1, Name: "free", Status: "active", Plan: types.ConsumerPlanFree},
		{ID: 2, Name: "pro", Status: "active", Plan: types.ConsumerPlanPro},
		{ID: 3, Name: "suspended", Status: "suspended", Plan: types.ConsumerPlanMax},
		{ID: 4, Name: "existing", Status: "active", Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{APIKey: "sk-existing", KeyHash: "hash-existing"}}},
		{ID: 5, Name: "broken", Status: "active", Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{KeyHash: "hash-broken"}}},
	}}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)

	summary, err := svc.ProvisionOpenRouterKeysForExistingTenants(context.Background())
	require.NoError(t, err)
	require.Equal(t, 5, summary.Scanned)
	require.Equal(t, 2, summary.Provisioned)
	require.Equal(t, 1, summary.AlreadyProvisioned)
	require.Equal(t, 1, summary.SkippedInactive)
	require.Len(t, summary.Failures, 1)
	require.Equal(t, uint64(5), summary.Failures[0].TenantID)
	require.Len(t, keys.creates, 2)
	require.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanFree).MonthlyOpenRouterMicrousd, keys.creates[0].limit)
	require.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanPro).MonthlyOpenRouterMicrousd, keys.creates[1].limit)
}

func TestProvisionExistingOpenRouterTenantKeysRequiresProductionSecrets(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "")
	repo := &tenantProvisionRepoStub{}
	svc := newTenantService(repo, nil, &tenantLifecycleKeyManager{})

	summary, err := svc.ProvisionOpenRouterKeysForExistingTenants(context.Background())
	require.Error(t, err)
	require.Nil(t, summary)
	require.Contains(t, err.Error(), "SYSTEM_AES_KEY")
}
