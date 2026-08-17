package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	apperrors "github.com/Tencent/WeKnora/internal/errors"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/gin-gonic/gin"
)

const paddleSignatureTolerance = 5 * time.Minute

type PaddleConfig struct {
	Environment   string
	ClientToken   string
	WebhookSecret string
	PricePlans    map[string]string
}

func loadPaddleConfig() PaddleConfig {
	prices := map[string]string{}
	for _, item := range []struct {
		plan string
		keys []string
	}{
		{"plus", []string{"MUSUW_PADDLE_PLUS_MONTHLY_PRICE_ID", "MUSNOW_PADDLE_PERSONAL_MONTHLY_PRICE_ID"}},
		{"plus", []string{"MUSUW_PADDLE_PLUS_YEARLY_PRICE_ID", "MUSNOW_PADDLE_PERSONAL_YEARLY_PRICE_ID"}},
		{"pro", []string{"MUSUW_PADDLE_PRO_MONTHLY_PRICE_ID", "MUSNOW_PADDLE_PRO_MONTHLY_PRICE_ID"}},
		{"pro", []string{"MUSUW_PADDLE_PRO_YEARLY_PRICE_ID", "MUSNOW_PADDLE_PRO_YEARLY_PRICE_ID"}},
		{"max", []string{"MUSUW_PADDLE_MAX_MONTHLY_PRICE_ID"}},
		{"max", []string{"MUSUW_PADDLE_MAX_YEARLY_PRICE_ID"}},
	} {
		if price := firstEnv(item.keys...); price != "" {
			prices[price] = item.plan
		}
	}
	return PaddleConfig{
		Environment:   firstEnv("MUSUW_PADDLE_ENVIRONMENT", "MUSNOW_PADDLE_ENVIRONMENT"),
		ClientToken:   firstEnv("MUSUW_PADDLE_CLIENT_TOKEN", "MUSNOW_PADDLE_CLIENT_TOKEN"),
		WebhookSecret: firstEnv("MUSUW_PADDLE_WEBHOOK_SECRET", "MUSNOW_PADDLE_WEBHOOK_SECRET"),
		PricePlans:    prices,
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
	return c.ClientToken != "" && c.WebhookSecret != "" && len(c.PricePlans) > 0
}

func (c PaddleConfig) planForPrice(priceID string) (types.ConsumerPlan, bool) {
	plan, ok := c.PricePlans[strings.TrimSpace(priceID)]
	if !ok {
		return "", false
	}
	normalized := types.NormalizeConsumerPlan(types.ConsumerPlan(plan))
	return normalized, normalized != types.ConsumerPlanFree
}

type EntitlementHandler struct {
	service interfaces.EntitlementService
	paddle  PaddleConfig
}

func NewEntitlementHandler(service interfaces.EntitlementService) *EntitlementHandler {
	return &EntitlementHandler{service: service, paddle: loadPaddleConfig()}
}

func (h *EntitlementHandler) Current(c *gin.Context) {
	current, err := h.service.Current(c.Request.Context(), time.Now())
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data": current,
		"billing": gin.H{
			"configured":  h.paddle.Configured(),
			"environment": h.paddle.Environment,
		},
	})
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
	if h.paddle.WebhookSecret == "" || len(h.paddle.PricePlans) == 0 {
		_ = c.Error(apperrors.NewServiceUnavailableError("Paddle billing is not configured"))
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1024*1024+1))
	if err != nil || len(body) > 1024*1024 {
		_ = c.Error(apperrors.NewBadRequestError("invalid Paddle webhook body"))
		return
	}
	if err := verifyPaddleSignature(h.paddle.WebhookSecret, c.GetHeader("Paddle-Signature"), body, time.Now()); err != nil {
		_ = c.Error(apperrors.NewUnauthorizedError("invalid Paddle signature"))
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
	plan, status, err := h.paddle.planForEvent(event)
	if err != nil {
		_ = c.Error(err)
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
	c.JSON(http.StatusOK, gin.H{"ok": true, "applied": applied})
}

func isEntitlementPaddleEvent(eventType string) bool {
	switch eventType {
	case "transaction.completed", "subscription.created", "subscription.activated", "subscription.resumed", "subscription.updated", "subscription.canceled", "subscription.paused":
		return true
	default:
		return false
	}
}

func (c PaddleConfig) planForEvent(event paddleEvent) (types.ConsumerPlan, string, error) {
	var matchedPlan types.ConsumerPlan
	for _, item := range event.Data.Items {
		if plan, ok := c.planForPrice(item.Price.ID); ok {
			matchedPlan = plan
			break
		}
	}
	if matchedPlan == "" {
		return "", "", apperrors.NewBadRequestError("Paddle event contains no known price")
	}
	status := event.Data.Status
	if event.EventType == "subscription.canceled" || event.EventType == "subscription.paused" {
		if status == "" {
			status = strings.TrimPrefix(event.EventType, "subscription.")
		}
		return types.ConsumerPlanFree, status, nil
	}
	if status == "" || event.EventType == "transaction.completed" {
		status = "active"
	}
	return matchedPlan, status, nil
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

func verifyPaddleSignature(secret, header string, body []byte, now time.Time) error {
	var timestamp int64
	var signatures []string
	for _, part := range strings.Split(header, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		switch key {
		case "ts":
			timestamp, _ = strconv.ParseInt(value, 10, 64)
		case "h1":
			signatures = append(signatures, value)
		}
	}
	if secret == "" || timestamp == 0 || len(signatures) == 0 {
		return fmt.Errorf("incomplete signature")
	}
	signedAt := time.Unix(timestamp, 0)
	if delta := now.Sub(signedAt); delta > paddleSignatureTolerance || delta < -paddleSignatureTolerance {
		return fmt.Errorf("signature timestamp outside tolerance")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(strconv.FormatInt(timestamp, 10) + ":" + string(body)))
	expected := mac.Sum(nil)
	for _, signature := range signatures {
		decoded, err := hex.DecodeString(signature)
		if err == nil && hmac.Equal(expected, decoded) {
			return nil
		}
	}
	return fmt.Errorf("signature mismatch")
}
