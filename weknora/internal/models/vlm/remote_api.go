package vlm

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/models/provider"
	secutils "github.com/Tencent/WeKnora/internal/utils"
	openai "github.com/sashabaranov/go-openai"
)

const (
	// defaultTimeout is the fallback HTTP timeout for a single VLM request.
	// Dense scanned-PDF OCR (full-page text + layout extraction) can take well
	// over a minute on slow endpoints, so this is intentionally generous and
	// can be raised further via VLM_HTTP_TIMEOUT_SECONDS.
	defaultTimeout = 180 * time.Second
	defaultMaxToks = 5000
	defaultTemp    = float32(0.1)
	// OpenRouterGeminiVideoModel is the only model admitted by Musuw's video path.
	OpenRouterGeminiVideoModel = "google/gemini-2.5-flash"
)

// vlmHTTPTimeout returns the HTTP client timeout for VLM requests, read from
// the VLM_HTTP_TIMEOUT_SECONDS env var when set (and positive), falling back to
// defaultTimeout otherwise. Shared by all OpenAI-compatible VLM backends.
func vlmHTTPTimeout() time.Duration {
	if v := strings.TrimSpace(os.Getenv("VLM_HTTP_TIMEOUT_SECONDS")); v != "" {
		if secs, err := strconv.Atoi(v); err == nil && secs > 0 {
			return time.Duration(secs) * time.Second
		}
	}
	return defaultTimeout
}

// RemoteAPIVLM implements VLM via an OpenAI-compatible chat completions API.
type RemoteAPIVLM struct {
	modelName   string
	modelID     string
	client      *openai.Client
	httpClient  *http.Client
	baseURL     string
	apiKey      string
	provider    provider.ProviderName
	temperature float32
}

// NewRemoteAPIVLM creates a remote-API backed VLM instance.
func NewRemoteAPIVLM(config *Config) (*RemoteAPIVLM, error) {
	if err := validateVLMBaseURL(config.BaseURL); err != nil {
		return nil, err
	}

	providerName := provider.ProviderName(config.Provider)
	if providerName == "" {
		providerName = provider.DetectProvider(config.BaseURL)
	}

	var apiCfg openai.ClientConfig
	if providerName == provider.ProviderAzureOpenAI {
		apiCfg = openai.DefaultAzureConfig(config.APIKey, config.BaseURL)
		apiCfg.AzureModelMapperFunc = func(model string) string {
			return model
		}
		if config.Extra != nil {
			if v, ok := config.Extra["api_version"]; ok {
				if vs, ok := v.(string); ok && vs != "" {
					apiCfg.APIVersion = vs
				}
			}
		}
	} else {
		apiCfg = openai.DefaultConfig(config.APIKey)
		if config.BaseURL != "" {
			apiCfg.BaseURL = config.BaseURL
		}
	}
	httpClient := newVLMHTTPClient(vlmHTTPTimeout())

	// 注入用户自定义 HTTP header（类似 OpenAI Python SDK 的 extra_headers）
	requestClient := httpClient
	if len(config.CustomHeaders) > 0 {
		requestClient = secutils.WrapHTTPClientWithHeaders(httpClient, config.CustomHeaders)
	}
	apiCfg.HTTPClient = requestClient

	temp := defaultTemp
	if config.Extra != nil {
		if v, ok := config.Extra["temperature"]; ok {
			if vs, ok := v.(string); ok {
				if f, err := strconv.ParseFloat(vs, 32); err == nil {
					temp = float32(f)
				}
			}
		}
	}

	return &RemoteAPIVLM{
		modelName:   config.ModelName,
		modelID:     config.ModelID,
		client:      openai.NewClientWithConfig(apiCfg),
		httpClient:  requestClient,
		baseURL:     config.BaseURL,
		apiKey:      config.APIKey,
		provider:    providerName,
		temperature: temp,
	}, nil
}

