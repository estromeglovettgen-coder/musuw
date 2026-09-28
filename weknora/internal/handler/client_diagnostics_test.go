package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const validClientDiagnostic = `{"phase":"auth.otp_verify","outcome":"timeout","duration_ms":12000,` +
	`"flow_id":"d3815104-c538-4a5f-9246-322140b46513","request_id":"req_safe-1","status":0}`

const expandedClientDiagnostic = `{"phase":"app.navigation","outcome":"ok","duration_ms":22316,` +
	`"flow_id":"d3815104-c538-4a5f-9246-322140b46513",` +
	`"journey_id":"84f4edc5-d014-40ad-b086-546a9891a21b",` +
	`"document_id":"e74c229b-2461-4884-9c84-895af0e99bd5",` +
	`"page":"app","browser_kind":"quark","platform_kind":"mobile","viewport_width":430,` +
	`"storage_status":"session_available","reason":"native_callback",` +
	`"timings":{"ttfb_ms":90,"download_ms":400},` +
	`"resources":[{"name":"index-ABcd_123.js","duration_ms":2000,"ttfb_ms":900,"download_ms":1100}]}`

// Public diagnostic ingestion is the privacy boundary: accept measured,
// bounded navigation evidence without accepting arbitrary browser contents.
func TestClientDiagnosticsAcceptsBoundedNavigationEvidence(t *testing.T) {
	var logs bytes.Buffer
	diagnosticLogs(t, &logs)
	w := postDiagnostic(diagnosticTestRouter(), expandedClientDiagnostic, "?code=secret-code")
	if w.Code != http.StatusNoContent {
		t.Fatalf("status=%d, want204", w.Code)
	}
	for _, want := range []string{
		"journey_id=84f4edc5-d014-40ad-b086-546a9891a21b", "browser_kind=quark",
		"phase=app.navigation", "index-ABcd_123.js",
	} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("missing bounded evidence %q", want)
		}
	}
	for _, secret := range []string{"secret-code", "never-log", "user@example", "client_ip", "request_body", "path="} {
		if strings.Contains(logs.String(), secret) {
			t.Errorf("unexpected private value %q", secret)
		}
	}
}

func diagnosticTestRouter() *gin.Engine {
	r := gin.New()
	r.Use(middleware.RequestID(), middleware.Logger())
	r.POST("/api/v1/client-diagnostics", NewClientDiagnosticsHandler())
	return r
}

func postDiagnostic(r *gin.Engine, body, query string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/client-diagnostics"+query, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Request-ID", "secret-token-user@example.test")
	req.Header.Set("Authorization", "Bearer never-log-this-token")
	req.Header.Set("Cookie", "email=user@example.test")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func diagnosticLogs(t *testing.T, out io.Writer) {
	t.Helper()
	instance := logger.GetLogger(context.Background()).Logger
	previous := instance.Out
	formatter := instance.Formatter
	instance.SetFormatter(&logrus.TextFormatter{DisableTimestamp: true, DisableColors: true})
	t.Cleanup(func() { instance.SetFormatter(formatter) })
	logger.SetOutput(out)
	t.Cleanup(func() { logger.SetOutput(previous) })
}

func TestClientDiagnosticsAcceptsOnlyBoundedFieldsAndLogsNoRequestData(t *testing.T) {
	var logs bytes.Buffer
	diagnosticLogs(t, &logs)
	r := diagnosticTestRouter()
	w := postDiagnostic(
		r, validClientDiagnostic, "?email=private@example.test&token=query-secret&content=private-document",
	)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	got := logs.String()
	for _, want := range []string{
		"client_diagnostic", "phase=auth.otp_verify", "duration_ms=12000",
		"flow_id=d3815104-c538-4a5f-9246-322140b46513", "outcome=timeout", "request_id=req_safe-1",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in %s", want, got)
		}
	}
	for _, secret := range []string{
		"@", "never-log", "query-secret", "private-document", "secret-token",
		"client_ip", "request_body", "response_body", "path=",
	} {
		if strings.Contains(got, secret) {
			t.Errorf("private request data %q in %s", secret, got)
		}
	}
	if strings.Count(got, "client_diagnostic") != 1 {
		t.Fatalf("unexpected unbounded access-log entry: %s", got)
	}
}

