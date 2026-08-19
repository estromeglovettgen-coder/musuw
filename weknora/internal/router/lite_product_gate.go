package router

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Tencent/WeKnora/internal/handler"
)

const (
	musuwProductEditionEnv    = "MUSUW_PRODUCT_EDITION"
	liteQuickAnswerAgentID    = "builtin-quick-answer"
	liteSmartReasoningAgentID = "builtin-smart-reasoning"
)

// Apply the optional product exposure override before NewRouter is built.
// The production container already loads production.env, so operators can
// switch Lite <-> Standard by changing one value and restarting the app.
// Invalid/empty values are ignored and the build-time Edition remains intact.
func init() {
	if edition, ok := normalizeMusuwProductEdition(os.Getenv(musuwProductEditionEnv)); ok {
		handler.Edition = edition
	}
}

func normalizeMusuwProductEdition(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "lite":
		return "lite", true
	case "standard":
		return "standard", true
	default:
		return "", false
	}
}

func abortLiteProductRoute(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
		"success": false,
		"message": "not found",
	})
}

// liteProductGate is the server-side product exposure boundary for Musuw Lite.
//
// Frontend hiding is UX only. This middleware is authoritative for authenticated
// /api/v1 traffic: knowing a WeKnora URL, changing localStorage, or crafting a
// request manually must not re-enable management surfaces that Musuw Lite does
// not expose.
//
// Standard edition is deliberately untouched so switching back to the normal
// WeKnora build restores the complete upstream surface without source recovery.
func liteProductGate() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.EqualFold(strings.TrimSpace(handler.Edition), "lite") {
			c.Next()
			return
		}
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		// Workspace switching is not an exposed Lite capability. The SPA clears
		// its old selected-tenant preference as soon as the server reports Lite;
		// reject a manually crafted X-Tenant-ID as well. System info is the one
		// exception because it is used to discover Edition before stale browser
		// state can be cleared.
		if strings.TrimSpace(c.GetHeader("X-Tenant-ID")) != "" && c.Request.URL.Path != "/api/v1/system/info" {
			abortLiteProductRoute(c)
			return
		}

		if liteProductRouteBlocked(c.Request.Method, c.Request.URL.Path) {
			abortLiteProductRoute(c)
			return
		}
		c.Next()
	}
}

func liteRuntimeAgentPathAllowed(path string) bool {
	for _, id := range []string{liteQuickAnswerAgentID, liteSmartReasoningAgentID} {
		base := "/api/v1/agents/" + id
		if path == base || path == base+"/suggested-questions" {
			return true
		}
	}
	return false
}

