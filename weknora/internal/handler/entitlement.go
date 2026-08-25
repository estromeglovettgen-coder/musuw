package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	paddle "github.com/PaddleHQ/paddle-go-sdk/v5"
	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/Tencent/WeKnora/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
)

const paddleSignatureTolerance = 5 * time.Second

type PaddleConfig struct {
	Environment   string
	APIKey        string
	ClientToken   string
	WebhookSecret string
	Prices        map[types.ConsumerPlan]map[string]string
}

func loadPaddleConfig() PaddleConfig {
	prices := map[types.ConsumerPlan]map[string]string{}
	for _, item := range []struct {
		plan   types.ConsumerPlan
		period string
		keys   []string
	}{
		{types.ConsumerPlanPlus, "monthly", []string{"MUSUW_PADDLE_PLUS_MONTHLY_PRICE_ID", "MUSNOW_PADDLE_PERSONAL_MONTHLY_PRICE_ID"}},
		{types.ConsumerPlanPlus, "yearly", []string{"MUSUW_PADDLE_PLUS_YEARLY_PRICE_ID", "MUSNOW_PADDLE_PERSONAL_YEARLY_PRICE_ID"}},
		{types.ConsumerPlanPro, "monthly", []string{"MUSUW_PADDLE_PRO_MONTHLY_PRICE_ID", "MUSNOW_PADDLE_PRO_MONTHLY_PRICE_ID"}},
		{types.ConsumerPlanPro, "yearly", []string{"MUSUW_PADDLE_PRO_YEARLY_PRICE_ID", "MUSNOW_PADDLE_PRO_YEARLY_PRICE_ID"}},
		{types.ConsumerPlanMax, "monthly", []string{"MUSUW_PADDLE_MAX_MONTHLY_PRICE_ID"}},
		{types.ConsumerPlanMax, "yearly", []string{"MUSUW_PADDLE_MAX_YEARLY_PRICE_ID"}},
	} {
		if price := firstEnv(item.keys...); price != "" {
			if prices[item.plan] == nil {
				prices[item.plan] = map[string]string{}
			}
			prices[item.plan][item.period] = price
		}
	}
	return PaddleConfig{
		Environment:   firstEnv("MUSUW_PADDLE_ENVIRONMENT", "MUSNOW_PADDLE_ENVIRONMENT"),
		APIKey:        firstEnv("MUSUW_PADDLE_API_KEY", "MUSNOW_PADDLE_API_KEY"),
		ClientToken:   firstEnv("MUSUW_PADDLE_CLIENT_TOKEN", "MUSNOW_PADDLE_CLIENT_TOKEN"),
		WebhookSecret: firstEnv("MUSUW_PADDLE_WEBHOOK_SECRET", "MUSNOW_PADDLE_WEBHOOK_SECRET"),
		Prices:        prices,
	}
}

func (c PaddleConfig) PortalConfigured() bool {
	switch strings.ToLower(strings.TrimSpace(c.Environment)) {
	case "sandbox":
		return strings.HasPrefix(c.APIKey, "pdl_sdbx_apikey_")
	case "live":
		return strings.HasPrefix(c.APIKey, "pdl_live_apikey_")
	default:
		return false
	}
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func (c PaddleConfig) Configured() bool {
	environment := strings.ToLower(strings.TrimSpace(c.Environment))
	if c.WebhookSecret == "" || (environment != "sandbox" && environment != "live") {
		return false
	}
	if (environment == "sandbox" && !strings.HasPrefix(c.ClientToken, "test_")) ||
		(environment == "live" && !strings.HasPrefix(c.ClientToken, "live_")) {
		return false
	}
	for _, plan := range []types.ConsumerPlan{types.ConsumerPlanPlus, types.ConsumerPlanPro, types.ConsumerPlanMax} {
		if c.Prices[plan]["monthly"] == "" || c.Prices[plan]["yearly"] == "" {
			return false
		}
	}
	return true
}

func (c PaddleConfig) planForPrice(priceID string) (types.ConsumerPlan, bool) {
	plan, _, ok := c.planAndPeriodForPrice(priceID)
	return plan, ok
}

func (c PaddleConfig) planAndPeriodForPrice(priceID string) (types.ConsumerPlan, string, bool) {
	priceID = strings.TrimSpace(priceID)
	for _, plan := range []types.ConsumerPlan{types.ConsumerPlanPlus, types.ConsumerPlanPro, types.ConsumerPlanMax} {
		for _, period := range []string{"monthly", "yearly"} {
			mapped := c.Prices[plan][period]
			if mapped == priceID {
				return plan, period, true
			}
		}
	}
	return "", "", false
}

func (c PaddleConfig) checkoutBinding(tenantID uint64, priceID string) string {
	mac := hmac.New(sha256.New, []byte(c.WebhookSecret))
	_, _ = mac.Write([]byte(fmt.Sprintf("musuw-paddle-checkout-v1\x00%d\x00%s", tenantID, priceID)))
	return hex.EncodeToString(mac.Sum(nil))
}

func (c PaddleConfig) validCheckoutBinding(tenantID uint64, priceID, binding string) bool {
	want, err := hex.DecodeString(c.checkoutBinding(tenantID, priceID))
	if err != nil {
		return false
	}
	got, err := hex.DecodeString(strings.TrimSpace(binding))
	return err == nil && hmac.Equal(want, got)
}

func (c PaddleConfig) billingResponse(tenantID uint64, plan types.ConsumerPlan, portalAvailable bool) gin.H {
	configured := c.Configured() && c.PortalConfigured()
	response := gin.H{
		"configured":       configured,
		"environment":      strings.ToLower(strings.TrimSpace(c.Environment)),
		"portal_available": portalAvailable,
	}
	if !configured || tenantID == 0 {
		return response
	}
	catalog := map[string]map[string]gin.H{}
	for _, paidPlan := range []types.ConsumerPlan{types.ConsumerPlanPlus, types.ConsumerPlanPro, types.ConsumerPlanMax} {
		catalog[string(paidPlan)] = map[string]gin.H{}
		for _, period := range []string{"monthly", "yearly"} {
			catalog[string(paidPlan)][period] = gin.H{"price_id": c.Prices[paidPlan][period]}
		}
	}
	response["client_token"] = c.ClientToken
	response["catalog"] = catalog
	return response
}

func paddleCustomerIDForRetain(value string) string {
	value = strings.TrimSpace(value)
	if len(value) != len("ctm_")+26 || !strings.HasPrefix(value, "ctm_") {
		return ""
	}
	for _, char := range value[len("ctm_"):] {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return ""
		}
	}
	return value
}