func TestClientDiagnosticsRejectsMalformedOrPrivatePayloadsWithoutLogging(t *testing.T) {
	var logs bytes.Buffer
	diagnosticLogs(t, &logs)
	var original map[string]any
	if err := json.Unmarshal([]byte(validClientDiagnostic), &original); err != nil {
		t.Fatal(err)
	}
	cases := map[string]string{
		"unknown field":    strings.TrimSuffix(validClientDiagnostic, "}") + `,"email":"user@example.test"}`,
		"trailing object":  validClientDiagnostic + ` {"token":"secret"}`,
		"trailing garbage": validClientDiagnostic + ` private-content`,
		"oversized":        validClientDiagnostic + strings.Repeat(" ", 2048),
		"array":            "[" + validClientDiagnostic + "]",
		"null":             "null",
	}
	changes := map[string]any{
		"phase": "auth.password-user@example.test", "outcome": "arbitrary-secret", "duration_ms": 120001,
		"flow_id": "oidc-state-secret", "request_id": "secret@email.test", "status": 600,
	}
	for field, value := range changes {
		changed := make(map[string]any)
		for k, v := range original {
			changed[k] = v
		}
		changed[field] = value
		body, _ := json.Marshal(changed)
		cases["invalid "+field] = string(body)
	}
	for name, body := range map[string]string{
		"negative duration":   strings.Replace(validClientDiagnostic, "12000", "-1", 1),
		"fractional duration": strings.Replace(validClientDiagnostic, "12000", "1.5", 1),
		"wrong field case":    strings.Replace(validClientDiagnostic, `"phase"`, `"Phase"`, 1),
		"long request id":     strings.Replace(validClientDiagnostic, "req_safe-1", strings.Repeat("a", 65), 1),
		"nonrandom uuid": strings.Replace(
			validClientDiagnostic, "d3815104-c538-4a5f-9246-322140b46513", "00000000-0000-0000-0000-000000000000", 1,
		),
		"missing duration": strings.Replace(validClientDiagnostic, `"duration_ms":12000,`, "", 1),
		"null status":      strings.Replace(validClientDiagnostic, `"status":0`, `"status":null`, 1),
	} {
		cases[name] = body
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			logs.Reset()
			w := postDiagnostic(diagnosticTestRouter(), body, "?email=private@example.test")
			if w.Code < 400 || w.Code >= 500 {
				t.Errorf("status=%d body=%s", w.Code, w.Body.String())
			}
			if logs.Len() != 0 {
				t.Errorf("rejected body/query reached logs: %s", logs.String())
			}
		})
	}
}

func TestClientDiagnosticsUsesOneGlobalBudgetAcrossClientIdentifiers(t *testing.T) {
	diagnosticLogs(t, io.Discard)
	r := diagnosticTestRouter()
	for i := 0; i < 600; i++ {
		if w := postDiagnostic(r, validClientDiagnostic, ""); w.Code != http.StatusNoContent {
			t.Fatalf("request %d status %d", i, w.Code)
		}
	}
	body := strings.Replace(
		validClientDiagnostic, "d3815104-c538-4a5f-9246-322140b46513", "84f4edc5-d014-40ad-b086-546a9891a21b", 1,
	)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/client-diagnostics", strings.NewReader(body))
	req.RemoteAddr = "203.0.113.199:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.200")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("new flow/IP bypassed global limit: %d", w.Code)
	}
}

func TestClientDiagnosticsDoesNotReadUnboundedBodyBeforeLimit(t *testing.T) {
	diagnosticLogs(t, io.Discard)
	r := diagnosticTestRouter()
	reader := &countingDiagnosticBody{left: 1 << 20}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/client-diagnostics?content=private", reader)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status=%d", w.Code)
	}
	if reader.read > 2049 {
		t.Errorf("middleware/handler read %d bytes before rejecting oversized body", reader.read)
	}
}

type countingDiagnosticBody struct{ left, read int }

