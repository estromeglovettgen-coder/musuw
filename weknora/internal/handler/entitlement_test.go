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
	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type entitlementHandlerServiceStub struct {
	current          *types.ConsumerEntitlement
	applyCalls       *int
	refreshCalls     *int
	capturePeriodEnd func(*time.Time)
}

type paddlePortalSessionCreatorStub struct {
	customerID      string
	subscriptionIDs []string
}

type emptyPaddlePortalSessionCreatorStub struct{}

type recordingPaddleWebhookEnqueuer struct {
	task *asynq.Task
}

type paddleBillingOperationRepoStub struct {
	operation *types.PaddleBillingOperation
}

func (s *paddleBillingOperationRepoStub) Claim(_ context.Context, intent types.PaddleBillingOperationIntent) (*types.PaddleBillingOperation, types.PaddleBillingOperationClaimDisposition, error) {
	if s.operation != nil {
		return s.operation, types.PaddleBillingOperationClaimExisting, nil
	}
	s.operation = &types.PaddleBillingOperation{
		ID: 1, TenantID: intent.TenantID, OperationKey: intent.OperationKey,
		OperationType: intent.OperationType, RequestFingerprint: intent.RequestFingerprint,
		Plan: intent.Plan, BillingPeriod: intent.BillingPeriod, PriceID: intent.PriceID,
		SubscriptionID: intent.SubscriptionID, Status: types.PaddleBillingOperationPending,
	}
	return s.operation, types.PaddleBillingOperationClaimCreated, nil
}
func (s *paddleBillingOperationRepoStub) FindByKey(_ context.Context, tenantID uint64, operationKey string) (*types.PaddleBillingOperation, bool, error) {
	if s.operation == nil || s.operation.TenantID != tenantID || s.operation.OperationKey != operationKey {
		return nil, false, nil
	}
	return s.operation, true, nil
}
func (s *paddleBillingOperationRepoStub) GetByID(context.Context, uint64) (*types.PaddleBillingOperation, error) {
	return s.operation, nil
}
func (s *paddleBillingOperationRepoStub) MarkInFlight(context.Context, uint64) error {
	s.operation.Status = types.PaddleBillingOperationInFlight
	return nil
}
func (s *paddleBillingOperationRepoStub) RecordPaddleTransaction(_ context.Context, _ uint64, id string) error {
	s.operation.PaddleTransactionID = id
	return nil
}
func (s *paddleBillingOperationRepoStub) Finish(_ context.Context, _ uint64, status types.PaddleBillingOperationStatus, _, _ string) error {
	s.operation.Status = status
	return nil
}
func (*paddleBillingOperationRepoStub) FinishMatchingActive(context.Context, uint64, types.PaddleBillingOperationType, string, string, string, types.PaddleBillingOperationStatus, string, string) (bool, error) {
	return true, nil
}

func (e *recordingPaddleWebhookEnqueuer) Enqueue(task *asynq.Task, _ ...asynq.Option) (*asynq.TaskInfo, error) {
	e.task = task
	return &asynq.TaskInfo{ID: "queued-paddle-event", Queue: "billing", Type: task.Type()}, nil
}

type paddleSubscriptionUpdaterStub struct {
	subscription *paddle.Subscription
	preview      *paddle.SubscriptionPreview
	previewReq   *paddle.PreviewSubscriptionUpdateRequest
	updateReq    *paddle.UpdateSubscriptionRequest
	updateCalls  int
}

type paddleTransactionCreatorStub struct {
	calls   int
	request *paddle.CreateTransactionRequest
	result  *paddle.Transaction
}

func (s *paddleTransactionCreatorStub) CreateTransaction(_ context.Context, request *paddle.CreateTransactionRequest) (*paddle.Transaction, error) {
	s.calls++
	s.request = request
	return s.result, nil
}

func (s *paddleSubscriptionUpdaterStub) GetSubscription(context.Context, *paddle.GetSubscriptionRequest) (*paddle.Subscription, error) {
	return s.subscription, nil
}

