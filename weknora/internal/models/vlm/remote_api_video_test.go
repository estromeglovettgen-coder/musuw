package vlm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRemoteAPIVLMPredictVideoUsesOpenRouterVideoURL(t *testing.T) {
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
		ModelName: "google/gemini-2.5-flash",
		APIKey:    "openrouter-test-key",
		Provider:  "openrouter",
	})
	if err != nil {
		t.Fatalf("NewRemoteAPIVLM: %v", err)
	}

	got, err := model.PredictVideo(context.Background(), []byte("tiny-video"), "video/mp4", "Describe it")
	if err != nil {
		t.Fatalf("PredictVideo: %v", err)
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
	if requestBody["model"] != "google/gemini-2.5-flash" {
		t.Fatalf("model = %#v", requestBody["model"])
	}
	messages := requestBody["messages"].([]any)
	content := messages[0].(map[string]any)["content"].([]any)
	videoPart := content[1].(map[string]any)
	if videoPart["type"] != "video_url" {
		t.Fatalf("video part = %#v", videoPart)
	}
	videoURL := videoPart["video_url"].(map[string]any)["url"].(string)
	if !strings.HasPrefix(videoURL, "data:video/mp4;base64,") {
		t.Fatalf("video URL = %q", videoURL)
	}
}
