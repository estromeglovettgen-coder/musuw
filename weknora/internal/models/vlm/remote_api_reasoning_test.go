package vlm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type vlmMeterStub struct{}

func (*vlmMeterStub) OpenRouterAPIKey(context.Context) (string, error) {
	return "tenant-child-key", nil
}

func (*vlmMeterStub) OpenRouterUserID(context.Context) string { return "opaque-user" }

func TestRemoteAPIVLMPredictDisablesOpenRouterReasoning(t *testing.T) {
	var requestBody map[string]any
	var authorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:         server.URL + "/v1",
		ModelName:       "qwen/qwen3.7-flash",
		APIKey:          "openrouter-test-key",
		Provider:        "openrouter",
		OpenRouterMeter: &vlmMeterStub{},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	if _, err := model.Predict(context.Background(), [][]byte{[]byte("tiny-image")}, "Describe it"); err != nil {
		t.Fatalf("Predict: %v", err)
	}
	if _, ok := requestBody["reasoning_effort"]; ok {
		t.Fatalf("legacy reasoning_effort unexpectedly present: %#v", requestBody["reasoning_effort"])
	}
	reasoning, ok := requestBody["reasoning"].(map[string]any)
	if !ok || reasoning["effort"] != "none" {
		t.Fatalf("reasoning = %#v, want effort none", requestBody["reasoning"])
	}
	if authorization != "Bearer tenant-child-key" {
		t.Fatalf("authorization = %q, want tenant child key", authorization)
	}
	if requestBody["user"] != "opaque-user" {
		t.Fatalf("user = %#v, want stable opaque attribution", requestBody["user"])
	}
}

func TestRemoteAPIVLMPredictDoesNotAddReasoningForOpenAI(t *testing.T) {
	var requestBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   server.URL + "/v1",
		ModelName: "gpt-4o",
		APIKey:    "openai-test-key",
		Provider:  "openai",
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	if _, err := model.Predict(context.Background(), [][]byte{[]byte("tiny-image")}, "Describe it"); err != nil {
		t.Fatalf("Predict: %v", err)
	}
	if _, ok := requestBody["reasoning"]; ok {
		t.Fatalf("reasoning unexpectedly present for OpenAI request: %#v", requestBody["reasoning"])
	}
}
