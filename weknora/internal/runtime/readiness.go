package runtime

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
)

// DependencyState is the stable readiness state emitted by /readyz.
type DependencyState string

const (
	DependencyPending  DependencyState = "pending"
	DependencyReady    DependencyState = "ready"
	DependencyDisabled DependencyState = "disabled"
	DependencyFailed   DependencyState = "failed"
)

const (
	DependencyRevision                 = "revision"
	DependencyDatabase                 = "database"
	DependencyRedis                    = "redis"
	DependencyStorage                  = "storage"
	DependencyDuckDB                   = "duckdb"
	DependencyAsynq                    = "asynq"
	DependencyDataSourceScheduler      = "datasource_scheduler"
	DependencyTemporaryCleanup         = "temporary_cleanup"
	DependencyHousekeeping             = "housekeeping"
	DependencyAuditRetention           = "audit_retention"
	DependencyWikiRecovery             = "wiki_recovery"
	DependencyIM                       = "im_background"
	DependencyInterruptedTaskReset     = "interrupted_task_reset"
	DependencyWorkerListener           = "worker_listener"
	DependencySystemSettingsSubscriber = "system_settings_subscriber"
	DependencyHTTPListener             = "http_listener"
	DependencyIMRoutes                 = "im_routes"
	DependencyMigrations               = "migrations"
	DependencyStoragePending           = "storage_pending"
	DependencyLegacyStorage            = "legacy_storage"
	DependencyModelCatalog             = "model_catalog"
	DependencyBootstrap                = "bootstrap"
)

// WorkerReadinessDependencies is the complete set of worker startup barriers.
// It is exported so probes/tests and the process entrypoint cannot drift.
var WorkerReadinessDependencies = []string{
	DependencyRevision,
	DependencyDatabase,
	DependencyRedis,
	DependencyStorage,
	DependencyDuckDB,
	DependencyAsynq,
	DependencyDataSourceScheduler,
	DependencyTemporaryCleanup,
	DependencyHousekeeping,
	DependencyAuditRetention,
	DependencyWikiRecovery,
	DependencyIM,
	DependencyInterruptedTaskReset,
	DependencyWorkerListener,
}

// WebReadinessDependencies is the complete set of request-process barriers.
var WebReadinessDependencies = []string{
	DependencyRevision,
	DependencyDatabase,
	DependencyRedis,
	DependencyStorage,
	DependencyDuckDB,
	DependencySystemSettingsSubscriber,
	DependencyIMRoutes,
	DependencyHTTPListener,
}

var prepareReadinessDependencies = []string{
	DependencyRevision,
	DependencyDatabase,
	DependencyStorage,
	DependencyDuckDB,
	DependencyMigrations,
	DependencyStoragePending,
	DependencyLegacyStorage,
	DependencyModelCatalog,
	DependencyBootstrap,
}

// ReadinessSnapshot is the public, machine-readable /readyz response. The
// release marker is deliberately separate from revision so operators can
// correlate a running process with a deployment transaction without exposing
// arbitrary environment variables.
type ReadinessSnapshot struct {
	Status           string                     `json:"status"`
	Role             RuntimeRole                `json:"role"`
	Revision         string                     `json:"revision"`
	AcceptingTraffic bool                       `json:"accepting_traffic"`
	ReleaseMarker    string                     `json:"release_marker"`
	Dependencies     map[string]DependencyState `json:"dependencies"`
}

// Readiness is a concurrency-safe process readiness register. Liveness is
// intentionally separate: /health remains a cheap process probe while
// /readyz waits for dependencies and traffic acceptance.
type Readiness struct {
	mu               sync.RWMutex
	role             RuntimeRole
	revision         string
	releaseMarker    string
	acceptingTraffic bool
	dependencies     map[string]DependencyState
}

// NewReadiness creates a readiness register with the database dependency
// pending. Callers mark it ready only after container construction and any
// role-specific startup work has completed.
func NewReadiness(role RuntimeRole, revision, releaseMarker string) *Readiness {
	if role == "" {
		role = RoleAll
	}
	if strings.TrimSpace(revision) == "" {
		revision = firstEnv("WEKNORA_PRODUCTION_REVISION", "WEKNORA_BUILD_REVISION", "GIT_SHA")
	}
	if strings.TrimSpace(revision) == "" {
		revision = "unknown"
	}
	if strings.TrimSpace(releaseMarker) == "" {
		releaseMarker = firstEnv("WEKNORA_RELEASE_MARKER", "RELEASE_MARKER", "MUSUW_RELEASE_MARKER")
	}
	if strings.TrimSpace(releaseMarker) == "" {
		if revision == "unknown" {
			releaseMarker = "unknown"
		} else {
			releaseMarker = "weknora/" + string(role) + "/" + revision
		}
	}
	return &Readiness{
		role:          role,
		revision:      revision,
		releaseMarker: releaseMarker,
		dependencies: map[string]DependencyState{
			"database": DependencyPending,
		},
	}
}