type paddlePortalSessionCreator interface {
	CreateCustomerPortalSession(context.Context, *paddle.CreateCustomerPortalSessionRequest) (*paddle.CustomerPortalSession, error)
}

type paddleSubscriptionUpdater interface {
	GetSubscription(context.Context, *paddle.GetSubscriptionRequest) (*paddle.Subscription, error)
	PreviewSubscriptionUpdate(context.Context, *paddle.PreviewSubscriptionUpdateRequest) (*paddle.SubscriptionPreview, error)
	UpdateSubscription(context.Context, *paddle.UpdateSubscriptionRequest) (*paddle.Subscription, error)
}

type paddleTransactionCreator interface {
	CreateTransaction(context.Context, *paddle.CreateTransactionRequest) (*paddle.Transaction, error)
}

type EntitlementHandler struct {
	service       interfaces.EntitlementService
	paddle        PaddleConfig
	portal        paddlePortalSessionCreator
	subscriptions paddleSubscriptionUpdater
	transactions  paddleTransactionCreator
	tasks         interfaces.TaskEnqueuer
	operations    interfaces.PaddleBillingOperationRepository
}

func NewEntitlementHandler(service interfaces.EntitlementService, tasks interfaces.TaskEnqueuer, operations interfaces.PaddleBillingOperationRepository) *EntitlementHandler {
	config := loadPaddleConfig()
	handler := &EntitlementHandler{service: service, paddle: config, tasks: tasks, operations: operations}
	if !config.PortalConfigured() {
		return handler
	}
	var (
		sdk *paddle.SDK
		err error
	)
	if strings.EqualFold(config.Environment, "sandbox") {
		sdk, err = paddle.NewSandbox(config.APIKey)
	} else {
		sdk, err = paddle.New(config.APIKey)
	}
	if err != nil {
		logger.Errorf(context.Background(), "Paddle client initialization failed: %v", err)
		return handler
	}
	handler.portal = sdk
	handler.subscriptions = sdk
	handler.transactions = sdk
	return handler
}

func (h *EntitlementHandler) Current(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	current, err := h.service.Current(c.Request.Context(), time.Now())
	if err != nil {
		_ = c.Error(err)
		return
	}
	tenantID, _ := types.TenantIDFromContext(c.Request.Context())
	portalAvailable := h.portal != nil && strings.TrimSpace(current.PaddleCustomerID) != ""
	billing := h.paddle.billingResponse(tenantID, current.Plan, portalAvailable)
	if customerID := paddleCustomerIDForRetain(current.PaddleCustomerID); tenantID != 0 && customerID != "" && h.paddle.Configured() && h.paddle.PortalConfigured() {
		// Paddle Retain requires the authenticated customer's Paddle ID in the
		// browser. This value is derived from signed provider state, never from
		// request input, and grants no billing or entitlement authority.
		billing["pw_customer_id"] = customerID
	}
	c.JSON(http.StatusOK, gin.H{"data": current, "billing": billing})
}

