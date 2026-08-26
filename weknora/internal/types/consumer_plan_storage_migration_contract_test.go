package types

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	consumerPlanFreeStorageBytes = "1073741824"
	consumerPlanPlusStorageBytes = "10737418240"
	consumerPlanProStorageBytes  = "32212254720"
	consumerPlanMaxStorageBytes  = "107374182400"
)

func readMigrationContract(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read migration %s: %v", path, err)
	}
	return strings.ToLower(string(raw))
}

func assertConsumerPlanStorageBackfill(t *testing.T, sql, path string) {
	t.Helper()
	compact := strings.Join(strings.Fields(sql), " ")
	for _, want := range []string{
		"when lower(trim(coalesce(plan, ''))) = 'plus' then " + consumerPlanPlusStorageBytes,
		"when lower(trim(coalesce(plan, ''))) = 'pro' then " + consumerPlanProStorageBytes,
		"when lower(trim(coalesce(plan, ''))) = 'max' then " + consumerPlanMaxStorageBytes,
	} {
		if !strings.Contains(compact, want) {
			t.Errorf("%s must normalize and map %q", path, want)
		}
	}
	for _, want := range []string{
		"update tenants",
		"case",
		consumerPlanFreeStorageBytes,
		consumerPlanPlusStorageBytes,
		consumerPlanProStorageBytes,
		consumerPlanMaxStorageBytes,
		"else " + consumerPlanFreeStorageBytes,
		"where deleted_at is null",
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("%s must contain %q", path, want)
		}
	}
	for _, forbidden := range []string{
		"delete from",
		"truncate",
		"drop table",
		"storage_used =",
		"open_router_used_microusd =",
	} {
		if strings.Contains(sql, forbidden) {
			t.Errorf("%s must not contain destructive/usage mutation %q", path, forbidden)
		}
	}
}

func TestConsumerPlanStorageQuotaMigrationsHavePairedBackfillAndRollback(t *testing.T) {
	root := filepath.Join("..", "..", "migrations")
	cases := []struct {
		name        string
		upPath      string
		downPath    string
		defaultUp   string
		defaultDown string
	}{
		{
			name:        "postgres",
			upPath:      filepath.Join(root, "versioned", "000089_consumer_plan_storage_quota.up.sql"),
			downPath:    filepath.Join(root, "versioned", "000089_consumer_plan_storage_quota.down.sql"),
			defaultUp:   "alter column storage_quota set default " + consumerPlanFreeStorageBytes,
			defaultDown: "alter column storage_quota set default 5368709120",
		},
		{
			name:     "sqlite",
			upPath:   filepath.Join(root, "sqlite", "000008_consumer_plan_storage_quota.up.sql"),
			downPath: filepath.Join(root, "sqlite", "000008_consumer_plan_storage_quota.down.sql"),
			// SQLite cannot alter an existing column default without rebuilding
			// the table. The fresh flattened schema is asserted below; this
			// incremental migration only backfills existing rows.
			defaultUp:   "",
			defaultDown: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			up := readMigrationContract(t, tc.upPath)
			down := readMigrationContract(t, tc.downPath)
			assertConsumerPlanStorageBackfill(t, up, tc.upPath)
			if tc.defaultUp != "" && !strings.Contains(up, tc.defaultUp) {
				t.Errorf("%s must set the fresh storage default to 1 GiB", tc.upPath)
			}
			if tc.defaultDown != "" && !strings.Contains(down, tc.defaultDown) {
				t.Errorf("%s must restore the previous storage default", tc.downPath)
			}
			for _, forbidden := range []string{"delete from", "truncate", "drop table", "storage_used =", "open_router_used_microusd ="} {
				if strings.Contains(down, forbidden) {
					t.Errorf("%s must not contain destructive/usage mutation %q", tc.downPath, forbidden)
				}
			}
		})
	}
}

func TestConsumerPlanStorageQuotaFreshSchemasDefaultToOneGiB(t *testing.T) {
	root := filepath.Join("..", "..", "migrations")
	for _, path := range []string{
		filepath.Join(root, "versioned", "000000_init.up.sql"),
		filepath.Join(root, "sqlite", "000000_init.up.sql"),
		filepath.Join(root, "paradedb", "00-init-db.sql"),
		filepath.Join(root, "mysql", "00-init-db.sql"),
	} {
		sql := readMigrationContract(t, path)
		if !strings.Contains(sql, "storage_quota bigint not null default "+consumerPlanFreeStorageBytes) {
			t.Errorf("%s must default storage_quota to 1 GiB", path)
		}
	}
}
