package router

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Tencent/WeKnora/internal/application/service"
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
	service.SetProductEdition(handler.Edition)
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

func serveLiteSystemInfo(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"version": handler.Version,
			"edition": handler.Edition,
		},
	})
}

func readAndRestoreRequestBody(c *gin.Context) ([]byte, error) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	return body, nil
}

func liteFavoriteRequestBlocked(c *gin.Context) bool {
	const base = "/api/v1/user/favorites"
	path := strings.TrimSpace(c.Request.URL.Path)
	method := strings.ToUpper(strings.TrimSpace(c.Request.Method))

	if path == base {
		switch method {
		case http.MethodGet:
			return !strings.EqualFold(strings.TrimSpace(c.Query("type")), "kb")
		case http.MethodPost:
			body, err := readAndRestoreRequestBody(c)
			if err != nil {
				return true
			}
			var req struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(body, &req); err != nil {
				return true
			}
			return !strings.EqualFold(strings.TrimSpace(req.Type), "kb")
		default:
			return true
		}
	}

	if strings.HasPrefix(path, base+"/") {
		if method != http.MethodDelete {
			return true
		}
		rest := strings.TrimPrefix(path, base+"/")
		parts := strings.SplitN(rest, "/", 2)
		return len(parts) != 2 || !strings.EqualFold(strings.TrimSpace(parts[0]), "kb") || strings.TrimSpace(parts[1]) == ""
	}

	return false
}

func liteAgentScopedKnowledgeRequestBlocked(c *gin.Context) bool {
	path := strings.TrimSpace(c.Request.URL.Path)
	if !strings.HasPrefix(path, "/api/v1/knowledge-bases") &&
		!strings.HasPrefix(path, "/api/v1/knowledge") {
		return false
	}
	return strings.TrimSpace(c.Query("agent_id")) != "" ||
		strings.TrimSpace(c.Query("agent_source_tenant_id")) != ""
}

func liteRuntimeAgentIDAllowed(agentID string) bool {
	agentID = strings.TrimSpace(agentID)
	return agentID == "" || agentID == liteQuickAnswerAgentID || agentID == liteSmartReasoningAgentID
}

