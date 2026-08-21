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
	current      *types.ConsumerEntitlement
	applyCalls   *int
	refreshCalls *int
}

type paddlePortalSessionCreatorStub struct {
	customerID      string
	subscriptionIDs []string
}

type emptyPaddlePortalSessionCreatorStub struct{}

type paddleSubscriptionUpdaterStub struct {
	subscription *paddle.Subscription
	preview      *paddle.SubscriptionPreview
	previewReq   *paddle.PreviewSubscriptionUpdateRequest
	updateReq    *paddle.UpdateSubscriptionRequest
}

func (s *paddleSubscriptionUpdaterStub) GetSubscription(context.Context, *paddle.GetSubscriptionRequest) (*paddle.Subscription, error) {
	return s.subscription, nil
}

func (s *paddleSubscriptionUpdaterStub) PreviewSubscriptionUpdate(_ context.Context, request *paddle.PreviewSubscriptionUpdateRequest) (*paddle.SubscriptionPreview, error) {
	s.previewReq = request
	return s.preview, nil
}

func (s *paddleSubscriptionUpdaterStub) UpdateSubscription(_ context.Context, request *paddle.UpdateSubscriptionRequest) (*paddle.Subscription, error) {
	s.updateReq = request
	return s.subscription, nil
}

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

func (s entitlementHandlerServiceStub) ApplyConsumerPlan(context.Context, uint64, types.ConsumerPlan, string, string, string, time.Time, string, string, *time.Time) (bool, error) {
	if s.applyCalls != nil {
		(*s.applyCalls)++
	}
	return true, nil
}

func (s entitlementHandlerServiceStub) RefreshPaidAllowance(context.Context, uint64, types.ConsumerPlan, string, time.Time, string, string, time.Time) (bool, error) {
	if s.refreshCalls != nil {
		(*s.refreshCalls)++
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

func TestPaddleSubscriptionUpgradeUsesOwnedSubscriptionAndServerPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config := PaddleConfig{
		Environment:   "sandbox",
		APIKey:        "pdl_sdbx_apikey_test",
		ClientToken:   "test_client_token",
		WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	subscription := &paddle.Subscription{
		ID:         "sub_owned_by_tenant",
		CustomerID: "ctm_owned_by_tenant",
		Status:     paddle.SubscriptionStatusActive,
		Items: []paddle.SubscriptionItem{{
			Quantity: 1,
			Price:    paddle.Price{ID: "pri_plus_monthly"},
		}},
	}
	nextBilledAt := "2026-09-20T17:20:07.682697Z"
	provider := &paddleSubscriptionUpdaterStub{
		subscription: subscription,
		preview: &paddle.SubscriptionPreview{
			NextBilledAt: &nextBilledAt,
			UpdateSummary: &paddle.SubscriptionPreviewUpdateSummary{
				Result: paddle.UpdateSummaryResult{Action: paddle.UpdateSummaryResultActionCharge, Amount: "900", CurrencyCode: paddle.CurrencyCodeCNY},
			},
			ImmediateTransaction: &paddle.NextTransaction{Details: paddle.TransactionDetailsPreview{Totals: paddle.TransactionTotals{
				Subtotal: "820", Tax: "80", Total: "900", Balance: "900", CurrencyCode: paddle.CurrencyCodeCNY,
			}}},
			RecurringTransactionDetails: paddle.TransactionDetailsPreview{Totals: paddle.TransactionTotals{
				Subtotal: "5900", Tax: "0", Total: "5900", Balance: "5900", CurrencyCode: paddle.CurrencyCodeCNY,
			}},
		},
	}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits:   types.LimitsForConsumerPlan(types.ConsumerPlanPlus),
			PlanStatus:           "active",
			PaddleCustomerID:     "ctm_owned_by_tenant",
			PaddleSubscriptionID: "sub_owned_by_tenant",
		}},
		paddle:        config,
		subscriptions: provider,
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/subscription-upgrade/preview", strings.NewReader(`{"plan":"pro","subscription_id":"sub_attacker"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))

	h.PaddleSubscriptionUpgradePreview(c)

	require.Empty(t, c.Errors)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{
		"plan":"pro",
		"period":"monthly",
		"action":"charge",
		"prorated_subtotal":"820",
		"prorated_tax":"80",
		"due_today":"900",
		"recurring_total":"5900",
		"currency_code":"CNY",
		"next_billed_at":"2026-09-20T17:20:07.682697Z"
	}`, recorder.Body.String())
	require.NotNil(t, provider.previewReq)
	assert.Equal(t, "sub_owned_by_tenant", provider.previewReq.SubscriptionID)
	require.NotNil(t, provider.previewReq.Items)
	previewItems := *provider.previewReq.Items.Value()
	require.Len(t, previewItems, 1)
	assert.Equal(t, "pri_pro_monthly", previewItems[0].SubscriptionUpdateItemFromCatalog.PriceID)
	assert.Equal(t, 1, previewItems[0].SubscriptionUpdateItemFromCatalog.Quantity)
	assert.Equal(t, paddle.ProrationBillingModeProratedImmediately, *provider.previewReq.ProrationBillingMode.Value())
	assert.Equal(t, paddle.SubscriptionOnPaymentFailurePreventChange, *provider.previewReq.OnPaymentFailure.Value())

	recorder = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(recorder)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/subscription-upgrade", strings.NewReader(`{"plan":"pro","customer_id":"ctm_attacker"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))

	h.PaddleSubscriptionUpgrade(c)

	require.Empty(t, c.Errors)
	require.Equal(t, http.StatusAccepted, recorder.Code)
	assert.JSONEq(t, `{"pending":true,"plan":"pro"}`, recorder.Body.String())
	require.NotNil(t, provider.updateReq)
	assert.Equal(t, "sub_owned_by_tenant", provider.updateReq.SubscriptionID)
	updateItems := *provider.updateReq.Items.Value()
	require.Len(t, updateItems, 1)
	assert.Equal(t, "pri_pro_monthly", updateItems[0].SubscriptionUpdateItemFromCatalog.PriceID)
	customData := *provider.updateReq.CustomData.Value()
	assert.Equal(t, "42", customData["tenant_id"])
	assert.Equal(t, config.checkoutBinding(42, "pri_pro_monthly"), customData["musuw_checkout_binding"])
	assert.Equal(t, paddle.ProrationBillingModeProratedImmediately, *provider.updateReq.ProrationBillingMode.Value())
	assert.Equal(t, paddle.SubscriptionOnPaymentFailurePreventChange, *provider.updateReq.OnPaymentFailure.Value())
}

