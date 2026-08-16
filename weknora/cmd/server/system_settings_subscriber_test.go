package main

import (
	"context"
	"errors"
	"testing"

	"github.com/Tencent/WeKnora/internal/runtime"
)

type settingsSubscriberStub struct {
	called bool
	err    error
}

func (s *settingsSubscriberStub) SubscribeRedis(context.Context) error {
	s.called = true
	return s.err
}

func TestWebStartsSystemSettingsSubscriberAndFailsReadinessOnError(t *testing.T) {
	readiness := runtime.NewReadiness(runtime.RoleWeb, "revision", "release")
	readiness.ConfigureForPlan(runtime.NewLifecyclePlan(runtime.RoleWeb))
	want := errors.New("subscribe failed")
	stub := &settingsSubscriberStub{err: want}
	err := startSystemSettingsSubscriber(context.Background(), runtime.NewLifecyclePlan(runtime.RoleWeb), readiness, stub)
	if !stub.called || !errors.Is(err, want) {
		t.Fatalf("subscriber called=%v error=%v, want called and wrapped %v", stub.called, err, want)
	}
	if got := readiness.Snapshot().Dependencies[runtime.DependencySystemSettingsSubscriber]; got != runtime.DependencyFailed {
		t.Fatalf("subscriber dependency = %q, want failed", got)
	}
}
