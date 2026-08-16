package runtime

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWorkerReadinessHandlerKeepsProbeSurfacePrivate(t *testing.T) {
	readiness := NewReadiness(RoleWorker, "full-revision", "release-marker")
	handler := NewWorkerReadinessHandler(readiness)

	readyz := httptest.NewRecorder()
	handler.ServeHTTP(readyz, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if readyz.Code != http.StatusServiceUnavailable {
		t.Fatalf("worker /readyz status = %d, want 503 before dependencies", readyz.Code)
	}
	var snapshot ReadinessSnapshot
	if err := json.NewDecoder(readyz.Body).Decode(&snapshot); err != nil {
		t.Fatalf("decode worker /readyz: %v", err)
	}
	if snapshot.Role != RoleWorker || snapshot.Revision != "full-revision" ||
		snapshot.ReleaseMarker != "release-marker" || snapshot.AcceptingTraffic {
		t.Fatalf("unexpected worker readiness snapshot: %+v", snapshot)
	}

	readiness.MarkDependencyReady("database")
	readiness.MarkDependency("redis", DependencyReady)
	readiness.MarkDependencyReady("workers")
	readyz = httptest.NewRecorder()
	handler.ServeHTTP(readyz, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if readyz.Code != http.StatusOK {
		t.Fatalf("worker /readyz status = %d, want 200 after dependencies", readyz.Code)
	}

	health := httptest.NewRecorder()
	handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/health", nil))
	if health.Code != http.StatusOK || health.Body.String() != `{"status":"ok"}
` {
		t.Fatalf("worker /health = status %d body %q, want liveness JSON", health.Code, health.Body.String())
	}

	public := httptest.NewRecorder()
	handler.ServeHTTP(public, httptest.NewRequest(http.MethodGet, "/api/v1/users", nil))
	if public.Code != http.StatusNotFound {
		t.Fatalf("worker public path status = %d, want 404", public.Code)
	}
}
