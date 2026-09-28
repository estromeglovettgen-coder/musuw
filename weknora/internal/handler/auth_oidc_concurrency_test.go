package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	secutils "github.com/Tencent/WeKnora/internal/utils"
)

const concurrentOIDCRedirect = "https://app.example.com/api/v1/auth/oidc/callback"

// Done is evaluated when the HTTP handler begins waiting for its own result.
// Observing that boundary keeps the provider pending until every duplicate is
// actually waiting, without scheduler-dependent sleeps or production hooks.
type waitingOIDCContext struct {
	context.Context
	once    sync.Once
	waiting chan struct{}
}

func observeOIDCWaiter(parent context.Context) *waitingOIDCContext {
	return &waitingOIDCContext{Context: parent, waiting: make(chan struct{})}
}

func (c *waitingOIDCContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.waiting) })
	return c.Context.Done()
}

func awaitOIDCWaiter(t *testing.T, waiter *waitingOIDCContext) {
	t.Helper()
	select {
	case <-waiter.waiting:
	case <-time.After(2 * time.Second):
		t.Fatal("callback did not begin waiting for its exchange")
	}
}

type singleUseOIDCGrant struct {
	verifier string
	token    string
	used     bool
}

// Model single-use grants at the existing UserService boundary; the handler,
// state, binding cookies and response encoding are real. Provider transport
// and native persistence are separately exercised by staging acceptance.
type singleUseOIDCService struct {
	interfaces.UserService
	mu          sync.Mutex
	grants      map[string]*singleUseOIDCGrant
	calls       int
	entered     chan struct{}
	release     <-chan struct{}
	exchangeCtx context.Context
}

