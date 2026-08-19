package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	managementAPIBaseURL  = "https://openrouter.ai/api/v1"
	managementKeyFilePath = "/run/secrets/openrouter_management_api_key"
)

// KeyManager is the small subset of OpenRouter's official Management API that
// Musuw needs for one monthly-limited inference key per personal workspace.
type KeyManager interface {
	CreateKey(ctx context.Context, name string, limitMicrousd int64) (*ManagedKey, error)
	UpdateKeyLimit(ctx context.Context, hash string, limitMicrousd int64) error
	GetKey(ctx context.Context, hash string) (*KeyInfo, error)
	DeleteKey(ctx context.Context, hash string) error
}

type ManagedKey struct {
	Key  string
	Hash string
}

type KeyInfo struct {
	Hash                   string
	LimitMicrousd          int64
	LimitRemainingMicrousd int64
	UsageMonthlyMicrousd   int64
}

type httpKeyManager struct {
	managementKey string
	baseURL       string
	client        *http.Client
}

func NewKeyManagerFromEnv() KeyManager {
	key := strings.TrimSpace(os.Getenv("OPENROUTER_MANAGEMENT_API_KEY"))
	if key == "" {
		if value, err := os.ReadFile(managementKeyFilePath); err == nil {
			key = strings.TrimSpace(string(value))
		}
	}
	if key == "" {
		return nil
	}
	return newHTTPKeyManager(key, managementAPIBaseURL, &http.Client{Timeout: 10 * time.Second})
}

func newHTTPKeyManager(managementKey, baseURL string, client *http.Client) *httpKeyManager {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &httpKeyManager{
		managementKey: strings.TrimSpace(managementKey),
		baseURL:       strings.TrimRight(baseURL, "/"),
		client:        client,
	}
}

type keyData struct {
	Hash           string   `json:"hash"`
	Limit          *float64 `json:"limit"`
	LimitRemaining *float64 `json:"limit_remaining"`
	LimitReset     *string  `json:"limit_reset"`
	UsageMonthly   float64  `json:"usage_monthly"`
}

type createKeyResponse struct {
	Data keyData `json:"data"`
	Key  string  `json:"key"`
}

type keyResponse struct {
	Data keyData `json:"data"`
}

func (m *httpKeyManager) CreateKey(ctx context.Context, name string, limitMicrousd int64) (*ManagedKey, error) {
	if limitMicrousd <= 0 {
		return nil, fmt.Errorf("OpenRouter key limit must be positive")
	}
	var response createKeyResponse
	err := m.doJSON(ctx, http.MethodPost, "/keys", map[string]any{
		"name":        name,
		"limit":       microusdToUSD(limitMicrousd),
		"limit_reset": "monthly",
	}, &response)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(response.Key) == "" || strings.TrimSpace(response.Data.Hash) == "" {
		return nil, fmt.Errorf("OpenRouter Management API returned an incomplete key")
	}
	return &ManagedKey{Key: response.Key, Hash: response.Data.Hash}, nil
}

func (m *httpKeyManager) UpdateKeyLimit(ctx context.Context, hash string, limitMicrousd int64) error {
	if limitMicrousd <= 0 {
		return fmt.Errorf("OpenRouter key limit must be positive")
	}
	var response keyResponse
	return m.doJSON(ctx, http.MethodPatch, "/keys/"+url.PathEscape(hash), map[string]any{
		"limit":       microusdToUSD(limitMicrousd),
		"limit_reset": "monthly",
	}, &response)
}

func (m *httpKeyManager) GetKey(ctx context.Context, hash string) (*KeyInfo, error) {
	var response keyResponse
	if err := m.doJSON(ctx, http.MethodGet, "/keys/"+url.PathEscape(hash), nil, &response); err != nil {
		return nil, err
	}
	if response.Data.Limit == nil || response.Data.LimitRemaining == nil {
		return nil, fmt.Errorf("OpenRouter managed key %q has no spend limit", hash)
	}
	return &KeyInfo{
		Hash:                   response.Data.Hash,
		LimitMicrousd:          usdToMicrousd(*response.Data.Limit),
		LimitRemainingMicrousd: usdToMicrousd(*response.Data.LimitRemaining),
		UsageMonthlyMicrousd:   usdToMicrousd(response.Data.UsageMonthly),
	}, nil
}

func (m *httpKeyManager) DeleteKey(ctx context.Context, hash string) error {
	return m.doJSON(ctx, http.MethodDelete, "/keys/"+url.PathEscape(hash), map[string]any{}, nil)
}

func (m *httpKeyManager) doJSON(ctx context.Context, method, path string, input, output any) error {
	if m == nil || m.managementKey == "" {
		return fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured")
	}
	var body io.Reader
	if input != nil {
		encoded, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, m.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.managementKey)
	req.Header.Set("Accept", "application/json")
	if input != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("OpenRouter Management API request failed: %w", err)
	}
	defer resp.Body.Close()
	// Deletion is an idempotent lifecycle operation. If a previous attempt
	// removed the provider key but failed before clearing Tenant.credentials,
	// retrying must be able to converge instead of getting stuck on 404.
	if method == http.MethodDelete && strings.HasPrefix(path, "/keys/") && resp.StatusCode == http.StatusNotFound {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("OpenRouter Management API %s %s returned HTTP %d", method, path, resp.StatusCode)
	}
	if output == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(output); err != nil {
		return fmt.Errorf("decode OpenRouter Management API response: %w", err)
	}
	return nil
}

func microusdToUSD(value int64) float64 {
	return float64(value) / 1_000_000
}

func usdToMicrousd(value float64) int64 {
	if value <= 0 {
		return 0
	}
	return int64(value*1_000_000 + 0.5)
}
