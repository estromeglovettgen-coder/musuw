package router

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Tencent/WeKnora/internal/handler"
	"github.com/gin-gonic/gin"
)

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
		{name: "consumer scene options", method: "GET", path: "/api/v1/models/scene-options/chat", blocked: false},
		{name: "quick answer runtime agent", method: "GET", path: "/api/v1/agents/builtin-quick-answer", blocked: false},
		{name: "smart reasoning runtime agent", method: "GET", path: "/api/v1/agents/builtin-smart-reasoning", blocked: false},
		{name: "quick answer suggestions", method: "GET", path: "/api/v1/agents/builtin-quick-answer/suggested-questions", blocked: false},
		{name: "smart reasoning suggestions", method: "GET", path: "/api/v1/agents/builtin-smart-reasoning/suggested-questions", blocked: false},
		{name: "agent enumeration", method: "GET", path: "/api/v1/agents", blocked: false},
		{name: "agent placeholders", method: "GET", path: "/api/v1/agents/placeholders", blocked: false},
		{name: "agent type presets", method: "GET", path: "/api/v1/agents/type-presets", blocked: false},
		{name: "custom agent read", method: "GET", path: "/api/v1/agents/custom-agent-id", blocked: false},
		{name: "custom agent create", method: "POST", path: "/api/v1/agents", blocked: false},
		{name: "custom agent update", method: "PUT", path: "/api/v1/agents/custom-agent-id", blocked: false},
		{name: "custom agent delete", method: "DELETE", path: "/api/v1/agents/custom-agent-id", blocked: false},
		{name: "custom agent copy", method: "POST", path: "/api/v1/agents/custom-agent-id/copy", blocked: false},
		{name: "kb initialization read", method: "GET", path: "/api/v1/initialization/config/1", blocked: false},
		{name: "kb initialization update", method: "PUT", path: "/api/v1/initialization/config/1", blocked: false},
		{name: "kb initialize", method: "POST", path: "/api/v1/initialization/initialize/1", blocked: true},
		{name: "parser catalog", method: "GET", path: "/api/v1/system/parser-engines", blocked: false},
		{name: "storage status", method: "GET", path: "/api/v1/system/storage-engine-status", blocked: false},
		{name: "system info", method: "GET", path: "/api/v1/system/info", blocked: false},
		{name: "organization read for kb sharing", method: "GET", path: "/api/v1/organizations/3", blocked: false},
		{name: "organization kb shares", method: "GET", path: "/api/v1/organizations/3/shares", blocked: false},
		{name: "consumer retrieval config read", method: "GET", path: "/api/v1/tenants/kv/retrieval-config", blocked: false},
		{name: "consumer retrieval config write", method: "PUT", path: "/api/v1/tenants/kv/retrieval-config", blocked: false},
		{name: "native prompt templates read", method: "GET", path: "/api/v1/tenants/kv/prompt-templates", blocked: false},
		{name: "native prompt templates write", method: "PUT", path: "/api/v1/tenants/kv/prompt-templates", blocked: true},
		{name: "native agent storage config read", method: "GET", path: "/api/v1/tenants/kv/storage-engine-config", blocked: false},
		{name: "native agent storage config write", method: "PUT", path: "/api/v1/tenants/kv/storage-engine-config", blocked: true},

		// Hidden auth/workspace surfaces.
		{name: "native register", method: "POST", path: "/api/v1/auth/register", blocked: true},
		{name: "native password login", method: "POST", path: "/api/v1/auth/login", blocked: true},
		{name: "native change password", method: "POST", path: "/api/v1/auth/change-password", blocked: true},
		{name: "native auth config", method: "GET", path: "/api/v1/auth/config", blocked: true},
		{name: "native lite auto setup", method: "POST", path: "/api/v1/auth/auto-setup", blocked: true},
		{name: "workspace switch", method: "POST", path: "/api/v1/auth/switch-tenant", blocked: true},
		{name: "workspace preference mutation", method: "PUT", path: "/api/v1/auth/me/preferences", blocked: true},
		{name: "self-service account deletion hidden", method: "DELETE", path: "/api/v1/auth/me", blocked: true},
		{name: "invite registration", method: "POST", path: "/api/v1/auth/register-by-invite", blocked: true},
		{name: "invite lookup", method: "POST", path: "/api/v1/auth/invitations/lookup", blocked: true},

		// Hidden management/discovery surfaces.
		{name: "model providers", method: "GET", path: "/api/v1/models/providers", blocked: true},
		{name: "model create", method: "POST", path: "/api/v1/models", blocked: true},
		{name: "model update", method: "PUT", path: "/api/v1/models/1", blocked: true},
		{name: "model credentials", method: "DELETE", path: "/api/v1/models/1/credentials/api_key", blocked: true},
		{name: "native built-in agent read", method: "GET", path: "/api/v1/agents/builtin-deep-researcher", blocked: false},
		{name: "agent share read", method: "GET", path: "/api/v1/agents/builtin-quick-answer/shares", blocked: true},
		{name: "agent im channels", method: "GET", path: "/api/v1/agents/builtin-quick-answer/im-channels", blocked: true},
		{name: "agent unknown nested route", method: "GET", path: "/api/v1/agents/custom-agent-id/unknown", blocked: true},
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
		{name: "other tenant kv key", method: "GET", path: "/api/v1/tenants/kv/other", blocked: true},
		{name: "retrieval config wrong verb", method: "POST", path: "/api/v1/tenants/kv/retrieval-config", blocked: true},
		{name: "my invitations", method: "GET", path: "/api/v1/me/invitations", blocked: true},
		{name: "evaluation", method: "GET", path: "/api/v1/evaluation", blocked: true},
		{name: "mcp", method: "GET", path: "/api/v1/mcp-services", blocked: false},
		{name: "mcp create", method: "POST", path: "/api/v1/mcp-services", blocked: false},
		{name: "mcp update", method: "PUT", path: "/api/v1/mcp-services/mcp-1", blocked: false},
		{name: "mcp tools", method: "GET", path: "/api/v1/mcp-services/mcp-1/tools", blocked: false},
		{name: "mcp credentials", method: "PUT", path: "/api/v1/mcp-services/mcp-1/credentials", blocked: false},
		{name: "mcp oauth callback", method: "GET", path: "/api/v1/mcp-oauth/callback", blocked: false},
		{name: "agent tool approval", method: "POST", path: "/api/v1/agent/tool-approvals/123", blocked: false},
		{name: "agent mcp oauth resolution", method: "POST", path: "/api/v1/agent/mcp-oauth-resolutions/123", blocked: false},
		{name: "web search catalog", method: "GET", path: "/api/v1/web-search/providers", blocked: true},
		{name: "web search management", method: "GET", path: "/api/v1/web-search-providers", blocked: true},
		{name: "vector stores", method: "GET", path: "/api/v1/vector-stores", blocked: true},
		{name: "storage backends", method: "GET", path: "/api/v1/storage-backends", blocked: true},
		{name: "data sources legacy prefix", method: "GET", path: "/api/v1/datasource", blocked: true},
		{name: "data sources plural prefix", method: "GET", path: "/api/v1/data-sources", blocked: true},
		{name: "weknora cloud", method: "GET", path: "/api/v1/weknora-cloud", blocked: true},
		{name: "weknora cloud credentials", method: "POST", path: "/api/v1/weknoracloud/credentials", blocked: true},
		{name: "operations tenant entitlement", method: "GET", path: "/api/v1/system/admin/tenants/7/entitlement", blocked: false},
		{name: "operations tenant status and quota", method: "PATCH", path: "/api/v1/system/admin/tenants/7", blocked: false},
		{name: "operations tenant credits", method: "PUT", path: "/api/v1/system/admin/tenants/7/openrouter-credits", blocked: false},
		{name: "operations user investigation", method: "GET", path: "/api/v1/system/admin/users/user-7/investigation", blocked: false},
		{name: "operations user erasure", method: "DELETE", path: "/api/v1/system/admin/users/user-7", blocked: false},
		{name: "operations audit", method: "GET", path: "/api/v1/system/admin/audit-log", blocked: false},
		{name: "operations consumer model policy", method: "GET", path: "/api/v1/system/admin/consumer-model-policy", blocked: false},
		{name: "operations consumer model policy update", method: "PUT", path: "/api/v1/system/admin/consumer-model-policy/rag", blocked: false},
		{name: "operations consumer model policy hidden chat", method: "PUT", path: "/api/v1/system/admin/consumer-model-policy/chat", blocked: true},
		{name: "operations consumer model policy embedding", method: "PUT", path: "/api/v1/system/admin/consumer-model-policy/embedding", blocked: true},
		{name: "operations consumer model policy wrong verb", method: "POST", path: "/api/v1/system/admin/consumer-model-policy/rag", blocked: true},
		{name: "operations runtime queues", method: "GET", path: "/api/v1/system/admin/runtime/queues", blocked: false},
		{name: "operations runtime tasks", method: "GET", path: "/api/v1/system/admin/runtime/queues/default/tasks", blocked: false},
		{name: "operations runtime task action", method: "POST", path: "/api/v1/system/admin/runtime/queues/default/tasks/task-7/actions/retry", blocked: false},
		{name: "operations runtime purge", method: "DELETE", path: "/api/v1/system/admin/runtime/queues/default/archived", blocked: false},
		{name: "system admin", method: "GET", path: "/api/v1/system/admin/settings", blocked: true},
		{name: "platform key management remains hidden", method: "POST", path: "/api/v1/system/admin/api-keys", blocked: true},
		{name: "operations tenant invalid id", method: "GET", path: "/api/v1/system/admin/tenants/nope/entitlement", blocked: true},
		{name: "operations tenant wrong verb", method: "POST", path: "/api/v1/system/admin/tenants/7", blocked: true},
		{name: "operations user missing id", method: "GET", path: "/api/v1/system/admin/users//investigation", blocked: true},
		{name: "operations runtime unknown action shape", method: "POST", path: "/api/v1/system/admin/runtime/queues/default/tasks/task-7/retry", blocked: true},
		{name: "system parser probe", method: "POST", path: "/api/v1/system/parser-engines/check", blocked: true},
		{name: "chunker debug preview", method: "POST", path: "/api/v1/chunker/preview", blocked: true},
		{name: "wechat channel management", method: "POST", path: "/api/v1/wechat/qrcode", blocked: true},
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

