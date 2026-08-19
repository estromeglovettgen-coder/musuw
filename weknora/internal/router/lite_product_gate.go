package router

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Tencent/WeKnora/internal/handler"
)

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
		if liteProductRouteBlocked(c.Request.Method, c.Request.URL.Path) {
			// Product-disabled capabilities deliberately look absent. This is not
			// the security mechanism by itself; the request is actually aborted
			// here before RBAC/handler execution.
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "not found",
			})
			return
		}
		c.Next()
	}
}

// liteProductRouteBlocked keeps shared runtime dependencies narrow rather than
// blindly disabling every route family. Chat still needs read-only model/agent
// metadata, while Knowledge Base keeps its own sharing, parsing, Trace, Wiki and
// Graph workflows. Management-only surfaces are denied.
func liteProductRouteBlocked(method, path string) bool {
	method = strings.ToUpper(strings.TrimSpace(method))
	path = strings.TrimSpace(path)

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
		"/api/v1/weknora-cloud",
		"/api/v1/system/admin",
		"/api/v1/skills",
		"/api/v1/shared-agents",
	} {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}

	// Model catalog is a chat runtime dependency. Lite may read models, but it
	// may not create/edit/delete/debug them or touch credentials.
	if path == "/api/v1/models" || strings.HasPrefix(path, "/api/v1/models/") {
		return method != http.MethodGet
	}

	// Agent definitions are still used by the chat runtime. Authoring, copying,
	// sharing and channel/embed management stay unavailable in Lite.
	if path == "/api/v1/agents" || strings.HasPrefix(path, "/api/v1/agents/") {
		if method != http.MethodGet {
			return true
		}
		if strings.Contains(path, "/shares") ||
			strings.Contains(path, "/im-channels") ||
			strings.Contains(path, "/embed-channels") {
			return true
		}
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

	// Workspace/member/invitation/API-key administration is not a Musuw Lite
	// surface. Keep a narrow GET /tenants/:id escape hatch because existing KB
	// code may read active workspace metadata; catalog and management endpoints
	// remain inaccessible.
	if path == "/api/v1/tenants" {
		return true
	}
	if strings.HasPrefix(path, "/api/v1/tenants/") {
		rest := strings.TrimPrefix(path, "/api/v1/tenants/")
		if rest == "all" || rest == "search" || strings.HasPrefix(rest, "kv/") {
			return true
		}
		if strings.Contains(rest, "/members") ||
			strings.Contains(rest, "/invitations") ||
			strings.Contains(rest, "/invite-links") ||
			strings.Contains(rest, "/api-keys") ||
			strings.Contains(rest, "/api-principal") ||
			strings.Contains(rest, "/audit-log") ||
			strings.HasSuffix(rest, "/leave") {
			return true
		}
		// Only the read-only active-tenant metadata endpoint remains available.
		return method != http.MethodGet || strings.Contains(rest, "/")
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
