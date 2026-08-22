import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  clampPage,
  clampPageSize,
  isPublicConsoleAsset,
  isSafeOperationsPath,
  parseEnvFile,
  readKeychainSecret,
  readLangfuseData,
  readPaddleData,
  readR2Inventory,
  readSupabaseAdminData,
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

test('provider secrets are read from named Keychain items without leaking command output', () => {
  const calls = []
  const executor = (command, args, options) => {
    calls.push({ command, args, options })
    return 'secret-value\n'
  }

  assert.equal(readKeychainSecret('com.musuw.test', 'operations-production', executor), 'secret-value')
  assert.deepEqual(calls, [{
    command: '/usr/bin/security',
    args: ['find-generic-password', '-w', '-s', 'com.musuw.test', '-a', 'operations-production'],
    options: { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  }])
})

test('production provider credentials never fall back to plaintext runtime environment values', () => {
  const source = readFileSync(new URL('./musuw-admin-server.mjs', import.meta.url), 'utf8')
  for (const variable of [
    'MUSUW_PADDLE_API_KEY',
    'MUSUW_SUPABASE_SERVICE_ROLE_KEY',
    'MUSUW_R2_ACCESS_KEY_ID',
    'MUSUW_R2_SECRET_ACCESS_KEY',
    'LANGFUSE_PUBLIC_KEY',
    'LANGFUSE_SECRET_KEY',
  ]) {
    assert.doesNotMatch(source, new RegExp(`runtime\\.${variable}\\b`), variable)
  }
})

test('host development loads Paddle and Langfuse server secrets from Keychain instead of ignored env files', () => {
  const source = readFileSync(new URL('./musuw-dev', import.meta.url), 'utf8')
  assert.match(source, /com\.musuw\.local-admin\.paddle-api-key/)
  assert.match(source, /com\.musuw\.local-admin\.paddle-webhook-secret/)
  assert.match(source, /com\.musuw\.local-admin\.langfuse-public-key/)
  assert.match(source, /com\.musuw\.local-admin\.langfuse-secret-key/)
  assert.match(source, /security find-generic-password/)
  assert.match(source, /musuw-admin-test/)
  assert.doesNotMatch(source, /load_env_file "\$paddle_sandbox_env"/)
  assert.match(source, /export LANGFUSE_ENVIRONMENT=test/)
})

test('Supabase Auth Admin reads only the selected process environment with the official apikey header', async () => {
  const calls = []
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options })
    return {
      response: { ok: true, status: 200 },
      payload: {
        users: [{
          id: 'user-1',
          email: 'person@example.com',
          created_at: '2026-08-22T00:00:00Z',
          last_sign_in_at: '2026-08-22T01:00:00Z',
          email_confirmed_at: '2026-08-22T00:01:00Z',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { private: 'must not leave provider adapter' },
        }],
      },
    }
  }

  const result = await readSupabaseAdminData({
    targetEnvironment: 'PRODUCTION',
    projects: [
      { environment: 'TEST', name: 'Staging', ref: 'staging-ref', url: 'https://staging-ref.supabase.co', applicable: false },
      { environment: 'PRODUCTION', name: 'Production', ref: 'production-ref', url: 'https://production-ref.supabase.co', applicable: true, apiKey: 'production-key' },
    ],
    fetcher,
  })

  assert.equal(result.available, true)
  assert.equal(result.projects[0].available, false)
  assert.equal(result.projects[0].applicable, false)
  assert.match(result.projects[0].reason, /not queried by the PRODUCTION process/)
  assert.equal(result.projects[1].available, true)
  assert.equal(result.projects[1].total, 1)
  assert.deepEqual(result.projects[1].users[0], {
    id: 'user-1',
    email: 'person@example.com',
    created_at: '2026-08-22T00:00:00Z',
    last_sign_in_at: '2026-08-22T01:00:00Z',
    email_confirmed_at: '2026-08-22T00:01:00Z',
    provider: 'email',
    providers: ['email'],
  })
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /production-ref/)
  assert.equal(calls[0].options.headers.apikey, 'production-key')
  assert.equal('Authorization' in calls[0].options.headers, false)
})

test('R2 inventory uses the official S3 client and returns bounded object metadata', async () => {
  const calls = []
  const client = {
    send: async (command) => {
      calls.push(command.input)
      return {
        KeyCount: 2,
        IsTruncated: false,
        Contents: [
          { Key: 'weknora/a.txt', Size: 7, LastModified: new Date('2026-08-22T00:00:00Z'), ETag: 'etag-a' },
          { Key: 'weknora/b.txt', Size: 9, LastModified: new Date('2026-08-22T01:00:00Z'), ETag: 'etag-b' },
        ],
      }
    },
  }

  const result = await readR2Inventory({ client, bucket: 'musuw-production', prefix: 'weknora/' })
  assert.equal(result.available, true)
  assert.equal(result.total, 2)
  assert.equal(result.total_bytes, 16)
  assert.deepEqual(calls, [{ Bucket: 'musuw-production', Prefix: 'weknora/', MaxKeys: 1000 }])
  assert.deepEqual(result.objects[0], {
    key: 'weknora/a.txt',
    size: 7,
    last_modified: '2026-08-22T00:00:00.000Z',
    etag: 'etag-a',
  })
})

test('R2 inventory reports TEST local storage as not applicable instead of a credential failure', async () => {
  const result = await readR2Inventory({
    client: null,
    bucket: '',
    prefix: '',
    applicable: false,
  })

  assert.equal(result.available, false)
  assert.equal(result.applicable, false)
  assert.match(result.reason, /TEST uses local storage/)
})

test('Langfuse query uses bounded v2 observations without prompt or output fields', async () => {
  let call
  const fetcher = async (url, options) => {
    call = { url: String(url), options }
    return {
      response: { ok: true, status: 200 },
      payload: {
        data: [{
          id: 'obs-1', traceId: 'trace-1', name: 'chat', type: 'GENERATION',
          startTime: '2026-08-22T00:00:00Z', endTime: '2026-08-22T00:00:01Z',
          environment: 'production', level: 'DEFAULT', providedModelName: 'model-a',
          totalCost: 0.001, input: 'must not escape', output: 'must not escape',
        }],
        meta: { cursor: null },
      },
    }
  }

  const result = await readLangfuseData({
    host: 'https://jp.cloud.langfuse.com',
    publicKey: 'public-key',
    secretKey: 'secret-key',
    fetcher,
  })

  assert.equal(result.available, true)
  assert.equal(result.observations.length, 1)
  assert.equal('input' in result.observations[0], false)
  assert.equal('output' in result.observations[0], false)
  assert.match(call.url, /\/api\/public\/v2\/observations\?/)
  assert.match(call.url, /fields=core%2Cbasic%2Ctime%2Cmodel%2Cusage%2Cmetrics%2Ctrace_context/)
  assert.doesNotMatch(call.url, /fields=[^&]*io/)
  assert.equal(call.options.headers.Authorization, `Basic ${Buffer.from('public-key:secret-key').toString('base64')}`)
})