// ConfigureForPlan installs all role-owned barriers in the pending state.
// Startup code may only transition a barrier after the corresponding
// subsystem has successfully registered or passed its dependency check.
func (r *Readiness) ConfigureForPlan(plan LifecyclePlan) {
	if r == nil {
		return
	}
	var names []string
	switch plan.Role {
	case RoleWeb:
		names = WebReadinessDependencies
	case RoleWorker:
		names = WorkerReadinessDependencies
	case RolePrepare:
		names = prepareReadinessDependencies
	default:
		names = []string{DependencyDatabase, DependencyRedis, DependencyHTTPListener}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.dependencies = make(map[string]DependencyState, len(names))
	for _, name := range names {
		r.dependencies[name] = DependencyPending
	}
}

// MarkDependency records a named dependency state. Empty names are ignored so
// a caller cannot accidentally create an unobservable readiness condition.
func (r *Readiness) MarkDependency(name string, state DependencyState) {
	if r == nil || strings.TrimSpace(name) == "" {
		return
	}
	if state == "" {
		state = DependencyPending
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.dependencies[strings.TrimSpace(name)] = state
}

// MarkDependencyReady is a convenience for the common successful path.
func (r *Readiness) MarkDependencyReady(name string) {
	r.MarkDependency(name, DependencyReady)
}

// MarkAcceptingTraffic records that the HTTP listener is bound and the
// process may receive traffic. Worker and prepare roles do not need to call
// this method because they deliberately do not expose a public listener.
func (r *Readiness) MarkAcceptingTraffic() {
	if r == nil {
		return
	}
	r.mu.Lock()
	r.acceptingTraffic = true
	r.mu.Unlock()
}

// Snapshot returns a defensive copy suitable for logging or JSON encoding.
func (r *Readiness) Snapshot() ReadinessSnapshot {
	if r == nil {
		return ReadinessSnapshot{
			Status:        "not_ready",
			Role:          RoleAll,
			Revision:      "unknown",
			ReleaseMarker: "unknown",
			Dependencies:  map[string]DependencyState{"readiness": DependencyFailed},
		}
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	deps := make(map[string]DependencyState, len(r.dependencies))
	ready := true
	for name, state := range r.dependencies {
		deps[name] = state
		if state != DependencyReady && state != DependencyDisabled {
			ready = false
		}
	}
	if r.role == RoleWeb || r.role == RoleAll {
		if !r.acceptingTraffic {
			ready = false
		}
	}
	status := "ready"
	if !ready {
		status = "not_ready"
	}
	return ReadinessSnapshot{
		Status:           status,
		Role:             r.role,
		Revision:         r.revision,
		AcceptingTraffic: r.acceptingTraffic,
		ReleaseMarker:    r.releaseMarker,
		Dependencies:     deps,
	}
}

// ReadyzHandler serves the stable readiness endpoint. It never returns a
// redirect or an HTML error page so probes and release transactions can parse
// the same JSON shape on both success and failure.
func (r *Readiness) ReadyzHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		snapshot := r.Snapshot()
		status := http.StatusOK
		if snapshot.Status != "ready" {
			status = http.StatusServiceUnavailable
		}
		w.Header().Set("Content-Type", "application/json")
		// Readiness changes with process state; intermediaries must not cache a
		// transient 503 (or a stale 200) across a release probe.
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(snapshot)
	})
}

func firstEnv(names ...string) string {
	for _, name := range names {
		if value := strings.TrimSpace(os.Getenv(name)); value != "" {
			return value
		}
	}
	return ""
}

var (
	readinessMu      sync.RWMutex
	processReadiness *Readiness
)

// SetProcessReadiness installs the readiness register used by the default
// router wiring. Tests and embedded callers can bypass this global by passing
// a Readiness value directly through RouterParams.
func SetProcessReadiness(readiness *Readiness) {
	readinessMu.Lock()
	processReadiness = readiness
	readinessMu.Unlock()
}

// ProcessReadiness returns the readiness register installed for the process.
func ProcessReadiness() *Readiness {
	readinessMu.RLock()
	defer readinessMu.RUnlock()
	return processReadiness
}
