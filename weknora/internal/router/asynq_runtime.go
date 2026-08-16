package router

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/hibiken/asynq"
)

type managedAsynqServer interface {
	Start(asynq.Handler) error
	Shutdown()
}

type namedAsynqServer struct {
	name   string
	server managedAsynqServer
}

// AsynqRuntime owns every queue server as one lifecycle unit. Start is
// transactional: if a later pool cannot start, all earlier pools are drained
// before the error returns. Shutdown and Wait give the process cleaner an
// explicit barrier before database and storage resources are released.
type AsynqRuntime struct {
	handler asynq.Handler
	pools   []namedAsynqServer

	mu       sync.Mutex
	started  []namedAsynqServer
	startRun bool
	stopOnce sync.Once
	done     chan struct{}
}

func newAsynqRuntime(handler asynq.Handler, pools []namedAsynqServer) *AsynqRuntime {
	return &AsynqRuntime{handler: handler, pools: pools, done: make(chan struct{})}
}

func (r *AsynqRuntime) Start() error {
	if r == nil {
		return errors.New("asynq runtime is nil")
	}
	r.mu.Lock()
	if r.startRun {
		r.mu.Unlock()
		return errors.New("asynq runtime already started")
	}
	r.startRun = true
	r.mu.Unlock()
	if r.handler == nil {
		r.Shutdown()
		return errors.New("asynq runtime requires a handler")
	}
	for _, pool := range r.pools {
		if pool.server == nil {
			r.Shutdown()
			return fmt.Errorf("start %s asynq pool: server is nil", pool.name)
		}
		if err := pool.server.Start(r.handler); err != nil {
			r.Shutdown()
			return fmt.Errorf("start %s asynq pool: %w", pool.name, err)
		}
		r.mu.Lock()
		r.started = append(r.started, pool)
		r.mu.Unlock()
	}
	return nil
}

func (r *AsynqRuntime) Shutdown() {
	if r == nil {
		return
	}
	r.stopOnce.Do(func() {
		r.mu.Lock()
		started := append([]namedAsynqServer(nil), r.started...)
		r.mu.Unlock()
		var wg sync.WaitGroup
		for _, pool := range started {
			wg.Add(1)
			go func(server managedAsynqServer) {
				defer wg.Done()
				server.Shutdown()
			}(pool.server)
		}
		wg.Wait()
		close(r.done)
	})
}

func (r *AsynqRuntime) Wait() {
	if r != nil {
		<-r.done
	}
}

func (r *AsynqRuntime) ShutdownWithin(timeout time.Duration) error {
	if r == nil {
		return nil
	}
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	go r.Shutdown()
	select {
	case <-r.done:
		return nil
	case <-time.After(timeout):
		// The deadline is diagnostic, not permission to tear down resources
		// used by in-flight handlers. Real asynq.Server instances bound their
		// own drain with Config.ShutdownTimeout; waiting here preserves the
		// hard lifecycle barrier even if a server implementation exceeds that
		// contract. Returning before done would let ResourceCleaner close the
		// database and DuckDB underneath still-running handlers.
		<-r.done
		return fmt.Errorf("asynq graceful drain exceeded %s", timeout)
	}
}
