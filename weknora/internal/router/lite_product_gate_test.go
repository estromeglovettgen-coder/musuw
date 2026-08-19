package router

import "testing"

func TestLiteProductRouteBlocked(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		method  string
		path    string
		blocked bool
	}{
		// Exposed product workflows.
		{name: "knowledge chat", method: "POST", path: "/api/v1/knowledge-chat/abc", blocked: false},
		{name: "agent chat", method: "POST", path: "/api/v1/agent-chat/abc", blocked: false},
		{name: "sessions", method: "GET", path: "/api/v1/sessions", blocked: false},
		{name: "knowledge base", method: "POST", path: "/api/v1/knowledge-bases", blocked: false},
		{name: "knowledge", method: "PUT", path: "/api/v1/knowledge/abc", blocked: false},
		{name: "wiki", method: "GET", path: "/api/v1/knowledge-bases/1/wiki/pages", blocked: false},
		{name: "kb share", method: "POST", path: "/api/v1/knowledge-bases/1/shares", blocked: false},
		{name: "shared kb", method: "GET", path: "/api/v1/shared-knowledge-bases", blocked: false},
		{name: "model runtime list", method: "GET", path: "/api/v1/models", blocked: false},
		{name: "model runtime detail", method: "GET", path: "/api/v1/models/builtin-deepseek-v4-flash", blocked: false},
		{name: "quick answer runtime agent", method: "GET", path: "/api/v1/agents/builtin-quick-answer", blocked: false},
		{name: "smart reasoning runtime agent", method: "GET", path: "/api/v1/agents/builtin-smart-reasoning", blocked: false},
		{name: "quick answer suggestions", method: "GET", path: "/api/v1/agents/builtin-quick-answer/suggested-questions", blocked: false},
		{name: "smart reasoning suggestions", method: "GET", path: "/api/v1/agents/builtin-smart-reasoning/suggested-questions", blocked: false},
		{name: "kb initialization read", method: "GET", path: "/api/v1/initialization/config/1", blocked: false},
		{name: "kb initialization update", method: "PUT", path: "/api/v1/initialization/config/1", blocked: false},
		{name: "kb initialize", method: "POST", path: "/api/v1/initialization/initialize/1", blocked: false},
		{name: "parser catalog", method: "GET", path: "/api/v1/system/parser-engines", blocked: false},
		{name: "storage status", method: "GET", path: "/api/v1/system/storage-engine-status", blocked: false},
		{name: "system info", method: "GET", path: "/api/v1/system/info", blocked: false},
		{name: "organization read for kb sharing", method: "GET", path: "/api/v1/organizations/3", blocked: false},
		{name: "organization kb shares", method: "GET", path: "/api/v1/organizations/3/shares", blocked: false},

		// Hidden auth/workspace surfaces.
		{name: "native register", method: "POST", path: "/api/v1/auth/register", blocked: true},
		{name: "native password login", method: "POST", path: "/api/v1/auth/login", blocked: true},
		{name: "native change password", method: "POST", path: "/api/v1/auth/change-password", blocked: true},
		{name: "native auth config", method: "GET", path: "/api/v1/auth/config", blocked: true},
		{name: "native lite auto setup", method: "POST", path: "/api/v1/auth/auto-setup", blocked: true},
		{name: "workspace switch", method: "POST", path: "/api/v1/auth/switch-tenant", blocked: true},
		{name: "workspace preference mutation", method: "PUT", path: "/api/v1/auth/me/preferences", blocked: true},
		{name: "invite registration", method: "POST", path: "/api/v1/auth/register-by-invite", blocked: true},
		{name: "invite lookup", method: "POST", path: "/api/v1/auth/invitations/lookup", blocked: true},

		// Hidden management/discovery surfaces.
		{name: "model providers", method: "GET", path: "/api/v1/models/providers", blocked: true},
		{name: "model create", method: "POST", path: "/api/v1/models", blocked: true},
		{name: "model update", method: "PUT", path: "/api/v1/models/1", blocked: true},
		{name: "model credentials", method: "DELETE", path: "/api/v1/models/1/credentials/api_key", blocked: true},
		{name: "agent enumeration", method: "GET", path: "/api/v1/agents", blocked: true},
		{name: "agent placeholders", method: "GET", path: "/api/v1/agents/placeholders", blocked: true},
		{name: "agent type presets", method: "GET", path: "/api/v1/agents/type-presets", blocked: true},
		{name: "custom agent read", method: "GET", path: "/api/v1/agents/custom-agent-id", blocked: true},
		{name: "internal deep researcher read", method: "GET", path: "/api/v1/agents/builtin-deep-researcher", blocked: true},
		{name: "agent create", method: "POST", path: "/api/v1/agents", blocked: true},
		{name: "agent update", method: "PUT", path: "/api/v1/agents/builtin-quick-answer", blocked: true},
		{name: "agent share read", method: "GET", path: "/api/v1/agents/builtin-quick-answer/shares", blocked: true},
		{name: "agent im channels", method: "GET", path: "/api/v1/agents/builtin-quick-answer/im-channels", blocked: true},
		{name: "shared agents", method: "GET", path: "/api/v1/shared-agents", blocked: true},
		{name: "im channel management", method: "GET", path: "/api/v1/im-channels", blocked: true},
		{name: "embed channel management", method: "GET", path: "/api/v1/embed-channels", blocked: true},
		{name: "organization create", method: "POST", path: "/api/v1/organizations", blocked: true},
		{name: "organization member list", method: "GET", path: "/api/v1/organizations/3/members", blocked: true},
		{name: "organization search", method: "GET", path: "/api/v1/organizations/search", blocked: true},
		{name: "tenant list", method: "GET", path: "/api/v1/tenants", blocked: true},
		{name: "tenant create", method: "POST", path: "/api/v1/tenants", blocked: true},
		{name: "tenant metadata read", method: "GET", path: "/api/v1/tenants/7", blocked: true},
		{name: "tenant update", method: "PUT", path: "/api/v1/tenants/7", blocked: true},
		{name: "tenant members", method: "GET", path: "/api/v1/tenants/7/members", blocked: true},
		{name: "tenant api keys", method: "GET", path: "/api/v1/tenants/7/api-keys", blocked: true},
		{name: "my invitations", method: "GET", path: "/api/v1/me/invitations", blocked: true},
		{name: "evaluation", method: "GET", path: "/api/v1/evaluation", blocked: true},
		{name: "mcp", method: "GET", path: "/api/v1/mcp-services", blocked: true},
		{name: "mcp oauth callback", method: "GET", path: "/api/v1/mcp-oauth/callback", blocked: true},
		{name: "agent tool approval", method: "POST", path: "/api/v1/agent/tool-approvals/123", blocked: true},
		{name: "agent mcp oauth resolution", method: "POST", path: "/api/v1/agent/mcp-oauth-resolutions/123", blocked: true},
		{name: "web search catalog", method: "GET", path: "/api/v1/web-search/providers", blocked: true},
		{name: "web search management", method: "GET", path: "/api/v1/web-search-providers", blocked: true},
		{name: "vector stores", method: "GET", path: "/api/v1/vector-stores", blocked: true},
		{name: "storage backends", method: "GET", path: "/api/v1/storage-backends", blocked: true},
		{name: "data sources legacy prefix", method: "GET", path: "/api/v1/datasource", blocked: true},
		{name: "data sources plural prefix", method: "GET", path: "/api/v1/data-sources", blocked: true},
		{name: "weknora cloud", method: "GET", path: "/api/v1/weknora-cloud", blocked: true},
		{name: "system admin", method: "GET", path: "/api/v1/system/admin/settings", blocked: true},
		{name: "system parser probe", method: "POST", path: "/api/v1/system/parser-engines/check", blocked: true},
		{name: "ollama management", method: "GET", path: "/api/v1/initialization/ollama/status", blocked: true},
		{name: "remote model test", method: "POST", path: "/api/v1/initialization/remote/check", blocked: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := liteProductRouteBlocked(tt.method, tt.path); got != tt.blocked {
				t.Fatalf("liteProductRouteBlocked(%q, %q) = %v, want %v", tt.method, tt.path, got, tt.blocked)
			}
		})
	}
}
