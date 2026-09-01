package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Tencent/WeKnora/internal/middleware"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUpdateTenantMemoryConfigLitePersistsCompleteVisibleConfig(t *testing.T) {
	originalEdition := Edition
	Edition = "lite"
	t.Cleanup(func() { Edition = originalEdition })

	vectorRecall := true
	retrievalConditioning := false
	tenant := &types.Tenant{
		ID: 1,
		MemoryConfig: &types.MemoryConfig{
			Enabled:                   false,
			WriteMode:                 types.MemoryWriteExplicitOnly,
			ExtractModelID:            "server-extractor",
			MaxItems:                  200,
			ExtractDelaySeconds:       90,
			ExtractMinIntervalSeconds: 300,
			ExtractInstructions:       "server instructions",
			InterestThreshold:         4,
			EmbeddingModelID:          "server-embedding",
			VectorRecall:              &vectorRecall,
			RetrievalConditioning:     &retrievalConditioning,
		},
	}
	service := &stubTenantService{tenant: tenant}
	h := &TenantHandler{service: service}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.ErrorHandler())
	r.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), types.TenantIDContextKey, tenant.ID)
		ctx = context.WithValue(ctx, types.TenantRoleContextKey, types.TenantRoleAdmin)
		ctx = context.WithValue(ctx, types.TenantInfoContextKey, tenant)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	r.PUT("/tenants/kv/:key", h.UpdateTenantKV)

	body := `{"enabled":true,"write_mode":"auto","max_items":17,"retrieval_conditioning":true,"extract_model_id":"custom-extractor","extract_delay_seconds":60,"extract_min_interval_seconds":120,"extract_instructions":"custom instructions","interest_threshold":5,"embedding_model_id":"custom-embedding","vector_recall":false}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/tenants/kv/memory-config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotNil(t, service.tenant.MemoryConfig)
	got := service.tenant.MemoryConfig
	require.True(t, got.Enabled)
	require.Equal(t, types.MemoryWriteAuto, got.WriteMode)
	require.Equal(t, 17, got.MaxItems)
	require.NotNil(t, got.RetrievalConditioning)
	require.True(t, *got.RetrievalConditioning)
	require.Equal(t, "custom-extractor", got.ExtractModelID)
	require.Equal(t, 60, got.ExtractDelaySeconds)
	require.Equal(t, 120, got.ExtractMinIntervalSeconds)
	require.Equal(t, "custom instructions", got.ExtractInstructions)
	require.Equal(t, 5, got.InterestThreshold)
	require.Equal(t, "custom-embedding", got.EmbeddingModelID)
	require.NotNil(t, got.VectorRecall)
	require.False(t, *got.VectorRecall)
}

func TestUpdateTenantMemoryConfigLiteValidatesEveryVisibleField(t *testing.T) {
	originalEdition := Edition
	Edition = "lite"
	t.Cleanup(func() { Edition = originalEdition })

	tenant := &types.Tenant{ID: 1}
	service := &stubTenantService{tenant: tenant}
	h := &TenantHandler{service: service}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.ErrorHandler())
	r.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), types.TenantIDContextKey, tenant.ID)
		ctx = context.WithValue(ctx, types.TenantRoleContextKey, types.TenantRoleAdmin)
		ctx = context.WithValue(ctx, types.TenantInfoContextKey, tenant)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	r.PUT("/tenants/kv/:key", h.UpdateTenantKV)

	body := `{"enabled":true,"write_mode":"auto","max_items":17,"extract_delay_seconds":-1}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/tenants/kv/memory-config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdateTenantMemoryConfigStandardKeepsExistingAuthority(t *testing.T) {
	originalEdition := Edition
	Edition = "standard"
	t.Cleanup(func() { Edition = originalEdition })

	tenant := &types.Tenant{ID: 1}
	service := &stubTenantService{tenant: tenant}
	h := &TenantHandler{service: service}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.ErrorHandler())
	r.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), types.TenantIDContextKey, tenant.ID)
		ctx = context.WithValue(ctx, types.TenantRoleContextKey, types.TenantRoleAdmin)
		ctx = context.WithValue(ctx, types.TenantInfoContextKey, tenant)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	r.PUT("/tenants/kv/:key", h.UpdateTenantKV)

	body := `{"enabled":true,"write_mode":"auto","max_items":17,"extract_model_id":"custom-extractor","extract_delay_seconds":60,"extract_min_interval_seconds":120,"extract_instructions":"custom instructions","interest_threshold":5,"embedding_model_id":"custom-embedding","vector_recall":false,"retrieval_conditioning":false}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/tenants/kv/memory-config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	got := service.tenant.MemoryConfig
	require.True(t, got.Enabled)
	require.Equal(t, types.MemoryWriteAuto, got.WriteMode)
	require.Equal(t, 17, got.MaxItems)
	require.Equal(t, "custom-extractor", got.ExtractModelID)
	require.Equal(t, 60, got.ExtractDelaySeconds)
	require.Equal(t, 120, got.ExtractMinIntervalSeconds)
	require.Equal(t, "custom instructions", got.ExtractInstructions)
	require.Equal(t, 5, got.InterestThreshold)
	require.Equal(t, "custom-embedding", got.EmbeddingModelID)
	require.NotNil(t, got.VectorRecall)
	require.False(t, *got.VectorRecall)
	require.NotNil(t, got.RetrievalConditioning)
	require.False(t, *got.RetrievalConditioning)
}
