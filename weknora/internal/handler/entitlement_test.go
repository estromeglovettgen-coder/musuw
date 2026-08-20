package handler

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	paddle "github.com/PaddleHQ/paddle-go-sdk/v5"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type entitlementHandlerServiceStub struct {
	current    *types.ConsumerEntitlement
	applyCalls *int
}

type paddlePortalSessionCreatorStub struct {
	customerID      string
	subscriptionIDs []string
}

type emptyPaddlePortalSessionCreatorStub struct{}

func (emptyPaddlePortalSessionCreatorStub) CreateCustomerPortalSession(context.Context, *paddle.CreateCustomerPortalSessionRequest) (*paddle.CustomerPortalSession, error) {
	return nil, nil
}

func (s *paddlePortalSessionCreatorStub) CreateCustomerPortalSession(_ context.Context, request *paddle.CreateCustomerPortalSessionRequest) (*paddle.CustomerPortalSession, error) {
	s.customerID = request.CustomerID
	s.subscriptionIDs = append([]string(nil), request.SubscriptionIDs...)
	return &paddle.CustomerPortalSession{
		ID:         "cpls_server_only",
		CustomerID: request.CustomerID,
		URLs: paddle.CustomerPortalSessionURLs{
			General: paddle.CustomerPortalSessionGeneralURLs{Overview: "https://customer-portal.paddle.com/session-token"},
		},
	}, nil
}

func (s entitlementHandlerServiceStub) Current(context.Context, time.Time) (*types.ConsumerEntitlement, error) {
	return s.current, nil
}

func (entitlementHandlerServiceStub) OpenRouterAPIKey(context.Context) (string, error) {
	return "", nil
}

func (entitlementHandlerServiceStub) OpenRouterUserID(context.Context) string { return "" }

func (s entitlementHandlerServiceStub) ApplyConsumerPlan(context.Context, uint64, types.ConsumerPlan, string, string, time.Time, string, string) (bool, error) {
	if s.applyCalls != nil {
		(*s.applyCalls)++
	}
	return true, nil
}

func TestPaddlePortalSessionUsesAuthenticatedTenantBillingIdentityAndReturnsOnlyURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	portal := &paddlePortalSessionCreatorStub{}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits:   types.LimitsForConsumerPlan(types.ConsumerPlanFree),
			PlanStatus:           "canceled",
			PaddleCustomerID:     "ctm_owned_by_tenant",
			PaddleSubscriptionID: "sub_owned_by_tenant",
		}},
		paddle: PaddleConfig{Environment: "sandbox", APIKey: "pdl_sdbx_apikey_test"},
		portal: portal,
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/portal-session", strings.NewReader(`{"customer_id":"ctm_attacker_supplied"}`))
	req = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
	c.Request = req

	h.PaddlePortalSession(c)

	require.Empty(t, c.Errors)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{"authorization_url":"https://customer-portal.paddle.com/session-token"}`, recorder.Body.String())
	assert.Equal(t, "ctm_owned_by_tenant", portal.customerID)
	assert.Equal(t, []string{"sub_owned_by_tenant"}, portal.subscriptionIDs)
	assert.NotContains(t, recorder.Body.String(), "ctm_owned_by_tenant")
	assert.NotContains(t, recorder.Body.String(), "cpls_server_only")
}

func TestPaddlePortalSessionRejectsMissingAuthenticatedTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	portal := &paddlePortalSessionCreatorStub{}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{PaddleCustomerID: "ctm_owned_by_tenant"}},
		portal:  portal,
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/portal-session", nil)

	h.PaddlePortalSession(c)

	require.NotEmpty(t, c.Errors)
	assert.Empty(t, portal.customerID)
}

func TestPaddlePortalSessionRejectsTenantWithoutPaddleCustomer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	portal := &paddlePortalSessionCreatorStub{}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{}},
		portal:  portal,
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/portal-session", nil)
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))

	h.PaddlePortalSession(c)

	require.NotEmpty(t, c.Errors)
	assert.Empty(t, portal.customerID)
}

func TestPaddlePortalSessionFailsClosedOnEmptyProviderResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{PaddleCustomerID: "ctm_owned_by_tenant"}},
		portal:  emptyPaddlePortalSessionCreatorStub{},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/portal-session", nil)
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))

	assert.NotPanics(t, func() { h.PaddlePortalSession(c) })
	require.NotEmpty(t, c.Errors)
}

func TestCurrentReturnsOnlyTenantBoundPaddleCheckoutOptions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	portal := &paddlePortalSessionCreatorStub{}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits: types.LimitsForConsumerPlan(types.ConsumerPlanFree),
			PlanStatus:         "active",
			PaddleCustomerID:   "ctm_server_only",
		}},
		paddle: PaddleConfig{
			Environment:   "sandbox",
			APIKey:        "pdl_sdbx_apikey_test",
			ClientToken:   "test_client_token",
			WebhookSecret: "pdl_ntfset_secret",
			Prices: map[types.ConsumerPlan]map[string]string{
				types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
				types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
				types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
			},
		},
		portal: portal,
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("GET", "/api/v1/entitlements/current", nil)
	req = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
	c.Request = req

	h.Current(c)
	require.Equal(t, 200, recorder.Code)
	var response struct {
		Billing struct {
			Configured      bool   `json:"configured"`
			PortalAvailable bool   `json:"portal_available"`
			Environment     string `json:"environment"`
			ClientToken     string `json:"client_token"`
			TenantID        string `json:"tenant_id"`
			Prices          map[string]map[string]struct {
				PriceID string `json:"price_id"`
				Binding string `json:"checkout_binding"`
			} `json:"prices"`
		} `json:"billing"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Billing.Configured)
	assert.True(t, response.Billing.PortalAvailable)
	assert.Equal(t, "sandbox", response.Billing.Environment)
	assert.Equal(t, "test_client_token", response.Billing.ClientToken)
	assert.Equal(t, "42", response.Billing.TenantID)
	option := response.Billing.Prices["plus"]["monthly"]
	assert.Equal(t, "pri_plus_monthly", option.PriceID)
	assert.NotEmpty(t, option.Binding)
	assert.True(t, h.paddle.validCheckoutBinding(42, option.PriceID, option.Binding))
	assert.NotContains(t, recorder.Body.String(), "ctm_server_only")
}