func (s *singleUseOIDCService) LoginWithOIDC(ctx context.Context, code, redirect, verifier string,
	_ types.TenantProvisioningMode,
) (*types.OIDCCallbackResponse, error) {
	s.mu.Lock()
	s.calls++
	grant := s.grants[code]
	valid := grant != nil && !grant.used && grant.verifier == verifier && redirect == concurrentOIDCRedirect
	var token string
	if valid {
		grant.used = true
		token = grant.token
		s.exchangeCtx = ctx
	}
	s.mu.Unlock()
	select {
	case s.entered <- struct{}{}:
	default:
	}
	if !valid {
		return nil, errors.New("synthetic invalid_grant")
	}
	if s.release != nil {
		select {
		case <-s.release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return &types.OIDCCallbackResponse{Success: true, Token: token}, nil
}

func (s *singleUseOIDCService) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

func (s *singleUseOIDCService) receivedExchangeContext() context.Context {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.exchangeCtx
}

func concurrentOIDCAttempt(t *testing.T, nonce, verifier string) (state, binding string) {
	t.Helper()
	var err error
	state, err = secutils.SignOIDCState(&secutils.OIDCStatePayload{
		Nonce: nonce, RedirectURI: concurrentOIDCRedirect, IssuedAt: time.Now().Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	binding, err = encodeOIDCBrowserBinding(nonce, verifier)
	if err != nil {
		t.Fatal(err)
	}
	return
}

func concurrentOIDCRequest(ctx context.Context, state, code, binding string) *http.Request {
	query := url.Values{"state": {state}, "code": {code}}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oidc/callback?"+query.Encode(), nil).WithContext(ctx)
	req.Header.Set("X-Forwarded-Proto", "https")
	if binding != "" {
		req.AddCookie(&http.Cookie{Name: oidcBindingCookieName, Value: binding})
	}
	return req
}

func concurrentOIDCRouter(service *singleUseOIDCService) *gin.Engine {
	return concurrentOIDCHandlerRouter(&AuthHandler{userService: service})
}

func concurrentOIDCHandlerRouter(h *AuthHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/auth/oidc/callback", h.OIDCRedirectCallback)
	return router
}

func concurrentOIDCResult(t *testing.T, recorder *httptest.ResponseRecorder) (string, string) {
	t.Helper()
	if recorder.Code != http.StatusFound {
		t.Fatalf("callback status = %d, want redirect", recorder.Code)
	}
	location, err := url.Parse(recorder.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	fragment, err := url.ParseQuery(location.Fragment)
	if err != nil {
		t.Fatal(err)
	}
	if reason := fragment.Get("oidc_error"); reason != "" {
		return "", reason
	}
	payload, err := base64.RawURLEncoding.DecodeString(fragment.Get("oidc_result"))
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Success bool   `json:"success"`
		Token   string `json:"token"`
	}
	if err := json.Unmarshal(payload, &result); err != nil {
		t.Fatal(err)
	}
	if !result.Success {
		t.Fatal("callback result did not contain successful authentication")
	}
	return result.Token, ""
}

// Observable seam: three real Gin callbacks carry the same signed state,
// authorization code and original browser cookie while the provider is still
// processing. All navigations must receive the same successful session; a
// slower duplicate must not redirect the browser back to a login error.
func TestOIDCRedirectCallbackConcurrentDuplicatesShareSuccessfulExchange(t *testing.T) {
	const code, verifier, token = "synthetic-single-use-code", "synthetic-pkce-verifier", "synthetic-session"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	release := make(chan struct{})
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: token}},
		entered: make(chan struct{}, 3), release: release,
	}
	router := concurrentOIDCRouter(service)
	start := make(chan struct{})
	ready := make(chan struct{}, 3)
	results := make(chan *httptest.ResponseRecorder, 3)
	waiters := make([]*waitingOIDCContext, 3)
	for i := range 3 {
		waiter := observeOIDCWaiter(context.Background())
		waiters[i] = waiter
		go func() {
			request := concurrentOIDCRequest(waiter, state, code, binding)
			recorder := httptest.NewRecorder()
			ready <- struct{}{}
			<-start
			router.ServeHTTP(recorder, request)
			results <- recorder
		}()
	}
	for range 3 {
		<-ready
	}
	close(start)
	select {
	case <-service.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("callback did not reach the provider exchange")
	}
	for _, waiter := range waiters {
		awaitOIDCWaiter(t, waiter)
	}
	close(release)
	for i := range 3 {
		select {
		case result := <-results:
			actualToken, reason := concurrentOIDCResult(t, result)
			if reason != "" || actualToken != token {
				t.Errorf("callback %d: error=%q, expected the same successful session", i+1, reason)
			}
			if !hasExpiredOIDCBindingCookie(result.Result().Cookies()) {
				t.Error("callback did not consume its browser binding cookie")
			}
		case <-time.After(2 * time.Second):
			t.Fatal("duplicate callback did not finish")
		}
	}
	if got := service.callCount(); got != 1 {
		t.Errorf("single-use authorization code exchanged %d times, want exactly 1", got)
	}
}

func runConcurrentOIDCCallback(router http.Handler, request *http.Request) <-chan *httptest.ResponseRecorder {
	result := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		result <- recorder
	}()
	return result
}

func awaitConcurrentOIDCCallback(t *testing.T, result <-chan *httptest.ResponseRecorder) *httptest.ResponseRecorder {
	t.Helper()
	select {
	case recorder := <-result:
		return recorder
	case <-time.After(2 * time.Second):
		t.Fatal("callback did not finish")
		return nil
	}
}

func awaitConcurrentOIDCExchange(t *testing.T, service *singleUseOIDCService) {
	t.Helper()
	select {
	case <-service.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("callback did not reach the provider exchange")
	}
}

