package service

import (
	"context"
	"fmt"
	"testing"

	modelopenrouter "github.com/Tencent/WeKnora/internal/models/openrouter"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/require"
)

type tenantLifecycleRepoStub struct {
	interfaces.TenantRepository
	tenant  *types.Tenant
	deleted bool
}

func cloneTenantForLifecycleTest(in *types.Tenant) *types.Tenant {
	if in == nil {
		return nil
	}
	cp := *in
	if in.Credentials != nil {
		credentials := *in.Credentials
		if in.Credentials.OpenRouter != nil {
			openRouter := *in.Credentials.OpenRouter
			credentials.OpenRouter = &openRouter
		}
		cp.Credentials = &credentials
	}
	return &cp
}

func (r *tenantLifecycleRepoStub) CreateTenant(_ context.Context, tenant *types.Tenant) error {
	if tenant.ID == 0 {
		tenant.ID = 42
	}
	r.tenant = cloneTenantForLifecycleTest(tenant)
	return nil
}

func (r *tenantLifecycleRepoStub) GetTenantByID(_ context.Context, id uint64) (*types.Tenant, error) {
	if r.tenant == nil || r.tenant.ID != id {
		return nil, fmt.Errorf("tenant not found")
	}
	return cloneTenantForLifecycleTest(r.tenant), nil
}

func (r *tenantLifecycleRepoStub) UpdateTenant(_ context.Context, tenant *types.Tenant) error {
	cp := cloneTenantForLifecycleTest(tenant)
	// GORM Updates(struct) ignores nil pointer fields. Preserve the currently
	// stored credentials when the caller is only changing status/name.
	if cp.Credentials == nil && r.tenant != nil {
		cp.Credentials = cloneTenantForLifecycleTest(r.tenant).Credentials
	}
	r.tenant = cp
	return nil
}

func (r *tenantLifecycleRepoStub) DeleteTenant(_ context.Context, id uint64) error {
	if r.tenant != nil && r.tenant.ID == id {
		r.deleted = true
	}
	return nil
}

type tenantLifecycleCreateCall struct {
	name  string
	limit int64
}

type tenantLifecycleKeyManager struct {
	creates []tenantLifecycleCreateCall
	deletes []string
}

func (m *tenantLifecycleKeyManager) CreateKey(_ context.Context, name string, limitMicrousd int64) (*modelopenrouter.ManagedKey, error) {
	m.creates = append(m.creates, tenantLifecycleCreateCall{name: name, limit: limitMicrousd})
	n := len(m.creates)
	return &modelopenrouter.ManagedKey{Key: fmt.Sprintf("sk-test-%d", n), Hash: fmt.Sprintf("hash-%d", n)}, nil
}

func (m *tenantLifecycleKeyManager) UpdateKeyLimit(context.Context, string, int64) error { return nil }
func (m *tenantLifecycleKeyManager) GetKey(context.Context, string) (*modelopenrouter.KeyInfo, error) {
	return nil, nil
}
func (m *tenantLifecycleKeyManager) DeleteKey(_ context.Context, hash string) error {
	m.deletes = append(m.deletes, hash)
	return nil
}

func TestCreateTenantProvisionsMonthlyOpenRouterKey(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "0123456789abcdef0123456789abcdef")
	repo := &tenantLifecycleRepoStub{}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)

	tenant, err := svc.CreateTenant(context.Background(), &types.Tenant{Name: "Personal"})
	require.NoError(t, err)
	require.Len(t, keys.creates, 1)
	require.Equal(t, "musuw-tenant-42", keys.creates[0].name)
	require.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanFree).MonthlyOpenRouterMicrousd, keys.creates[0].limit)
	require.NotNil(t, tenant.Credentials)
	require.Equal(t, "hash-1", tenant.Credentials.OpenRouter.KeyHash)
	require.Equal(t, "sk-test-1", tenant.Credentials.OpenRouter.APIKey)
}

func TestTenantDeleteRemovesProviderKeyBeforeWorkspace(t *testing.T) {
	repo := &tenantLifecycleRepoStub{tenant: &types.Tenant{
		ID:     42,
		Name:   "Personal",
		Status: "active",
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-existing", KeyHash: "hash-existing",
		}},
	}}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)

	err := svc.DeleteTenant(context.Background(), 42)
	require.NoError(t, err)
	require.Equal(t, []string{"hash-existing"}, keys.deletes)
	require.True(t, repo.deleted)
	require.Nil(t, repo.tenant.Credentials.OpenRouter)
}

func TestTenantSuspendDeletesKeyAndRestoreProvisionsFreshKey(t *testing.T) {
	t.Setenv("SYSTEM_AES_KEY", "0123456789abcdef0123456789abcdef")
	repo := &tenantLifecycleRepoStub{tenant: &types.Tenant{
		ID:     42,
		Name:   "Personal",
		Status: "active",
		Plan:   types.ConsumerPlanPro,
		Credentials: &types.CredentialsConfig{OpenRouter: &types.OpenRouterCredentials{
			APIKey: "sk-existing", KeyHash: "hash-existing",
		}},
	}}
	keys := &tenantLifecycleKeyManager{}
	svc := newTenantService(repo, nil, keys)

	_, err := svc.UpdateTenant(context.Background(), &types.Tenant{ID: 42, Name: "Personal", Status: "suspended", Plan: types.ConsumerPlanPro})
	require.NoError(t, err)
	require.Equal(t, []string{"hash-existing"}, keys.deletes)
	require.Nil(t, repo.tenant.Credentials.OpenRouter)

	_, err = svc.UpdateTenant(context.Background(), &types.Tenant{ID: 42, Name: "Personal", Status: "active", Plan: types.ConsumerPlanPro})
	require.NoError(t, err)
	require.Len(t, keys.creates, 1)
	require.Equal(t, types.LimitsForConsumerPlan(types.ConsumerPlanPro).MonthlyOpenRouterMicrousd, keys.creates[0].limit)
	require.Equal(t, "hash-1", repo.tenant.Credentials.OpenRouter.KeyHash)
}