// PaddlePublicConfig exposes only the client-side values required to
// initialize Paddle.js on Paddle's public default-payment-link page.
func (h *EntitlementHandler) PaddlePublicConfig(c *gin.Context) {
	environment := strings.ToLower(strings.TrimSpace(h.paddle.Environment))
	clientToken := strings.TrimSpace(h.paddle.ClientToken)
	configured := h.paddle.Configured() && h.paddle.PortalConfigured() &&
		((environment == "sandbox" && len(clientToken) > len("test_")) ||
			(environment == "live" && len(clientToken) > len("live_")))
	c.Header("Cache-Control", "no-store")
	if !configured {
		c.JSON(http.StatusOK, gin.H{"configured": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"configured":   true,
		"environment":  environment,
		"client_token": clientToken,
	})
}

func (h *EntitlementHandler) PaddlePortalSession(c *gin.Context) {
	tenantID, ok := types.TenantIDFromContext(c.Request.Context())
	if !ok || tenantID == 0 {
		_ = c.Error(apperrors.NewUnauthorizedError("authentication required"))
		return
	}
	if h.portal == nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle customer portal is not configured"))
		return
	}
	current, err := h.service.Current(c.Request.Context(), time.Now())
	if err != nil {
		_ = c.Error(err)
		return
	}
	customerID := strings.TrimSpace(current.PaddleCustomerID)
	if customerID == "" {
		_ = c.Error(apperrors.NewBadRequestError("Paddle customer is unavailable"))
		return
	}
	request := &paddle.CreateCustomerPortalSessionRequest{CustomerID: customerID}
	if subscriptionID := strings.TrimSpace(current.PaddleSubscriptionID); subscriptionID != "" {
		request.SubscriptionIDs = []string{subscriptionID}
	}
	session, err := h.portal.CreateCustomerPortalSession(c.Request.Context(), request)
	if err != nil {
		logger.Errorf(c.Request.Context(), "Paddle portal session creation failed tenant_id=%d: %v", tenantID, err)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle customer portal is temporarily unavailable"))
		return
	}
	if session == nil {
		logger.Errorf(c.Request.Context(), "Paddle portal session returned an empty response tenant_id=%d", tenantID)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle customer portal is temporarily unavailable"))
		return
	}
	overview := strings.TrimSpace(session.URLs.General.Overview)
	parsed, parseErr := url.Parse(overview)
	if parseErr != nil || parsed.Scheme != "https" || parsed.Host == "" {
		logger.Errorf(c.Request.Context(), "Paddle portal session returned an invalid overview URL tenant_id=%d", tenantID)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle customer portal is temporarily unavailable"))
		return
	}
	// Reuse the HTTP logger's existing authorization_url redaction. This URL
	// contains a temporary bearer token and must never appear in access logs.
	c.JSON(http.StatusOK, gin.H{"authorization_url": overview})
}

type paddleSubscriptionUpgradeRequest struct {
	Plan         types.ConsumerPlan `json:"plan" binding:"required"`
	OperationKey string             `json:"operation_key"`
}

type paddleCheckoutIntentRequest struct {
	Plan          types.ConsumerPlan `json:"plan" binding:"required"`
	BillingPeriod string             `json:"billing_period" binding:"required"`
	OperationKey  string             `json:"operation_key" binding:"required"`
}

func validPaddleOperationKey(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) < 16 || len(value) > 128 {
		return false
	}
	for _, char := range value {
		if !((char >= '0' && char <= '9') ||
			(char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			char == '-' || char == '_') {
			return false
		}
	}
	return true
}

func paddleBillingOperationFingerprint(operationType types.PaddleBillingOperationType, plan types.ConsumerPlan, period, priceID, subscriptionID string) string {
	canonical := strings.Join([]string{string(operationType), string(plan), period, priceID, subscriptionID}, "\x00")
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}

func samePaddleBillingOperation(operation *types.PaddleBillingOperation, intent types.PaddleBillingOperationIntent) bool {
	return operation != nil && operation.OperationType == intent.OperationType &&
		operation.RequestFingerprint == intent.RequestFingerprint && operation.Plan == intent.Plan &&
		operation.BillingPeriod == intent.BillingPeriod && operation.PriceID == intent.PriceID &&
		operation.SubscriptionID == intent.SubscriptionID
}

