package runtime

import (
	"encoding/json"
	"net/http"
)

// WorkerReadinessAddr is intentionally loopback-only. Worker containers do
// not expose business HTTP; this private probe is available only to the
// container supervisor (and is not published by the release Compose topology).
const WorkerReadinessAddr = "127.0.0.1:8081"

// NewWorkerReadinessHandler exposes only liveness and readiness probes for a
// worker's loopback listener. It deliberately does not share the Gin router,
// so accidentally publishing the worker port cannot expose business routes.
func NewWorkerReadinessHandler(readiness *Readiness) http.Handler {
	if readiness == nil {
		readiness = NewReadiness(RoleWorker, "", "")
	}
	mux := http.NewServeMux()
	mux.Handle("/readyz", readiness.ReadyzHandler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	return mux
}
