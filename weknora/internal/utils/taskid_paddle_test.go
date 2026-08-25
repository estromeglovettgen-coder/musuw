package utils

import "testing"

func TestPaddleWebhookTaskIDIsDeterministicAndDistinct(t *testing.T) {
	first := PaddleWebhookTaskID("evt_abc")
	if first == "" {
		t.Fatal("expected task id")
	}
	if got := PaddleWebhookTaskID("evt_abc"); got != first {
		t.Fatalf("same event id produced different task ids: %q != %q", first, got)
	}
	if got := PaddleWebhookTaskID("evt_other"); got == first {
		t.Fatal("different event ids must not coalesce")
	}
	if got := PaddleWebhookTaskID(""); got != "" {
		t.Fatalf("empty event id = %q, want empty", got)
	}
}
