package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/Tencent/WeKnora/internal/config"
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/gin-gonic/gin"
)

// oidcNewIdentityDeniedProvisioning is intentionally not a valid tenant
// provisioning mode. LoginWithOIDC ignores the provisioning argument for an
// existing local user, while first-time identities eventually pass it to
// UserService.Register, which rejects invalid provisioning before creating a
// tenant or user. This lets invite_only block OIDC sign-up without blocking
// existing OIDC users and without duplicating registration business logic.
const oidcNewIdentityDeniedProvisioning types.TenantProvisioningMode = "__oidc_new_identity_denied__"

func (h *AuthHandler) resolveOIDCProvisioningMode(ctx context.Context) types.TenantProvisioningMode {
	if h.resolveRegistrationMode(ctx) == config.AuthRegistrationModeInviteOnly {
		return oidcNewIdentityDeniedProvisioning
	}
	return h.resolveDefaultTenantMode(ctx)
}

// OIDCRedirectCallbackWithRegistrationPolicy mirrors the established OIDC
// callback flow but resolves tenant provisioning through registration_mode.
// Existing local OIDC users continue to log in under invite_only. A valid IdP
// identity that has no local Musuw user receives an invalid provisioning mode,
// causing service-level Register to fail before it creates a Personal Tenant or
// OpenRouter child key.
func (h *AuthHandler) OIDCRedirectCallbackWithRegistrationPolicy(c *gin.Context) {
	ctx := c.Request.Context()
	frontendRedirectURI := "/"

	if providerError := strings.TrimSpace(c.Query("error")); providerError != "" {
		setOIDCBrowserBinding(c, "", -1)
		redirectURL := frontendRedirectURI + "#oidc_error=" + urlQueryEscape(providerError)
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	state := strings.TrimSpace(c.Query("state"))
	decodedState, err := decodeOIDCState(state, c.Request)
	if err != nil {
		logger.Errorf(ctx, "Failed to decode OIDC state: %v", err)
		c.Redirect(http.StatusFound, frontendRedirectURI+"#oidc_error="+urlQueryEscape("invalid_state"))
		return
	}
	setOIDCBrowserBinding(c, "", -1)

	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		c.Redirect(http.StatusFound, frontendRedirectURI+"#oidc_error="+urlQueryEscape("missing_code"))
		return
	}

	resp, err := h.userService.LoginWithOIDC(
		ctx,
		code,
		strings.TrimSpace(decodedState.RedirectURI),
		decodedState.CodeVerifier,
		h.resolveOIDCProvisioningMode(ctx),
	)
	if err != nil {
		logger.Errorf(ctx, "Failed to complete OIDC login via redirect callback: %v", err)
		c.Redirect(http.StatusFound, frontendRedirectURI+"#oidc_error="+urlQueryEscape("login_failed"))
		return
	}
	if !resp.Success {
		logger.Warnf(ctx, "OIDC login rejected by service: %s", resp.Message)
		c.Redirect(http.StatusFound, frontendRedirectURI+"#oidc_error="+urlQueryEscape("login_failed"))
		return
	}

	payload, err := encodeOIDCCallbackPayload(resp)
	if err != nil {
		logger.Errorf(ctx, "Failed to encode OIDC callback payload: %v", err)
		c.Redirect(http.StatusFound, frontendRedirectURI+"#oidc_error="+urlQueryEscape("payload_encode_failed"))
		return
	}

	c.Redirect(http.StatusFound, frontendRedirectURI+"#oidc_result="+urlQueryEscape(payload))
}
