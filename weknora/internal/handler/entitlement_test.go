package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestVerifyPaddleSignature(t *testing.T) {
	secret := "pdl_secret"
	body := []byte(`{"event_id":"evt_1"}`)
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	ts := now.Unix()
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", ts, body)))
	header := fmt.Sprintf("ts=%d;h1=%s", ts, hex.EncodeToString(mac.Sum(nil)))

	assert.NoError(t, verifyPaddleSignature(secret, header, body, now))
	assert.Error(t, verifyPaddleSignature(secret, header+"00", body, now))
	assert.Error(t, verifyPaddleSignature(secret, header, body, now.Add(6*time.Minute)))
}

func TestPaddlePlanMappingRequiresKnownServerPrice(t *testing.T) {
	config := PaddleConfig{PricePlans: map[string]string{"pri_plus": "plus"}}
	plan, ok := config.planForPrice("pri_plus")
	assert.True(t, ok)
	assert.Equal(t, "plus", string(plan))

	_, ok = config.planForPrice("pri_attacker")
	assert.False(t, ok)
}

func TestPaddleCancellationStillRequiresKnownServerPrice(t *testing.T) {
	config := PaddleConfig{PricePlans: map[string]string{"pri_plus": "plus"}}
	event := paddleEvent{EventType: "subscription.canceled"}
	event.Data.Items = append(event.Data.Items, struct {
		Price struct {
			ID string `json:"id"`
		} `json:"price"`
	}{})
	event.Data.Items[0].Price.ID = "pri_attacker"
	_, _, err := config.planForEvent(event)
	assert.Error(t, err)

	event.Data.Items[0].Price.ID = "pri_plus"
	plan, status, err := config.planForEvent(event)
	assert.NoError(t, err)
	assert.Equal(t, "free", string(plan))
	assert.Equal(t, "canceled", status)
}