func (r *countingDiagnosticBody) Read(p []byte) (int, error) {
	if r.left == 0 {
		return 0, io.EOF
	}
	n := len(p)
	if n > r.left {
		n = r.left
	}
	for i := 0; i < n; i++ {
		p[i] = ' '
	}
	r.left -= n
	r.read += n
	return n, nil
}

func TestClientDiagnosticsAcceptsContractEnumsAndBoundaryValues(t *testing.T) {
	diagnosticLogs(t, io.Discard)
	r := diagnosticTestRouter()
	for _, phase := range []string{
		"auth.session", "auth.exchange", "auth.authorize", "auth.password", "auth.otp_send", "auth.otp_verify",
		"auth.native_session", "auth.oidc_start", "auth.other", "app.startup", "api.auth", "api.documents", "api.other",
		"auth.session_state", "auth.continuation", "auth.navigation", "app.navigation", "app.entry", "app.bootstrap",
		"app.router", "app.mount", "auth.entry", "auth.startup", "auth.mount",
	} {
		for _, outcome := range []string{"ok", "network", "timeout", "http", "identity", "error"} {
			body, _ := json.Marshal(map[string]any{
				"phase": phase, "outcome": outcome, "duration_ms": 0,
				"flow_id": "84f4edc5-d014-40ad-b086-546a9891a21b",
			})
			if w := postDiagnostic(r, string(body), ""); w.Code != http.StatusNoContent {
				t.Fatalf("phase=%s outcome=%s status=%d", phase, outcome, w.Code)
			}
		}
	}
	for _, status := range []int{0, 100, 599} {
		body, _ := json.Marshal(map[string]any{
			"phase": "app.startup", "outcome": "error", "duration_ms": 120000,
			"flow_id": "84f4edc5-d014-40ad-b086-546a9891a21b", "status": status, "request_id": strings.Repeat("a", 64),
		})
		if w := postDiagnostic(r, string(body), ""); w.Code != http.StatusNoContent {
			t.Fatalf("boundary status=%d response=%d", status, w.Code)
		}
	}
}

func TestClientDiagnosticsGlobalBudgetHoldsUnderConcurrentRequests(t *testing.T) {
	diagnosticLogs(t, io.Discard)
	r := diagnosticTestRouter()
	var wg sync.WaitGroup
	var accepted, rejected, unexpected atomic.Int32
	for worker := 0; worker < 16; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 40; i++ {
				switch postDiagnostic(r, validClientDiagnostic, "").Code {
				case http.StatusNoContent:
					accepted.Add(1)
				case http.StatusTooManyRequests:
					rejected.Add(1)
				default:
					unexpected.Add(1)
				}
			}
		}()
	}
	wg.Wait()
	if accepted.Load() != 600 || rejected.Load() != 40 || unexpected.Load() != 0 {
		t.Fatalf(
			"concurrent counts accepted=%d rejected=%d unexpected=%d",
			accepted.Load(), rejected.Load(), unexpected.Load(),
		)
	}
}

