import assert from 'node:assert/strict'
import test from 'node:test'
import { createDiagnosticReporter } from '../../../../shared/client-diagnostics.ts'

const uuid = '9b7658e8-bf24-4f91-8194-2620ba574e71'
function fixture(overrides = {}) {
  const calls = []
  const values = new Map()
  const options = {
    fetch: async (...args) => { calls.push(args); return new Response(null, { status: 204 }) },
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, val) => values.set(key, val) },
    now: () => 1000, randomUUID: () => uuid, ...overrides,
  }
  return { report: createDiagnosticReporter(options), calls, options, values }
}
const event = { phase: 'auth.otp_verify', outcome: 'ok', duration_ms: 125 }

test('sends only allowlisted metadata, never raw extras or ambient credentials/referrer', () => {
  const { report, calls } = fixture()
  report({ ...event, password: 'secret', email: 'private@example.test', url: '/?code=secret' })
  assert.equal(calls.length, 1)
  const [url, options] = calls[0]
  assert.equal(url, '/api/v1/client-diagnostics')
  assert.deepEqual(JSON.parse(options.body), { ...event, flow_id: uuid, document_id: uuid, storage_status: 'session_available', flow_status: 'new' })
  assert.equal(options.credentials, 'omit')
  assert.equal(options.referrerPolicy, 'no-referrer')
  assert.equal(options.mode, 'same-origin')
})
test('rejects unsafe values and caps page traffic', () => {
  const { report, calls } = fixture()
  for (const patch of [{ phase: 'private@example.test' }, { outcome: 'secret' }, { duration_ms: NaN }, { duration_ms: -1 }, { duration_ms: 120001 }, { request_id: 'token=secret' }]) report({ ...event, ...patch })
  assert.equal(calls.length, 0)
  for (let i = 0; i < 60; i++) report(event)
  assert.equal(calls.length, 40)
})
test('storage and transport failures never throw or retry', async () => {
  let attempts = 0
  const { report } = fixture({
    storage: { getItem() { throw Error('disabled') }, setItem() { throw Error('disabled') } },
    fetch: async () => { attempts++; throw Error('unreachable') },
  })
  assert.doesNotThrow(() => report(event))
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(attempts, 1)
})
test('correlation survives same-tab navigation but expires after ten minutes', () => {
  const { report, options, calls } = fixture()
  report(event)
  const next = createDiagnosticReporter({ ...options, randomUUID: () => 'ef3e9b35-a9c0-4d06-950f-356da2e6fb3c' })
  next(event)
  assert.equal(JSON.parse(calls[1][1].body).flow_id, uuid)
  createDiagnosticReporter({ ...options, now: () => 602000, randomUUID: () => 'ef3e9b35-a9c0-4d06-950f-356da2e6fb3c' })(event)
  assert.notEqual(JSON.parse(calls[2][1].body).flow_id, uuid)
})

test('journey survives session storage loss while document and flow identify the new context', () => {
  let cookie = '', written = '', serial = 1
  const cookieAccess = { read: () => cookie, write: value => { written = value; cookie = value.split(';')[0] } }
  const nextId = () => `00000000-0000-4000-8000-${String(serial++).padStart(12, '0')}`
  const first = fixture({ cookies: cookieAccess, randomUUID: nextId })
  first.report(event)
  const second = fixture({ cookies: cookieAccess, randomUUID: nextId })
  second.report(event)
  const a = JSON.parse(first.calls[0][1].body), b = JSON.parse(second.calls[0][1].body)
  assert.equal(a.journey_id, b.journey_id)
  assert.notEqual(a.flow_id, b.flow_id)
  assert.notEqual(a.document_id, b.document_id)
  assert.match(cookie, /^musuw_diagnostic_journey=/)
  assert.match(written, /Max-Age=600; Path=\/; SameSite=Lax; Secure$/)
  const expired = fixture({ cookies: cookieAccess, randomUUID: nextId, now: () => 602000 })
  expired.report(event)
  assert.notEqual(JSON.parse(expired.calls[0][1].body).journey_id, a.journey_id)
})

test('blocked cookies and broken client hints do not drop operational evidence', () => {
  const { report, calls } = fixture({ cookies: { read() { throw Error('blocked') }, write() { throw Error('blocked') } }, context() { throw Error('denied') } })
  assert.doesNotThrow(() => report(event))
  assert.equal(calls.length, 1)
  assert.equal(JSON.parse(calls[0][1].body).journey_id, undefined)
})

test('reports storage expiry separately from unavailable storage and safe UA hints', () => {
  const first = fixture()
  first.report(event)
  createDiagnosticReporter({ ...first.options, now: () => 602000 })(event)
  assert.equal(JSON.parse(first.calls[1][1].body).flow_status, 'expired')
  const broken = fixture({
    storage: { getItem() { throw Error('denied') }, setItem() { throw Error('denied') } },
    context: () => ({ pathname: '/auth/start?secret=x', userAgent: 'Windows Chrome/53 Quark/7', viewportWidth: 430, visibility: 'visible', navigationType: 'reload' }),
  })
  broken.report({ ...event, reason: 'session_unavailable' })
  const body = JSON.parse(broken.calls[0][1].body)
  assert.equal(body.storage_status, 'session_unavailable')
  assert.equal(body.flow_status, 'unavailable')
  assert.equal(body.browser_kind, 'quark')
  assert.equal(body.platform_kind, 'desktop')
  assert.equal(body.viewport_width, 430)
  assert.equal(body.navigation_type, 'reload')
  assert.equal(JSON.stringify(body).includes('Windows'), false)
  assert.equal(JSON.stringify(body).includes('secret'), false)
  const corrupt = fixture({ storage: { getItem: () => '{invalid', setItem() {} }, context: () => ({ pathname: '/oauth/consent', userAgent: 'Safari', viewportWidth: 430 }) })
  corrupt.report(event)
  const corrupted = JSON.parse(corrupt.calls[0][1].body)
  assert.equal(corrupted.flow_status, 'expired')
  assert.equal(corrupted.storage_status, 'session_available')
  assert.equal(corrupted.page, 'consent')
})

test('timings/resources are bounded and optional metadata never serializes caller extras', () => {
  const { report, calls } = fixture()
  report({ ...event, reason: 'email@example.test' })
  report({ ...event, timings: { ttfb_ms: -1, download_ms: 2 } })
  report({ ...event, resources: [{ name: 'https://private.test/?token=secret', duration_ms: 1, ttfb_ms: 1, download_ms: 0 }] })
  assert.equal(calls.length, 0)
  report({ ...event, timings: { ttfb_ms: 5, download_ms: 10, secret: 'hidden' }, resources: [{ name: 'main-Abcd1234.js', duration_ms: 20, ttfb_ms: 5, download_ms: 10, url: 'hidden' }] })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].body.includes('hidden'), false)
})

test('legacy engines without AbortSignal.timeout still send diagnostics without blocking', async () => {
  const timeout = AbortSignal.timeout
  AbortSignal.timeout = undefined
  try {
    const { report, calls } = fixture()
    assert.doesNotThrow(() => report(event))
    assert.equal(calls.length, 1)
    await new Promise(resolve => setTimeout(resolve, 0))
  } finally { AbortSignal.timeout = timeout }
})
