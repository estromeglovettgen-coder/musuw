package runtime

import (
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

// RuntimeRole selects the process responsibilities owned by one WeKnora
// process. The default is RoleAll so existing deployments retain their
// single-process behaviour until they opt into an explicit split.
type RuntimeRole string

const (
	// RuntimeRoleEnv is the process role selector.
	RuntimeRoleEnv = "WEKNORA_RUNTIME_ROLE"
	// RoleAll keeps the historical web plus worker process behaviour.
	RoleAll RuntimeRole = "all"
	// RoleWeb serves public HTTP and request-scoped interactive work.
	RoleWeb RuntimeRole = "web"
	// RoleWorker owns background queues and maintenance loops.
	RoleWorker RuntimeRole = "worker"
	// RolePrepare runs database preparation and exits without serving traffic.
	RolePrepare RuntimeRole = "prepare"
)

// ParseRuntimeRole parses the operator-facing role value. Empty input is an
// intentional compatibility default; every non-empty value must be one of the
// documented roles so a typo cannot silently start the wrong process class.
func ParseRuntimeRole(raw string) (RuntimeRole, error) {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" {
		return RoleAll, nil
	}
	role := RuntimeRole(value)
	switch role {
	case RoleAll, RoleWeb, RoleWorker, RolePrepare:
		return role, nil
	default:
		return "", fmt.Errorf("invalid %s=%q; expected all, web, worker, or prepare", RuntimeRoleEnv, raw)
	}
}

// ResolveRuntimeRole resolves the process role from the environment.
func ResolveRuntimeRole() (RuntimeRole, error) {
	return ParseRuntimeRole(os.Getenv(RuntimeRoleEnv))
}

// LifecyclePlan is the authoritative lifecycle contract for a process role.
// Container wiring and the server entrypoint consume this plan instead of
// reinterpreting WEKNORA_RUNTIME_ROLE at individual call sites.
type LifecyclePlan struct {
	Role RuntimeRole

	OwnsDatabaseBootstrap   bool
	ServesHTTP              bool
	RunsWorkers             bool
	EnqueuesInteractive     bool
	RunsDataSourceScheduler bool
	RunsTemporaryCleanup    bool
	RunsHousekeeping        bool
	RunsAuditRetention      bool
	RecoversWikiTasks       bool
	RunsIMBackground        bool
	RunsStartupBootstrap    bool
	ResetsInterruptedTasks  bool
	RequiresRedis           bool
	ProvidesIMRequestRoutes bool
}

// NewLifecyclePlan returns the complete lifecycle contract for role. An
// invalid role yields an inert plan; production entrypoints resolve and
// validate the role before constructing a container, so this fail-closed
// fallback cannot accidentally start a process with ambiguous ownership.
func NewLifecyclePlan(role RuntimeRole) LifecyclePlan {
	if role == "" {
		role = RoleAll
	}
	plan := LifecyclePlan{Role: role}
	switch role {
	case RoleWeb:
		plan.ServesHTTP = true
		plan.EnqueuesInteractive = true
		plan.RequiresRedis = true
		plan.ProvidesIMRequestRoutes = true
	case RoleWorker:
		plan.RequiresRedis = true
		plan.RunsWorkers = true
		plan.EnqueuesInteractive = true
		plan.RunsDataSourceScheduler = true
		plan.RunsTemporaryCleanup = true
		plan.RunsHousekeeping = true
		plan.RunsAuditRetention = true
		plan.RecoversWikiTasks = true
		plan.RunsIMBackground = true
		plan.ResetsInterruptedTasks = true
	case RolePrepare:
		plan.OwnsDatabaseBootstrap = true
		plan.RunsStartupBootstrap = true
	case RoleAll:
		plan.OwnsDatabaseBootstrap = true
		plan.ServesHTTP = true
		plan.RunsWorkers = true
		plan.EnqueuesInteractive = true
		plan.RunsDataSourceScheduler = true
		plan.RunsTemporaryCleanup = true
		plan.RunsHousekeeping = true
		plan.RunsAuditRetention = true
		plan.RecoversWikiTasks = true
		plan.RunsIMBackground = true
		plan.RunsStartupBootstrap = true
		plan.ResetsInterruptedTasks = true
		plan.ProvidesIMRequestRoutes = true
	}
	return plan
}

// ValidateRoleConfiguration rejects split runtimes that would otherwise fall
// back to the in-process Lite executor. Lite mode launches work in request
// goroutines and therefore violates both web/worker ownership and release
// readiness. RoleAll intentionally retains the historical Redis-less mode.
func ValidateRoleConfiguration(plan LifecyclePlan, getenv func(string) string) error {
	if getenv == nil {
		getenv = os.Getenv
	}
	if plan.RequiresRedis && strings.TrimSpace(getenv("REDIS_ADDR")) == "" {
		return fmt.Errorf("%s role requires REDIS_ADDR; refusing Lite background execution", plan.Role)
	}
	return nil
}

// ValidateRevisionProvenance binds the operator-supplied production revision
// to the revision compiled into the binary. Split roles are release-only and
// always require an exact full Git SHA. RoleAll keeps local-development
// compatibility when the production variable is absent, but validates it when
// operators explicitly provide one.
func ValidateRevisionProvenance(role RuntimeRole, productionRevision, compiledRevision string) (string, error) {
	productionRevision = strings.ToLower(strings.TrimSpace(productionRevision))
	compiledRevision = strings.ToLower(strings.TrimSpace(compiledRevision))
	if role == RoleAll && productionRevision == "" {
		return "unknown", nil
	}
	if !isFullGitSHA(productionRevision) {
		return "", fmt.Errorf("WEKNORA_PRODUCTION_REVISION must be a full 40-hex Git SHA for role %s", role)
	}
	if !isFullGitSHA(compiledRevision) {
		return "", fmt.Errorf("compiled CommitID must be a full 40-hex Git SHA for role %s", role)
	}
	if productionRevision != compiledRevision {
		return "", fmt.Errorf("revision provenance mismatch: environment %s does not match compiled %s", productionRevision, compiledRevision)
	}
	return productionRevision, nil
}

func isFullGitSHA(value string) bool {
	if len(value) != 40 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

// IsPrepare reports whether the process is a one-shot preparation process.
func (p LifecyclePlan) IsPrepare() bool { return p.Role == RolePrepare }
