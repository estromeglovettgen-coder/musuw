package runtime

import (
	"strings"
	"testing"
)

func TestParseRuntimeRoleDefaultsAndNormalizes(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want RuntimeRole
	}{
		{name: "empty defaults to all", raw: "", want: RoleAll},
		{name: "whitespace defaults to all", raw: "  ", want: RoleAll},
		{name: "case is normalized", raw: " Web ", want: RoleWeb},
		{name: "worker", raw: "worker", want: RoleWorker},
		{name: "prepare", raw: "prepare", want: RolePrepare},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseRuntimeRole(tt.raw)
			if err != nil {
				t.Fatalf("ParseRuntimeRole(%q) error: %v", tt.raw, err)
			}
			if got != tt.want {
				t.Fatalf("ParseRuntimeRole(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestParseRuntimeRoleRejectsUnknownBeforeLifecycleConstruction(t *testing.T) {
	if _, err := ParseRuntimeRole("web-worker"); err == nil {
		t.Fatal("ParseRuntimeRole should reject unknown role")
	}
}

func TestLifecyclePlanSeparatesDatabaseAndBackgroundOwnership(t *testing.T) {
	all := NewLifecyclePlan(RoleAll)
	if !all.OwnsDatabaseBootstrap || !all.ServesHTTP || !all.RunsWorkers || !all.RunsIMBackground || !all.ProvidesIMRequestRoutes {
		t.Fatalf("all plan lost compatibility responsibilities: %+v", all)
	}

	web := NewLifecyclePlan(RoleWeb)
	if !web.ServesHTTP || !web.EnqueuesInteractive || !web.RequiresRedis || !web.ProvidesIMRequestRoutes || web.OwnsDatabaseBootstrap || web.RunsWorkers ||
		web.RunsDataSourceScheduler || web.RunsTemporaryCleanup || web.RunsHousekeeping ||
		web.RunsAuditRetention || web.RecoversWikiTasks || web.RunsIMBackground || web.RunsStartupBootstrap {
		t.Fatalf("web plan has forbidden responsibilities: %+v", web)
	}

	worker := NewLifecyclePlan(RoleWorker)
	if worker.ServesHTTP || !worker.RequiresRedis || !worker.RunsWorkers || !worker.RunsDataSourceScheduler ||
		!worker.RunsTemporaryCleanup || !worker.RunsHousekeeping || !worker.RunsAuditRetention ||
		!worker.RecoversWikiTasks || !worker.RunsIMBackground || !worker.ResetsInterruptedTasks || worker.ProvidesIMRequestRoutes ||
		worker.OwnsDatabaseBootstrap || worker.RunsStartupBootstrap {
		t.Fatalf("worker plan has invalid responsibilities: %+v", worker)
	}

	prepare := NewLifecyclePlan(RolePrepare)
	if !prepare.OwnsDatabaseBootstrap || !prepare.RunsStartupBootstrap || prepare.ServesHTTP ||
		prepare.RunsWorkers || prepare.RunsDataSourceScheduler || prepare.RunsTemporaryCleanup ||
		prepare.RunsHousekeeping || prepare.RunsAuditRetention || prepare.RecoversWikiTasks ||
		prepare.RunsIMBackground || prepare.ResetsInterruptedTasks {
		t.Fatalf("prepare plan has forbidden responsibilities: %+v", prepare)
	}
}

func TestValidateRevisionProvenanceRequiresMatchingFullSHAForSplitRoles(t *testing.T) {
	const sha = "0123456789abcdef0123456789abcdef01234567"
	for _, role := range []RuntimeRole{RoleWeb, RoleWorker, RolePrepare} {
		t.Run(string(role), func(t *testing.T) {
			got, err := ValidateRevisionProvenance(role, strings.ToUpper(sha), sha)
			if err != nil {
				t.Fatalf("ValidateRevisionProvenance() error = %v", err)
			}
			if got != sha {
				t.Fatalf("validated revision = %q, want %q", got, sha)
			}
		})
	}

	bad := []struct {
		name     string
		env      string
		compiled string
	}{
		{name: "missing env", env: "", compiled: sha},
		{name: "short env", env: sha[:12], compiled: sha},
		{name: "unknown compiled", env: sha, compiled: "unknown"},
		{name: "mismatch", env: sha, compiled: "1123456789abcdef0123456789abcdef01234567"},
	}
	for _, tt := range bad {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := ValidateRevisionProvenance(RoleWeb, tt.env, tt.compiled); err == nil {
				t.Fatal("ValidateRevisionProvenance() error = nil, want fail-closed error")
			}
		})
	}
}

func TestValidateRevisionProvenanceKeepsLegacyAllCompatibility(t *testing.T) {
	got, err := ValidateRevisionProvenance(RoleAll, "", "unknown")
	if err != nil || got != "unknown" {
		t.Fatalf("legacy all validation = (%q, %v), want (unknown, nil)", got, err)
	}
}

func TestValidateRoleConfigurationRejectsRedislessSplitRuntime(t *testing.T) {
	getenv := func(string) string { return "" }
	for _, role := range []RuntimeRole{RoleWeb, RoleWorker} {
		if err := ValidateRoleConfiguration(NewLifecyclePlan(role), getenv); err == nil {
			t.Fatalf("%s without Redis should fail closed", role)
		}
	}
	if err := ValidateRoleConfiguration(NewLifecyclePlan(RoleAll), getenv); err != nil {
		t.Fatalf("all must preserve Redis-less compatibility: %v", err)
	}
}
