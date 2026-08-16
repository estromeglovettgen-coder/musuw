package im

import "testing"

func TestNewServiceDoesNotStartBackgroundLoopsDuringWebWiring(t *testing.T) {
	service := NewService(nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	if service.runtimeStarted.Load() {
		t.Fatal("NewService started IM request/background loops during construction")
	}
	service.Stop()
}
