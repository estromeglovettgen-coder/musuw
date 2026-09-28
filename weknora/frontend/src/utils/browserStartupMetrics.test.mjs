import assert from 'node:assert/strict'
import test from 'node:test'
import { startStartupMetrics } from '../../../../shared/browser-startup-metrics.ts'

test('separates navigation/entry/router/mount and emits only three slow build assets without URLs', () => {
  let now = 2000
  const events = []
  const asset = (name, duration) => ({ name, duration, requestStart: 10, responseStart: 30, responseEnd: 10 + duration })
  const metrics = startStartupMetrics('app', {
    origin: 'https://app.musuw.com', report: event => events.push(event),
    performance: { now: () => now, getEntriesByType: type => type === 'navigation'
      ? [{ startTime: 0, responseStart: 200, responseEnd: 500 }]
      : [asset('https://app.musuw.com/assets/main-Abcd1234.js?token=secret', 900), asset('https://app.musuw.com/assets/ui-Abcd1234.css', 800), asset('https://app.musuw.com/auth/assets/index-Abcd1234.js', 700), asset('https://app.musuw.com/assets/other-Abcd1234.js', 600), asset('https://private.test/assets/secret-Abcd1234.js', 5000), asset('https://app.musuw.com/api/auth?code=secret', 6000), asset('https://app.musuw.com/assets/nohash.js', 7000)] },
  })
  metrics.routerStart(); now = 2500; metrics.routerReady(); metrics.mountStart(); now = 2600; metrics.mounted(); metrics.mounted()
  assert.deepEqual(events.map(v => v.phase), ['app.navigation', 'app.entry', 'app.router', 'app.mount', 'app.bootstrap', 'app.startup'])
  assert.deepEqual(events[0].timings, { ttfb_ms: 200, download_ms: 300 })
  assert.equal(events[1].duration_ms, 2000)
  assert.equal(events[2].duration_ms, 500)
  assert.equal(events[3].duration_ms, 100)
  assert.equal(events[4].duration_ms, 600)
  assert.equal(events[3].resources.length, 3)
  assert.deepEqual(events[3].resources[0], { name: 'main-Abcd1234.js', duration_ms: 900, ttfb_ms: 20, download_ms: 880 })
  assert.doesNotMatch(JSON.stringify(events), /secret|https:|token|api\/auth/)
})

test('auth failures are not later mislabeled successful and instrumentation errors never throw', () => {
  const events = []
  const metrics = startStartupMetrics('auth', { origin: 'https://app.musuw.com', performance: { now: () => 20, getEntriesByType: () => [] }, report: event => events.push(event) })
  metrics.failed(); metrics.mountStart(); metrics.mounted()
  assert.deepEqual(events.filter(v => v.phase === 'auth.startup').map(v => v.outcome), ['error'])
  const unavailable = startStartupMetrics('app', { performance: { now() { throw Error('unavailable') }, getEntriesByType: () => [] } })
  assert.doesNotThrow(() => { unavailable.routerReady(); unavailable.mounted(); unavailable.failed() })
})