func TestLiteTemporaryAttachmentRequestBlocked(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		agentID  string
		sourceID string
		blocked  bool
	}{
		{name: "no agent", blocked: false},
		{name: "builtin runtime agent", agentID: liteSmartReasoningAgentID, blocked: false},
		{name: "custom agent", agentID: "custom-agent", blocked: false},
		{name: "shared agent source", agentID: liteSmartReasoningAgentID, sourceID: "42", blocked: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body bytes.Buffer
			form := multipart.NewWriter(&body)
			if tt.agentID != "" {
				if err := form.WriteField("agent_id", tt.agentID); err != nil {
					t.Fatal(err)
				}
			}
			if tt.sourceID != "" {
				if err := form.WriteField("agent_source_tenant_id", tt.sourceID); err != nil {
					t.Fatal(err)
				}
			}
			if err := form.Close(); err != nil {
				t.Fatal(err)
			}

			req := httptest.NewRequest(http.MethodPost, "/api/v1/sessions/session-1/attachments", &body)
			req.Header.Set("Content-Type", form.FormDataContentType())
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = req

			if got := liteTemporaryAttachmentRequestBlocked(c); got != tt.blocked {
				t.Fatalf("liteTemporaryAttachmentRequestBlocked() = %v, want %v", got, tt.blocked)
			}
		})
	}
}

