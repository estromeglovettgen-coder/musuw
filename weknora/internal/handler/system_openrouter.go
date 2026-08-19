package handler

import (
	"net/http"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/gin-gonic/gin"
)

// ProvisionOpenRouterTenantKeys godoc
// @Summary      Provision OpenRouter keys for existing tenants
// @Description  Explicitly migrates active existing tenants to provider-managed monthly inference keys. Never runs automatically at startup and never returns key material.
// @Tags         System Admin
// @Produce      json
// @Success      200 {object} map[string]interface{}
// @Failure      500 {object} apperrors.AppError
// @Security     Bearer
// @Router       /system/admin/openrouter/provision-tenants [post]
func (h *SystemHandler) ProvisionOpenRouterTenantKeys(c *gin.Context) {
	if h == nil || h.tenantSvc == nil {
		c.Error(apperrors.NewInternalServerError("Tenant service is unavailable"))
		return
	}
	summary, err := h.tenantSvc.ProvisionOpenRouterKeysForExistingTenants(c.Request.Context())
	if err != nil {
		c.Error(apperrors.NewInternalServerError("Failed to provision OpenRouter tenant keys").WithDetails(err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": summary})
}