func (s *paddleSubscriptionUpdaterStub) PreviewSubscriptionUpdate(_ context.Context, request *paddle.PreviewSubscriptionUpdateRequest) (*paddle.SubscriptionPreview, error) {
	s.previewReq = request
	return s.preview, nil
}

func (s *paddleSubscriptionUpdaterStub) UpdateSubscription(_ context.Context, request *paddle.UpdateSubscriptionRequest) (*paddle.Subscription, error) {
	s.updateCalls++
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

func TestValidPaddleOperationKeyAcceptsBoundedOpaqueKeys(t *testing.T) {
	assert.True(t, validPaddleOperationKey("00000000-0000-4000-8000-000000000001"))
	assert.True(t, validPaddleOperationKey("checkout-1780000000000-deadbeef1234"))
	assert.False(t, validPaddleOperationKey("too-short"))
	assert.False(t, validPaddleOperationKey("checkout/../../other-tenant"))
}

func (s entitlementHandlerServiceStub) Current(context.Context, time.Time) (*types.ConsumerEntitlement, error) {
	return s.current, nil
}

func (s entitlementHandlerServiceStub) CurrentForTenant(context.Context, uint64, time.Time) (*types.ConsumerEntitlement, error) {
	return s.current, nil
}

func (entitlementHandlerServiceStub) OpenRouterAPIKey(context.Context) (string, error) {
	return "", nil
}

func (entitlementHandlerServiceStub) OpenRouterUserID(context.Context) string { return "" }

func (s entitlementHandlerServiceStub) SetOpenRouterRemainingForTenant(context.Context, uint64, int64) (*types.ConsumerEntitlement, error) {
	return s.current, nil
}

func (s entitlementHandlerServiceStub) ApplyConsumerPlan(_ context.Context, _ uint64, _ types.ConsumerPlan, _, _, _ string, _ time.Time, _, _ string, periodEnd *time.Time) (bool, error) {
	if s.applyCalls != nil {
		(*s.applyCalls)++
	}
	if s.capturePeriodEnd != nil {
		s.capturePeriodEnd(periodEnd)
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
		operations:    &paddleBillingOperationRepoStub{},
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
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/subscription-upgrade", strings.NewReader(`{"plan":"pro","operation_key":"00000000-0000-4000-8000-000000000001","customer_id":"ctm_attacker"}`))
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
	assert.Equal(t, "00000000-0000-4000-8000-000000000001", customData["musuw_billing_operation_key"])
	assert.Equal(t, paddle.ProrationBillingModeProratedImmediately, *provider.updateReq.ProrationBillingMode.Value())
	assert.Equal(t, paddle.SubscriptionOnPaymentFailurePreventChange, *provider.updateReq.OnPaymentFailure.Value())
	assert.Equal(t, 1, provider.updateCalls)

	// A retry with the same key reuses the accepted operation even if Paddle
	// already reflects the target before the signed webhook reaches Musuw.
	provider.subscription.Items[0].Price.ID = "pri_pro_monthly"
	recorder = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(recorder)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/subscription-upgrade", strings.NewReader(`{"plan":"pro","operation_key":"00000000-0000-4000-8000-000000000001"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
	h.PaddleSubscriptionUpgrade(c)
	require.Empty(t, c.Errors)
	require.Equal(t, http.StatusAccepted, recorder.Code)
	assert.JSONEq(t, `{"pending":true,"plan":"pro"}`, recorder.Body.String())
	assert.Equal(t, 1, provider.updateCalls)
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

func TestPaddleCheckoutIntentCreatesAndReusesOneServerOwnedTransaction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config := PaddleConfig{
		Environment: "sandbox", APIKey: "pdl_sdbx_apikey_test", ClientToken: "test_client_token", WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	provider := &paddleTransactionCreatorStub{result: &paddle.Transaction{ID: "txn_server_owned"}}
	operations := &paddleBillingOperationRepoStub{}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{ConsumerPlanLimits: types.LimitsForConsumerPlan(types.ConsumerPlanFree)}},
		paddle:  config, transactions: provider, operations: operations,
	}
	body := `{"plan":"plus","billing_period":"monthly","operation_key":"00000000-0000-4000-8000-000000000001"}`
	for range 2 {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/checkout-intent", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
		h.PaddleCheckoutIntent(c)
		require.Empty(t, c.Errors)
		assert.JSONEq(t, `{"transaction_id":"txn_server_owned","pending":true}`, recorder.Body.String())
	}
	assert.Equal(t, 1, provider.calls)
	require.NotNil(t, provider.request)
	require.Len(t, provider.request.Items, 1)
	assert.Equal(t, "pri_plus_monthly", provider.request.Items[0].TransactionItemFromCatalog.PriceID)
	assert.Equal(t, "42", provider.request.CustomData["tenant_id"])
	assert.Equal(t, config.checkoutBinding(42, "pri_plus_monthly"), provider.request.CustomData["musuw_checkout_binding"])
	assert.Equal(t, "00000000-0000-4000-8000-000000000001", provider.request.CustomData["musuw_billing_operation_key"])
}

func TestPaddleCheckoutIntentRejectsExistingPastDueSubscriptionAfterGrace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	provider := &paddleTransactionCreatorStub{result: &paddle.Transaction{ID: "txn_must_not_exist"}}
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits:   types.LimitsForConsumerPlan(types.ConsumerPlanFree),
			PlanStatus:           "past_due",
			PaddleSubscriptionID: "sub_existing",
		}},
		paddle: PaddleConfig{
			Environment: "sandbox", APIKey: "pdl_sdbx_apikey_test", ClientToken: "test_client_token", WebhookSecret: "pdl_ntfset_secret",
			Prices: map[types.ConsumerPlan]map[string]string{
				types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
				types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
				types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
			},
		},
		transactions: provider,
		operations:   &paddleBillingOperationRepoStub{},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/checkout-intent", strings.NewReader(`{"plan":"plus","billing_period":"monthly","operation_key":"00000000-0000-4000-8000-000000000001"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))
	h.PaddleCheckoutIntent(c)
	require.NotEmpty(t, c.Errors)
	assert.Zero(t, provider.calls)
}