func TestOIDCRedirectCallbackConcurrentDuplicateSurvivesLeaderCancellation(t *testing.T) {
	const (
		code     = "synthetic-canceled-code"
		verifier = "synthetic-canceled-verifier"
		token    = "synthetic-surviving-session"
	)
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	release := make(chan struct{})
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: token}},
		entered: make(chan struct{}, 2), release: release,
	}
	router := concurrentOIDCRouter(service)
	leaderCtx, cancelLeader := context.WithCancel(context.Background())
	defer cancelLeader()
	leaderWaiter := observeOIDCWaiter(leaderCtx)
	followerWaiter := observeOIDCWaiter(context.Background())
	leader := runConcurrentOIDCCallback(router, concurrentOIDCRequest(leaderWaiter, state, code, binding))
	awaitConcurrentOIDCExchange(t, service)
	follower := runConcurrentOIDCCallback(router, concurrentOIDCRequest(followerWaiter, state, code, binding))
	awaitOIDCWaiter(t, leaderWaiter)
	awaitOIDCWaiter(t, followerWaiter)
	cancelLeader()
	// Assert isolation before releasing the provider. Otherwise a broken
	// inherited context could randomly select the ready success channel even
	// though the leader also canceled its exchange context.
	exchangeCtx := service.receivedExchangeContext()
	if err := exchangeCtx.Err(); err != nil {
		t.Errorf("leader cancellation reached the shared provider exchange: %v", err)
	}
	if deadline, ok := exchangeCtx.Deadline(); !ok || time.Until(deadline) <= 0 || time.Until(deadline) > time.Minute {
		t.Error("shared provider exchange must retain a live, bounded deadline")
	}
	close(release)
	// A browser may cancel an earlier duplicate navigation. The legitimate
	// remaining navigation must still receive its one completed exchange.
	actualToken, reason := concurrentOIDCResult(t, awaitConcurrentOIDCCallback(t, follower))
	if reason != "" || actualToken != token {
		t.Errorf("remaining callback: error=%q, expected successful session", reason)
	}
	awaitConcurrentOIDCCallback(t, leader)
	if got := service.callCount(); got != 1 {
		t.Errorf("canceling the first callback caused %d exchanges, want 1", got)
	}
}

func TestOIDCRedirectCallbackConcurrentInvalidBindingCannotShareSuccess(t *testing.T) {
	const code, verifier, token = "synthetic-bound-code", "synthetic-bound-verifier", "synthetic-bound-session"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	_, wrongNonce := concurrentOIDCAttempt(t, t.Name()+"-another-browser", verifier)
	_, wrongVerifier := concurrentOIDCAttempt(t, t.Name(), "synthetic-wrong-verifier")
	release := make(chan struct{})
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: token}},
		entered: make(chan struct{}, 4), release: release,
	}
	router := concurrentOIDCRouter(service)
	validWaiter := observeOIDCWaiter(context.Background())
	wrongVerifierWaiter := observeOIDCWaiter(context.Background())
	valid := runConcurrentOIDCCallback(router, concurrentOIDCRequest(validWaiter, state, code, binding))
	awaitConcurrentOIDCExchange(t, service)
	attempts := []struct {
		name   string
		result <-chan *httptest.ResponseRecorder
	}{
		{"missing binding", runConcurrentOIDCCallback(router,
			concurrentOIDCRequest(context.Background(), state, code, ""))},
		{"wrong nonce", runConcurrentOIDCCallback(router,
			concurrentOIDCRequest(context.Background(), state, code, wrongNonce))},
		{"wrong PKCE verifier", runConcurrentOIDCCallback(router,
			concurrentOIDCRequest(wrongVerifierWaiter, state, code, wrongVerifier))},
	}
	awaitOIDCWaiter(t, validWaiter)
	awaitOIDCWaiter(t, wrongVerifierWaiter)
	close(release)
	actualToken, reason := concurrentOIDCResult(t, awaitConcurrentOIDCCallback(t, valid))
	if reason != "" || actualToken != token {
		t.Fatalf("valid callback: error=%q, expected successful session", reason)
	}
	for _, attempt := range attempts {
		actualToken, reason := concurrentOIDCResult(t, awaitConcurrentOIDCCallback(t, attempt.result))
		if reason == "" || actualToken != "" {
			t.Errorf("%s received the successful session of another browser binding", attempt.name)
		}
	}
	// Missing/mismatched nonce fail before exchange; the altered PKCE verifier
	// is independently rejected at the provider, never attached to valid work.
	if got := service.callCount(); got != 2 {
		t.Errorf("provider calls = %d, want valid exchange plus independent PKCE rejection", got)
	}
}