func liteChatRequestBlocked(c *gin.Context) bool {
	if c.Request.Method != http.MethodPost {
		return false
	}
	path := strings.TrimSpace(c.Request.URL.Path)
	if !strings.HasPrefix(path, "/api/v1/knowledge-chat/") &&
		!strings.HasPrefix(path, "/api/v1/agent-chat/") {
		return false
	}

	body, err := readAndRestoreRequestBody(c)
	if err != nil {
		return true
	}
	var req struct {
		AgentID             string   `json:"agent_id"`
		AgentSourceTenantID uint64   `json:"agent_source_tenant_id"`
		WebSearchEnabled    bool     `json:"web_search_enabled"`
		MCPServiceIDs       []string `json:"mcp_service_ids"`
		SkillNames          []string `json:"skill_names"`
		MentionedItems      []struct {
			Type string `json:"type"`
		} `json:"mentioned_items"`
	}
	// Malformed JSON is not a product-policy decision. Restore the body and let
	// the native handler preserve its existing 400 validation semantics.
	if err := json.Unmarshal(body, &req); err != nil {
		return false
	}
	if !liteRuntimeAgentIDAllowed(req.AgentID) || req.AgentSourceTenantID != 0 {
		return true
	}
	if req.WebSearchEnabled {
		return true
	}
	if len(req.MCPServiceIDs) > 0 || len(req.SkillNames) > 0 {
		return true
	}
	for _, item := range req.MentionedItems {
		switch strings.ToLower(strings.TrimSpace(item.Type)) {
		case "mcp", "skill":
			return true
		}
	}
	return false
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

		// The browser only needs Edition to activate/deactivate the Musuw product
		// boundary. Do not pass Lite /system/info through to the full system
		// handler, which also exposes database/vector/graph/storage internals.
		if c.Request.Method == http.MethodGet && c.Request.URL.Path == "/api/v1/system/info" {
			serveLiteSystemInfo(c)
			return
		}

		// Favorites are shared by Knowledge Base and Agent directories upstream.
		// Lite exposes the KB directory only, so the shared API is narrowed to
		// type=kb instead of becoming an Agent discovery/mutation backdoor.
		if strings.HasPrefix(c.Request.URL.Path, "/api/v1/user/favorites") && liteFavoriteRequestBlocked(c) {
			abortLiteProductRoute(c)
			return
		}

		// Shared/custom Agent KB access is a hidden Agent capability. Local Lite
		// built-ins use the ordinary KB paths, so agent-scoped KB query parameters
		// are never required by the exposed Chat/KB UI.
		if liteAgentScopedKnowledgeRequestBlocked(c) {
			abortLiteProductRoute(c)
			return
		}

		// Both native QA endpoints accept Agent/MCP/Skill overrides in their JSON
		// request. Limit those fields here so knowing a hidden Agent/tool ID cannot
		// turn the exposed chat box into a management-feature execution backdoor.
		if liteChatRequestBlocked(c) {
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

// liteOperationsAdminRouteAllowed exposes only the narrow operations-console
// seam in Lite. These routes remain behind the existing SystemAdmin guard and
// capability-scoped platform API-key middleware; this function only prevents
// the product-surface gate from turning an authorized request into a 404.
// Platform key management, settings and every other upstream admin surface
// remain hidden.
func liteOperationsAdminRouteAllowed(method, path string) bool {
	method = strings.ToUpper(strings.TrimSpace(method))
	path = strings.TrimSpace(path)

	if method == http.MethodGet && path == "/api/v1/system/admin/audit-log" {
		return true
	}

	const tenantPrefix = "/api/v1/system/admin/tenants/"
	if strings.HasPrefix(path, tenantPrefix) {
		parts := strings.Split(strings.TrimPrefix(path, tenantPrefix), "/")
		if len(parts) == 0 {
			return false
		}
		tenantID, err := strconv.ParseUint(parts[0], 10, 64)
		if err != nil || tenantID == 0 {
			return false
		}
		switch {
		case method == http.MethodPatch && len(parts) == 1:
			return true
		case method == http.MethodGet && len(parts) == 2 && parts[1] == "entitlement":
			return true
		case method == http.MethodPut && len(parts) == 2 && parts[1] == "openrouter-credits":
			return true
		default:
			return false
		}
	}

	const userPrefix = "/api/v1/system/admin/users/"
	if method == http.MethodGet && strings.HasPrefix(path, userPrefix) {
		parts := strings.Split(strings.TrimPrefix(path, userPrefix), "/")
		return len(parts) == 2 && strings.TrimSpace(parts[0]) != "" && parts[1] == "investigation"
	}

	const runtimeQueues = "/api/v1/system/admin/runtime/queues"
	if path == runtimeQueues {
		return method == http.MethodGet
	}
	if strings.HasPrefix(path, runtimeQueues+"/") {
		parts := strings.Split(strings.TrimPrefix(path, runtimeQueues+"/"), "/")
		if len(parts) < 2 || strings.TrimSpace(parts[0]) == "" {
			return false
		}
		switch {
		case method == http.MethodGet && len(parts) == 2 && parts[1] == "tasks":
			return true
		case method == http.MethodDelete && len(parts) == 2 && parts[1] == "archived":
			return true
		case method == http.MethodPost && len(parts) == 5 && parts[1] == "tasks" &&
			strings.TrimSpace(parts[2]) != "" && parts[3] == "actions" && strings.TrimSpace(parts[4]) != "":
			return true
		default:
			return false
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

	// Musuw uses the external OIDC/Auth shell for human identity. Native
	// password registration/login/change-password, desktop auto-setup, tenant
	// switching/preferences, and invite registration are not consumer surfaces.
	// OIDC config/url/callback, refresh, validate, logout and /auth/me remain.
	for _, blockedAuthPath := range []string{
		"/api/v1/auth/register",
		"/api/v1/auth/login",
		"/api/v1/auth/change-password",
		"/api/v1/auth/config",
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

	if liteOperationsAdminRouteAllowed(method, path) {
		return false
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
		"/api/v1/wechat",
		"/api/v1/chunker/preview",
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
		if strings.HasPrefix(rest, "scene-options/") {
			return false
		}
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

	// The consumer workflow may read the resolved KB configuration, but every
	// initialization write is a model-management surface. In particular,
	// InitializeByKB can create/update raw provider models internally, bypassing
	// the ordinary /models route guard, so Lite must fail it closed.
	if path == "/api/v1/initialization" || strings.HasPrefix(path, "/api/v1/initialization/") {
		rest := strings.TrimPrefix(path, "/api/v1/initialization/")
		if strings.HasPrefix(rest, "config/") {
			return method != http.MethodGet
		}
		return true
	}

	return false
}