func (h *EntitlementHandler) PaddleCheckoutIntent(c *gin.Context) {
	tenantID, ok := types.TenantIDFromContext(c.Request.Context())
	if !ok || tenantID == 0 {
		_ = c.Error(apperrors.NewUnauthorizedError("authentication required"))
		return
	}
	if h.transactions == nil || h.operations == nil || !h.paddle.Configured() || !h.paddle.PortalConfigured() {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle checkout is not configured"))
		return
	}
	var request paddleCheckoutIntentRequest
	if err := c.ShouldBindJSON(&request); err != nil || !validPaddleOperationKey(request.OperationKey) {
		_ = c.Error(apperrors.NewBadRequestError("a valid checkout operation key is required"))
		return
	}
	request.Plan = types.NormalizeConsumerPlan(request.Plan)
	request.BillingPeriod = strings.ToLower(strings.TrimSpace(request.BillingPeriod))
	if request.Plan == types.ConsumerPlanFree || request.BillingPeriod != "monthly" && request.BillingPeriod != "yearly" {
		_ = c.Error(apperrors.NewBadRequestError("a paid plan and billing period are required"))
		return
	}
	current, err := h.service.Current(c.Request.Context(), time.Now())
	if err != nil {
		_ = c.Error(err)
		return
	}
	if current.Plan != types.ConsumerPlanFree ||
		(strings.TrimSpace(current.PaddleSubscriptionID) != "" && current.PlanStatus != "canceled") {
		_ = c.Error(apperrors.NewConflictError("an existing paid subscription must be managed instead of opening another checkout"))
		return
	}
	priceID := strings.TrimSpace(h.paddle.Prices[request.Plan][request.BillingPeriod])
	if priceID == "" {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle price is not configured"))
		return
	}
	intent := types.PaddleBillingOperationIntent{
		TenantID: tenantID, OperationKey: strings.TrimSpace(request.OperationKey),
		OperationType: types.PaddleBillingOperationCheckout, Plan: request.Plan,
		BillingPeriod: request.BillingPeriod, PriceID: priceID,
	}
	intent.RequestFingerprint = paddleBillingOperationFingerprint(intent.OperationType, intent.Plan, intent.BillingPeriod, intent.PriceID, "")
	operation, disposition, err := h.operations.Claim(c.Request.Context(), intent)
	if errors.Is(err, interfaces.ErrPaddleBillingOperationKeyConflict) {
		_ = c.Error(apperrors.NewConflictError("checkout operation key was already used for another request"))
		return
	}
	if err != nil {
		logger.Errorf(c.Request.Context(), "Paddle checkout operation claim failed tenant_id=%d: %v", tenantID, err)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle checkout is temporarily unavailable"))
		return
	}
	if !samePaddleBillingOperation(operation, intent) {
		_ = c.Error(apperrors.NewConflictError("another billing operation is already in progress"))
		return
	}
	if transactionID := strings.TrimSpace(operation.PaddleTransactionID); transactionID != "" {
		c.JSON(http.StatusOK, gin.H{"transaction_id": transactionID, "pending": true})
		return
	}
	if disposition != types.PaddleBillingOperationClaimCreated {
		_ = c.Error(apperrors.NewConflictError("checkout creation is already in progress or requires reconciliation"))
		return
	}
	if err := h.operations.MarkInFlight(c.Request.Context(), operation.ID); err != nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle checkout is temporarily unavailable"))
		return
	}
	transaction, providerErr := h.transactions.CreateTransaction(c.Request.Context(), &paddle.CreateTransactionRequest{
		Items: []paddle.CreateTransactionItems{*paddle.NewCreateTransactionItemsTransactionItemFromCatalog(&paddle.TransactionItemFromCatalog{
			PriceID: priceID, Quantity: 1,
		})},
		CustomData: paddle.CustomData{
			"tenant_id":                   strconv.FormatUint(tenantID, 10),
			"musuw_checkout_binding":      h.paddle.checkoutBinding(tenantID, priceID),
			"musuw_billing_operation_key": intent.OperationKey,
		},
	})
	if providerErr != nil || transaction == nil || !strings.HasPrefix(strings.TrimSpace(transaction.ID), "txn_") {
		message := "Paddle transaction response is uncertain"
		if providerErr != nil {
			message = providerErr.Error()
		}
		_ = h.operations.Finish(c.Request.Context(), operation.ID, types.PaddleBillingOperationUncertain, `{}`, message)
		logger.Errorf(c.Request.Context(), "Paddle checkout transaction result uncertain tenant_id=%d", tenantID)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle checkout is temporarily unavailable; retrying will not create another transaction"))
		return
	}
	transactionID := strings.TrimSpace(transaction.ID)
	if err := h.operations.RecordPaddleTransaction(c.Request.Context(), operation.ID, transactionID); err != nil {
		_ = h.operations.Finish(c.Request.Context(), operation.ID, types.PaddleBillingOperationUncertain, `{}`, err.Error())
		logger.Errorf(c.Request.Context(), "Paddle checkout transaction persistence uncertain tenant_id=%d", tenantID)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle checkout is temporarily unavailable; retrying will not create another transaction"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"transaction_id": transactionID, "pending": true})
}

type paddleSubscriptionUpgradeTarget struct {
	plan           types.ConsumerPlan
	period         string
	priceID        string
	subscriptionID string
}

func consumerPlanRank(plan types.ConsumerPlan) int {
	switch plan {
	case types.ConsumerPlanPlus:
		return 1
	case types.ConsumerPlanPro:
		return 2
	case types.ConsumerPlanMax:
		return 3
	default:
		return 0
	}
}