func TestCurrentReturnsOnlyServerCatalogForCheckoutIntent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	portal := &paddlePortalSessionCreatorStub{}
	paddleCustomerID := "ctm_" + strings.Repeat("a", 26)
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits: types.LimitsForConsumerPlan(types.ConsumerPlanFree),
			PlanStatus:         "active",
			PaddleCustomerID:   paddleCustomerID,
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
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	var response struct {
		Billing struct {
			Configured      bool   `json:"configured"`
			PortalAvailable bool   `json:"portal_available"`
			Environment     string `json:"environment"`
			ClientToken     string `json:"client_token"`
			PWCustomerID    string `json:"pw_customer_id"`
			Catalog         map[string]map[string]struct {
				PriceID string `json:"price_id"`
			} `json:"catalog"`
		} `json:"billing"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Billing.Configured)
	assert.True(t, response.Billing.PortalAvailable)
	assert.Equal(t, "sandbox", response.Billing.Environment)
	assert.Equal(t, "test_client_token", response.Billing.ClientToken)
	assert.Equal(t, paddleCustomerID, response.Billing.PWCustomerID)
	option := response.Billing.Catalog["plus"]["monthly"]
	assert.Equal(t, "pri_plus_monthly", option.PriceID)
	assert.NotContains(t, recorder.Body.String(), "checkout_binding")
	assert.NotContains(t, recorder.Body.String(), "tenant_id")
}

func TestCurrentOmitsRetainCustomerWithoutAuthenticatedTenantOwnedPaddleCustomer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{current: &types.ConsumerEntitlement{
			ConsumerPlanLimits: types.LimitsForConsumerPlan(types.ConsumerPlanFree),
			PlanStatus:         "active",
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
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/entitlements/current", nil)
	c.Request = req.WithContext(context.WithValue(req.Context(), types.TenantIDContextKey, uint64(42)))

	h.Current(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "pw_customer_id")
}

func TestPaddleCustomerIDForRetainAcceptsOnlyOfficialCustomerIDs(t *testing.T) {
	valid := "ctm_" + strings.Repeat("a", 26)
	assert.Equal(t, valid, paddleCustomerIDForRetain("  "+valid+"  "))
	for _, invalid := range []string{
		"",
		"ctm_" + strings.Repeat("a", 25),
		"ctm_" + strings.Repeat("a", 27),
		"ctm_" + strings.Repeat("A", 26),
		"sub_" + strings.Repeat("a", 26),
		"tenant-owned-id",
	} {
		assert.Empty(t, paddleCustomerIDForRetain(invalid))
	}
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
	queue := &recordingPaddleWebhookEnqueuer{}
	var capturedPeriodEnd *time.Time
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
	binding := config.checkoutBinding(42, "pri_plus_yearly")
	periodStart := time.Date(2026, 8, 21, 12, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2027, 8, 21, 12, 0, 0, 0, time.UTC)
	body := []byte(fmt.Sprintf(`{
		"event_id":"evt_bound",
		"event_type":"subscription.created",
		"occurred_at":%q,
		"data":{
			"id":"sub_bound",
			"status":"active",
			"customer_id":"ctm_bound",
			"custom_data":{"tenant_id":"42","musuw_checkout_binding":%q},
			"current_billing_period":{"starts_at":%q,"ends_at":%q},
			"items":[{"price":{"id":"pri_plus_yearly"}}]
		}
	}`, time.Now().UTC().Format(time.RFC3339Nano), binding, periodStart.Format(time.RFC3339Nano), periodEnd.Format(time.RFC3339Nano)))
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("POST", "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	req.Header.Set("Paddle-Signature", fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil))))
	c.Request = req

	h := &EntitlementHandler{service: entitlementHandlerServiceStub{
		applyCalls: &calls,
		capturePeriodEnd: func(value *time.Time) {
			capturedPeriodEnd = value
		},
	}, paddle: config, tasks: queue}
	h.PaddleWebhook(c)
	assert.Empty(t, c.Errors)
	assert.Equal(t, 0, calls)
	require.NotNil(t, queue.task)
	var payload types.PaddleWebhookTaskPayload
	require.NoError(t, json.Unmarshal(queue.task.Payload(), &payload))
	require.NotNil(t, payload.EventPeriodEnd)
	assert.Equal(t, periodEnd, payload.EventPeriodEnd.UTC())
	assert.Nil(t, capturedPeriodEnd)
}

func TestPaddleWebhookQueuesVerifiedWorkBeforeAcknowledging(t *testing.T) {
	applyCalls := 0
	queue := &recordingPaddleWebhookEnqueuer{}
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
	binding := config.checkoutBinding(42, "pri_plus_monthly")
	now := time.Now().UTC()
	body := []byte(fmt.Sprintf(`{
		"event_id":"evt_queued",
		"event_type":"subscription.created",
		"occurred_at":%q,
		"data":{
			"id":"sub_queued",
			"status":"active",
			"customer_id":"ctm_queued",
			"custom_data":{"tenant_id":"42","musuw_checkout_binding":%q},
			"current_billing_period":{"starts_at":%q,"ends_at":%q},
			"items":[{"price":{"id":"pri_plus_monthly"}}]
		}
	}`, now.Format(time.RFC3339Nano), binding, now.Format(time.RFC3339Nano), now.AddDate(0, 1, 0).Format(time.RFC3339Nano)))
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
	req.Header.Set("Paddle-Signature", fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil))))
	c.Request = req

	h := &EntitlementHandler{
		service: entitlementHandlerServiceStub{applyCalls: &applyCalls},
		paddle:  config,
		tasks:   queue,
	}
	h.PaddleWebhook(c)

	require.Empty(t, c.Errors)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{"ok":true,"queued":true}`, recorder.Body.String())
	assert.Zero(t, applyCalls, "provider and database work must not run before the webhook response")
	require.NotNil(t, queue.task)
	assert.Equal(t, types.TypePaddleWebhook, queue.task.Type())
	assert.NotContains(t, string(queue.task.Payload()), config.WebhookSecret)
	assert.NotContains(t, string(queue.task.Payload()), "Paddle-Signature")
}

