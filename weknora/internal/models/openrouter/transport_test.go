package openrouter

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type meterStub struct {
	preflight int64
	recorded  int64
}

func (m *meterStub) PreflightOpenRouter(context.Context, time.Time, int64) error {
	m.preflight++
	return nil
}

func (m *meterStub) RecordOpenRouterCost(_ context.Context, _ time.Time, cost int64) (int64, error) {
	m.recorded += cost
	return m.recorded, nil
}

func (*meterStub) OpenRouterUserID(context.Context) string { return "musuw_opaque" }

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestTransportInjectsUserAndRecordsOfficialCost(t *testing.T) {
	meter := &meterStub{}
	base := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), `"user":"musuw_opaque"`)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{"choices":[],"usage":{"cost":0.000123}}`)),
			Request:    req,
		}, nil
	})}
	client := WrapHTTPClient(base, meter)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewBufferString(`{"model":"test","max_tokens":64}`))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	require.NoError(t, err)
	_, err = io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	assert.Equal(t, int64(1), meter.preflight)
	assert.Equal(t, int64(123), meter.recorded)
}

func TestTransportReadsStreamingTerminalUsage(t *testing.T) {
	meter := &meterStub{}
	base := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
			Body: io.NopCloser(strings.NewReader("data: {\"choices\":[]}\n\n" +
				"data: {\"usage\":{\"cost\":0.0000025}}\n\n" +
				"data: [DONE]\n\n")),
			Request: req,
		}, nil
	})}
	client := WrapHTTPClient(base, meter)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewBufferString(`{"model":"test","stream":true}`))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	require.NoError(t, err)
	_, err = io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, int64(3), meter.recorded)
}