func (h *EntitlementHandler) paddleSubscriptionUpgradeTarget(ctx context.Context, tenantID uint64, targetPlan types.ConsumerPlan) (*paddleSubscriptionUpgradeTarget, error) {
	if h.subscriptions == nil || !h.paddle.Configured() {
		return nil, apperrors.NewServiceUnavailableError("Paddle subscription upgrades are not configured")
	}
	current, err := h.service.Current(ctx, time.Now())
	if err != nil {
		return nil, err
	}
	currentPlan := current.Plan
	if consumerPlanRank(currentPlan) == 0 || consumerPlanRank(targetPlan) <= consumerPlanRank(currentPlan) {
		return nil, apperrors.NewBadRequestError("target plan must be higher than the current paid plan")
	}
	if !strings.EqualFold(strings.TrimSpace(current.PlanStatus), string(paddle.SubscriptionStatusActive)) {
		return nil, apperrors.NewBadRequestError("only active subscriptions can be upgraded")
	}
	customerID := strings.TrimSpace(current.PaddleCustomerID)
	subscriptionID := strings.TrimSpace(current.PaddleSubscriptionID)
	if customerID == "" || subscriptionID == "" {
		return nil, apperrors.NewBadRequestError("Paddle subscription is unavailable")
	}
	subscription, err := h.subscriptions.GetSubscription(ctx, &paddle.GetSubscriptionRequest{SubscriptionID: subscriptionID})
	if err != nil {
		logger.Errorf(ctx, "Paddle subscription lookup failed tenant_id=%d: %v", tenantID, err)
		return nil, apperrors.NewServiceUnavailableError("Paddle subscription is temporarily unavailable")
	}
	if subscription == nil || strings.TrimSpace(subscription.ID) != subscriptionID || strings.TrimSpace(subscription.CustomerID) != customerID {
		return nil, apperrors.NewConflictError("Paddle subscription ownership does not match the authenticated account")
	}
	if subscription.Status != paddle.SubscriptionStatusActive || len(subscription.Items) != 1 {
		return nil, apperrors.NewBadRequestError("Paddle subscription cannot be upgraded automatically")
	}
	providerPlan, period, ok := h.paddle.planAndPeriodForPrice(subscription.Items[0].Price.ID)
	if !ok || providerPlan != currentPlan {
		return nil, apperrors.NewConflictError("Paddle subscription does not match the current plan")
	}
	priceID := strings.TrimSpace(h.paddle.Prices[targetPlan][period])
	if priceID == "" {
		return nil, apperrors.NewServiceUnavailableError("target Paddle price is not configured")
	}
	return &paddleSubscriptionUpgradeTarget{plan: targetPlan, period: period, priceID: priceID, subscriptionID: subscriptionID}, nil
}

func paddlePreviewUpgradeRequest(tenantID uint64, config PaddleConfig, target *paddleSubscriptionUpgradeTarget) *paddle.PreviewSubscriptionUpdateRequest {
	items := []paddle.PreviewSubscriptionUpdateItems{*paddle.NewPreviewSubscriptionUpdateItemsSubscriptionUpdateItemFromCatalog(&paddle.SubscriptionUpdateItemFromCatalog{
		PriceID:  target.priceID,
		Quantity: 1,
	})}
	customData := paddle.CustomData{
		"tenant_id":              strconv.FormatUint(tenantID, 10),
		"musuw_checkout_binding": config.checkoutBinding(tenantID, target.priceID),
	}
	return &paddle.PreviewSubscriptionUpdateRequest{
		SubscriptionID:       target.subscriptionID,
		Items:                paddle.NewPatchField(items),
		CustomData:           paddle.NewPatchField(customData),
		ProrationBillingMode: paddle.NewPatchField(paddle.ProrationBillingModeProratedImmediately),
		OnPaymentFailure:     paddle.NewPatchField(paddle.SubscriptionOnPaymentFailurePreventChange),
	}
}

func paddleApplyUpgradeRequest(tenantID uint64, config PaddleConfig, target *paddleSubscriptionUpgradeTarget, operationKey string) *paddle.UpdateSubscriptionRequest {
	items := []paddle.UpdateSubscriptionItems{*paddle.NewUpdateSubscriptionItemsSubscriptionUpdateItemFromCatalog(&paddle.SubscriptionUpdateItemFromCatalog{
		PriceID:  target.priceID,
		Quantity: 1,
	})}
	customData := paddle.CustomData{
		"tenant_id":                   strconv.FormatUint(tenantID, 10),
		"musuw_checkout_binding":      config.checkoutBinding(tenantID, target.priceID),
		"musuw_billing_operation_key": strings.TrimSpace(operationKey),
	}
	return &paddle.UpdateSubscriptionRequest{
		SubscriptionID:       target.subscriptionID,
		Items:                paddle.NewPatchField(items),
		CustomData:           paddle.NewPatchField(customData),
		ProrationBillingMode: paddle.NewPatchField(paddle.ProrationBillingModeProratedImmediately),
		OnPaymentFailure:     paddle.NewPatchField(paddle.SubscriptionOnPaymentFailurePreventChange),
	}
}