func TestOIDCRedirectCallbackConcurrentDifferentCodesRemainIsolated(t *testing.T) {
	const verifier = "synthetic-isolation-verifier"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	release := make(chan struct{})
	service := &singleUseOIDCService{
		grants: map[string]*singleUseOIDCGrant{
			"synthetic-code-a": {verifier: verifier, token: "synthetic-session-a"},
			"synthetic-code-b": {verifier: verifier, token: "synthetic-session-b"},
		},
		entered: make(chan struct{}, 2), release: release,
	}
	router := concurrentOIDCRouter(service)
	firstWaiter := observeOIDCWaiter(context.Background())
	secondWaiter := observeOIDCWaiter(context.Background())
	first := runConcurrentOIDCCallback(router, concurrentOIDCRequest(firstWaiter, state, "synthetic-code-a", binding))
	awaitConcurrentOIDCExchange(t, service)
	second := runConcurrentOIDCCallback(router, concurrentOIDCRequest(secondWaiter, state, "synthetic-code-b", binding))
	awaitOIDCWaiter(t, firstWaiter)
	awaitOIDCWaiter(t, secondWaiter)
	close(release)
	for _, attempt := range []struct {
		result <-chan *httptest.ResponseRecorder
		want   string
	}{{first, "synthetic-session-a"}, {second, "synthetic-session-b"}} {
		token, reason := concurrentOIDCResult(t, awaitConcurrentOIDCCallback(t, attempt.result))
		if reason != "" || token != attempt.want {
			t.Errorf("distinct authorization code mixed callback outcomes: error=%q", reason)
		}
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("different authorization codes exchanged %d times, want 2", got)
	}
}

func TestOIDCRedirectCallbackConcurrentDifferentStatesDoNotShareResult(t *testing.T) {
	const code, verifier, token = "synthetic-shared-code", "synthetic-state-verifier", "synthetic-first-session"
	firstState, firstBinding := concurrentOIDCAttempt(t, t.Name()+"-first", verifier)
	secondState, secondBinding := concurrentOIDCAttempt(t, t.Name()+"-second", verifier)
	release := make(chan struct{})
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: token}},
		entered: make(chan struct{}, 2), release: release,
	}
	router := concurrentOIDCRouter(service)
	firstWaiter := observeOIDCWaiter(context.Background())
	secondWaiter := observeOIDCWaiter(context.Background())
	first := runConcurrentOIDCCallback(router, concurrentOIDCRequest(firstWaiter, firstState, code, firstBinding))
	awaitConcurrentOIDCExchange(t, service)
	second := runConcurrentOIDCCallback(router, concurrentOIDCRequest(secondWaiter, secondState, code, secondBinding))
	awaitOIDCWaiter(t, firstWaiter)
	awaitOIDCWaiter(t, secondWaiter)
	close(release)
	actualToken, reason := concurrentOIDCResult(t, awaitConcurrentOIDCCallback(t, first))
	if reason != "" || actualToken != token {
		t.Fatalf("first valid callback: error=%q, expected successful session", reason)
	}
	actualToken, reason = concurrentOIDCResult(t, awaitConcurrentOIDCCallback(t, second))
	if reason == "" || actualToken != "" {
		t.Error("another signed state received the first state's completed session")
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("different signed states shared an exchange: calls=%d, want 2", got)
	}
}

func TestOIDCRedirectCallbackSuccessLateDuplicatesReuseOneSession(t *testing.T) {
	const code, verifier = "synthetic-completed-code", "synthetic-completed-verifier"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: "synthetic-completed-session"}},
		entered: make(chan struct{}, 2),
	}
	router := concurrentOIDCRouter(service)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, concurrentOIDCRequest(context.Background(), state, code, binding))
	if _, reason := concurrentOIDCResult(t, first); reason != "" {
		t.Fatalf("first callback failed: %s", reason)
	}
	// Requests already sent by the browser retain their original binding even
	// when the first response has completed and deleted that cookie. A late
	// duplicate within the short result window must receive the same session.
	replay := httptest.NewRecorder()
	router.ServeHTTP(replay, concurrentOIDCRequest(context.Background(), state, code, binding))
	token, reason := concurrentOIDCResult(t, replay)
	if reason != "" || token != "synthetic-completed-session" {
		t.Errorf("late duplicate failed instead of returning the same session: error=%q", reason)
	}
	if first.Header().Get("Location") != replay.Header().Get("Location") {
		t.Error("late duplicate changed the completed callback result")
	}
	if got := service.callCount(); got != 1 {
		t.Errorf("late duplicate exchanged the single-use code %d times, want 1", got)
	}
}

