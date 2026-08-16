package runtime

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReadyzReturns503UntilDependenciesAndTrafficAreReady(t *testing.T) {
	r := NewReadiness(RoleWeb, "rev-123", "release-456")
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()
	r.ReadyzHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("initial /readyz status = %d, want 503", recorder.Code)
	}

	r.MarkDependencyReady("database")
	r.MarkAcceptingTraffic()
	recorder = httptest.NewRecorder()
	r.ReadyzHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("ready /readyz status = %d, want 200", recorder.Code)
	}
	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("ready /readyz cache-control = %q, want no-store", got)
	}
	var got ReadinessSnapshot
	if err := json.NewDecoder(recorder.Body).Decode(&got); err != nil {
		t.Fatalf("decode /readyz response: %v", err)
	}
	if got.Status != "ready" || got.Role != RoleWeb || got.Revision != "rev-123" ||
		!got.AcceptingTraffic || got.ReleaseMarker != "release-456" ||
		got.Dependencies["database"] != DependencyReady {
		t.Fatalf("unexpected /readyz snapshot: %+v", got)
	}
}

func TestWorkerReadinessDoesNotRequirePublicTraffic(t *testing.T) {
	r := NewReadiness(RoleWorker, "rev", "marker")
	r.ConfigureForPlan(NewLifecyclePlan(RoleWorker))
	for _, dependency := range WorkerReadinessDependencies {
		r.MarkDependencyReady(dependency)
	}
	recorder := httptest.NewRecorder()
	r.ReadyzHandler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("worker /readyz status = %d, want 200 without public listener", recorder.Code)
	}
}

func TestWorkerReadinessFailsUntilEveryLifecycleBarrierIsReady(t *testing.T) {
	r := NewReadiness(RoleWorker, "0123456789abcdef0123456789abcdef01234567", "release")
	r.ConfigureForPlan(NewLifecyclePlan(RoleWorker))

	for _, dependency := range WorkerReadinessDependencies {
		if dependency != DependencyIM {
			r.MarkDependencyReady(dependency)
		}
	}
	if got := r.Snapshot(); got.Status != "not_ready" || got.Dependencies[DependencyIM] != DependencyPending {
		t.Fatalf("worker must remain not_ready while IM barrier is pending: %+v", got)
	}

	r.MarkDependency(DependencyIM, DependencyFailed)
	if got := r.Snapshot(); got.Status != "not_ready" {
		t.Fatalf("failed worker dependency must return not_ready: %+v", got)
	}
	r.MarkDependencyReady(DependencyIM)
	if got := r.Snapshot(); got.Status != "ready" {
		t.Fatalf("worker should become ready after all barriers: %+v", got)
	}
}

func TestWebReadinessRequiresRedisSubscriberAndListener(t *testing.T) {
	r := NewReadiness(RoleWeb, "0123456789abcdef0123456789abcdef01234567", "release")
	r.ConfigureForPlan(NewLifecyclePlan(RoleWeb))
	for _, dependency := range WebReadinessDependencies {
		if dependency != DependencySystemSettingsSubscriber {
			r.MarkDependencyReady(dependency)
		}
	}
	r.MarkAcceptingTraffic()
	if got := r.Snapshot(); got.Status != "not_ready" {
		t.Fatalf("web must remain not_ready without settings subscriber: %+v", got)
	}
	r.MarkDependencyReady(DependencySystemSettingsSubscriber)
	if got := r.Snapshot(); got.Status != "ready" {
		t.Fatalf("web should become ready after subscriber barrier: %+v", got)
	}
}