func TestLiteProductGateTemporaryAttachmentRequest(t *testing.T) {
	// liteProductGate reads the process-wide build edition. Keep this request-
	// level test serial and restore it immediately so unrelated router tests do
	// not observe a different product mode.
	originalEdition := handler.Edition
	handler.Edition = "lite"
	t.Cleanup(func() { handler.Edition = originalEdition })

	tests := []struct {
		name         string
		agentID      string
		sourceID     string
		wantStatus   int
		wantSentinel bool
	}{
		{name: "empty agent", wantStatus: http.StatusNoContent, wantSentinel: true},
		{name: "quick answer", agentID: liteQuickAnswerAgentID, wantStatus: http.StatusNoContent, wantSentinel: true},
		{name: "smart reasoning", agentID: liteSmartReasoningAgentID, wantStatus: http.StatusNoContent, wantSentinel: true},
		{name: "custom agent", agentID: "custom-agent", wantStatus: http.StatusNoContent, wantSentinel: true},
		{name: "nonzero source tenant", agentID: liteSmartReasoningAgentID, sourceID: "42", wantStatus: http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body bytes.Buffer
			form := multipart.NewWriter(&body)
			file, err := form.CreateFormFile("file", "notes.txt")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := file.Write([]byte("multipart sentinel")); err != nil {
				t.Fatal(err)
			}
			if tt.agentID != "" {
				if err := form.WriteField("agent_id", tt.agentID); err != nil {
					t.Fatal(err)
				}
			}
			if tt.sourceID != "" {
				if err := form.WriteField("agent_source_tenant_id", tt.sourceID); err != nil {
					t.Fatal(err)
				}
			}
			if err := form.Close(); err != nil {
				t.Fatal(err)
			}

			req := httptest.NewRequest(http.MethodPost, "/api/v1/sessions/session-1/attachments", &body)
			req.Header.Set("Content-Type", form.FormDataContentType())
			recorder := httptest.NewRecorder()
			router := gin.New()
			router.Use(liteProductGate())
			router.POST("/api/v1/sessions/:session_id/attachments", func(c *gin.Context) {
				f, header, err := c.Request.FormFile("file")
				if err != nil {
					c.String(http.StatusBadRequest, "file: %v", err)
					return
				}
				defer f.Close()
				contents, err := io.ReadAll(f)
				if err != nil {
					c.String(http.StatusBadRequest, "read: %v", err)
					return
				}
				if header.Filename != "notes.txt" || string(contents) != "multipart sentinel" {
					c.String(http.StatusBadRequest, "multipart payload changed")
					return
				}
				c.Status(http.StatusNoContent)
			})

			// The middleware must run before the route's sentinel, while preserving
			// the parsed multipart form for the native handler on allowed requests.
			router.ServeHTTP(recorder, req)
			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body=%s)", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
			if got := recorder.Code == http.StatusNoContent; got != tt.wantSentinel {
				t.Fatalf("sentinel reached = %v, want %v", got, tt.wantSentinel)
			}
		})
	}
}