func TestPastDueSubscriptionCannotAdvancePaidTerm(t *testing.T) {
	periodEnd := time.Date(2027, 8, 21, 12, 0, 0, 0, time.UTC)
	period := &paddleBillingPeriod{EndsAt: periodEnd}
	assert.Nil(t, entitledPaddlePeriodEnd("subscription.past_due", "past_due", period))
	assert.Nil(t, entitledPaddlePeriodEnd("subscription.updated", "active", period))
	require.NotNil(t, entitledPaddlePeriodEnd("subscription.created", "active", period))
}

func TestPaddleWebhookRoutesBoundRecurringCompletionToAllowanceRefresh(t *testing.T) {
	config := PaddleConfig{
		Environment: "sandbox", ClientToken: "test_client_token", WebhookSecret: "pdl_ntfset_secret",
		Prices: map[types.ConsumerPlan]map[string]string{
			types.ConsumerPlanPlus: {"monthly": "pri_plus_monthly", "yearly": "pri_plus_yearly"},
			types.ConsumerPlanPro:  {"monthly": "pri_pro_monthly", "yearly": "pri_pro_yearly"},
			types.ConsumerPlanMax:  {"monthly": "pri_max_monthly", "yearly": "pri_max_yearly"},
		},
	}
	for _, period := range []string{"monthly", "yearly"} {
		t.Run(period, func(t *testing.T) {
			applyCalls, refreshCalls := 0, 0
			queue := &recordingPaddleWebhookEnqueuer{}
			priceID := "pri_plus_" + period
			binding := config.checkoutBinding(42, priceID)
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
			"items":[{"price":{"id":%q}}]
		}
	}`, now.Format(time.RFC3339Nano), binding, now.Add(-time.Minute).Format(time.RFC3339Nano), now.AddDate(0, 1, 0).Format(time.RFC3339Nano), priceID))
			ts := time.Now().Unix()
			mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
			_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/paddle/webhook", bytes.NewReader(body))
			req.Header.Set("Paddle-Signature", fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil))))
			c.Request = req

			h := &EntitlementHandler{service: entitlementHandlerServiceStub{applyCalls: &applyCalls, refreshCalls: &refreshCalls}, paddle: config, tasks: queue}
			h.PaddleWebhook(c)
			require.Empty(t, c.Errors)
			assert.Equal(t, 0, applyCalls)
			assert.Equal(t, 0, refreshCalls)
			require.NotNil(t, queue.task)
			var payload types.PaddleWebhookTaskPayload
			require.NoError(t, json.Unmarshal(queue.task.Payload(), &payload))
			assert.Equal(t, types.PaddleWebhookTaskOperationRefreshPaidAllowance, payload.Operation)
			assert.JSONEq(t, `{"ok":true,"queued":true}`, recorder.Body.String())
		})
	}
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

	event.EventType = "subscription.paused"
	plan, status, _, period, err = config.planForEvent(event)
	assert.NoError(t, err)
	assert.Equal(t, "plus", string(plan))
	assert.Equal(t, "paused", status)
	assert.Equal(t, "monthly", period)
}

func TestPaddlePlanMappingRejectsMultipleOrUnknownItems(t *testing.T) {
	config := PaddleConfig{Prices: map[types.ConsumerPlan]map[string]string{types.ConsumerPlanPlus: {"monthly": "pri_plus"}}}
	event := paddleEvent{EventType: "subscription.created"}
	item := struct {
		Price struct {
			ID string `json:"id"`
		} `json:"price"`
	}{}
	item.Price.ID = "pri_plus"
	event.Data.Items = []struct {
		Price struct {
			ID string `json:"id"`
		} `json:"price"`
	}{item, item}
	_, _, _, _, err := config.planForEvent(event)
	assert.Error(t, err)
	event.Data.Items = event.Data.Items[:1]
	event.Data.Items[0].Price.ID = "pri_unknown"
	_, _, _, _, err = config.planForEvent(event)
	assert.Error(t, err)
}
