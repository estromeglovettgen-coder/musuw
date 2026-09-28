package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const clientDiagnosticBodyLimit = 2048

var clientDiagnosticRequestID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

var clientDiagnosticPhases = map[string]bool{
	"auth.session": true, "auth.exchange": true, "auth.authorize": true,
	"auth.password": true, "auth.otp_send": true, "auth.otp_verify": true,
	"auth.native_session": true, "auth.oidc_start": true, "auth.other": true,
	"app.startup": true, "api.auth": true, "api.documents": true, "api.other": true,
	"auth.session_state": true, "auth.continuation": true, "auth.navigation": true,
	"app.navigation": true, "app.entry": true, "app.router": true, "app.mount": true,
	"app.bootstrap": true, "auth.entry": true, "auth.startup": true, "auth.mount": true,
}

var clientDiagnosticOutcomes = map[string]bool{
	"ok": true, "network": true, "timeout": true, "http": true, "identity": true, "error": true,
}

var clientDiagnosticAssetName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}-[A-Za-z0-9_-]{8}\.(js|css)$`)

var clientDiagnosticMetadataEnums = map[string]map[string]bool{
	"flow_status":     {"restored": true, "new": true, "expired": true, "unavailable": true},
	"navigation_type": {"navigate": true, "reload": true, "back_forward": true, "prerender": true, "unknown": true},
	"visibility":      {"visible": true, "hidden": true},
	"page":            {"start": true, "consent": true, "callback": true, "error": true, "logout": true, "app": true, "other": true},
	"browser_kind":    {"quark": true, "chrome": true, "safari": true, "firefox": true, "edge": true, "other": true},
	"platform_kind":   {"mobile": true, "desktop": true, "other": true},
	"storage_status":  {"session_available": true, "session_unavailable": true},
	"reason":          {"session_present": true, "session_missing": true, "session_unavailable": true, "oidc_start": true, "consent_resume": true, "native_callback": true, "login_required": true, "authorization_complete": true, "authorization_invalid": true},
}

type clientDiagnosticTimings struct {
	TTFBMS     *int `json:"ttfb_ms"`
	DownloadMS *int `json:"download_ms"`
}
type clientDiagnosticResource struct {
	Name       string `json:"name"`
	DurationMS *int   `json:"duration_ms"`
	TTFBMS     *int   `json:"ttfb_ms"`
	DownloadMS *int   `json:"download_ms"`
}
type clientDiagnostic struct {
	FlowStatus     string                     `json:"flow_status"`
	NavigationType string                     `json:"navigation_type"`
	Visibility     string                     `json:"visibility"`
	Phase          string                     `json:"phase"`
	Outcome        string                     `json:"outcome"`
	DurationMS     *int                       `json:"duration_ms"`
	FlowID         string                     `json:"flow_id"`
	RequestID      string                     `json:"request_id"`
	Status         int                        `json:"status"`
	JourneyID      string                     `json:"journey_id"`
	DocumentID     string                     `json:"document_id"`
	Page           string                     `json:"page"`
	BrowserKind    string                     `json:"browser_kind"`
	PlatformKind   string                     `json:"platform_kind"`
	ViewportWidth  *int                       `json:"viewport_width"`
	StorageStatus  string                     `json:"storage_status"`
	Reason         string                     `json:"reason"`
	Timings        *clientDiagnosticTimings   `json:"timings"`
	Resources      []clientDiagnosticResource `json:"resources"`
}

func validDiagnosticUUID(value string) bool {
	id, err := uuid.Parse(value)
	return err == nil && id.Version() == 4 && id.Variant() == uuid.RFC4122 && id.String() == value
}
func validDiagnosticMilliseconds(value *int) bool {
	return value != nil && *value >= 0 && *value <= 120000
}

// encoding/json accepts case-insensitive keys and null. Check raw keys at
// every object boundary as well as decoding their precise Go types.
func exactDiagnosticObject(raw []byte, allowed ...string) (map[string]json.RawMessage, bool) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields == nil {
		return nil, false
	}
	for key, value := range fields {
		found := false
		for _, candidate := range allowed {
			if key == candidate {
				found = true
				break
			}
		}
		if !found || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return nil, false
		}
	}
	return fields, true
}

// NewClientDiagnosticsHandler accepts untrusted browser timing hints, never
// authentication authority. One local bucket bounds memory and total log volume;
// diagnostics cannot consume any authentication or business rate-limit budget.
func NewClientDiagnosticsHandler() gin.HandlerFunc {
	limiter := ratelimit.New(nil, "client-diagnostics:", time.Minute, "")
	return func(c *gin.Context) {
		if !limiter.Allow(c.Request.Context(), "global", 600) {
			c.Status(http.StatusTooManyRequests)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, clientDiagnosticBodyLimit))
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				c.Status(http.StatusRequestEntityTooLarge)
			} else {
				c.Status(http.StatusBadRequest)
			}
			return
		}
		var event clientDiagnostic
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&event) != nil || decoder.Decode(new(any)) != io.EOF {
			c.Status(http.StatusBadRequest)
			return
		}
		fields, exact := exactDiagnosticObject(body, "phase", "outcome", "duration_ms", "flow_id", "request_id", "status",
			"journey_id", "document_id", "page", "browser_kind", "platform_kind", "viewport_width", "storage_status", "reason", "timings", "resources", "flow_status", "navigation_type", "visibility")
		if !exact || !clientDiagnosticPhases[event.Phase] || !clientDiagnosticOutcomes[event.Outcome] ||
			!validDiagnosticMilliseconds(event.DurationMS) || !validDiagnosticUUID(event.FlowID) ||
			(event.Status != 0 && (event.Status < 100 || event.Status > 599)) {
			c.Status(http.StatusBadRequest)
			return
		}
		if _, present := fields["request_id"]; present && !clientDiagnosticRequestID.MatchString(event.RequestID) {
			c.Status(http.StatusBadRequest)
			return
		}
		for key, value := range map[string]string{"journey_id": event.JourneyID, "document_id": event.DocumentID} {
			if _, present := fields[key]; present && !validDiagnosticUUID(value) {
				c.Status(http.StatusBadRequest)
				return
			}
		}
		for key, value := range map[string]string{"flow_status": event.FlowStatus, "navigation_type": event.NavigationType, "visibility": event.Visibility, "page": event.Page, "browser_kind": event.BrowserKind, "platform_kind": event.PlatformKind, "storage_status": event.StorageStatus, "reason": event.Reason} {
			if _, present := fields[key]; present && !clientDiagnosticMetadataEnums[key][value] {
				c.Status(http.StatusBadRequest)
				return
			}
		}
		if event.ViewportWidth != nil && (*event.ViewportWidth < 0 || *event.ViewportWidth > 10000) {
			c.Status(http.StatusBadRequest)
			return
		}
		if raw, present := fields["timings"]; present {
			_, exact := exactDiagnosticObject(raw, "ttfb_ms", "download_ms")
			if !exact || event.Timings == nil || !validDiagnosticMilliseconds(event.Timings.TTFBMS) || !validDiagnosticMilliseconds(event.Timings.DownloadMS) {
				c.Status(http.StatusBadRequest)
				return
			}
		}
		if raw, present := fields["resources"]; present {
			var items []json.RawMessage
			if json.Unmarshal(raw, &items) != nil || len(items) > 3 {
				c.Status(http.StatusBadRequest)
				return
			}
			for i, item := range items {
				_, exact := exactDiagnosticObject(item, "name", "duration_ms", "ttfb_ms", "download_ms")
				resource := event.Resources[i]
				if !exact || !clientDiagnosticAssetName.MatchString(resource.Name) || !validDiagnosticMilliseconds(resource.DurationMS) || !validDiagnosticMilliseconds(resource.TTFBMS) || !validDiagnosticMilliseconds(resource.DownloadMS) {
					c.Status(http.StatusBadRequest)
					return
				}
			}
		}
		bounded := map[string]interface{}{
			"phase": event.Phase, "outcome": event.Outcome, "duration_ms": *event.DurationMS,
			"flow_id": event.FlowID, "status": event.Status,
		}
		if event.RequestID != "" {
			bounded["request_id"] = event.RequestID
		}
		for key, value := range map[string]string{"flow_status": event.FlowStatus, "navigation_type": event.NavigationType, "visibility": event.Visibility, "journey_id": event.JourneyID, "document_id": event.DocumentID, "page": event.Page, "browser_kind": event.BrowserKind, "platform_kind": event.PlatformKind, "storage_status": event.StorageStatus, "reason": event.Reason} {
			if value != "" {
				bounded[key] = value
			}
		}
		if event.ViewportWidth != nil {
			bounded["viewport_width"] = *event.ViewportWidth
		}
		if event.Timings != nil {
			bounded["timings"] = map[string]int{"ttfb_ms": *event.Timings.TTFBMS, "download_ms": *event.Timings.DownloadMS}
		}
		if len(event.Resources) > 0 {
			resources := make([]map[string]interface{}, 0, len(event.Resources))
			for _, resource := range event.Resources {
				resources = append(resources, map[string]interface{}{"name": resource.Name, "duration_ms": *resource.DurationMS, "ttfb_ms": *resource.TTFBMS, "download_ms": *resource.DownloadMS})
			}
			bounded["resources"] = resources
		}
		// Do not inherit arbitrary request headers, IPs, user context, or URLs.
		logger.GetLogger(context.Background()).WithFields(bounded).Info("client_diagnostic")
		c.Status(http.StatusNoContent)
	}
}