func TestPaddleWebhookRejectsUnsignedCheckoutBinding(t *testing.T) {
	calls := 0
	config := PaddleConfig{
		Environment:   "sandbox",
		ClientToken:   "test_client_token",
		WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{applyCalls: &calls},
		paddle:  config,
	}
	body := []byte(fmt.Sprintf(`{
		"event_id":"evt_unbound",
		"event_type":"subscription.created",
		"occurred_at":%q,
		"data":{
			"id":"sub_unbound",
			"status":"active",
			"customer_id":"ctm_unbound",
			"custom_data":{"tenant_id":"42"},
			"items":[{"price":{"id":"pri_plus_monthly"}}]
		}
	}`, time.Now().UTC().Format(time.RFC3339Nano)))
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(h.paddle.WebhookSecret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))
	header := fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil)))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("POST", "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	req.Header.Set("Paddle-Signature", header)
	c.Request = req

	h.PaddleWebhook(c)
	assert.Zero(t, calls)
	assert.NotEmpty(t, c.Errors)
}

func TestPaddleWebhookAppliesServerBoundSubscription(t *testing.T) {
	calls := 0
	config := PaddleConfig{
		Environment:   "sandbox",
		ClientToken:   "test_client_token",
		WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	binding := config.checkoutBinding(42, "pri_plus_monthly")
	body := []byte(fmt.Sprintf(`{
		"event_id":"evt_bound",
		"event_type":"subscription.created",
		"occurred_at":%q,
		"data":{
			"id":"sub_bound",
			"status":"active",
			"customer_id":"ctm_bound",
			"custom_data":{"tenant_id":"42","musuw_checkout_binding":%q},
			"items":[{"price":{"id":"pri_plus_monthly"}}]
		}
	}`, time.Now().UTC().Format(time.RFC3339Nano), binding))
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("POST", "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	req.Header.Set("Paddle-Signature", fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil))))
	c.Request = req

	h := &EntitlementHandler{service: entitlementHandlerServiceStub{applyCalls: &calls}, paddle: config}
	h.PaddleWebhook(c)
	assert.Empty(t, c.Errors)
	assert.Equal(t, 1, calls)
}

func TestVerifyPaddleRequestPreservesTheSignedBody(t *testing.T) {
	secret := "pdl_secret"
	body := []byte(`{"event_id":"evt_1"}`)
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))
	header := fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil)))

	req := httptest.NewRequest("POST", "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	req.Header.Set("Paddle-Signature", header)
	assert.NoError(t, verifyPaddleRequest(secret, req))
	restored, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	assert.Equal(t, body, restored)

	bad := httptest.NewRequest("POST", "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	bad.Header.Set("Paddle-Signature", header[:len(header)-1]+"x")
	assert.Error(t, verifyPaddleRequest(secret, bad))
}

func TestPaddlePlanMappingRequiresKnownServerPrice(t *testing.T) {
	config := PaddleConfig{Prices: map[types.ConsumerPlan]map[string]string{types.ConsumerPlanPlus: {"monthly": "pri_plus"}}}
	plan, ok := config.planForPrice("pri_plus")
	assert.True(t, ok)
	assert.Equal(t, "plus", string(plan))

	_, ok = config.planForPrice("pri_attacker")
	assert.False(t, ok)
}

func TestOnlySubscriptionEventsCanChangeConsumerEntitlements(t *testing.T) {
	assert.False(t, isEntitlementPaddleEvent("transaction.completed"))
	for _, eventType := range []string{
		"subscription.created",
		"subscription.activated",
		"subscription.trialing",
		"subscription.past_due",
		"subscription.updated",
		"subscription.paused",
		"subscription.resumed",
		"subscription.canceled",
	} {
		assert.True(t, isEntitlementPaddleEvent(eventType), eventType)
	}
}

func TestPaddleCancellationStillRequiresKnownServerPrice(t *testing.T) {
	config := PaddleConfig{Prices: map[types.ConsumerPlan]map[string]string{types.ConsumerPlanPlus: {"monthly": "pri_plus"}}}
	event := paddleEvent{EventType: "subscription.canceled"}
	event.Data.Items = append(event.Data.Items, struct {
		Price struct {
			ID string `json:"id"`
		} `json:"price"`
	}{})
	event.Data.Items[0].Price.ID = "pri_attacker"
	_, _, _, err := config.planForEvent(event)
	assert.Error(t, err)

	event.Data.Items[0].Price.ID = "pri_plus"
	plan, status, priceID, err := config.planForEvent(event)
	assert.NoError(t, err)
	assert.Equal(t, "free", string(plan))
	assert.Equal(t, "canceled", status)
	assert.Equal(t, "pri_plus", priceID)
}
