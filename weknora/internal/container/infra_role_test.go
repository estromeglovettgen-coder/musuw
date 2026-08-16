package container

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	weknoraRuntime "github.com/Tencent/WeKnora/internal/runtime"
)

func TestSplitRolesNeverIssueDuckDBInstall(t *testing.T) {
	for _, role := range []weknoraRuntime.RuntimeRole{weknoraRuntime.RoleWeb, weknoraRuntime.RoleWorker} {
		statements := duckDBExtensionStatements(weknoraRuntime.NewLifecyclePlan(role))
		joined := strings.ToUpper(strings.Join(statements, " "))
		if strings.Contains(joined, "INSTALL ") {
			t.Fatalf("%s DuckDB statements contain startup mutation: %v", role, statements)
		}
		if !strings.Contains(joined, "AUTOINSTALL_KNOWN_EXTENSIONS = FALSE") {
			t.Fatalf("%s must explicitly disable DuckDB extension auto-install: %v", role, statements)
		}
	}
}

func TestPrepareOwnsDuckDBExtensionInstallation(t *testing.T) {
	joined := strings.ToUpper(strings.Join(duckDBExtensionStatements(weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RolePrepare)), " "))
	if !strings.Contains(joined, "INSTALL SPATIAL") || !strings.Contains(joined, "INSTALL EXCEL") {
		t.Fatalf("prepare statements do not install required extensions: %s", joined)
	}
}

func TestSplitRoleCannotSkipDuckDBPrerequisiteVerification(t *testing.T) {
	t.Setenv("DUCKDB_SKIP_EXTENSION_LOAD", "1")
	if _, err := NewDuckDBForPlan(weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RoleWorker)); err == nil {
		t.Fatal("worker accepted DUCKDB_SKIP_EXTENSION_LOAD without verifying extensions")
	}
}

func TestSplitLocalStorageCheckDoesNotCreateDirectory(t *testing.T) {
	base := filepath.Join(t.TempDir(), "missing", "files")
	t.Setenv("STORAGE_TYPE", "local")
	t.Setenv("LOCAL_STORAGE_BASE_DIR", base)
	if _, err := initRawFileServiceWithPlan(nil, weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RoleWeb)); err == nil {
		t.Fatal("web local storage startup should fail when prepared directory is missing")
	}
	if _, err := os.Stat(base); !os.IsNotExist(err) {
		t.Fatalf("web startup created local storage path; stat error = %v", err)
	}
}

func TestPrepareCreatesLocalStorageDirectory(t *testing.T) {
	base := filepath.Join(t.TempDir(), "prepared", "files")
	t.Setenv("STORAGE_TYPE", "local")
	t.Setenv("LOCAL_STORAGE_BASE_DIR", base)
	if _, err := initRawFileServiceWithPlan(nil, weknoraRuntime.NewLifecyclePlan(weknoraRuntime.RolePrepare)); err != nil {
		t.Fatalf("prepare local storage error = %v", err)
	}
	if info, err := os.Stat(base); err != nil || !info.IsDir() {
		t.Fatalf("prepare did not create local storage directory: info=%v err=%v", info, err)
	}
}