func (h *EntitlementHandler) PaddleSubscriptionUpgradePreview(c *gin.Context) {
	tenantID, ok := types.TenantIDFromContext(c.Request.Context())
	if !ok || tenantID == 0 {
		_ = c.Error(apperrors.NewUnauthorizedError("authentication required"))
		return
	}
	var request paddleSubscriptionUpgradeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		_ = c.Error(apperrors.NewBadRequestError("target plan is required"))
		return
	}
	target, err := h.paddleSubscriptionUpgradeTarget(c.Request.Context(), tenantID, request.Plan)
	if err != nil {
		_ = c.Error(err)
		return
	}
	preview, err := h.subscriptions.PreviewSubscriptionUpdate(c.Request.Context(), paddlePreviewUpgradeRequest(tenantID, h.paddle, target))
	if err != nil {
		logger.Errorf(c.Request.Context(), "Paddle subscription upgrade preview failed tenant_id=%d target_plan=%s: %v", tenantID, target.plan, err)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle upgrade preview is temporarily unavailable"))
		return
	}
	if preview == nil || preview.UpdateSummary == nil || preview.ImmediateTransaction == nil || preview.NextBilledAt == nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle returned an incomplete upgrade preview"))
		return
	}
	immediate := preview.ImmediateTransaction.Details.Totals
	recurring := preview.RecurringTransactionDetails.Totals
	currency := recurring.CurrencyCode
	if strings.TrimSpace(immediate.Subtotal) == "" || strings.TrimSpace(immediate.Tax) == "" || strings.TrimSpace(immediate.Balance) == "" ||
		strings.TrimSpace(recurring.Total) == "" ||
		currency == "" || immediate.CurrencyCode != currency || preview.UpdateSummary.Result.CurrencyCode != currency || strings.TrimSpace(*preview.NextBilledAt) == "" {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle returned an incomplete upgrade preview"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"plan":              target.plan,
		"period":            target.period,
		"action":            preview.UpdateSummary.Result.Action,
		"prorated_subtotal": immediate.Subtotal,
		"prorated_tax":      immediate.Tax,
		"due_today":         immediate.Balance,
		"recurring_total":   recurring.Total,
		"currency_code":     currency,
		"next_billed_at":    *preview.NextBilledAt,
	})
}

func (h *EntitlementHandler) PaddleSubscriptionUpgrade(c *gin.Context) {
	tenantID, ok := types.TenantIDFromContext(c.Request.Context())
	if !ok || tenantID == 0 {
		_ = c.Error(apperrors.NewUnauthorizedError("authentication required"))
		return
	}
	var request paddleSubscriptionUpgradeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		_ = c.Error(apperrors.NewBadRequestError("target plan is required"))
		return
	}
	if !validPaddleOperationKey(request.OperationKey) || h.operations == nil {
		_ = c.Error(apperrors.NewBadRequestError("a valid upgrade operation key is required"))
		return
	}
	request.Plan = types.NormalizeConsumerPlan(request.Plan)
	operationKey := strings.TrimSpace(request.OperationKey)
	existing, found, err := h.operations.FindByKey(c.Request.Context(), tenantID, operationKey)
	if err != nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle subscription upgrade is temporarily unavailable"))
		return
	}
	if found {
		if existing.OperationType != types.PaddleBillingOperationUpgrade || existing.Plan != request.Plan {
			_ = c.Error(apperrors.NewConflictError("upgrade operation key was already used for another request"))
			return
		}
		if existing.Status == types.PaddleBillingOperationInFlight || existing.Status == types.PaddleBillingOperationSucceeded {
			c.JSON(http.StatusAccepted, gin.H{"pending": true, "plan": existing.Plan})
			return
		}
		_ = c.Error(apperrors.NewConflictError("subscription upgrade requires provider reconciliation"))
		return
	}
	target, err := h.paddleSubscriptionUpgradeTarget(c.Request.Context(), tenantID, request.Plan)
	if err != nil {
		_ = c.Error(err)
		return
	}
	intent := types.PaddleBillingOperationIntent{
		TenantID: tenantID, OperationKey: operationKey,
		OperationType: types.PaddleBillingOperationUpgrade, Plan: target.plan,
		BillingPeriod: target.period, PriceID: target.priceID, SubscriptionID: target.subscriptionID,
	}
	intent.RequestFingerprint = paddleBillingOperationFingerprint(intent.OperationType, intent.Plan, intent.BillingPeriod, intent.PriceID, intent.SubscriptionID)
	operation, disposition, err := h.operations.Claim(c.Request.Context(), intent)
	if errors.Is(err, interfaces.ErrPaddleBillingOperationKeyConflict) {
		_ = c.Error(apperrors.NewConflictError("upgrade operation key was already used for another request"))
		return
	}
	if err != nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle subscription upgrade is temporarily unavailable"))
		return
	}
	if !samePaddleBillingOperation(operation, intent) {
		_ = c.Error(apperrors.NewConflictError("another billing operation is already in progress"))
		return
	}
	if disposition != types.PaddleBillingOperationClaimCreated {
		if operation.Status == types.PaddleBillingOperationInFlight || operation.Status == types.PaddleBillingOperationSucceeded {
			c.JSON(http.StatusAccepted, gin.H{"pending": true, "plan": target.plan})
			return
		}
		_ = c.Error(apperrors.NewConflictError("subscription upgrade requires provider reconciliation"))
		return
	}
	if err := h.operations.MarkInFlight(c.Request.Context(), operation.ID); err != nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle subscription upgrade is temporarily unavailable"))
		return
	}
	updated, err := h.subscriptions.UpdateSubscription(c.Request.Context(), paddleApplyUpgradeRequest(tenantID, h.paddle, target, operationKey))
	if err != nil {
		_ = h.operations.Finish(c.Request.Context(), operation.ID, types.PaddleBillingOperationUncertain, `{}`, err.Error())
		logger.Errorf(c.Request.Context(), "Paddle subscription upgrade failed tenant_id=%d target_plan=%s: %v", tenantID, target.plan, err)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle subscription upgrade is temporarily unavailable; retrying will not submit another change"))
		return
	}
	if updated == nil || strings.TrimSpace(updated.ID) != target.subscriptionID {
		_ = h.operations.Finish(c.Request.Context(), operation.ID, types.PaddleBillingOperationUncertain, `{}`, "Paddle returned an incomplete subscription update")
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle returned an incomplete subscription update"))
		return
	}
	logger.Infof(c.Request.Context(), "Paddle subscription upgrade accepted tenant_id=%d target_plan=%s", tenantID, target.plan)
	// The signed subscription.updated webhook remains the only authority that
	// updates the plan and the existing OpenRouter child-key spend limit.
	c.JSON(http.StatusAccepted, gin.H{"pending": true, "plan": target.plan})
}

