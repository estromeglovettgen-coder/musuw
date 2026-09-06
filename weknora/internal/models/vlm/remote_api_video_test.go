package vlm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRemoteAPIVLMPredictVideoURLUsesConfiguredPublicURL(t *testing.T) {
	var requestPath string
	var authorization string
	var requestBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestPath = r.URL.Path
		authorization = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"# Video summary\nA blue square moves."}}]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   server.URL + "/api/v1",
		ModelName: "xiaomi/mimo-v2.5",
		APIKey:    "openrouter-test-key",
		Provider:  "openrouter",
		Extra:     map[string]any{"video_input_mode": VideoInputModeURL},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	videoURL := "https://objects.example.test/videos/tiny-video.mp4?signature=abc"
	got, err := model.PredictVideoURL(context.Background(), videoURL, "video/mp4", "Describe it")
	if err != nil {
		t.Fatalf("PredictVideoURL: %v", err)
	}
	if !strings.Contains(got, "blue square") {
		t.Fatalf("response = %q", got)
	}
	if requestPath != "/api/v1/chat/completions" {
		t.Fatalf("path = %q", requestPath)
	}
	if authorization != "Bearer openrouter-test-key" {
		t.Fatalf("authorization = %q", authorization)
	}
	if requestBody["model"] != "xiaomi/mimo-v2.5" {
		t.Fatalf("model = %#v", requestBody["model"])
	}
	if _, ok := requestBody["reasoning_effort"]; ok {
		t.Fatalf("legacy reasoning_effort unexpectedly present: %#v", requestBody["reasoning_effort"])
	}
	reasoning := requestBody["reasoning"].(map[string]any)
	if reasoning["effort"] != "none" {
		t.Fatalf("reasoning = %#v, want effort none", reasoning)
	}
	providerRouting := requestBody["provider"].(map[string]any)
	if providerRouting["allow_fallbacks"] != true {
		t.Fatalf("allow_fallbacks = %#v", providerRouting["allow_fallbacks"])
	}
	if _, ok := providerRouting["only"]; ok {
		t.Fatalf("provider only should be omitted for URL model: %#v", providerRouting)
	}
	messages := requestBody["messages"].([]any)
	content := messages[0].(map[string]any)["content"].([]any)
	videoPart := content[1].(map[string]any)
	if videoPart["type"] != "video_url" {
		t.Fatalf("video part = %#v", videoPart)
	}
	gotURL := videoPart["video_url"].(map[string]any)["url"].(string)
	if gotURL != videoURL {
		t.Fatalf("video URL = %q, want %q", gotURL, videoURL)
	}
}

func TestRemoteAPIVLMPredictVideoURLRejectsUnconfiguredModel(t *testing.T) {
	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   "http://127.0.0.1:1/api/v1",
		ModelName: "google/gemini-2.5-flash",
		Provider:  "openrouter",
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	_, err = model.PredictVideoURL(
		context.Background(),
		"https://objects.example.test/video.mp4",
		"video/mp4",
		"Describe it",
	)
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Fatalf("error = %v, want explicit capability error", err)
	}
}

func TestRemoteAPIVLMPredictVideoBase64KeepsGeminiVertex(t *testing.T) {
	var requestBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"# Video summary\nA native Gemini result."}}]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   server.URL + "/api/v1",
		ModelName: OpenRouterGeminiVideoModel,
		APIKey:    "openrouter-test-key",
		Provider:  "openrouter",
		Extra: map[string]any{
			"video_input_mode": VideoInputModeBase64,
			"video_provider":   "google-vertex",
		},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	if _, err := model.PredictVideo(
		context.Background(),
		[]byte("tiny-video"),
		"video/mp4",
		"Describe it",
	); err != nil {
		t.Fatalf("PredictVideo: %v", err)
	}
	providerRouting := requestBody["provider"].(map[string]any)
	providerOnly := providerRouting["only"].([]any)
	if len(providerOnly) != 1 || providerOnly[0] != "google-vertex" {
		t.Fatalf("provider only = %#v", providerOnly)
	}
	messages := requestBody["messages"].([]any)
	content := messages[0].(map[string]any)["content"].([]any)
	videoPart := content[1].(map[string]any)
	videoURL := videoPart["video_url"].(map[string]any)["url"].(string)
	if !strings.HasPrefix(videoURL, "data:video/mp4;base64,") {
		t.Fatalf("video URL = %q", videoURL)
	}
}

