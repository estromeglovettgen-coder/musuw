package tikhub

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"time"
)

const (
	ProductionBaseURL = "https://api.tikhub.io"

	tiktokSharePath      = "/api/v1/tiktok/app/v3/fetch_one_video_by_share_url"
	douyinSharePath      = "/api/v1/douyin/app/v3/fetch_one_video_by_share_url"
	youtubeStreamsV2Path = "/api/v1/youtube/web_v2/get_video_streams_v2"
	xhsImagePath         = "/api/v1/xiaohongshu/app_v2/get_image_note_detail"
	xhsVideoPath         = "/api/v1/xiaohongshu/app_v2/get_video_note_detail"
	instagramPostPath    = "/api/v1/instagram/v2/fetch_post_info"
	xTweetPath           = "/api/v1/twitter/web/fetch_tweet_detail"
)

var (
	ErrMissingAPIKey       = errors.New("TIKHUB_API_KEY is not configured")
	ErrMissingRouteValue   = errors.New("TikHub route is missing its required value")
	ErrUnsupportedPlatform = errors.New("TikHub route uses an unsupported platform")
)

type ResultKind string

const (
	ResultVideo    ResultKind = "video"
	ResultDocument ResultKind = "document"
)

// Result is the only contract between TikHub and the existing ingestion
// pipeline: one social work becomes either a video file or a Markdown document.
type Result struct {
	Kind        ResultKind `json:"kind"`
	Title       string     `json:"title,omitempty"`
	Description string     `json:"description,omitempty"`
	MediaURL    string     `json:"media_url,omitempty"`
	FileName    string     `json:"file_name,omitempty"`
	FileType    string     `json:"file_type,omitempty"`
	Markdown    string     `json:"markdown,omitempty"`
	ImageURLs   []string   `json:"image_urls,omitempty"`
}

// TikHubImporter is deliberately concrete and small: fixed provider host,
// fixed endpoint table, one HTTP client, and no retry/plugin abstraction.
type TikHubImporter struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewTikHubImporter() (*TikHubImporter, error) { return NewFromEnv() }

func NewFromEnv() (*TikHubImporter, error) {
	key := strings.TrimSpace(os.Getenv("TIKHUB_API_KEY"))
	if key == "" {
		return nil, ErrMissingAPIKey
	}
	return &TikHubImporter{baseURL: ProductionBaseURL, apiKey: key, client: newTikHubHTTPClient()}, nil
}

func NewTikHubImporterForTest(baseURL, apiKey string, client *http.Client) *TikHubImporter {
	if client == nil {
		client = newTikHubHTTPClient()
	}
	return &TikHubImporter{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		apiKey:  strings.TrimSpace(apiKey),
		client:  client,
	}
}

// Fetch makes one billed request, except Xiaohongshu video notes where the
// official image-first flow requires a conditional second request.
func (i *TikHubImporter) Fetch(ctx context.Context, route Route) (Result, error) {
	if i == nil || i.client == nil {
		return Result{}, errors.New("TikHub importer is unavailable")
	}
	if strings.TrimSpace(i.apiKey) == "" {
		return Result{}, ErrMissingAPIKey
	}

	switch route.Platform {
	case PlatformTikTok, PlatformDouyin:
		input, err := requireInputURL(route)
		if err != nil {
			return Result{}, err
		}
		endpoint := tiktokSharePath
		if route.Platform == PlatformDouyin {
			endpoint = douyinSharePath
		}
		data, err := i.get(ctx, endpoint, url.Values{"share_url": {input}})
		if err != nil {
			return Result{}, err
		}
		return normalizeWork(route.Platform, route.ObjectID, data, true)

	case PlatformYouTube:
		id, err := requireObjectID(route)
		if err != nil {
			return Result{}, err
		}
		data, err := i.get(ctx, youtubeStreamsV2Path, url.Values{"video_id": {id}})
		if err != nil {
			return Result{}, err
		}
		return normalizeWork(route.Platform, id, data, false)

	case PlatformXiaohongshu:
		params, err := xhsParams(route)
		if err != nil {
			return Result{}, err
		}
		data, err := i.get(ctx, xhsImagePath, params)
		if err != nil {
			return Result{}, err
		}
		if xhsResponseIsVideo(data) {
			data, err = i.get(ctx, xhsVideoPath, params)
			if err != nil {
				return Result{}, err
			}
			return normalizeWork(route.Platform, route.ObjectID, data, false)
		}
		return normalizeDocument(route.Platform, route.ObjectID, data, false)

	case PlatformInstagram:
		value := strings.TrimSpace(route.ObjectID)
		if value == "" {
			value = strings.TrimSpace(route.InputURL)
		}
		if value == "" {
			return Result{}, fmt.Errorf("%w: Instagram ObjectID or InputURL", ErrMissingRouteValue)
		}
		data, err := i.get(ctx, instagramPostPath, url.Values{"code_or_url": {value}})
		if err != nil {
			return Result{}, err
		}
		return normalizeInstagram(data)

	case PlatformX:
		id, err := requireObjectID(route)
		if err != nil {
			return Result{}, err
		}
		data, err := i.get(ctx, xTweetPath, url.Values{"tweet_id": {id}})
		if err != nil {
			return Result{}, err
		}
		return normalizeX(data)

	default:
		return Result{}, fmt.Errorf("%w: %q", ErrUnsupportedPlatform, route.Platform)
	}
}

