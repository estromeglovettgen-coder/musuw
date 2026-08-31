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
	modelopenrouter "github.com/Tencent/WeKnora/internal/models/openrouter"
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
	// Keep video ingestion on exact OpenRouter models with provider endpoints
	// that advertise native base64 video support. Tokyo's default VLM is Gemini;
	// Qwen remains admitted for the historical regional fallback route.
	OpenRouterQwenVideoModel   = "qwen/qwen3.7-flash"
	OpenRouterGeminiVideoModel = "google/gemini-2.5-flash"
)

var openRouterVideoProviders = map[string]string{
	OpenRouterQwenVideoModel:   "alibaba",
	OpenRouterGeminiVideoModel: "google-vertex",
}

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

type openRouterReasoning struct {
	Effort string `json:"effort"`
}

type openRouterImageRequest struct {
	openai.ChatCompletionRequest
	Reasoning *openRouterReasoning `json:"reasoning,omitempty"`
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
	if providerName == provider.ProviderOpenRouter && config.OpenRouterMeter != nil {
		httpClient = modelopenrouter.WrapHTTPClient(httpClient, config.OpenRouterMeter)
	}

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
	shapeReasoningVLMRequest(&req)
	totalImageSize := 0
	for _, img := range imgBytesList {
		totalImageSize += len(img)
	}
	logger.Infof(ctx, "[VLM] Calling OpenAI-compatible API, model=%s, baseURL=%s, numImages=%d, totalImageSize=%d",
		v.modelName, v.baseURL, len(imgBytesList), totalImageSize)

	var resp openai.ChatCompletionResponse
	var err error
	if v.provider == provider.ProviderOpenRouter {
		// OpenRouter's native control is the nested reasoning object. Its
		// reasoning_effort compatibility field is not supported by every model
		// and can be rejected even when reasoning itself is optional.
		resp, err = v.createOpenRouterImageCompletion(ctx, req)
	} else {
		resp, err = v.client.CreateChatCompletion(ctx, req)
	}
	if err != nil {
		return "", fmt.Errorf("OpenAI VLM request: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("OpenAI VLM returned no choices")
	}

	choice := resp.Choices[0]
	content := choice.Message.Content
	if strings.TrimSpace(content) == "" && choice.FinishReason == openai.FinishReasonLength {
		// Reasoning models spend max_completion_tokens on reasoning before any
		// visible output, so an exhausted budget yields an empty message rather
		// than an API error. Returning "" here would be recorded as
		// "no_extracted_content" and look identical to an image with no text.
		return "", fmt.Errorf(
			"OpenAI VLM returned no content: completion truncated at %d tokens (finish_reason=length)",
			defaultMaxToks,
		)
	}
	logger.Infof(ctx, "[VLM] OpenAI response received, len=%d", len(content))
	return content, nil
}

func (v *RemoteAPIVLM) createOpenRouterImageCompletion(
	ctx context.Context,
	req openai.ChatCompletionRequest,
) (openai.ChatCompletionResponse, error) {
	payload := openRouterImageRequest{
		ChatCompletionRequest: req,
		Reasoning:             &openRouterReasoning{Effort: "none"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return openai.ChatCompletionResponse{}, fmt.Errorf("marshal OpenRouter VLM request: %w", err)
	}
	endpoint := strings.TrimRight(v.baseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return openai.ChatCompletionResponse{}, fmt.Errorf("create OpenRouter VLM request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+v.apiKey)

	httpResp, err := v.httpClient.Do(httpReq)
	if err != nil {
		return openai.ChatCompletionResponse{}, err
	}
	defer httpResp.Body.Close()
	if httpResp.StatusCode < http.StatusOK || httpResp.StatusCode >= http.StatusMultipleChoices {
		detail, _ := io.ReadAll(io.LimitReader(httpResp.Body, 8192))
		return openai.ChatCompletionResponse{}, fmt.Errorf(
			"OpenRouter VLM request returned %s: %s",
			httpResp.Status,
			strings.TrimSpace(string(detail)),
		)
	}

	var decoded openai.ChatCompletionResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&decoded); err != nil {
		return openai.ChatCompletionResponse{}, fmt.Errorf("decode OpenRouter VLM response: %w", err)
	}
	return decoded, nil
}

// shapeReasoningVLMRequest adapts an OpenAI-compatible VLM request for
// reasoning (o-series) and GPT-5 models, which reject `max_tokens` and every
// non-default sampling parameter.
//
// This mirrors shapeOpenAIReasoning in internal/models/chat, which fixed the
// same incompatibility on the chat path for issue #1283. The VLM path was
// never wired to it, so image OCR and captioning failed for every one of these
// models (issue #2537).
//
// Both quirks have to be handled together: migrating max_tokens alone still
// fails, because the VLM default temperature (0.1) is itself rejected.
func shapeReasoningVLMRequest(req *openai.ChatCompletionRequest) {
	if !provider.IsOpenAIReasoningOrGPT5Model(req.Model) {
		return
	}
	if req.MaxCompletionTokens == 0 && req.MaxTokens > 0 {
		req.MaxCompletionTokens = req.MaxTokens
	}
	req.MaxTokens = 0
	req.Temperature = 0
	req.TopP = 0
	req.FrequencyPenalty = 0
	req.PresencePenalty = 0
}

func (v *RemoteAPIVLM) GetModelName() string { return v.modelName }
func (v *RemoteAPIVLM) GetModelID() string   { return v.modelID }

// PredictVideo sends a private video through OpenRouter's documented
// video_url chat-completions contract. Exact model-to-provider routing keeps
// the native-video capability explicit and prevents an image-only endpoint
// from being selected silently.
func (v *RemoteAPIVLM) PredictVideo(ctx context.Context, videoBytes []byte, mimeType, prompt string) (string, error) {
	if v.provider != provider.ProviderOpenRouter {
		return "", fmt.Errorf("video input requires OpenRouter")
	}
	videoProvider, supported := openRouterVideoProviders[v.modelName]
	if !supported {
		return "", fmt.Errorf("video input requires an approved native-video model")
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
		// OpenRouter exposes a stable provider slug for each approved native
		// video endpoint. Keep the transport and tenant metering unchanged.
		"provider": map[string]any{
			"only":            []string{videoProvider},
			"allow_fallbacks": true,
		},
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
	// Keep video ingestion non-reasoning with OpenRouter's native nested
	// control, matching the image path above.
	payload["reasoning"] = map[string]string{"effort": "none"}
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