func TestOIDCRedirectCallbackLateDuplicateAfterResultExpiryFailsClosed(t *testing.T) {
	const code, verifier = "synthetic-expired-code", "synthetic-expired-verifier"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: "synthetic-expired-session"}},
		entered: make(chan struct{}, 2),
	}
	h := &AuthHandler{userService: service}
	router := concurrentOIDCHandlerRouter(h)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, concurrentOIDCRequest(context.Background(), state, code, binding))
	if _, reason := concurrentOIDCResult(t, first); reason != "" {
		t.Fatalf("first callback failed: %s", reason)
	}
	// Move the actual retained result past its lifetime without sleeping or
	// changing signed state validation. The next callback must not get a token.
	h.oidcResults.mu.Lock()
	retained := len(h.oidcResults.entries)
	for _, result := range h.oidcResults.entries {
		result.expiresAt = time.Now().Add(-time.Second)
	}
	h.oidcResults.mu.Unlock()
	if retained != 1 {
		t.Fatalf("retained completed results = %d, want 1", retained)
	}
	replay := httptest.NewRecorder()
	router.ServeHTTP(replay, concurrentOIDCRequest(context.Background(), state, code, binding))
	token, reason := concurrentOIDCResult(t, replay)
	if reason != "login_failed" || token != "" {
		t.Error("expired completed callback returned a retained session")
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("expired result bypassed provider validation: calls=%d, want 2", got)
	}
	h.oidcResults.mu.Lock()
	remaining := len(h.oidcResults.entries)
	h.oidcResults.mu.Unlock()
	if remaining != 0 {
		t.Error("expired successful result was not removed")
	}
}

func TestOIDCRedirectCallbackLateDuplicateStillValidatesBrowserBinding(t *testing.T) {
	const code, verifier = "synthetic-warm-code", "synthetic-warm-verifier"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	_, wrongNonce := concurrentOIDCAttempt(t, t.Name()+"-wrong-nonce", verifier)
	_, wrongVerifier := concurrentOIDCAttempt(t, t.Name(), "synthetic-wrong-warm-verifier")
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: "synthetic-warm-session"}},
		entered: make(chan struct{}, 2),
	}
	router := concurrentOIDCRouter(service)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, concurrentOIDCRequest(context.Background(), state, code, binding))
	if _, reason := concurrentOIDCResult(t, first); reason != "" {
		t.Fatalf("first callback failed: %s", reason)
	}
	for _, invalid := range []struct {
		name    string
		binding string
		reason  string
	}{
		{"missing cookie", "", "invalid_state"},
		{"wrong nonce", wrongNonce, "invalid_state"},
		{"wrong PKCE verifier", wrongVerifier, "login_failed"},
	} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, concurrentOIDCRequest(context.Background(), state, code, invalid.binding))
		token, reason := concurrentOIDCResult(t, recorder)
		if token != "" || reason != invalid.reason {
			t.Errorf("%s accessed a retained successful callback: reason=%q", invalid.name, reason)
		}
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("provider calls = %d, want valid exchange plus separate PKCE rejection", got)
	}
	// Rejected bindings must neither disclose nor poison the valid tuple.
	valid := httptest.NewRecorder()
	router.ServeHTTP(valid, concurrentOIDCRequest(context.Background(), state, code, binding))
	token, reason := concurrentOIDCResult(t, valid)
	if token != "synthetic-warm-session" || reason != "" {
		t.Errorf("rejected binding changed the valid retained result: reason=%q", reason)
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("valid warm result exchanged its code again: calls=%d", got)
	}
}

func TestOIDCRedirectCallbackFailedExchangeIsNotRetained(t *testing.T) {
	const code, verifier = "synthetic-retry-code", "synthetic-retry-verifier"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: "synthetic-retry-session", used: true}},
		entered: make(chan struct{}, 2),
	}
	router := concurrentOIDCRouter(service)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, concurrentOIDCRequest(context.Background(), state, code, binding))
	if token, reason := concurrentOIDCResult(t, first); token != "" || reason != "login_failed" {
		t.Fatal("provider rejection did not fail the initial callback")
	}
	// A previously rejected callback must still reach provider validation.
	// A failure is never a reusable result, even for an identical tuple.
	retry := httptest.NewRecorder()
	router.ServeHTTP(retry, concurrentOIDCRequest(context.Background(), state, code, binding))
	token, reason := concurrentOIDCResult(t, retry)
	if token != "" || reason != "login_failed" {
		t.Errorf("rejected single-use code unexpectedly produced a session: reason=%q", reason)
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("failed exchange was reused: provider calls=%d, want 2", got)
	}
}