type paddleEvent struct {
	EventID    string          `json:"event_id"`
	EventType  string          `json:"event_type"`
	OccurredAt time.Time       `json:"occurred_at"`
	Data       paddleEventData `json:"data"`
}

type paddleEventData struct {
	ID                   string               `json:"id"`
	Status               string               `json:"status"`
	Origin               string               `json:"origin"`
	CustomerID           string               `json:"customer_id"`
	SubscriptionID       string               `json:"subscription_id"`
	CustomData           json.RawMessage      `json:"custom_data"`
	BillingPeriod        *paddleBillingPeriod `json:"billing_period"`
	CurrentBillingPeriod *paddleBillingPeriod `json:"current_billing_period"`
	Items                []struct {
		Price struct {
			ID string `json:"id"`
		} `json:"price"`
	} `json:"items"`
}

func (h *EntitlementHandler) enqueuePaddleWebhook(c *gin.Context, payload types.PaddleWebhookTaskPayload) bool {
	if h.tasks == nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle event queue is unavailable"))
		return false
	}
	if err := payload.Validate(); err != nil {
		_ = c.Error(apperrors.NewBadRequestError("Paddle event shape is invalid"))
		return false
	}
	taskBody, err := json.Marshal(payload)
	if err != nil {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle event queue is unavailable"))
		return false
	}
	options := []asynq.Option{
		asynq.Queue(types.QueueBilling),
		asynq.MaxRetry(types.PaddleWebhookTaskMaxRetry),
		asynq.Timeout(types.PaddleWebhookTaskTimeout),
	}
	if taskID := utils.PaddleWebhookTaskID(payload.EventID); taskID != "" {
		options = append(options, asynq.TaskID(taskID))
	}
	_, err = h.tasks.Enqueue(asynq.NewTask(types.TypePaddleWebhook, taskBody), options...)
	if err != nil && !errors.Is(err, asynq.ErrTaskIDConflict) && !errors.Is(err, asynq.ErrDuplicateTask) {
		logger.Errorf(c.Request.Context(), "Paddle billing event enqueue failed event_id=%s: %v", payload.EventID, err)
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle event queue is temporarily unavailable"))
		return false
	}
	logger.Infof(c.Request.Context(), "Paddle billing event queued event_id=%s event_type=%s tenant_id=%d", payload.EventID, payload.EventType, payload.TenantID)
	return true
}

type paddleBillingPeriod struct {
	StartsAt time.Time `json:"starts_at"`
	EndsAt   time.Time `json:"ends_at"`
}

func (h *EntitlementHandler) PaddleWebhook(c *gin.Context) {
	if !h.paddle.Configured() {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle billing is not configured"))
		return
	}
	if err := verifyPaddleRequest(h.paddle.WebhookSecret, c.Request); err != nil {
		_ = c.Error(apperrors.NewUnauthorizedError("invalid Paddle signature"))
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1024*1024+1))
	if err != nil || len(body) > 1024*1024 {
		_ = c.Error(apperrors.NewBadRequestError("invalid Paddle webhook body"))
		return
	}
	var event paddleEvent
	if err := json.Unmarshal(body, &event); err != nil || event.EventID == "" || event.OccurredAt.IsZero() {
		_ = c.Error(apperrors.NewBadRequestError("invalid Paddle event"))
		return
	}
	isSubscriptionEvent := isEntitlementPaddleEvent(event.EventType)
	isRecurringCompletion := event.EventType == "transaction.completed" && event.Data.Status == "completed" && event.Data.Origin == "subscription_recurring"
	if !isSubscriptionEvent && !isRecurringCompletion {
		c.JSON(http.StatusOK, gin.H{"ok": true, "applied": false})
		return
	}
	tenantID, err := paddleTenantID(event.Data.CustomData)
	if err != nil {
		_ = c.Error(apperrors.NewBadRequestError("Paddle event has no valid tenant_id"))
		return
	}
	plan, status, priceID, billingPeriod, err := h.paddle.planForEvent(event)
	if err != nil {
		_ = c.Error(err)
		return
	}
	if !h.paddle.validCheckoutBinding(tenantID, priceID, paddleCheckoutBinding(event.Data.CustomData)) {
		_ = c.Error(apperrors.NewUnauthorizedError("Paddle checkout binding is invalid"))
		return
	}
	subscriptionID := event.Data.SubscriptionID
	if subscriptionID == "" && strings.HasPrefix(event.EventType, "subscription.") {
		subscriptionID = event.Data.ID
	}
	payload := types.PaddleWebhookTaskPayload{
		TenantID: tenantID, Plan: plan, Status: status, BillingPeriod: billingPeriod,
		EventID: event.EventID, EventType: event.EventType, OccurredAt: event.OccurredAt,
		CustomerID: event.Data.CustomerID, SubscriptionID: subscriptionID, PriceID: priceID,
	}
	if isRecurringCompletion {
		if event.Data.BillingPeriod == nil || event.Data.BillingPeriod.EndsAt.IsZero() {
			_ = c.Error(apperrors.NewBadRequestError("Paddle recurring transaction has no billing period"))
			return
		}
		periodEnd := event.Data.BillingPeriod.EndsAt.UTC()
		payload.Operation = types.PaddleWebhookTaskOperationRefreshPaidAllowance
		payload.EventPeriodEnd = &periodEnd
	} else {
		payload.Operation = types.PaddleWebhookTaskOperationApplyConsumerPlan
		payload.EventPeriodEnd = entitledPaddlePeriodEnd(event.EventType, status, event.Data.CurrentBillingPeriod)
		if operationKey := paddleBillingOperationKey(event.Data.CustomData); validPaddleOperationKey(operationKey) {
			payload.BillingOperationKey = operationKey
			switch event.EventType {
			case "subscription.created", "subscription.activated":
				payload.BillingOperationType = types.PaddleBillingOperationCheckout
			case "subscription.updated":
				payload.BillingOperationType = types.PaddleBillingOperationUpgrade
			}
		}
	}
	if !h.enqueuePaddleWebhook(c, payload) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "queued": true})
}

