package container

import (
	"context"
	"errors"
	"fmt"

	"github.com/Tencent/WeKnora/internal/logger"
	weknoraRuntime "github.com/Tencent/WeKnora/internal/runtime"
)

// databasePreparationHooks makes the prepare mutation boundary explicit and
// fault-injectable. No web or worker path calls this module.
type databasePreparationHooks struct {
	Migrate               func() error
	ResolveStoragePending func() error
	MigrateLegacyStorage  func() error
	LoadModelCatalog      func() error
}

func runDatabasePreparation(plan weknoraRuntime.LifecyclePlan, autoMigrate bool, hooks databasePreparationHooks) error {
	if !plan.OwnsDatabaseBootstrap {
		return nil
	}
	strict := plan.Role == weknoraRuntime.RolePrepare
	var errs error
	run := func(name string, hook func() error) {
		var err error
		if hook == nil {
			err = errors.New("startup hook is not configured")
		} else {
			err = hook()
		}
		if err == nil {
			return
		}
		wrapped := fmt.Errorf("%s: %w", name, err)
		if strict {
			errs = errors.Join(errs, wrapped)
			return
		}
		logger.Warnf(context.Background(), "[database preparation] %v", wrapped)
	}

	if autoMigrate {
		run("migrations", hooks.Migrate)
		run("storage pending resolution", hooks.ResolveStoragePending)
		run("legacy storage migration", hooks.MigrateLegacyStorage)
	} else if strict {
		errs = errors.Join(errs, errors.New("prepare refuses AUTO_MIGRATE=false because schema preparation was not executed"))
	}
	run("model catalog", hooks.LoadModelCatalog)
	return errs
}
