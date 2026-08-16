package router

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/hibiken/asynq"
)

type fakeAsynqServer struct {
	startErr error
	started  atomic.Int32
	stopped  atomic.Int32
	block    <-chan struct{}
}

func (s *fakeAsynqServer) Start(asynq.Handler) error {
	s.started.Add(1)
	return s.startErr
}

func (s *fakeAsynqServer) Shutdown() {
	if s.block != nil {
		<-s.block
	}
	s.stopped.Add(1)
}

func TestAsynqRuntimeStartFailureDrainsPreviouslyStartedPools(t *testing.T) {
	first := &fakeAsynqServer{}
	want := errors.New("second pool refused startup")
	second := &fakeAsynqServer{startErr: want}
	runtime := newAsynqRuntime(asynq.HandlerFunc(func(context.Context, *asynq.Task) error { return nil }), []namedAsynqServer{
		{name: "first", server: first},
		{name: "second", server: second},
	})
	if err := runtime.Start(); !errors.Is(err, want) {
		t.Fatalf("Start() error = %v, want wrapped %v", err, want)
	}
	runtime.Wait()
	if first.stopped.Load() != 1 {
		t.Fatalf("previously started pool shutdown count = %d, want 1", first.stopped.Load())
	}
	if second.stopped.Load() != 0 {
		t.Fatalf("failed pool shutdown count = %d, want 0", second.stopped.Load())
	}
}

func TestAsynqRuntimeShutdownWaitsForEveryPool(t *testing.T) {
	first := &fakeAsynqServer{}
	second := &fakeAsynqServer{}
	runtime := newAsynqRuntime(asynq.HandlerFunc(func(context.Context, *asynq.Task) error { return nil }), []namedAsynqServer{
		{name: "first", server: first},
		{name: "second", server: second},
	})
	if err := runtime.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	runtime.Shutdown()
	runtime.Wait()
	if first.stopped.Load() != 1 || second.stopped.Load() != 1 {
		t.Fatalf("shutdown counts = (%d,%d), want (1,1)", first.stopped.Load(), second.stopped.Load())
	}
}

func TestAsynqRuntimeShutdownTimeoutStillWaitsBeforeDependentCleanup(t *testing.T) {
	unblock := make(chan struct{})
	server := &fakeAsynqServer{block: unblock}
	runtime := newAsynqRuntime(asynq.HandlerFunc(func(context.Context, *asynq.Task) error { return nil }), []namedAsynqServer{
		{name: "blocked", server: server},
	})
	if err := runtime.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	go func() {
		time.Sleep(30 * time.Millisecond)
		close(unblock)
	}()
	started := time.Now()
	if err := runtime.ShutdownWithin(10 * time.Millisecond); err == nil {
		t.Fatal("ShutdownWithin() error = nil, want timeout")
	}
	if elapsed := time.Since(started); elapsed < 25*time.Millisecond {
		t.Fatalf("ShutdownWithin() returned after %s while server was still active", elapsed)
	}
	if server.stopped.Load() != 1 {
		t.Fatalf("shutdown count = %d, want 1 before dependent cleanup", server.stopped.Load())
	}
}
