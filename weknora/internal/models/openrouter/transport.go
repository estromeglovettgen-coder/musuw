package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const CreditExhaustedCode = "openrouter_credits_exhausted"

// CreditExhaustedError is the provider-level hard monthly-spend boundary. It is
// intentionally distinct from transient transport/provider failures so callers
// can avoid retries and preserve any answer already streamed to the user.
type CreditExhaustedError struct {
	StatusCode int
}

func (e *CreditExhaustedError) Error() string {
	return "OpenRouter monthly AI credits are exhausted"
}

func IsCreditExhausted(err error) bool {
	if err == nil {
		return false
	}
	var target *CreditExhaustedError
	if errors.As(err, &target) {
		return true
	}
	return textIndicatesCreditExhausted(err.Error())
}

// PayloadIndicatesCreditExhausted handles providers that start a successful SSE
// response and later emit an error object when the key budget is reached.
func PayloadIndicatesCreditExhausted(payload []byte) bool {
	return textIndicatesCreditExhausted(string(payload))
}

func textIndicatesCreditExhausted(value string) bool {
	lower := strings.ToLower(value)
	for _, marker := range []string{
		"payment_required",
		"insufficient credits",
		"insufficient credit",
		"credit limit",
		"credits exhausted",
		"credit exhausted",
		"spending limit",
	} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return strings.Contains(lower, `"code":402`) || strings.Contains(lower, `"code":"402"`)
}

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

	resp, err := t.base.RoundTrip(outbound)
	if err != nil {
		return nil, err
	}
	if resp != nil && resp.StatusCode == http.StatusPaymentRequired {
		// Never pass a 402 into generic provider retry/fallback machinery. Drain a
		// bounded body for connection reuse but do not surface provider text that
		// may contain account metadata.
		if resp.Body != nil {
			_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))
			_ = resp.Body.Close()
		}
		return nil, &CreditExhaustedError{StatusCode: resp.StatusCode}
	}
	return resp, nil
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