// liteProductRouteBlocked keeps shared runtime dependencies narrow rather than
// blindly disabling every route family. Chat still needs read-only model/agent
// metadata, while Knowledge Base keeps its own sharing, parsing, Trace, Wiki and
// Graph workflows. Management-only surfaces are denied.
func liteProductRouteBlocked(method, path string) bool {
	method = strings.ToUpper(strings.TrimSpace(method))
	path = strings.TrimSpace(path)

	// Native Lite desktop auto-setup creates/signs in a local default admin and
	// is never part of Musuw's external-auth product. Tenant switching,
	// workspace preference mutation, and invite registration/lookup are also
	// hidden workspace capabilities rather than chat/KB runtime dependencies.
	for _, blockedAuthPath := range []string{
		"/api/v1/auth/auto-setup",
		"/api/v1/auth/switch-tenant",
		"/api/v1/auth/me/preferences",
		"/api/v1/auth/register-by-invite",
		"/api/v1/auth/invitations/lookup",
	} {
		if path == blockedAuthPath {
			return true
		}
	}

	// Entire management-only route families.
	for _, prefix := range []string{
		"/api/v1/evaluation",
		"/api/v1/mcp-services",
		"/api/v1/mcp-oauth",
		"/api/v1/agent/tool-approvals",
		"/api/v1/agent/mcp-oauth-resolutions",
		"/api/v1/web-search",
		"/api/v1/web-search-providers",
		"/api/v1/vector-stores",
		"/api/v1/storage-backends",
		"/api/v1/datasource",
		"/api/v1/data-sources",
		"/api/v1/weknora-cloud",
		"/api/v1/system/admin",
		"/api/v1/skills",
		"/api/v1/shared-agents",
		"/api/v1/im-channels",
		"/api/v1/embed-channels",
	} {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}

	// Model catalog is a chat runtime dependency. Lite may read the runtime
	// model list/detail, but provider metadata and every mutation/debug/
	// credential surface remain hidden.
	if path == "/api/v1/models" {
		return method != http.MethodGet
	}
	if strings.HasPrefix(path, "/api/v1/models/") {
		if method != http.MethodGet {
			return true
		}
		if path == "/api/v1/models/providers" || strings.Contains(path, "/credentials") || strings.HasSuffix(path, "/debug") {
			return true
		}
		// A single model detail is the only nested read required by runtime UI.
		rest := strings.TrimPrefix(path, "/api/v1/models/")
		return rest == "" || strings.Contains(rest, "/")
	}

	// Agent management itself is not a Lite product surface. The browser only
	// needs the two built-in runtime modes used by the conversation composer.
	// Do not expose GET /agents because it would enumerate custom/internal
	// agents even though their UI is hidden.
	if path == "/api/v1/agents" {
		return true
	}
	if strings.HasPrefix(path, "/api/v1/agents/") {
		if method != http.MethodGet {
			return true
		}
		return !liteRuntimeAgentPathAllowed(path)
	}

	// Standalone organization management is hidden, but KB sharing is an
	// exposed Knowledge Base workflow. Read-only organization data required by
	// the KB share picker/list is therefore allowed; all org mutations and
	// agent-share projections are denied.
	if path == "/api/v1/organizations" || strings.HasPrefix(path, "/api/v1/organizations/") {
		if method != http.MethodGet {
			return true
		}
		if strings.Contains(path, "/agent-shares") || strings.Contains(path, "/shared-agents") {
			return true
		}
		for _, managementSegment := range []string{
			"/members",
			"/join-requests",
			"/search-tenants",
			"/search-users",
		} {
			if strings.Contains(path, managementSegment) {
				return true
			}
		}
		if path == "/api/v1/organizations/search" || strings.Contains(path, "/preview/") {
			return true
		}
	}

	// KB share routes are intentionally NOT blocked: they are part of the
	// exposed Knowledge Base UI. Shared-KB reads are allowed for the same reason.

	// Workspace lifecycle/settings/member/invitation/API-key administration is
	// not a Musuw Lite surface. The current tenant identity already comes from
	// /auth/me, so there is no need to expose even GET /tenants/:id.
	if path == "/api/v1/tenants" || strings.HasPrefix(path, "/api/v1/tenants/") {
		return true
	}
	if path == "/api/v1/me/invitations" || strings.HasPrefix(path, "/api/v1/me/invitations/") {
		return true
	}

	// System settings/admin probes are hidden. These three read-only endpoints
	// are retained because the KB document workflow uses them for parser/storage
	// availability and the app uses system info for edition detection.
	if path == "/api/v1/system" || strings.HasPrefix(path, "/api/v1/system/") {
		if method != http.MethodGet {
			return true
		}
		switch path {
		case "/api/v1/system/info",
			"/api/v1/system/parser-engines",
			"/api/v1/system/storage-engine-status":
			return false
		default:
			return true
		}
	}

	// KB initialization/configuration remains available. Model downloading,
	// connectivity testing and extraction-debug endpoints are management tools.
	if path == "/api/v1/initialization" || strings.HasPrefix(path, "/api/v1/initialization/") {
		rest := strings.TrimPrefix(path, "/api/v1/initialization/")
		if strings.HasPrefix(rest, "config/") {
			return method != http.MethodGet && method != http.MethodPut
		}
		if strings.HasPrefix(rest, "initialize/") {
			return method != http.MethodPost
		}
		return true
	}

	return false
}