func requireInputURL(route Route) (string, error) {
	value := strings.TrimSpace(route.InputURL)
	if value == "" {
		return "", fmt.Errorf("%w: %s InputURL", ErrMissingRouteValue, route.Platform)
	}
	return value, nil
}

func requireObjectID(route Route) (string, error) {
	value := strings.TrimSpace(route.ObjectID)
	if value == "" {
		return "", fmt.Errorf("%w: %s ObjectID", ErrMissingRouteValue, route.Platform)
	}
	return value, nil
}

func xhsParams(route Route) (url.Values, error) {
	if id := strings.TrimSpace(route.ObjectID); id != "" {
		return url.Values{"note_id": {id}}, nil
	}
	if input := strings.TrimSpace(route.InputURL); input != "" {
		return url.Values{"share_text": {input}}, nil
	}
	return nil, fmt.Errorf("%w: Xiaohongshu ObjectID or InputURL", ErrMissingRouteValue)
}

type responseEnvelope struct {
	Code int             `json:"code"`
	Data json.RawMessage `json:"data"`
}

func (i *TikHubImporter) get(ctx context.Context, endpoint string, params url.Values) (any, error) {
	base, err := url.Parse(i.baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" || !strings.HasPrefix(endpoint, "/") {
		return nil, errors.New("TikHub endpoint configuration is invalid")
	}
	base.Path = strings.TrimRight(base.Path, "/") + endpoint
	base.RawQuery = params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base.String(), nil)
	if err != nil {
		return nil, errors.New("could not create TikHub request")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+i.apiKey)
	resp, err := i.client.Do(req)
	if err != nil {
		// Do not wrap url.Error: it contains the full query/share text.
		if errors.Is(err, context.Canceled) {
			return nil, context.Canceled
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, context.DeadlineExceeded
		}
		return nil, errors.New("TikHub request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("TikHub request returned HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, errors.New("could not read TikHub response")
	}
	var envelope responseEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, errors.New("TikHub returned invalid JSON")
	}
	if envelope.Code != http.StatusOK {
		// Provider messages are intentionally omitted because they can echo input.
		return nil, fmt.Errorf("TikHub request returned code %d", envelope.Code)
	}
	if len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		return nil, errors.New("TikHub returned empty data")
	}
	var data any
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data == nil {
		return nil, errors.New("TikHub returned invalid data")
	}
	return data, nil
}

