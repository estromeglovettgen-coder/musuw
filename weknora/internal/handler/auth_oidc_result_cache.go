package handler

import (
	"sync"
	"time"
)

const (
	oidcCallbackResultTTL      = 10 * time.Second
	oidcCallbackResultLimit    = 128
	oidcCallbackResultMaxBytes = 64 * 1024
)

type oidcCallbackResult struct {
	payload   string
	expiresAt time.Time
	timer     *time.Timer
}

// This bounded, process-local window covers identical browser callbacks that
// arrive just after the provider exchange completes. The handler must validate
// the original state and binding before lookup. It stores only an already-issued
// successful payload, never raw authorization material or failed exchanges.
type oidcCallbackResultCache struct {
	mu      sync.Mutex
	entries map[[32]byte]*oidcCallbackResult
}

func (c *oidcCallbackResultCache) get(key [32]byte, now time.Time) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry := c.entries[key]
	if entry == nil {
		return "", false
	}
	if !now.Before(entry.expiresAt) {
		c.removeLocked(key)
		return "", false
	}
	return entry.payload, true
}

func (c *oidcCallbackResultCache) put(key [32]byte, payload string, now time.Time) {
	if payload == "" || len(payload) > oidcCallbackResultMaxBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = make(map[[32]byte]*oidcCallbackResult)
	}
	c.removeLocked(key)
	if len(c.entries) >= oidcCallbackResultLimit {
		var oldestKey [32]byte
		var oldest *oidcCallbackResult
		for candidateKey, candidate := range c.entries {
			if oldest == nil || candidate.expiresAt.Before(oldest.expiresAt) {
				oldestKey, oldest = candidateKey, candidate
			}
		}
		c.removeLocked(oldestKey)
	}
	entry := &oidcCallbackResult{payload: payload, expiresAt: now.Add(oidcCallbackResultTTL)}
	c.entries[key] = entry
	entry.timer = time.AfterFunc(time.Until(entry.expiresAt), func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.entries[key] == entry {
			c.removeLocked(key)
		}
	})
}

func (c *oidcCallbackResultCache) removeLocked(key [32]byte) {
	if entry := c.entries[key]; entry != nil {
		if entry.timer != nil {
			entry.timer.Stop()
		}
		entry.payload = ""
		delete(c.entries, key)
	}
}
