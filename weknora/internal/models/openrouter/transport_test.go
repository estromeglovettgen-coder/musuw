package openrouter

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type meterStub struct {
	key      string
	user     string
	keyCalls int
}

func (m *meterStub) OpenRouterAPIKey(context.Context) (string, error) {
	m.keyCalls++
	return m.key, nil
}

func (m *meterStub) OpenRouterUserID(context.Context) string { return m.user }

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestTransportUsesTenantKeyAndInjectsStableUser(t *testing.T) {
	meter := &meterStub{key: "tenant-child-key", user: "musuw_opaque"}
	base := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		assert.Equal(t, "Bearer tenant-child-key", req.Header.Get("Authorization"))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), `"user":"musuw_opaque"`)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{"choices":[]}`)),
			Request:    req,
		}, nil
	})}
	client := WrapHTTPClient(base, meter)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewBufferString(`{"model":"test"}`))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer global-platform-key")

	resp, err := client.Do(req)
	require.NoError(t, err)
	_, err = io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	assert.Equal(t, 1, meter.keyCalls)
}

func TestTransportUsesTenantKeyWithoutBufferingMultipartBody(t *testing.T) {
	meter := &meterStub{key: "tenant-child-key", user: "musuw_opaque"}
	const audioBody = "raw-multipart-audio"
	base := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		assert.Equal(t, "Bearer tenant-child-key", req.Header.Get("Authorization"))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		assert.Equal(t, audioBody, string(body))
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"text":"ok"}`)), Request: req}, nil
	})}
	client := WrapHTTPClient(base, meter)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://openrouter.ai/api/v1/audio/transcriptions", strings.NewReader(audioBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=test")

	resp, err := client.Do(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	assert.Equal(t, 1, meter.keyCalls)
}

func TestTransportClassifiesHTTP402AsCreditExhausted(t *testing.T) {
	meter := &meterStub{key: "tenant-child-key", user: "musuw_opaque"}
	base := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusPaymentRequired,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"error":{"code":402,"message":"payment_required"}}`)),
			Request:    req,
		}, nil
	})}
	client := WrapHTTPClient(base, meter)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewBufferString(`{"model":"test"}`))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	assert.Nil(t, resp)
	require.Error(t, err)
	assert.True(t, IsCreditExhausted(err))
	assert.Contains(t, err.Error(), "monthly AI credits")
}

func TestCreditExhaustedPayloadClassification(t *testing.T) {
	assert.True(t, PayloadIndicatesCreditExhausted([]byte(`{"error":{"code":402,"message":"payment_required"}}`)))
	assert.True(t, PayloadIndicatesCreditExhausted([]byte(`{"error":{"message":"spending limit reached"}}`)))
	assert.False(t, PayloadIndicatesCreditExhausted([]byte(`{"error":{"code":429,"message":"rate limited"}}`)))
}