func newTikHubHTTPClient() *http.Client {
	return &http.Client{
		Timeout:       60 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func normalizeWork(platform Platform, routeID string, data any, allowDocument bool) (Result, error) {
	title := firstString(data, "title", "display_title", "name", "desc", "caption", "accessibility_caption", "full_text", "text")
	description := firstString(data, "description", "desc", "caption", "accessibility_caption", "full_text", "text")
	if allowDocument && (platform == PlatformTikTok || platform == PlatformDouyin) && len(imageURLs(data)) > 0 {
		return normalizeDocument(platform, routeID, data, false)
	}
	if mediaURL := videoURL(platform, data); mediaURL != "" {
		return Result{
			Kind: ResultVideo, Title: title, Description: description, MediaURL: mediaURL,
			FileName: artifactName(platform, routeID, extensionForURL(mediaURL, "mp4")),
			FileType: extensionForURL(mediaURL, "mp4"),
		}, nil
	}
	if allowDocument {
		return normalizeDocument(platform, routeID, data, false)
	}
	return Result{}, fmt.Errorf("TikHub %s response has no video URL", platform)
}

func normalizeInstagram(data any) (Result, error) {
	return normalizeWork(PlatformInstagram, "", data, true)
}

func normalizeX(data any) (Result, error) {
	return normalizeDocumentOrVideo(PlatformX, data)
}

func normalizeDocumentOrVideo(platform Platform, data any) (Result, error) {
	if mediaURL := videoURL(platform, data); mediaURL != "" {
		title := firstString(data, "full_text", "text", "title", "name")
		return Result{Kind: ResultVideo, Title: title, Description: title, MediaURL: mediaURL, FileName: artifactName(platform, "", "mp4"), FileType: extensionForURL(mediaURL, "mp4")}, nil
	}
	return normalizeDocument(platform, "", data, platform == PlatformX)
}

func normalizeDocument(platform Platform, routeID string, data any, allowTextOnly bool) (Result, error) {
	title := firstString(data, "title", "display_title", "name", "desc", "caption", "accessibility_caption", "full_text", "text")
	description := firstString(data, "description", "desc", "caption", "accessibility_caption", "full_text", "text")
	if platform == PlatformDouyin || platform == PlatformTikTok {
		if workDescription := stringValue(nestedMapValue(data, "aweme_detail", "desc")); workDescription != "" {
			title = workDescription
			description = workDescription
		}
	}
	images := imageURLs(data)
	if len(images) == 0 && !(allowTextOnly && title != "") {
		return Result{}, fmt.Errorf("TikHub %s response has no document content", platform)
	}
	result := documentResult(title, description, images)
	result.FileName = artifactName(platform, routeID, "md")
	return result, nil
}

func videoURL(platform Platform, data any) string {
	var keys []string
	switch platform {
	case PlatformTikTok, PlatformDouyin:
		// App responses may include bitrate alternatives under video.bit_rate.
		// Pick the smallest bitrate when it is present; otherwise keep using
		// the provider's primary play address below.
		for _, value := range valuesByKey(data, "bit_rate") {
			if candidate := lowestBitrateURL(value); candidate != "" {
				return candidate
			}
		}
		// The App response exposes one primary address under
		// aweme_detail.video. Prefer it deterministically; recursive map walks
		// can otherwise select an arbitrary bitrate/codec alternative first.
		for _, key := range []string{"play_addr_h264", "play_addr", "download_addr", "play_addr_265", "video_url"} {
			if candidate := firstPlayableURL(nestedMapValue(data, "aweme_detail", "video", key)); candidate != "" {
				return candidate
			}
		}
		// Never search the whole video object: it also contains cover URLs.
		keys = []string{"play_addr_h264", "play_addr_265", "play_addr", "download_addr", "video_url"}
	case PlatformYouTube:
		// TikHub's merged formats are already audio+video MP4 candidates.
		// adaptive_formats are intentionally ignored (they require a merge).
		for _, value := range valuesByKey(data, "formats") {
			if candidate := lowestQualityURL(value); candidate != "" {
				return candidate
			}
		}
		return ""
	case PlatformXiaohongshu:
		keys = []string{"master_url", "play_url", "video_url", "video"}
	case PlatformInstagram:
		for _, key := range []string{"video_versions", "videoVersions"} {
			for _, value := range valuesByKey(data, key) {
				if candidate := lowestQualityURL(value); candidate != "" {
					return candidate
				}
			}
		}
		keys = []string{"video_url", "videoUrl"}
	case PlatformX:
		for _, key := range []string{"variants", "video_variants"} {
			for _, value := range valuesByKey(data, key) {
				if candidate := lowestQualityURL(value); candidate != "" {
					return candidate
				}
			}
		}
		keys = []string{"video_info", "videoInfo"}
	}
	for _, key := range keys {
		for _, value := range valuesByKey(data, key) {
			if candidate := firstPlayableURL(value); candidate != "" {
				return candidate
			}
		}
	}
	return ""
}

type qualityCandidate struct {
	url        string
	height     float64
	bitrate    float64
	hasHeight  bool
	hasBitrate bool
}

func lowestBitrateURL(value any) string {
	candidates := qualityCandidates(value)
	if len(candidates) == 0 {
		return ""
	}
	var best *qualityCandidate
	for index := range candidates {
		candidate := &candidates[index]
		if !candidate.hasBitrate {
			continue
		}
		if best == nil || candidate.bitrate < best.bitrate {
			best = candidate
		}
	}
	if best == nil {
		return ""
	}
	return best.url
}

func lowestQualityURL(value any) string {
	candidates := qualityCandidates(value)
	if len(candidates) == 0 {
		return ""
	}
	// If all candidates omit quality metadata, preserve the provider's order.
	known := candidates[:0]
	for _, candidate := range candidates {
		if candidate.hasHeight || candidate.hasBitrate {
			known = append(known, candidate)
		}
	}
	if len(known) == 0 {
		return candidates[0].url
	}
	best := known[0]
	for _, candidate := range known[1:] {
		if lowerQuality(candidate, best) {
			best = candidate
		}
	}
	return best.url
}

func lowerQuality(a, b qualityCandidate) bool {
	if a.hasHeight && b.hasHeight && a.height != b.height {
		return a.height < b.height
	}
	if a.hasBitrate && b.hasBitrate && a.bitrate != b.bitrate {
		return a.bitrate < b.bitrate
	}
	return false
}

func qualityCandidates(value any) []qualityCandidate {
	items, ok := value.([]any)
	if !ok {
		items = []any{value}
	}
	result := make([]qualityCandidate, 0, len(items))
	for _, item := range items {
		candidateURL := firstPlayableURL(item)
		if candidateURL == "" {
			continue
		}
		candidate := qualityCandidate{url: candidateURL}
		if typed, ok := item.(map[string]any); ok {
			candidate.height, candidate.hasHeight = numberField(typed, "height", "video_height", "quality_label", "qualityLabel")
			candidate.bitrate, candidate.hasBitrate = numberField(typed, "bitrate", "bit_rate", "bitRate")
		}
		result = append(result, candidate)
	}
	return result
}

func numberField(values map[string]any, keys ...string) (float64, bool) {
	for _, key := range keys {
		if number, ok := numberValue(values[key]); ok {
			return number, true
		}
	}
	return 0, false
}

func numberValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case string:
		number, err := strconv.ParseFloat(strings.TrimSpace(strings.TrimSuffix(typed, "p")), 64)
		return number, err == nil
	default:
		return 0, false
	}
}

