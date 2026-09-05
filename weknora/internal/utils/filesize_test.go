package utils

import "testing"

func TestGetMaxVideoFileSizeBytesDefault(t *testing.T) {
	t.Setenv("VIDEO_MAX_BYTES", "")
	if got := GetMaxVideoFileSizeBytes(); got != 300_000_000 {
		t.Fatalf("default video upload limit = %d, want 300000000", got)
	}
}

func TestGetMaxVideoFileSizeBytesOverrideAndInvalidValues(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  int64
	}{
		{name: "positive", value: "123456789", want: 123456789},
		{name: "zero", value: "0", want: 300_000_000},
		{name: "negative", value: "-1", want: 300_000_000},
		{name: "fraction", value: "1.5", want: 300_000_000},
		{name: "overflow", value: "999999999999999999999999", want: 300_000_000},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("VIDEO_MAX_BYTES", tt.value)
			if got := GetMaxVideoFileSizeBytes(); got != tt.want {
				t.Fatalf("VIDEO_MAX_BYTES=%q: got %d, want %d", tt.value, got, tt.want)
			}
		})
	}
}
