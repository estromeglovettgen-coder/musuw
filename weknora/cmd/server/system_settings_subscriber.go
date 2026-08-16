package main

import (
	"context"
	"fmt"

	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/runtime"
)

type redisSettingsSubscriber interface {
	SubscribeRedis(context.Context) error
}

func startSystemSettingsSubscriber(ctx context.Context, plan runtime.LifecyclePlan, readiness *runtime.Readiness, subscriber redisSettingsSubscriber) error {
	err := subscriber.SubscribeRedis(ctx)
	if err != nil {
		if plan.Role == runtime.RoleWeb {
			readiness.MarkDependency(runtime.DependencySystemSettingsSubscriber, runtime.DependencyFailed)
			return fmt.Errorf("system_settings Redis subscriber: %w", err)
		}
		logger.Warnf(ctx, "[system_settings] subscribe failed: %v", err)
		return nil
	}
	if plan.Role == runtime.RoleWeb {
		readiness.MarkDependencyReady(runtime.DependencySystemSettingsSubscriber)
	}
	return nil
}
