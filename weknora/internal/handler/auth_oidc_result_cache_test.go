package handler

import (
	"context"
	"encoding/binary"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/synctest"
	"time"
)

func clearOIDCResultTestCache(cache *oidcCallbackResultCache) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	for key := range cache.entries {
		cache.removeLocked(key)
	}
}

func TestOIDCCallbackResultCacheFixedExpiryAndTimerRelease(t *testing.T) {
	// Go's isolated fake clock exercises real AfterFunc callbacks immediately;
	// this does not sleep for ten seconds of wall time.
	synctest.Test(t, func(t *testing.T) {
		var cache oidcCallbackResultCache
		defer clearOIDCResultTestCache(&cache)
		key := [32]byte{1}
		now := time.Now()
		cache.put(key, "synthetic-result", now)
		cache.mu.Lock()
		entry := cache.entries[key]
		cache.mu.Unlock()
		if entry == nil || !entry.expiresAt.Equal(now.Add(10*time.Second)) {
			t.Fatal("successful callback must have a fixed ten-second result window")
		}
		time.Sleep(9 * time.Second)
		if payload, ok := cache.get(key, time.Now()); !ok || payload != "synthetic-result" {
			t.Fatal("result expired before the fixed ten-second window")
		}
		time.Sleep(time.Second)
		synctest.Wait()
		// No get/put triggers expiry here: the real timer must release the token.
		cache.mu.Lock()
		remaining, retainedPayload := len(cache.entries), entry.payload
		cache.mu.Unlock()
		if remaining != 0 || retainedPayload != "" {
			t.Fatal("timer did not remove the result and release its payload at the original expiry")
		}
		if _, ok := cache.get(key, time.Now()); ok {
			t.Fatal("reading the result extended its expiry")
		}
	})
}

func TestOIDCCallbackResultCacheCapacityEvictsEarliestExpiry(t *testing.T) {
	var cache oidcCallbackResultCache
	defer clearOIDCResultTestCache(&cache)
	now := time.Now()
	keyFor := func(i int) [32]byte {
		var key [32]byte
		binary.BigEndian.PutUint32(key[:4], uint32(i))
		return key
	}
	for i := range 128 {
		cache.put(keyFor(i), fmt.Sprintf("synthetic-result-%d", i), now.Add(time.Duration(i)*time.Millisecond))
	}
	cache.mu.Lock()
	oldest := cache.entries[keyFor(0)]
	cache.mu.Unlock()
	cache.put(keyFor(128), "synthetic-new-result", now.Add(time.Second))
	cache.mu.Lock()
	count, evictedPayload := len(cache.entries), oldest.payload
	cache.mu.Unlock()
	if count != 128 || evictedPayload != "" {
		t.Fatalf("cache count=%d, want hard limit 128 with evicted payload released", count)
	}
	if _, ok := cache.get(keyFor(0), now); ok {
		t.Fatal("oldest result survived capacity eviction")
	}
	for i := 1; i < 128; i++ {
		if payload, ok := cache.get(keyFor(i), now); !ok || payload != fmt.Sprintf("synthetic-result-%d", i) {
			t.Fatalf("capacity eviction mixed or removed unrelated result %d", i)
		}
	}
	if payload, ok := cache.get(keyFor(128), now); !ok || payload != "synthetic-new-result" {
		t.Fatal("new result was not retained")
	}
	if _, ok := cache.get(keyFor(129), now); ok {
		t.Fatal("unknown key received another result")
	}
}

func TestOIDCCallbackResultCachePayloadSizeBoundary(t *testing.T) {
	var cache oidcCallbackResultCache
	defer clearOIDCResultTestCache(&cache)
	now := time.Now()
	boundary := strings.Repeat("x", 64*1024)
	cache.put([32]byte{1}, boundary, now)
	cache.put([32]byte{2}, boundary+"x", now)
	cache.put([32]byte{3}, "", now)
	if payload, ok := cache.get([32]byte{1}, now); !ok || payload != boundary {
		t.Fatal("exactly 64 KiB must fit the bounded result cache")
	}
	for _, key := range [][32]byte{{2}, {3}} {
		if _, ok := cache.get(key, now); ok {
			t.Fatal("oversized or empty payload entered the result cache")
		}
	}
	cache.mu.Lock()
	count := len(cache.entries)
	cache.mu.Unlock()
	if count != 1 {
		t.Fatalf("retained %d results, want only the valid boundary payload", count)
	}
}

func TestOIDCCallbackResultCacheStaleTimerCannotDeleteReplacement(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var cache oidcCallbackResultCache
		defer clearOIDCResultTestCache(&cache)
		key := [32]byte{1}
		cache.put(key, "synthetic-old-result", time.Now())
		cache.mu.Lock()
		old := cache.entries[key]
		cache.mu.Unlock()
		cache.put(key, "synthetic-new-result", time.Now())
		// Re-arm the actual old timer callback after replacement to reproduce
		// the race where it had already fired before Stop could prevent it.
		old.timer.Reset(0)
		time.Sleep(time.Nanosecond)
		synctest.Wait()
		if payload, ok := cache.get(key, time.Now()); !ok || payload != "synthetic-new-result" {
			t.Fatal("stale timer callback deleted the new result for the same key")
		}
	})
}

func TestOIDCRedirectCallbackOversizedResultStillSucceedsWithoutRetention(t *testing.T) {
	const code, verifier = "synthetic-large-code", "synthetic-large-verifier"
	state, binding := concurrentOIDCAttempt(t, t.Name(), verifier)
	largeToken := strings.Repeat("x", 64*1024)
	service := &singleUseOIDCService{
		grants:  map[string]*singleUseOIDCGrant{code: {verifier: verifier, token: largeToken}},
		entered: make(chan struct{}, 2),
	}
	h := &AuthHandler{userService: service}
	router := concurrentOIDCHandlerRouter(h)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, concurrentOIDCRequest(context.Background(), state, code, binding))
	if token, reason := concurrentOIDCResult(t, first); reason != "" || token != largeToken {
		t.Fatal("cache size guard changed an otherwise successful callback")
	}
	h.oidcResults.mu.Lock()
	count := len(h.oidcResults.entries)
	h.oidcResults.mu.Unlock()
	if count != 0 {
		t.Fatal("oversized encoded callback payload was retained")
	}
	late := httptest.NewRecorder()
	router.ServeHTTP(late, concurrentOIDCRequest(context.Background(), state, code, binding))
	if token, reason := concurrentOIDCResult(t, late); token != "" || reason != "login_failed" {
		t.Fatal("oversized result unexpectedly reused a retained token")
	}
	if got := service.callCount(); got != 2 {
		t.Errorf("non-retained large result skipped provider validation: calls=%d", got)
	}
}
