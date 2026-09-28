package handler

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/middleware"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	secutils "github.com/Tencent/WeKnora/internal/utils"
	"github.com/gin-gonic/gin"
)

type diagnosticOIDCService struct {
	interfaces.UserService
	response *types.OIDCCallbackResponse
	err      error
}

func (s *diagnosticOIDCService) LoginWithOIDC(
	context.Context, string, string, string, types.TenantProvisioningMode,
) (*types.OIDCCallbackResponse, error) {
	return s.response, s.err
}

// HTTP callback outcomes must retain their existing redirects while the new
// event supplies bounded reasons and anonymous correlation, never secrets.
func TestOIDCCallbackDiagnosticsBoundedReasonsAndPrivacy(t *testing.T) {
	const journey = "84f4edc5-d014-40ad-b086-546a9891a21b"
	state, err := secutils.SignOIDCState(&secutils.OIDCStatePayload{
		Nonce: "private-nonce", RedirectURI: "https://app.example.com/api/v1/auth/oidc/callback",
		IssuedAt: time.Now().Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	binding, err := encodeOIDCBrowserBinding("private-nonce", "private-code-verifier")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name, query, cookie, reason, fragment string
		service                               *diagnosticOIDCService
	}{
		{
			"cookie missing", "code=private-code&state=" + url.QueryEscape(state), "",
			"cookie_missing", "oidc_error=invalid_state", nil,
		},
		{
			"state invalid", "code=private-code&state=private-invalid-state", binding,
			"invalid_state", "oidc_error=invalid_state", nil,
		},
		{"code missing", "state=" + url.QueryEscape(state), binding, "missing_code", "oidc_error=missing_code", nil},
		{
			"provider rejects", "error=access_denied&error_description=private-provider-error", binding,
			"provider_error", "oidc_error=access_denied", nil,
		},
		{
			"exchange fails", "code=private-code&state=" + url.QueryEscape(state), binding,
			"exchange_failed", "oidc_error=login_failed",
			&diagnosticOIDCService{err: errors.New("private-provider-token")},
		},
		{
			"service rejects", "code=private-code&state=" + url.QueryEscape(state), binding,
			"exchange_failed", "oidc_error=login_failed",
			&diagnosticOIDCService{response: &types.OIDCCallbackResponse{
				Success: false, Message: "private-service-reason",
			}},
		},
		{
			"success", "code=private-code&state=" + url.QueryEscape(state), binding, "success", "oidc_result=",
			&diagnosticOIDCService{response: &types.OIDCCallbackResponse{Success: true}},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var logs bytes.Buffer
			diagnosticLogs(t, &logs)
			h := &AuthHandler{userService: tc.service}
			r := gin.New()
			r.Use(middleware.RequestID())
			r.GET("/callback", h.OIDCRedirectCallback)
			req := httptest.NewRequest(http.MethodGet, "/callback?"+tc.query, nil)
			req.Header.Set("X-Request-ID", "safe_request-7")
			req.Header.Set("User-Agent", "private-UA")
			req.AddCookie(&http.Cookie{
				Name: "musuw_diagnostic_journey", Value: fmt.Sprintf("%s.%d", journey, time.Now().UnixMilli()),
			})
			if tc.cookie != "" {
				req.AddCookie(&http.Cookie{Name: oidcBindingCookieName, Value: tc.cookie})
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != 302 || !strings.Contains(w.Header().Get("Location"), tc.fragment) {
				t.Fatalf("changed callback outcome: status%d", w.Code)
			}
			for _, want := range []string{
				"auth_diagnostic", "phase=oidc.callback", "reason=" + tc.reason,
				"journey_id=" + journey, "request_id=safe_request-7",
			} {
				if !strings.Contains(logs.String(), want) {
					t.Errorf("missing %q in %s", want, logs.String())
				}
			}
			for _, secret := range []string{
				"private-", state, binding, "client_ip", "path=", "request_body", "user_agent",
			} {
				if strings.Contains(logs.String(), secret) {
					t.Errorf("private value reached logs: %q", secret)
				}
			}
			if strings.Count(logs.String(), "auth_diagnostic") != 1 {
				t.Errorf("must emit one callback result: %s", logs.String())
			}
		})
	}
}

func TestOIDCStartDiagnosticsIgnoreUntrustedJourneyWithoutChangingLogin(t *testing.T) {
	const journey = "84f4edc5-d014-40ad-b086-546a9891a21b"
	now := time.Now().UnixMilli()
	for _, tc := range []struct {
		name, cookie string
		wantJourney  bool
	}{
		{"current", fmt.Sprintf("%s.%d", journey, now), true},
		{"small clock skew", fmt.Sprintf("%s.%d", journey, now+30000), true},
		{"missing", "", false},
		{"private", "private-token", false},
		{"old", fmt.Sprintf("%s.%d", journey, now-601000), false},
		{"future", fmt.Sprintf("%s.%d", journey, now+61000), false},
		{"nonrandom", fmt.Sprintf("00000000-0000-0000-0000-000000000000.%d", now), false},
		{"extra fields", fmt.Sprintf("%s.%d.private-token", journey, now), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var logs bytes.Buffer
			diagnosticLogs(t, &logs)
			h := &AuthHandler{userService: &oidcPKCEUserServiceStub{authorizationResponse: &types.OIDCAuthURLResponse{
				Success: true, AuthorizationURL: "https://idp.test/?state=private-state",
				Nonce: "private-nonce", CodeVerifier: "private-verifier",
			}}}
			r := gin.New()
			r.Use(middleware.RequestID())
			r.GET("/start", h.OIDCStart)
			req := httptest.NewRequest(http.MethodGet, "https://app.test/start", nil)
			if tc.cookie != "" {
				req.AddCookie(&http.Cookie{Name: "musuw_diagnostic_journey", Value: tc.cookie})
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != 302 || !strings.Contains(w.Header().Get("Location"), "idp.test") {
				t.Fatalf("journey affected auth: %d", w.Code)
			}
			if strings.Contains(logs.String(), "journey_id=") != tc.wantJourney {
				t.Fatalf("incorrect journey correlation: %s", logs.String())
			}
			for _, want := range []string{"auth_diagnostic", "phase=oidc.start", "reason=success", "outcome=ok"} {
				if !strings.Contains(logs.String(), want) {
					t.Errorf("missing %q", want)
				}
			}
			if strings.Contains(logs.String(), "private-") {
				t.Errorf("secret logged: %s", logs.String())
			}
		})
	}
}

func TestOIDCJSONStartFailureLogsBoundedReason(t *testing.T) {
	var logs bytes.Buffer
	diagnosticLogs(t, &logs)
	h := &AuthHandler{userService: &stubOIDCStartUserService{getOIDCAuthorizationURL: func(
		context.Context, string,
	) (*types.OIDCAuthURLResponse, error) {
		return nil, errors.New("private-provider-key")
	}}}
	r := gin.New()
	r.Use(errorCapture())
	r.GET("/url", h.GetOIDCAuthorizationURL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/url?redirect_uri=https://app.test/callback", nil))
	if w.Code != 403 {
		t.Fatalf("changed error status%d", w.Code)
	}
	if !strings.Contains(logs.String(), "reason=start_failed") || !strings.Contains(logs.String(), "phase=oidc.start") {
		t.Fatalf("missing result: %s", logs.String())
	}
	if strings.Contains(logs.String(), "private-") {
		t.Fatalf("raw service error logged: %s", logs.String())
	}
}
