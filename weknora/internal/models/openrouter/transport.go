package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Tencent/WeKnora/internal/logger"
)

const maxUsageResponseBytes = 8 * 1024 * 1024

// Meter is the narrow contract needed at the OpenRouter HTTP boundary.
// The application entitlement service satisfies it without coupling model
// clients to billing implementation details.
type Meter interface {
	PreflightOpenRouter(ctx context.Context, at time.Time, estimateMicrousd int64) error
	RecordOpenRouterCost(ctx context.Context, at time.Time, costMicrousd int64) (int64, error)
	OpenRouterUserID(ctx context.Context) string
}

type trackingTransport struct {
	base  http.RoundTripper
	meter Meter
	now   func() time.Time
}

func WrapHTTPClient(base *http.Client, meter Meter) *http.Client {
	if base == nil {
		base = &http.Client{}
	}
	copy := *base
	transport := copy.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}
	copy.Transport = &trackingTransport{base: transport, meter: meter, now: time.Now}
	return &copy
}

func (t *trackingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.meter == nil {
		return t.base.RoundTrip(req)
	}
	body, err := readAndRestoreRequest(req)
	if err != nil {
		return nil, err
	}
	if isJSONRequest(req) {
		body, err = injectUser(body, t.meter.OpenRouterUserID(req.Context()))
		if err != nil {
			return nil, err
		}
		restoreRequest(req, body)
	}
	now := t.now().UTC()
	if err := t.meter.PreflightOpenRouter(req.Context(), now, estimateRequestMicrousd(req.URL.Path, body)); err != nil {
		return nil, err
	}
	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	if resp.Body != nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
		resp.Body = &usageBody{
			ReadCloser: resp.Body,
			ctx:        context.WithoutCancel(req.Context()),
			meter:      t.meter,
			at:         now,
			stream:     strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/event-stream"),
		}
	}
	return resp, nil
}

func readAndRestoreRequest(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return nil, nil
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, fmt.Errorf("read OpenRouter request: %w", err)
	}
	restoreRequest(req, body)
	return body, nil
}

func restoreRequest(req *http.Request, body []byte) {
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
}

func isJSONRequest(req *http.Request) bool {
	return strings.Contains(strings.ToLower(req.Header.Get("Content-Type")), "application/json")
}

func injectUser(body []byte, user string) ([]byte, error) {
	if len(body) == 0 || user == "" {
		return body, nil
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode OpenRouter request: %w", err)
	}
	payload["user"] = user
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encode OpenRouter request: %w", err)
	}
	return encoded, nil
}

func estimateRequestMicrousd(path string, body []byte) int64 {
	inputTokens := int64((len(body) + 3) / 4)
	estimate := inputTokens * 2 // conservative USD 2 / million prompt tokens
	if strings.Contains(path, "/chat/completions") {
		maxTokens := int64(1024)
		var payload struct {
			MaxTokens           int64 `json:"max_tokens"`
			MaxCompletionTokens int64 `json:"max_completion_tokens"`
		}
		if json.Unmarshal(body, &payload) == nil {
			if payload.MaxTokens > 0 {
				maxTokens = payload.MaxTokens
			} else if payload.MaxCompletionTokens > 0 {
				maxTokens = payload.MaxCompletionTokens
			}
		}
		estimate += maxTokens * 4 // conservative USD 4 / million output tokens
	}
	if estimate < 1_000 {
		return 1_000
	}
	return estimate
}

type usageBody struct {
	io.ReadCloser
	ctx    context.Context
	meter  Meter
	at     time.Time
	stream bool
	buf    bytes.Buffer
	once   sync.Once
}

func (b *usageBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	if n > 0 && b.buf.Len() < maxUsageResponseBytes {
		remaining := maxUsageResponseBytes - b.buf.Len()
		if n < remaining {
			remaining = n
		}
		_, _ = b.buf.Write(p[:remaining])
	}
	if err == io.EOF {
		b.finalize()
	}
	return n, err
}

func (b *usageBody) Close() error {
	b.finalize()
	return b.ReadCloser.Close()
}

func (b *usageBody) finalize() {
	b.once.Do(func() {
		cost := responseCostUSD(b.buf.Bytes(), b.stream)
		if cost <= 0 {
			return
		}
		microusd := int64(math.Ceil(cost*1_000_000 - 1e-9))
		if microusd <= 0 {
			return
		}
		if _, err := b.meter.RecordOpenRouterCost(b.ctx, b.at, microusd); err != nil {
			logger.Warnf(b.ctx, "failed to record OpenRouter usage cost: %v", err)
		}
	})
}

type costNumber float64

func (n *costNumber) UnmarshalJSON(data []byte) error {
	raw := strings.Trim(string(data), `"`)
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return err
	}
	*n = costNumber(value)
	return nil
}

func responseCostUSD(data []byte, stream bool) float64 {
	decode := func(raw []byte) float64 {
		var payload struct {
			Usage struct {
				Cost costNumber `json:"cost"`
			} `json:"usage"`
		}
		if json.Unmarshal(raw, &payload) != nil {
			return 0
		}
		return float64(payload.Usage.Cost)
	}
	if !stream {
		return decode(data)
	}
	var cost float64
	for _, line := range bytes.Split(data, []byte("\n")) {
		line = bytes.TrimSpace(line)
		if !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		raw := bytes.TrimSpace(bytes.TrimPrefix(line, []byte("data:")))
		if value := decode(raw); value > 0 {
			cost = value
		}
	}
	return cost
}