func TestRemoteAPIVLMPredictVideoKeepsLegacyQwenRuntimeRow(t *testing.T) {
	var requestBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"# Legacy Qwen video"}}]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   server.URL + "/api/v1",
		ModelName: OpenRouterQwenVideoModel,
		APIKey:    "openrouter-test-key",
		Provider:  "openrouter",
		// Existing database rows predate video_input_mode. They must retain
		// the old bounded Base64 + Alibaba behavior for small videos.
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	if _, err := model.PredictVideo(context.Background(), []byte("tiny-video"), "video/mp4", "Describe it"); err != nil {
		t.Fatalf("PredictVideo: %v", err)
	}
	providerRouting := requestBody["provider"].(map[string]any)
	providerOnly := providerRouting["only"].([]any)
	if len(providerOnly) != 1 || providerOnly[0] != "alibaba" {
		t.Fatalf("provider only = %#v", providerOnly)
	}
}

func TestRemoteAPIVLMPredictVideoBase64RejectsLargeInput(t *testing.T) {
	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   "http://127.0.0.1:1/api/v1",
		ModelName: OpenRouterGeminiVideoModel,
		Provider:  "openrouter",
		Extra:     map[string]any{"video_input_mode": VideoInputModeBase64},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	_, err = model.PredictVideo(context.Background(), make([]byte, maxInlineVideoBytes+1), "video/mp4", "Describe it")
	if err == nil || !strings.Contains(err.Error(), "inline Base64 limit") {
		t.Fatalf("error = %v, want inline Base64 limit", err)
	}
}

func TestRemoteAPIVLMPredictVideoReportsFinishReason(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"content_filter","message":{"content":""}}]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   server.URL + "/api/v1",
		ModelName: "xiaomi/mimo-v2.5",
		Provider:  "openrouter",
		Extra:     map[string]any{"video_input_mode": VideoInputModeURL},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	_, err = model.PredictVideoURL(
		context.Background(),
		"https://objects.example.test/video.mp4",
		"video/mp4",
		"Describe it",
	)
	if err == nil || !strings.Contains(err.Error(), "finish_reason=content_filter") {
		t.Fatalf("error = %v, want finish reason", err)
	}
	if IsRetryableVideoError(err) {
		t.Fatalf("content-filter failure must be permanent: %v", err)
	}
}

func TestRemoteAPIVLMPredictVideoReportsNoChoices(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[]}`))
	}))
	defer server.Close()

	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   server.URL + "/api/v1",
		ModelName: "xiaomi/mimo-v2.5",
		Provider:  "openrouter",
		Extra:     map[string]any{"video_input_mode": VideoInputModeURL},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	_, err = model.PredictVideoURL(
		context.Background(),
		"https://objects.example.test/video.mp4",
		"video/mp4",
		"Describe it",
	)
	if err == nil || !strings.Contains(err.Error(), "no choices") {
		t.Fatalf("error = %v, want no choices", err)
	}
	if !IsRetryableVideoError(err) {
		t.Fatalf("valid empty response should be retryable: %v", err)
	}
}

func TestRemoteAPIVLMPredictVideoClassifiesHTTPFailures(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		retryable bool
	}{
		{name: "rate limited", status: http.StatusTooManyRequests, retryable: true},
		{name: "server error", status: http.StatusBadGateway, retryable: true},
		{name: "request timeout", status: http.StatusRequestTimeout, retryable: true},
		{name: "bad parameters", status: http.StatusBadRequest, retryable: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				http.Error(w, "diagnostic body", tt.status)
			}))
			defer server.Close()

			withVLMSSRFWhitelist(t, "127.0.0.1")
			model, err := NewRemoteAPIVLM(&Config{
				BaseURL: server.URL, ModelName: "xiaomi/mimo-v2.5", Provider: "openrouter",
				Extra: map[string]any{"video_input_mode": VideoInputModeURL},
			})
			if err != nil {
				t.Fatalf("NewRemoteAPIVLM: %v", err)
			}
			_, err = model.PredictVideoURL(
				context.Background(), "https://objects.example.test/video.mp4", "video/mp4", "Describe it",
			)
			if err == nil {
				t.Fatal("PredictVideoURL unexpectedly succeeded")
			}
			if got := IsRetryableVideoError(err); got != tt.retryable {
				t.Fatalf("IsRetryableVideoError(%v) = %t, want %t", err, got, tt.retryable)
			}
		})
	}
}

func TestRemoteAPIVLMPredictVideoURLRequiresHTTPURL(t *testing.T) {
	withVLMSSRFWhitelist(t, "127.0.0.1")
	model, err := NewRemoteAPIVLM(&Config{
		BaseURL:   "http://127.0.0.1:1/api/v1",
		ModelName: "xiaomi/mimo-v2.5",
		Provider:  "openrouter",
		Extra:     map[string]any{"video_input_mode": VideoInputModeURL},
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	_, err = model.PredictVideoURL(context.Background(), "local://tenant/video.mp4", "video/mp4", "Describe it")
	if err == nil || !strings.Contains(err.Error(), "http or https") {
		t.Fatalf("error = %v, want HTTP URL validation", err)
	}
}