// Predict sends an image with a text prompt to the OpenAI-compatible API.
func (v *RemoteAPIVLM) Predict(ctx context.Context, imgBytesList [][]byte, prompt string) (string, error) {
	var parts []openai.ChatMessagePart

	// Add text prompt first
	parts = append(parts, openai.ChatMessagePart{
		Type: openai.ChatMessagePartTypeText,
		Text: prompt,
	})

	// Add images
	for _, imgBytes := range imgBytesList {
		if len(imgBytes) > 0 {
			mimeType := detectImageMIME(imgBytes)
			b64 := base64.StdEncoding.EncodeToString(imgBytes)
			dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, b64)
			parts = append(parts, openai.ChatMessagePart{
				Type: openai.ChatMessagePartTypeImageURL,
				ImageURL: &openai.ChatMessageImageURL{
					URL:    dataURI,
					Detail: openai.ImageURLDetailAuto,
				},
			})
		}
	}

	req := openai.ChatCompletionRequest{
		Model: v.modelName,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:         openai.ChatMessageRoleUser,
				MultiContent: parts,
			},
		},
		MaxTokens:   defaultMaxToks,
		Temperature: v.temperature,
	}

	totalImageSize := 0
	for _, img := range imgBytesList {
		totalImageSize += len(img)
	}
	logger.Infof(ctx, "[VLM] Calling OpenAI-compatible API, model=%s, baseURL=%s, numImages=%d, totalImageSize=%d",
		v.modelName, v.baseURL, len(imgBytesList), totalImageSize)

	resp, err := v.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("OpenAI VLM request: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("OpenAI VLM returned no choices")
	}

	content := resp.Choices[0].Message.Content
	logger.Infof(ctx, "[VLM] OpenAI response received, len=%d", len(content))
	return content, nil
}

func (v *RemoteAPIVLM) GetModelName() string { return v.modelName }
func (v *RemoteAPIVLM) GetModelID() string   { return v.modelID }

// PredictVideo sends a private video through OpenRouter's documented
// video_url chat-completions contract. It is intentionally pinned to Gemini
// 2.5 Flash so video ingestion cannot silently fall back to another model.
func (v *RemoteAPIVLM) PredictVideo(ctx context.Context, videoBytes []byte, mimeType, prompt string) (string, error) {
	if v.provider != provider.ProviderOpenRouter {
		return "", fmt.Errorf("video input requires OpenRouter")
	}
	if v.modelName != OpenRouterGeminiVideoModel {
		return "", fmt.Errorf("video input requires model %s", OpenRouterGeminiVideoModel)
	}
	if len(videoBytes) == 0 {
		return "", fmt.Errorf("video input is empty")
	}
	switch mimeType {
	case "video/mp4", "video/mpeg", "video/mov", "video/webm":
	default:
		return "", fmt.Errorf("unsupported OpenRouter video MIME type %q", mimeType)
	}

	dataURI := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(videoBytes)
	payload := map[string]any{
		"model": v.modelName,
		"messages": []map[string]any{{
			"role": "user",
			"content": []map[string]any{
				{"type": "text", "text": prompt},
				{"type": "video_url", "video_url": map[string]string{"url": dataURI}},
			},
		}},
		"max_tokens":  defaultMaxToks,
		"temperature": v.temperature,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal OpenRouter video request: %w", err)
	}
	endpoint := strings.TrimRight(v.baseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create OpenRouter video request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+v.apiKey)

	logger.Infof(ctx, "[VLM] Calling OpenRouter video API, model=%s, videoSize=%d", v.modelName, len(videoBytes))
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("OpenRouter video request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return "", fmt.Errorf("OpenRouter video request returned %s: %s", resp.Status, strings.TrimSpace(string(detail)))
	}
	var decoded struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return "", fmt.Errorf("decode OpenRouter video response: %w", err)
	}
	if len(decoded.Choices) == 0 || strings.TrimSpace(decoded.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("OpenRouter video response contained no text")
	}
	return decoded.Choices[0].Message.Content, nil
}

// detectImageMIME returns the MIME type for the given image bytes.
func detectImageMIME(data []byte) string {
	ct := http.DetectContentType(data)
	if strings.HasPrefix(ct, "image/") {
		return ct
	}
	return "image/png"
}
