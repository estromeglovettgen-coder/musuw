package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type managedTenantServiceStub struct {
	interfaces.TenantService
	tenant  *types.Tenant
	updated *types.Tenant
}

func (s *managedTenantServiceStub) GetTenantByID(context.Context, uint64) (*types.Tenant, error) {
	return s.tenant, nil
}

func (s *managedTenantServiceStub) UpdateTenant(_ context.Context, tenant *types.Tenant) (*types.Tenant, error) {
	s.updated = tenant
	return tenant, nil
}

type managedEntitlementServiceStub struct {
	interfaces.EntitlementService
	current      *types.ConsumerEntitlement
	setRemaining int64
	setTenantID  uint64
	setError     error
	currentError error
}

func (s *managedEntitlementServiceStub) CurrentForTenant(context.Context, uint64, time.Time) (*types.ConsumerEntitlement, error) {
	return s.current, s.currentError
}

func (s *managedEntitlementServiceStub) SetOpenRouterRemainingForTenant(_ context.Context, tenantID uint64, remaining int64) (*types.ConsumerEntitlement, error) {
	s.setTenantID = tenantID
	s.setRemaining = remaining
	if s.setError != nil {
		return nil, s.setError
	}
	return s.current, nil
}

type managedAuditStub struct {
	interfaces.AuditLogService
	entries []*types.AuditLog
}

func (s *managedAuditStub) Log(_ context.Context, entry *types.AuditLog) error {
	s.entries = append(s.entries, entry)
	return nil
}

func managedTenantOpsRouter(h *SystemHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/tenants/:id/entitlement", h.GetManagedTenantEntitlement)
	r.PATCH("/tenants/:id", h.UpdateManagedTenant)
	r.PUT("/tenants/:id/openrouter-credits", h.UpdateManagedTenantOpenRouterCredits)
	return r
}

func TestGetManagedTenantEntitlementReturnsProviderStatusAndUsage(t *testing.T) {
	periodEnd := time.Date(2026, 9, 16, 0, 0, 0, 0, time.UTC)
	h := &SystemHandler{
		tenantSvc: &managedTenantServiceStub{tenant: &types.Tenant{
			ID: 7, Name: "Workspace", Status: "active", Plan: types.ConsumerPlanPro,
			StorageQuota: 40 * 1024, StorageUsed: 1024,
			PaddleBillingPeriod: "monthly", PaddleCurrentPeriodEnd: &periodEnd,
		}},
		entitlementSvc: &managedEntitlementServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits:          types.LimitsForConsumerPlan(types.ConsumerPlanPro),
			PlanStatus:                  "active",
			StorageUsed:                 1024,
			OpenRouterUsedMicrousd:      500_000,
			OpenRouterRemainingMicrousd: 2_000_000,
			OpenRouterResetsAt:          &periodEnd,
			OpenRouterCreditsStatus:     types.OpenRouterCreditsUnavailable,
		}},
	}
	r := managedTenantOpsRouter(h)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/tenants/7/entitlement", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	data := body["data"].(map[string]any)
	assert.Equal(t, "pro", data["plan"])
	assert.Equal(t, "unavailable", data["openrouter_credits_status"])
	assert.Equal(t, float64(1024), data["storage_used_bytes"])
	assert.NotContains(t, w.Body.String(), "api_key")
}

func TestUpdateManagedTenantWhitelistsStatusAndStorageQuota(t *testing.T) {
	audits := &managedAuditStub{}
	tenant := &types.Tenant{ID: 7, Name: "Workspace", Status: "active", StorageQuota: 100}
	service := &managedTenantServiceStub{tenant: tenant}
	h := &SystemHandler{tenantSvc: service, auditSvc: audits}
	r := managedTenantOpsRouter(h)

	invalid := httptest.NewRecorder()
	r.ServeHTTP(invalid, httptest.NewRequest(http.MethodPatch, "/tenants/7", strings.NewReader(`{"status":"suspended"}`)))
	assert.Equal(t, http.StatusBadRequest, invalid.Code)
	assert.Nil(t, service.updated)

	unknown := httptest.NewRecorder()
	r.ServeHTTP(unknown, httptest.NewRequest(http.MethodPatch, "/tenants/7", strings.NewReader(`{"status":"active","plan":"max"}`)))
	assert.Equal(t, http.StatusBadRequest, unknown.Code)
	assert.Nil(t, service.updated)

	valid := httptest.NewRecorder()
	r.ServeHTTP(valid, httptest.NewRequest(http.MethodPatch, "/tenants/7", strings.NewReader(`{"status":"inactive","storage_quota_bytes":2048}`)))
	require.Equal(t, http.StatusOK, valid.Code)
	require.NotNil(t, service.updated)
	assert.Equal(t, "inactive", service.updated.Status)
	assert.Equal(t, int64(2048), service.updated.StorageQuota)
	require.Len(t, audits.entries, 1)
	assert.Equal(t, types.AuditActionSystemTenantUpdated, audits.entries[0].Action)
}

func TestUpdateManagedTenantCreditsSupportsResetAndRejectsAmbiguousBody(t *testing.T) {
	audits := &managedAuditStub{}
	service := &managedTenantServiceStub{tenant: &types.Tenant{ID: 7, Plan: types.ConsumerPlanPlus, PlanStatus: "active"}}
	credits := &managedEntitlementServiceStub{current: &types.ConsumerEntitlement{ConsumerPlanLimits: types.LimitsForConsumerPlan(types.ConsumerPlanPlus)}}
	h := &SystemHandler{tenantSvc: service, entitlementSvc: credits, auditSvc: audits}
	r := managedTenantOpsRouter(h)

	bad := httptest.NewRecorder()
	r.ServeHTTP(bad, httptest.NewRequest(http.MethodPut, "/tenants/7/openrouter-credits", strings.NewReader(`{"reset":true,"remaining_microusd":1}`)))
	assert.Equal(t, http.StatusBadRequest, bad.Code)
	assert.Zero(t, credits.setRemaining)

	unknown := httptest.NewRecorder()
	r.ServeHTTP(unknown, httptest.NewRequest(http.MethodPut, "/tenants/7/openrouter-credits", strings.NewReader(`{"reset":true,"plan":"max"}`)))
	assert.Equal(t, http.StatusBadRequest, unknown.Code)
	assert.Zero(t, credits.setRemaining)

	good := httptest.NewRecorder()
	r.ServeHTTP(good, httptest.NewRequest(http.MethodPut, "/tenants/7/openrouter-credits", strings.NewReader(`{"reset":true}`)))
	require.Equal(t, http.StatusOK, good.Code)
	assert.Equal(t, int64(1_250_000), credits.setRemaining)
	assert.Equal(t, uint64(7), credits.setTenantID)
	require.Len(t, audits.entries, 1)
	assert.Equal(t, types.AuditActionSystemCreditsAdjusted, audits.entries[0].Action)
}