// Paddle sends subscription.updated at the start of renewal, before payment is
// collected, and past_due already points at that unpaid period. Only initial
// creation/activation (or an intentional trial) may seed the boundary here;
// successful recurring transactions advance renewals separately above.
func entitledPaddlePeriodEnd(eventType, status string, period *paddleBillingPeriod) *time.Time {
	if period == nil || period.EndsAt.IsZero() {
		return nil
	}
	if eventType != "subscription.created" && eventType != "subscription.activated" && eventType != "subscription.trialing" {
		return nil
	}
	if status != "active" && status != "trialing" {
		return nil
	}
	value := period.EndsAt.UTC()
	return &value
}

func isEntitlementPaddleEvent(eventType string) bool {
	switch eventType {
	case "subscription.created", "subscription.activated", "subscription.trialing", "subscription.past_due", "subscription.resumed", "subscription.updated", "subscription.canceled", "subscription.paused":
		return true
	default:
		return false
	}
}

func (c PaddleConfig) planForEvent(event paddleEvent) (types.ConsumerPlan, string, string, string, error) {
	if len(event.Data.Items) != 1 {
		return "", "", "", "", apperrors.NewBadRequestError("Paddle subscription must contain exactly one known price")
	}
	matchedPrice := strings.TrimSpace(event.Data.Items[0].Price.ID)
	matchedPlan, matchedPeriod, ok := c.planAndPeriodForPrice(matchedPrice)
	if !ok {
		return "", "", "", "", apperrors.NewBadRequestError("Paddle event contains no known price")
	}
	status := event.Data.Status
	if event.EventType == "subscription.canceled" {
		if status == "" {
			status = strings.TrimPrefix(event.EventType, "subscription.")
		}
		return types.ConsumerPlanFree, status, matchedPrice, matchedPeriod, nil
	}
	if status == "" {
		if event.EventType == "subscription.paused" {
			status = "paused"
		} else {
			status = "active"
		}
	}
	return matchedPlan, status, matchedPrice, matchedPeriod, nil
}

func paddleCheckoutBinding(raw json.RawMessage) string {
	var custom struct {
		CheckoutBinding string `json:"musuw_checkout_binding"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &custom) != nil {
		return ""
	}
	return strings.TrimSpace(custom.CheckoutBinding)
}

func paddleBillingOperationKey(raw json.RawMessage) string {
	var custom struct {
		OperationKey string `json:"musuw_billing_operation_key"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &custom) != nil {
		return ""
	}
	return strings.TrimSpace(custom.OperationKey)
}

func paddleTenantID(raw json.RawMessage) (uint64, error) {
	var custom struct {
		TenantID json.RawMessage `json:"tenant_id"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &custom) != nil || len(custom.TenantID) == 0 {
		return 0, fmt.Errorf("missing custom data")
	}
	var text string
	if err := json.Unmarshal(custom.TenantID, &text); err != nil {
		text = string(custom.TenantID)
	}
	text = strings.TrimSpace(text)
	id, err := strconv.ParseUint(text, 10, 64)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("invalid tenant_id")
	}
	return id, nil
}

func verifyPaddleRequest(secret string, request *http.Request) error {
	if strings.TrimSpace(secret) == "" {
		return fmt.Errorf("Paddle webhook secret is missing")
	}
	verified, err := paddle.NewWebhookVerifier(
		secret,
		paddle.VerifierWithTimestampTolerance(paddleSignatureTolerance),
	).Verify(request)
	if err != nil {
		return err
	}
	if !verified {
		return fmt.Errorf("Paddle signature mismatch")
	}
	return nil
}