func TestPaddleSubscriptionUpgradeRejectsDowngradeAndProviderOwnershipMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config := PaddleConfig{
		Environment:   "sandbox",
		APIKey:        "pdl_sdbx_apikey_test",
		ClientToken:   "test_client_token",
		WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	provider := &paddleSubscriptionUpdaterStub{subscription: &paddle.Subscription{
		ID:         "sub_owned_by_tenant",
		CustomerID: "ctm_different_customer",
		Status:     paddle.SubscriptionStatusActive,
		Items:      []paddle.SubscriptionItem{{Quantity: 1, Price: paddle.Price{ID: "pri_pro_monthly"}}},
	}}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits:   types.LimitsForConsumerPlan(types.ConsumerPlanPro),
			PlanStatus:           "active",
			PaddleCustomerID:     "ctm_owned_by_tenant",
			PaddleSubscriptionID: "sub_owned_by_tenant",
		}},
		paddle:        config,
		subscriptions: provider,
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/subscription-upgrade/preview", strings.NewReader(`{"plan":"plus"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
	h.PaddleSubscriptionUpgradePreview(c)
	require.NotEmpty(t, c.Errors)
	assert.Nil(t, provider.previewReq)

	recorder = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(recorder)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/subscription-upgrade/preview", strings.NewReader(`{"plan":"max"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
	h.PaddleSubscriptionUpgradePreview(c)
	require.NotEmpty(t, c.Errors)
	assert.Nil(t, provider.previewReq)
	assert.Nil(t, provider.updateReq)
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

func TestPaddleWebhookRoutesOnlyBoundRecurringCompletionToAllowanceRefresh(t *testing.T) {
	applyCalls, refreshCalls := 0, 0
	config := PaddleConfig{
		Environment: "sandbox", ClientToken: "test_client_token", WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	binding := config.checkoutBinding(42, "pri_plus_monthly")
	now := time.Now().UTC()
	body := []byte(fmt.Sprintf(`{
		"event_id":"evt_renewal",
		"event_type":"transaction.completed",
		"occurred_at":%q,
		"data":{
			"id":"txn_renewal",
			"status":"completed",
			"origin":"subscription_recurring",
			"customer_id":"ctm_bound",
			"subscription_id":"sub_bound",
			"custom_data":{"tenant_id":"42","musuw_checkout_binding":%q},
			"billing_period":{"starts_at":%q,"ends_at":%q},
			"items":[{"price":{"id":"pri_plus_monthly"}}]
		}
	}`, now.Format(time.RFC3339Nano), binding, now.Add(-time.Minute).Format(time.RFC3339Nano), now.AddDate(0, 1, 0).Format(time.RFC3339Nano)))
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	req.Header.Set("Paddle-Signature", fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil))))
	c.Request = req

	h := &EntitlementHandler{service: entitlementHandlerServiceStub{applyCalls: &applyCalls, refreshCalls: &refreshCalls}, paddle: config}
	h.PaddleWebhook(c)
	require.Empty(t, c.Errors)
	assert.Equal(t, 0, applyCalls)
	assert.Equal(t, 1, refreshCalls)
	assert.JSONEq(t, `{"ok":true,"applied":true}`, recorder.Body.String())
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
	_, _, _, _, err := config.planForEvent(event)
	assert.Error(t, err)

	event.Data.Items[0].Price.ID = "pri_plus"
	plan, status, priceID, period, err := config.planForEvent(event)
	assert.NoError(t, err)
	assert.Equal(t, "free", string(plan))
	assert.Equal(t, "canceled", status)
	assert.Equal(t, "pri_plus", priceID)
	assert.Equal(t, "monthly", period)
}
