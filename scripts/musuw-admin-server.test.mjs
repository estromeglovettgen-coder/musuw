import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  clampPage,
  clampPageSize,
  isPublicConsoleAsset,
  isSafeOperationsPath,
  parseEnvFile,
  readPaddleData,
  unavailableProviderState,
} from './musuw-admin-server.mjs'

test('parseEnvFile handles comments, exports, and quoted values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'musuw-admin-test-'))
  const path = join(directory, 'runtime.env')
  try {
    writeFileSync(path, '# ignored\nexport A=one\nB="two words"\nC=\'three\'\nINVALID\n')
    assert.deepEqual(parseEnvFile(path), { A: 'one', B: 'two words', C: 'three' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('pagination is finite and bounded', () => {
  assert.equal(clampPage('2'), 2)
  assert.equal(clampPage('-1'), 1)
  assert.equal(clampPageSize('500'), 100)
  assert.equal(clampPageSize('0'), 25)
})

test('an unimplemented official provider never becomes available from credential presence alone', () => {
  assert.deepEqual(unavailableProviderState(false, 'credential missing', 'adapter missing'), {
    available: false,
    reason: 'credential missing',
  })
  assert.deepEqual(unavailableProviderState(true, 'credential missing', 'adapter missing'), {
    available: false,
    reason: 'adapter missing',
  })
})

test('allowlist admits only scoped operations routes and methods', () => {
  const allowed = [
    ['GET', '/api/v1/system/admin/runtime/queues'],
    ['GET', '/api/v1/system/admin/runtime/queues/knowledge/tasks'],
    ['GET', '/api/v1/system/admin/tenants/10005/entitlement'],
    ['GET', '/api/v1/system/admin/users/7c67173c-7113-4766-98b9-61f47ed182c9/investigation'],
    ['PATCH', '/api/v1/system/admin/tenants/10005'],
    ['PUT', '/api/v1/system/admin/tenants/10005/openrouter-credits'],
    ['POST', '/api/v1/system/admin/runtime/queues/knowledge/tasks/abc:123/actions/retry'],
    ['DELETE', '/api/v1/system/admin/runtime/queues/knowledge/archived'],
  ]
  for (const [method, path] of allowed) assert.equal(isSafeOperationsPath(method, path), true, `${method} ${path}`)

  const denied = [
    ['GET', '/api/v1/system/info'],
    ['GET', '/api/v1/system/settings'],
    ['GET', '/api/v1/system/admin/api-keys'],
    ['POST', '/api/v1/system/admin/tenants/10005'],
    ['DELETE', '/api/v1/system/admin/runtime/queues/knowledge/tasks/abc'],
    ['GET', '/api/v1/system/admin/users/not-an-id/investigation'],
    ['PATCH', '/api/v1/system/admin/tenants/10005/../../settings'],
  ]
  for (const [method, path] of denied) assert.equal(isSafeOperationsPath(method, path), false, `${method} ${path}`)
})

test('console shell assets can bootstrap after a server restart while APIs stay session-bound', () => {
  assert.equal(isPublicConsoleAsset('GET', '/musuw-logo.png'), true)
  assert.equal(isPublicConsoleAsset('HEAD', '/favicon.ico'), true)
  assert.equal(isPublicConsoleAsset('GET', '/assets/operations.js'), true)
  assert.equal(isPublicConsoleAsset('GET', '/tdesign-icons/0.4.1/fonts/index.js'), true)
  assert.equal(isPublicConsoleAsset('GET', '/admin-api/config'), false)
  assert.equal(isPublicConsoleAsset('GET', '/api/v1/system/info'), false)
  assert.equal(isPublicConsoleAsset('POST', '/assets/operations.js'), false)
})

test('Paddle reads keep each official capability honest when transaction scope is absent', async () => {
  const fetcher = async (url) => {
    if (String(url).includes('/subscriptions?')) {
      return {
        response: { ok: true, status: 200 },
        payload: { data: [{ id: 'sub_1', status: 'active', customer_id: 'ctm_1' }] },
      }
    }
    return {
      response: { ok: false, status: 403 },
      payload: { error: { code: 'forbidden', detail: 'not authorized to read transaction' } },
    }
  }

  const result = await readPaddleData({
    apiKey: 'configured-for-test',
    apiBase: 'https://api.paddle.test',
    fetcher,
  })

  assert.equal(result.available, true)
  assert.equal(result.subscriptions_available, true)
  assert.equal(result.subscriptions.length, 1)
  assert.equal(result.transactions_available, false)
  assert.deepEqual(result.transactions, [])
  assert.match(result.transactions_reason, /HTTP 403/)
})
