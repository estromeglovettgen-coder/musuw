package container

import (
	"context"

	"github.com/Tencent/WeKnora/internal/logger"
	weknoraRuntime "github.com/Tencent/WeKnora/internal/runtime"
)

// finishStartupBarrier is the single role-aware startup error policy. Split
// roles fail closed; RoleAll keeps historical best-effort background startup
// while exposing the failed dependency through /readyz.
func finishStartupBarrier(plan weknoraRuntime.LifecyclePlan, dependency string, err error) error {
	readiness := weknoraRuntime.ProcessReadiness()
	if err == nil {
		if readiness != nil {
			readiness.MarkDependencyReady(dependency)
		}
		return nil
	}
	if readiness != nil {
		readiness.MarkDependency(dependency, weknoraRuntime.DependencyFailed)
	}
	if plan.Role == weknoraRuntime.RoleAll {
		logger.Warnf(context.Background(), "[runtime] %s startup barrier failed (all compatibility mode continues): %v", dependency, err)
		return nil
	}
	return err
}