func nestedMapValue(value any, keys ...string) any {
	current := value
	for _, key := range keys {
		object, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = object[key]
	}
	return current
}

func firstPlayableURL(value any) string {
	switch typed := value.(type) {
	case string:
		candidate := validHTTPURL(typed)
		if strings.Contains(strings.ToLower(candidate), ".m3u8") {
			return ""
		}
		return candidate
	case []any:
		for _, item := range typed {
			if candidate := firstPlayableURL(item); candidate != "" {
				return candidate
			}
		}
	case map[string]any:
		mime := strings.ToLower(stringValue(typed["content_type"]))
		if mime == "" {
			mime = strings.ToLower(stringValue(typed["mime_type"]))
		}
		if strings.Contains(mime, "mpegurl") {
			return ""
		}
		if mime != "" && !strings.HasPrefix(mime, "video/") {
			return ""
		}
		for _, key := range []string{"url", "video_url", "videoUrl", "url_default", "master_url", "play_url", "play_addr", "play_addr_h264", "play_addr_265", "download_addr"} {
			if candidate := firstPlayableURL(typed[key]); candidate != "" {
				return candidate
			}
		}
		for _, key := range []string{"url_list", "urlList", "variants", "video_versions", "videoVersions", "formats", "adaptive_formats", "stream", "media"} {
			if candidate := firstPlayableURL(typed[key]); candidate != "" {
				return candidate
			}
		}
	}
	return ""
}