func TestClientDiagnosticsRejectsPrivateOrMalformedNavigationEvidence(t *testing.T) {
	var logs bytes.Buffer
	diagnosticLogs(t, &logs)
	cases := map[string]func(map[string]any){
		"journey not random":  func(m map[string]any) { m["journey_id"] = "00000000-0000-0000-0000-000000000000" },
		"document private":    func(m map[string]any) { m["document_id"] = "user@example.test" },
		"raw ua":              func(m map[string]any) { m["browser_kind"] = "Mozilla/private" },
		"unknown platform":    func(m map[string]any) { m["platform_kind"] = "iPhone-secret" },
		"private reason":      func(m map[string]any) { m["reason"] = "private-token" },
		"unknown flow status": func(m map[string]any) { m["flow_status"] = "private" },
		"unknown navigation":  func(m map[string]any) { m["navigation_type"] = "private" },
		"unknown visibility":  func(m map[string]any) { m["visibility"] = "private" },
		"viewport overflow":   func(m map[string]any) { m["viewport_width"] = 10001 },
		"viewport negative":   func(m map[string]any) { m["viewport_width"] = -1 },
		"viewport fraction":   func(m map[string]any) { m["viewport_width"] = 1.5 },
		"null timings":        func(m map[string]any) { m["timings"] = nil },
		"missing download":    func(m map[string]any) { m["timings"] = map[string]any{"ttfb_ms": 1} },
		"nested private": func(m map[string]any) {
			m["timings"].(map[string]any)["url"] = "https://private.test?token=secret"
		},
		"nested case":     func(m map[string]any) { m["timings"] = map[string]any{"TTFB_ms": 1, "download_ms": 1} },
		"nested null":     func(m map[string]any) { m["timings"].(map[string]any)["ttfb_ms"] = nil },
		"timing overflow": func(m map[string]any) { m["timings"].(map[string]any)["ttfb_ms"] = 120001 },
		"timing fraction": func(m map[string]any) { m["timings"].(map[string]any)["download_ms"] = 0.5 },
		"resource url": func(m map[string]any) {
			m["resources"].([]any)[0].(map[string]any)["name"] = "https://private.test/index-ABcd_123.js"
		},
		"resource query": func(m map[string]any) {
			m["resources"].([]any)[0].(map[string]any)["name"] = "index-ABcd_123.js?code=secret"
		},
		"resource name too long": func(m map[string]any) {
			m["resources"].([]any)[0].(map[string]any)["name"] = strings.Repeat("a", 101) + "-ABcd_123.js"
		},
		"resource missing duration": func(m map[string]any) {
			delete(m["resources"].([]any)[0].(map[string]any), "duration_ms")
		},
		"resource null": func(m map[string]any) { m["resources"] = []any{nil} },
		"resource unknown": func(m map[string]any) {
			m["resources"].([]any)[0].(map[string]any)["body"] = "secret"
		},
		"resource key case": func(m map[string]any) {
			r := m["resources"].([]any)[0].(map[string]any)
			r["Name"] = r["name"]
			delete(r, "name")
		},
		"too many resources": func(m map[string]any) {
			r := m["resources"].([]any)[0]
			m["resources"] = []any{r, r, r, r}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			var input map[string]any
			_ = json.Unmarshal([]byte(expandedClientDiagnostic), &input)
			mutate(input)
			body, _ := json.Marshal(input)
			logs.Reset()
			w := postDiagnostic(diagnosticTestRouter(), string(body), "")
			if w.Code != 400 {
				t.Errorf("status=%d, want400", w.Code)
			}
			if logs.Len() != 0 {
				t.Errorf("rejected evidence reached logs: %s", logs.String())
			}
		})
	}
	for _, invalid := range []string{"NaN", "Infinity", "1e9999"} {
		logs.Reset()
		body := strings.Replace(expandedClientDiagnostic, `"ttfb_ms":90`, `"ttfb_ms":`+invalid, 1)
		if w := postDiagnostic(diagnosticTestRouter(), body, ""); w.Code != 400 {
			t.Errorf("nonfinite %s status=%d", invalid, w.Code)
		}
		if logs.Len() != 0 {
			t.Fatal("nonfinite payload logged")
		}
	}
}

func TestClientDiagnosticsAcceptsExpandedBoundaryPayload(t *testing.T) {
	diagnosticLogs(t, io.Discard)
	var input map[string]any
	_ = json.Unmarshal([]byte(expandedClientDiagnostic), &input)
	input["viewport_width"] = 10000
	input["flow_status"] = "restored"
	input["navigation_type"] = "reload"
	input["visibility"] = "visible"
	resource := map[string]any{
		"name": strings.Repeat("a", 100) + "-12345678.css", "duration_ms": 120000, "ttfb_ms": 0, "download_ms": 120000,
	}
	input["resources"] = []any{resource, resource, resource}
	body, _ := json.Marshal(input)
	if len(body) <= 1024 || len(body) > 2048 {
		t.Fatalf("test must demonstrate 2KiB need, bytes%d", len(body))
	}
	if w := postDiagnostic(diagnosticTestRouter(), string(body), ""); w.Code != 204 {
		t.Fatalf("valid expanded boundary status%d", w.Code)
	}
}