func TestLiteProductGateRetrievalConfigRouteBoundary(t *testing.T) {
	// Keep this middleware-level check serial because the product edition is a
	// process-wide build setting. Restore it before any other router test runs.
	originalEdition := handler.Edition
	handler.Edition = "lite"
	t.Cleanup(func() { handler.Edition = originalEdition })

	router := gin.New()
	router.Use(liteProductGate())
	sentinel := func(c *gin.Context) { c.Status(http.StatusNoContent) }
	router.GET("/api/v1/tenants/kv/retrieval-config", sentinel)
	router.PUT("/api/v1/tenants/kv/retrieval-config", sentinel)
	router.GET("/api/v1/tenants/kv/prompt-templates", sentinel)
	router.PUT("/api/v1/tenants/kv/prompt-templates", sentinel)
	router.GET("/api/v1/tenants/kv/storage-engine-config", sentinel)
	router.PUT("/api/v1/tenants/kv/storage-engine-config", sentinel)
	router.GET("/api/v1/tenants/kv/other", sentinel)

	tests := []struct {
		name   string
		method string
		path   string
		want   int
	}{
		{name: "read retrieval config", method: http.MethodGet, path: "/api/v1/tenants/kv/retrieval-config", want: http.StatusNoContent},
		{name: "write retrieval config", method: http.MethodPut, path: "/api/v1/tenants/kv/retrieval-config", want: http.StatusNoContent},
		{name: "read prompt templates", method: http.MethodGet, path: "/api/v1/tenants/kv/prompt-templates", want: http.StatusNoContent},
		{name: "write prompt templates", method: http.MethodPut, path: "/api/v1/tenants/kv/prompt-templates", want: http.StatusNotFound},
		{name: "read storage config", method: http.MethodGet, path: "/api/v1/tenants/kv/storage-engine-config", want: http.StatusNoContent},
		{name: "write storage config", method: http.MethodPut, path: "/api/v1/tenants/kv/storage-engine-config", want: http.StatusNotFound},
		{name: "wrong verb", method: http.MethodPost, path: "/api/v1/tenants/kv/retrieval-config", want: http.StatusNotFound},
		{name: "other tenant kv key", method: http.MethodGet, path: "/api/v1/tenants/kv/other", want: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)
			if recorder.Code != tt.want {
				t.Fatalf("status = %d, want %d (body=%s)", recorder.Code, tt.want, recorder.Body.String())
			}
		})
	}
}