func imageURLs(data any) []string {
	keys := []string{"images", "image_list", "images_list", "imageList", "image_versions", "image_versions2", "imageVersions2", "display_url", "media_url_https", "media_url"}
	seen := map[string]bool{}
	var result []string
	for _, key := range keys {
		for _, value := range valuesByKey(data, key) {
			for _, candidate := range collectImageItems(value) {
				if !seen[candidate] {
					seen[candidate] = true
					result = append(result, candidate)
				}
			}
		}
	}
	return result
}

func collectImageItems(value any) []string {
	if candidate := validHTTPURL(value); candidate != "" {
		return []string{candidate}
	}
	if items, ok := value.([]any); ok {
		result := make([]string, 0, len(items))
		for _, item := range items {
			if candidate := firstImageURL(item); candidate != "" {
				result = append(result, candidate)
			}
		}
		return result
	}
	if candidate := firstImageURL(value); candidate != "" {
		return []string{candidate}
	}
	return nil
}

func firstImageURL(value any) string {
	if candidate := validHTTPURL(value); candidate != "" {
		return candidate
	}
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if candidate := firstImageURL(item); candidate != "" {
				return candidate
			}
		}
	case map[string]any:
		for _, key := range []string{"url", "url_default", "display_url", "media_url_https", "media_url", "src", "url_list", "urlList", "url_pre", "url_orig", "candidates", "items"} {
			if candidate := firstImageURL(typed[key]); candidate != "" {
				return candidate
			}
		}
	}
	return ""
}

func valuesByKey(data any, wanted string) []any {
	var result []any
	var walk func(any)
	walk = func(node any) {
		switch typed := node.(type) {
		case map[string]any:
			for key, value := range typed {
				if strings.EqualFold(key, wanted) {
					result = append(result, value)
				}
				walk(value)
			}
		case []any:
			for _, item := range typed {
				walk(item)
			}
		}
	}
	walk(data)
	return result
}

func firstString(data any, keys ...string) string {
	for _, key := range keys {
		for _, value := range valuesByKey(data, key) {
			if text := strings.TrimSpace(stringValue(value)); text != "" {
				return text
			}
		}
	}
	return ""
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return ""
	}
}

func xhsResponseIsVideo(data any) bool {
	// A response may contain contradictory type fields (for example a legacy
	// top-level `type: normal` alongside `note_type: video`). Scan all known
	// fields before deciding that the note is an image; a video marker anywhere
	// in the response must win.
	for _, key := range []string{"type", "note_type", "media_type"} {
		for _, value := range valuesByKey(data, key) {
			switch strings.ToLower(strings.TrimSpace(stringValue(value))) {
			case "video", "video_note", "2":
				return true
			}
		}
	}
	return len(valuesByKey(data, "video")) > 0
}

func documentResult(title, description string, images []string) Result {
	var markdown strings.Builder
	if title != "" {
		markdown.WriteString("# " + title + "\n\n")
	}
	if description != "" && description != title {
		markdown.WriteString(description + "\n\n")
	}
	for index, image := range images {
		fmt.Fprintf(&markdown, "![image %d](%s)\n\n", index+1, image)
	}
	return Result{Kind: ResultDocument, Title: title, Description: description, Markdown: markdown.String(), ImageURLs: images, FileType: "md"}
}

func artifactName(platform Platform, id, extension string) string {
	base := strings.TrimSpace(string(platform) + "-" + id)
	base = strings.TrimSuffix(base, "-")
	if base == "" {
		base = "social-work"
	}
	return sanitizeFilename(base) + "." + extension
}

func sanitizeFilename(value string) string {
	var result strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			result.WriteRune(r)
		}
	}
	if result.Len() == 0 {
		return "social-work"
	}
	return result.String()
}

func extensionForURL(raw, fallback string) string {
	parsed, err := url.Parse(raw)
	if err == nil {
		extension := strings.TrimPrefix(path.Ext(parsed.Path), ".")
		if extension != "" && len(extension) <= 8 {
			return strings.ToLower(extension)
		}
	}
	return fallback
}

func validHTTPURL(value any) string {
	text := strings.TrimSpace(stringValue(value))
	parsed, err := url.Parse(text)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return ""
	}
	return text
}
