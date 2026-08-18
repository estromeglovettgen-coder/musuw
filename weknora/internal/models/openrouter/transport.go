package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Meter supplies the tenant-scoped provider key and stable end-user
// attribution. OpenRouter itself enforces the monthly spend limit on the key.
type Meter interface {
	OpenRouterAPIKey(ctx context.Context) (string, error)
	OpenRouterUserID(ctx context.Context) string
}

type trackingTransport struct {
	base  http.RoundTripper
	meter Meter
}

func WrapHTTPClient(base *http.Client, meter Meter) *http.Client {
	if base == nil {
		base = &http.Client{}
	}
	clone := *base
	transport := base.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}
	clone.Transport = &trackingTransport{base: transport, meter: meter}
	return &clone
}

func (t *trackingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.meter == nil {
		return t.base.RoundTrip(req)
	}
	apiKey, err := t.meter.OpenRouterAPIKey(req.Context())
	if err != nil {
		return nil, err
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, fmt.Errorf("OpenRouter tenant API key is empty")
	}

	outbound := req.Clone(req.Context())
	outbound.Header = req.Header.Clone()
	outbound.Header.Set("Authorization", "Bearer "+apiKey)

	// The OpenRouter `user` field is only part of JSON inference payloads.
	// Do not buffer multipart ASR bodies merely for attribution; the tenant key
	// still enforces spend for every request regardless of content type.
	if isJSONRequest(outbound) {
		body, readErr := readAndRestoreRequest(outbound)
		if readErr != nil {
			return nil, readErr
		}
		if len(body) > 0 {
			body = injectUser(body, t.meter.OpenRouterUserID(outbound.Context()))
			restoreRequest(outbound, body)
		}
	}
	return t.base.RoundTrip(outbound)
}

func isJSONRequest(req *http.Request) bool {
	contentType := strings.ToLower(req.Header.Get("Content-Type"))
	return strings.Contains(contentType, "application/json")
}

func readAndRestoreRequest(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return nil, nil
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	restoreRequest(req, body)
	return body, nil
}

func restoreRequest(req *http.Request, body []byte) {
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	if req.GetBody != nil {
		req.GetBody = func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(body)), nil
		}
	}
}

func injectUser(body []byte, user string) []byte {
	if strings.TrimSpace(user) == "" {
		return body
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return body
	}
	payload["user"] = user
	updated, err := json.Marshal(payload)
	if err != nil {
		return body
	}
	return updated
}
