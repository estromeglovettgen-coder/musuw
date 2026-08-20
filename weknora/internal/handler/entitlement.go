package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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
	"github.com/gin-gonic/gin"
)

const paddleSignatureTolerance = 5 * time.Minute

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
	priceID = strings.TrimSpace(priceID)
	for _, plan := range []types.ConsumerPlan{types.ConsumerPlanPlus, types.ConsumerPlanPro, types.ConsumerPlanMax} {
		for _, mapped := range c.Prices[plan] {
			if mapped == priceID {
				return plan, true
			}
		}
	}
	return "", false
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
	if !configured || plan != types.ConsumerPlanFree || tenantID == 0 {
		return response
	}
	prices := map[string]map[string]gin.H{}
	for _, paidPlan := range []types.ConsumerPlan{types.ConsumerPlanPlus, types.ConsumerPlanPro, types.ConsumerPlanMax} {
		prices[string(paidPlan)] = map[string]gin.H{}
		for _, period := range []string{"monthly", "yearly"} {
			priceID := c.Prices[paidPlan][period]
			prices[string(paidPlan)][period] = gin.H{
				"price_id":         priceID,
				"checkout_binding": c.checkoutBinding(tenantID, priceID),
			}
		}
	}
	response["client_token"] = c.ClientToken
	response["tenant_id"] = strconv.FormatUint(tenantID, 10)
	response["prices"] = prices
	return response
}

type paddlePortalSessionCreator interface {
	CreateCustomerPortalSession(context.Context, *paddle.CreateCustomerPortalSessionRequest) (*paddle.CustomerPortalSession, error)
}

type EntitlementHandler struct {
	service interfaces.EntitlementService
	paddle  PaddleConfig
	portal  paddlePortalSessionCreator
}

func NewEntitlementHandler(service interfaces.EntitlementService) *EntitlementHandler {
	config := loadPaddleConfig()
	handler := &EntitlementHandler{service: service, paddle: config}
	if !config.PortalConfigured() {
		return handler
	}
	var err error
	if strings.EqualFold(config.Environment, "sandbox") {
		handler.portal, err = paddle.NewSandbox(config.APIKey)
	} else {
		handler.portal, err = paddle.New(config.APIKey)
	}
	if err != nil {
		logger.Errorf(context.Background(), "Paddle portal client initialization failed: %v", err)
		handler.portal = nil
	}
	return handler
}

func (h *EntitlementHandler) Current(c *gin.Context) {
	current, err := h.service.Current(c.Request.Context(), time.Now())
	if err != nil {
		_ = c.Error(err)
		return
	}
	tenantID, _ := types.TenantIDFromContext(c.Request.Context())
	portalAvailable := h.portal != nil && strings.TrimSpace(current.PaddleCustomerID) != ""
	c.JSON(http.StatusOK, gin.H{"data": current, "billing": h.paddle.billingResponse(tenantID, current.Plan, portalAvailable)})
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

type paddleEvent struct {
	EventID    string          `json:"event_id"`
	EventType  string          `json:"event_type"`
	OccurredAt time.Time       `json:"occurred_at"`
	Data       paddleEventData `json:"data"`
}

type paddleEventData struct {
	ID             string          `json:"id"`
	Status         string          `json:"status"`
	CustomerID     string          `json:"customer_id"`
	SubscriptionID string          `json:"subscription_id"`
	CustomData     json.RawMessage `json:"custom_data"`
	Items          []struct {
		Price struct {
			ID string `json:"id"`
		} `json:"price"`
	} `json:"items"`
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

	if !isEntitlementPaddleEvent(event.EventType) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "applied": false})
		return
	}
	tenantID, err := paddleTenantID(event.Data.CustomData)
	if err != nil {
		_ = c.Error(apperrors.NewBadRequestError("Paddle event has no valid tenant_id"))
		return
	}
	plan, status, priceID, err := h.paddle.planForEvent(event)
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
	applied, err := h.service.ApplyConsumerPlan(c.Request.Context(), tenantID, plan, status, event.EventID, event.OccurredAt, event.Data.CustomerID, subscriptionID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	logger.Infof(c.Request.Context(), "Paddle subscription event processed event_id=%s event_type=%s tenant_id=%d plan=%s status=%s applied=%t",
		event.EventID, event.EventType, tenantID, plan, status, applied)
	c.JSON(http.StatusOK, gin.H{"ok": true, "applied": applied})
}

func isEntitlementPaddleEvent(eventType string) bool {
	switch eventType {
	case "subscription.created", "subscription.activated", "subscription.trialing", "subscription.past_due", "subscription.resumed", "subscription.updated", "subscription.canceled", "subscription.paused":
		return true
	default:
		return false
	}
}

func (c PaddleConfig) planForEvent(event paddleEvent) (types.ConsumerPlan, string, string, error) {
	var matchedPlan types.ConsumerPlan
	var matchedPrice string
	for _, item := range event.Data.Items {
		if plan, ok := c.planForPrice(item.Price.ID); ok {
			matchedPlan = plan
			matchedPrice = item.Price.ID
			break
		}
	}
	if matchedPlan == "" {
		return "", "", "", apperrors.NewBadRequestError("Paddle event contains no known price")
	}
	status := event.Data.Status
	if event.EventType == "subscription.canceled" || event.EventType == "subscription.paused" {
		if status == "" {
			status = strings.TrimPrefix(event.EventType, "subscription.")
		}
		return types.ConsumerPlanFree, status, matchedPrice, nil
	}
	if status == "" {
		status = "active"
	}
	return matchedPlan, status, matchedPrice, nil
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
