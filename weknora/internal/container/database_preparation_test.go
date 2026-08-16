package container

import (
	"errors"
	"strings"
	"testing"

	weknoraRuntime "github.com/Tencent/WeKnora/internal/runtime"
)

func TestPrepareDatabaseHooksAggregateEveryFailedMutation(t *testing.T) {
	wantMigration := errors.New("migration failed")
	wantPending := errors.New("pending storage failed")
	wantLegacy := errors.New("legacy storage failed")
	wantCatalog := errors.New("catalog failed")
	called := make(map[string]bool)
	err := runDatabasePreparation(weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RolePrepare), true, databasePreparationHooks{
		Migrate:               func() error { called["migration"] = true; return wantMigration },
		ResolveStoragePending: func() error { called["pending"] = true; return wantPending },
		MigrateLegacyStorage:  func() error { called["legacy"] = true; return wantLegacy },
		LoadModelCatalog:      func() error { called["catalog"] = true; return wantCatalog },
	})
	for _, want := range []error{wantMigration, wantPending, wantLegacy, wantCatalog} {
		if !errors.Is(err, want) {
			t.Fatalf("aggregate error %v does not include %v", err, want)
		}
	}
	for _, step := range []string{"migration", "pending", "legacy", "catalog"} {
		if !called[step] {
			t.Fatalf("prepare did not execute independent %s hook", step)
		}
	}
}

func TestPrepareDatabaseHooksRejectDisabledMigration(t *testing.T) {
	err := runDatabasePreparation(weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RolePrepare), false, databasePreparationHooks{
		LoadModelCatalog: func() error { return nil },
	})
	if err == nil || !strings.Contains(err.Error(), "AUTO_MIGRATE=false") {
		t.Fatalf("prepare error = %v, want disabled migration refusal", err)
	}
}

func TestAllDatabaseHooksRetainBestEffortCompatibility(t *testing.T) {
	err := runDatabasePreparation(weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RoleAll), true, databasePreparationHooks{
		Migrate:               func() error { return errors.New("migration") },
		ResolveStoragePending: func() error { return errors.New("pending") },
		MigrateLegacyStorage:  func() error { return errors.New("legacy") },
		LoadModelCatalog:      func() error { return errors.New("catalog") },
	})
	if err != nil {
		t.Fatalf("all role should preserve best-effort startup, got %v", err)
	}
}
