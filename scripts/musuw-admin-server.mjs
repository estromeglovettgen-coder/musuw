#!/usr/bin/env node

import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(scriptDir, '..')

const DEFAULT_PORT = 4186
const SESSION_COOKIE = 'musuw_admin_session'
const CSRF_COOKIE = 'musuw_admin_csrf'
const PAGE_SIZE_MAX = 100
const API_TIMEOUT_MS = 12_000
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000
const PLATFORM_KEY_SERVICE = 'com.musuw.local-admin.platform-key'
const PUBLIC_BRAND_ASSETS = new Set(['/favicon.ico', '/musuw-logo.png'])

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const values = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line
    const separator = normalized.indexOf('=')
    if (separator <= 0) continue
    const key = normalized.slice(0, separator).trim()
    let value = normalized.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

export function clampPageSize(value, fallback = 25) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, PAGE_SIZE_MAX)
}

export function clampPage(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function unavailableProviderState(configured, missingReason, adapterReason) {
  return { available: false, reason: configured ? adapterReason : missingReason }
}

export function isSafeOperationsPath(method, pathname) {
  const exactReads = new Set([
    '/api/v1/system/info',
    '/api/v1/system/admin/runtime/queues',
    '/api/v1/system/admin/audit-log',
  ])
  if (method === 'GET' && exactReads.has(pathname)) return true
  if (method === 'GET' && /^\/api\/v1\/system\/admin\/runtime\/queues\/[a-z0-9_-]+\/tasks$/.test(pathname)) return true
  if (method === 'GET' && /^\/api\/v1\/system\/admin\/tenants\/\d+\/entitlement$/.test(pathname)) return true
  if (method === 'GET' && /^\/api\/v1\/system\/admin\/users\/[0-9a-f-]+\/investigation$/.test(pathname)) return true
  if (method === 'PATCH' && /^\/api\/v1\/system\/admin\/tenants\/\d+$/.test(pathname)) return true
  if (method === 'PUT' && /^\/api\/v1\/system\/admin\/tenants\/\d+\/openrouter-credits$/.test(pathname)) return true
  if (method === 'POST' && /^\/api\/v1\/system\/admin\/runtime\/queues\/[a-z0-9_-]+\/tasks\/[0-9a-z:_-]+\/actions\/(retry|run-now|run_now)$/.test(pathname)) return true
  if (method === 'DELETE' && /^\/api\/v1\/system\/admin\/runtime\/queues\/[a-z0-9_-]+\/archived$/.test(pathname)) return true
  return false
}

export function isPublicBrandAsset(method, pathname) {
  return ['GET', 'HEAD'].includes(method) && PUBLIC_BRAND_ASSETS.has(pathname)
}

function loadRuntime(target) {
  if (target === 'production') {
    const runtimePath = resolve(repoRoot, '.runtime/musuw-admin/production.env')
    const runtime = { ...parseEnvFile(runtimePath), ...process.env }
    if (!runtime.MUSUW_ADMIN_DATABASE_URL || !runtime.MUSUW_ADMIN_BACKEND_URL) {
      throw new Error('production requires .runtime/musuw-admin/production.env with MUSUW_ADMIN_DATABASE_URL and MUSUW_ADMIN_BACKEND_URL')
    }
    return {
      target,
      label: 'PRODUCTION',
      database: { connectionString: runtime.MUSUW_ADMIN_DATABASE_URL, application_name: 'musuw-operations-production' },
      backendBaseUrl: runtime.MUSUW_ADMIN_BACKEND_URL.replace(/\/$/, ''),
      platformKeyAccount: runtime.MUSUW_ADMIN_PLATFORM_KEY_ACCOUNT || 'musuw-admin-production',
      paddleEnvironment: 'live',
      paddleApiKey: runtime.MUSUW_PADDLE_API_KEY || '',
      paddleApiBase: 'https://api.paddle.com',
      supabaseAdmin: unavailableProviderState(
        Boolean(runtime.MUSUW_SUPABASE_SERVICE_ROLE_KEY),
        'Auth Admin server credential is not configured',
        'Supabase Auth Admin query adapter is not enabled; use the official console',
      ),
      r2Admin: unavailableProviderState(
        Boolean(runtime.MUSUW_R2_ACCESS_KEY_ID && runtime.MUSUW_R2_SECRET_ACCESS_KEY),
        'R2 operator credential is not configured on this Mac',
        'R2 inventory adapter is not enabled; use the official Cloudflare console',
      ),
      langfuse: unavailableProviderState(
        Boolean(runtime.LANGFUSE_PUBLIC_KEY && runtime.LANGFUSE_SECRET_KEY),
        'Langfuse query credentials are not configured',
        'Langfuse query adapter is not enabled for this console',
      ),
    }
  }

  const candidate = parseEnvFile(resolve(repoRoot, '.runtime/weknora/candidate.env'))
  const paddle = parseEnvFile(resolve(repoRoot, '.runtime/weknora/paddle-sandbox.env'))
  return {
    target: 'test',
    label: 'TEST',
    database: {
      host: process.env.MUSUW_ADMIN_TEST_DB_HOST || '127.0.0.1',
      port: Number.parseInt(process.env.MUSUW_ADMIN_TEST_DB_PORT || '15432', 10),
      user: candidate.DB_USER,
      password: candidate.DB_PASSWORD,
      database: candidate.DB_NAME,
      application_name: 'musuw-operations-test',
    },
    backendBaseUrl: (process.env.MUSUW_ADMIN_TEST_BACKEND_URL || 'http://127.0.0.1:18090').replace(/\/$/, ''),
    platformKeyAccount: 'musuw-admin-test',
    paddleEnvironment: 'sandbox',
    paddleApiKey: paddle.MUSUW_PADDLE_API_KEY || '',
    paddleApiBase: 'https://sandbox-api.paddle.com',
    supabaseAdmin: { available: false, reason: 'Auth Admin server credential is not configured' },
    r2Admin: { available: false, reason: 'R2 operator credential is not configured on this Mac' },
    langfuse: { available: false, reason: 'Langfuse query credentials are not configured' },
  }
}

function readPlatformKey(account) {
  try {
    return execFileSync('/usr/bin/security', [
      'find-generic-password',
      '-w',
      '-s', PLATFORM_KEY_SERVICE,
      '-a', account,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

function parseCookies(header = '') {
  const cookies = {}
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator < 0) continue
    cookies[pair.slice(0, separator).trim()] = decodeURIComponent(pair.slice(separator + 1).trim())
  }
  return cookies
}

function safeEqual(left, right) {
  if (!left || !right) return false
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function writeJSON(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function publicError(error) {
  if (error?.name === 'AbortError') return 'upstream request timed out'
  if (error?.code === 'ECONNREFUSED') return 'service unavailable'
  return error instanceof Error ? error.message : 'unexpected error'
}

function parseJSONBody(request, maxBytes = 64 * 1024) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        rejectBody(new Error('request body is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (chunks.length === 0) return resolveBody(null)
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        rejectBody(new Error('invalid JSON body'))
      }
    })
    request.on('error', rejectBody)
  })
}

function secureHeaders(response) {
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '))
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
}

function normalizeProviderItems(payload, key) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  if (key === 'subscriptions') {
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      customer_id: row.customer_id,
      currency_code: row.currency_code,
      collection_mode: row.collection_mode,
      created_at: row.created_at,
      updated_at: row.updated_at,
      next_billed_at: row.next_billed_at,
      current_billing_period: row.current_billing_period || null,
      scheduled_change: row.scheduled_change || null,
    }))
  }
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    customer_id: row.customer_id,
    subscription_id: row.subscription_id,
    currency_code: row.currency_code,
    origin: row.origin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    billed_at: row.billed_at,
    details: row.details ? {
      totals: row.details.totals || null,
      payout_totals: row.details.payout_totals || null,
    } : null,
  }))
}

async function fetchJSON(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { error: { detail: text.slice(0, 500) } }
    }
    return { response, payload }
  } finally {
    clearTimeout(timer)
  }
}

function createQueries(pool) {
  async function overview() {
    const [users, tenants, knowledge, storage, recent] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE is_active)::int AS active,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d
          FROM users WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'active')::int AS active,
               COUNT(*) FILTER (WHERE plan <> 'free' AND plan_status = 'active')::int AS paid,
               COALESCE(SUM(storage_quota), 0)::bigint AS storage_quota_bytes,
               COALESCE(SUM(storage_used), 0)::bigint AS storage_used_bytes
          FROM tenants WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT (SELECT COUNT(*) FROM knowledge_bases WHERE deleted_at IS NULL)::int AS knowledge_bases,
               COUNT(*)::int AS documents,
               COUNT(*) FILTER (WHERE parse_status = 'failed')::int AS failed,
               COUNT(*) FILTER (WHERE parse_status IN ('waiting','pending','running','processing'))::int AS processing,
               COALESCE(SUM(file_size), 0)::bigint AS source_bytes,
               COALESCE(SUM(storage_size), 0)::bigint AS index_bytes
          FROM knowledges WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT provider, status, source, COUNT(*)::int AS count
          FROM storage_backends WHERE deleted_at IS NULL
         GROUP BY provider, status, source ORDER BY provider, status
      `),
      pool.query(`
        SELECT k.id, k.title, k.file_type, k.parse_status, k.updated_at,
               kb.name AS knowledge_base_name, t.name AS tenant_name
          FROM knowledges k
          JOIN knowledge_bases kb ON kb.id = k.knowledge_base_id
          JOIN tenants t ON t.id = k.tenant_id
         WHERE k.deleted_at IS NULL
         ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
         LIMIT 8
      `),
    ])
    return {
      users: users.rows[0],
      tenants: tenants.rows[0],
      knowledge: knowledge.rows[0],
      storage_backends: storage.rows,
      recent_documents: recent.rows,
    }
  }

  async function users(url) {
    const page = clampPage(url.searchParams.get('page'))
    const pageSize = clampPageSize(url.searchParams.get('page_size'))
    const offset = (page - 1) * pageSize
    const search = (url.searchParams.get('q') || '').trim()
    const plan = (url.searchParams.get('plan') || '').trim().toLowerCase()
    const state = (url.searchParams.get('state') || '').trim().toLowerCase()
    const params = []
    const where = ['u.deleted_at IS NULL']
    if (search) {
      params.push(`%${search}%`)
      where.push(`(u.email ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.id ILIKE $${params.length} OR t.name ILIKE $${params.length})`)
    }
    if (['free', 'plus', 'pro', 'max'].includes(plan)) {
      params.push(plan)
      where.push(`t.plan = $${params.length}`)
    }
    if (state === 'active' || state === 'inactive') {
      params.push(state === 'active')
      where.push(`u.is_active = $${params.length}`)
    }
    const whereSQL = where.join(' AND ')
    const dataParams = [...params, pageSize, offset]
    const rows = await pool.query(`
      SELECT u.id, u.username, u.email, u.avatar, u.is_active, u.is_system_admin,
             u.tenant_id, u.created_at, u.updated_at,
             t.name AS tenant_name, t.status AS tenant_status, t.plan, t.plan_status,
             t.storage_quota AS storage_quota_bytes, t.storage_used AS storage_used_bytes,
             t.paddle_customer_id, t.paddle_subscription_id, t.paddle_billing_period,
             t.paddle_current_period_end, t.open_router_credit_period_end,
             COALESCE(kb.knowledge_base_count, 0)::int AS knowledge_base_count,
             COALESCE(doc.document_count, 0)::int AS document_count,
             COALESCE(doc.source_bytes, 0)::bigint AS source_bytes,
             COALESCE(doc.index_bytes, 0)::bigint AS index_bytes
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS knowledge_base_count
            FROM knowledge_bases WHERE deleted_at IS NULL GROUP BY tenant_id
        ) kb ON kb.tenant_id = u.tenant_id
        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS document_count,
                 COALESCE(SUM(file_size), 0) AS source_bytes,
                 COALESCE(SUM(storage_size), 0) AS index_bytes
            FROM knowledges WHERE deleted_at IS NULL GROUP BY tenant_id
        ) doc ON doc.tenant_id = u.tenant_id
       WHERE ${whereSQL}
       ORDER BY u.created_at DESC, u.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, dataParams)
    const total = await pool.query(`
      SELECT COUNT(*)::int AS total
        FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
       WHERE ${whereSQL}
    `, params)
    return { rows: rows.rows, total: total.rows[0]?.total || 0, page, page_size: pageSize }
  }

  async function knowledge(url) {
    const kind = url.searchParams.get('kind') === 'knowledge_bases' ? 'knowledge_bases' : 'documents'
    const page = clampPage(url.searchParams.get('page'))
    const pageSize = clampPageSize(url.searchParams.get('page_size'))
    const offset = (page - 1) * pageSize
    const search = (url.searchParams.get('q') || '').trim()
    const status = (url.searchParams.get('status') || '').trim().toLowerCase()
    const params = []
    const where = []
    if (kind === 'knowledge_bases') {
      where.push('kb.deleted_at IS NULL')
      if (search) {
        params.push(`%${search}%`)
        where.push(`(kb.name ILIKE $${params.length} OR kb.id ILIKE $${params.length} OR t.name ILIKE $${params.length})`)
      }
      const dataParams = [...params, pageSize, offset]
      const rows = await pool.query(`
        SELECT kb.id, kb.name, kb.description, kb.type, kb.tenant_id, kb.creator_id,
               kb.storage_backend_id, kb.created_at, kb.updated_at,
               t.name AS tenant_name, t.plan, t.storage_quota AS storage_quota_bytes,
               t.storage_used AS storage_used_bytes,
               COALESCE(COUNT(k.id), 0)::int AS document_count,
               COALESCE(SUM(k.file_size), 0)::bigint AS source_bytes,
               COALESCE(SUM(k.storage_size), 0)::bigint AS index_bytes,
               COUNT(k.id) FILTER (WHERE k.parse_status = 'failed')::int AS failed_count,
               sb.provider AS storage_provider, sb.status AS storage_backend_status
          FROM knowledge_bases kb
          JOIN tenants t ON t.id = kb.tenant_id
          LEFT JOIN knowledges k ON k.knowledge_base_id = kb.id AND k.deleted_at IS NULL
          LEFT JOIN storage_backends sb ON sb.id = kb.storage_backend_id AND sb.deleted_at IS NULL
         WHERE ${where.join(' AND ')}
         GROUP BY kb.id, t.id, sb.provider, sb.status
         ORDER BY kb.updated_at DESC NULLS LAST, kb.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, dataParams)
      const total = await pool.query(`
        SELECT COUNT(*)::int AS total FROM knowledge_bases kb
        JOIN tenants t ON t.id = kb.tenant_id WHERE ${where.join(' AND ')}
      `, params)
      return { kind, rows: rows.rows, total: total.rows[0]?.total || 0, page, page_size: pageSize }
    }

    where.push('k.deleted_at IS NULL')
    if (search) {
      params.push(`%${search}%`)
      where.push(`(k.title ILIKE $${params.length} OR k.file_name ILIKE $${params.length} OR k.id ILIKE $${params.length} OR kb.name ILIKE $${params.length} OR t.name ILIKE $${params.length})`)
    }
    if (status) {
      params.push(status)
      where.push(`LOWER(k.parse_status) = $${params.length}`)
    }
    const dataParams = [...params, pageSize, offset]
    const rows = await pool.query(`
      SELECT k.id, k.tenant_id, k.knowledge_base_id, k.type, k.title, k.description,
             k.source, k.parse_status, k.enable_status, k.file_name, k.file_type,
             k.file_size AS source_bytes, k.storage_size AS index_bytes,
             k.file_path AS object_reference, k.error_message, k.channel,
             k.created_at, k.updated_at, k.processed_at,
             kb.name AS knowledge_base_name, kb.storage_backend_id,
             t.name AS tenant_name, t.plan, t.storage_quota AS storage_quota_bytes,
             t.storage_used AS storage_used_bytes,
             sb.provider AS storage_provider, sb.status AS storage_backend_status
        FROM knowledges k
        JOIN knowledge_bases kb ON kb.id = k.knowledge_base_id
        JOIN tenants t ON t.id = k.tenant_id
        LEFT JOIN storage_backends sb ON sb.id = kb.storage_backend_id AND sb.deleted_at IS NULL
       WHERE ${where.join(' AND ')}
       ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, dataParams)
    const total = await pool.query(`
      SELECT COUNT(*)::int AS total FROM knowledges k
      JOIN knowledge_bases kb ON kb.id = k.knowledge_base_id
      JOIN tenants t ON t.id = k.tenant_id
      WHERE ${where.join(' AND ')}
    `, params)
    return { kind, rows: rows.rows, total: total.rows[0]?.total || 0, page, page_size: pageSize }
  }

  async function billing() {
    const result = await pool.query(`
      SELECT id AS tenant_id, name AS tenant_name, status AS tenant_status,
             plan, plan_status, paddle_customer_id, paddle_subscription_id,
             paddle_billing_period, paddle_current_period_end,
             paddle_last_event_id, paddle_last_event_at,
             open_router_credit_period_end, created_at, updated_at
        FROM tenants WHERE deleted_at IS NULL
       ORDER BY (paddle_subscription_id IS NOT NULL) DESC, updated_at DESC, id ASC
    `)
    return result.rows
  }

  async function identity() {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE is_active)::int AS active,
             COUNT(*) FILTER (WHERE is_system_admin)::int AS system_admins,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d,
             MAX(updated_at) AS latest_update
        FROM users WHERE deleted_at IS NULL
    `)
    return result.rows[0]
  }

  async function storage(url) {
    const page = clampPage(url.searchParams.get('page'))
    const pageSize = clampPageSize(url.searchParams.get('page_size'))
    const offset = (page - 1) * pageSize
    const search = (url.searchParams.get('q') || '').trim()
    const params = []
    const where = ['k.deleted_at IS NULL']
    if (search) {
      params.push(`%${search}%`)
      where.push(`(k.title ILIKE $${params.length} OR k.file_name ILIKE $${params.length} OR k.file_path ILIKE $${params.length} OR t.name ILIKE $${params.length})`)
    }
    const [backends, usage, rows, total] = await Promise.all([
      pool.query(`
        SELECT sb.id, sb.tenant_id, sb.name, sb.provider, sb.source, sb.status,
               sb.legacy_alias, sb.created_at, sb.updated_at, t.name AS tenant_name,
               COUNT(kb.id)::int AS knowledge_base_count
          FROM storage_backends sb
          LEFT JOIN tenants t ON t.id = sb.tenant_id
          LEFT JOIN knowledge_bases kb ON kb.storage_backend_id = sb.id AND kb.deleted_at IS NULL
         WHERE sb.deleted_at IS NULL
         GROUP BY sb.id, t.name ORDER BY sb.provider, sb.tenant_id
      `),
      pool.query(`
        SELECT COALESCE(SUM(storage_quota), 0)::bigint AS quota_bytes,
               COALESCE(SUM(storage_used), 0)::bigint AS measured_used_bytes,
               (SELECT COALESCE(SUM(file_size), 0) FROM knowledges WHERE deleted_at IS NULL)::bigint AS source_bytes,
               (SELECT COALESCE(SUM(storage_size), 0) FROM knowledges WHERE deleted_at IS NULL)::bigint AS index_bytes
          FROM tenants WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT k.id, k.title, k.file_name, k.file_type,
               k.file_size AS source_bytes, k.storage_size AS index_bytes,
               k.file_path AS object_reference, k.parse_status, k.updated_at,
               t.id AS tenant_id, t.name AS tenant_name,
               t.storage_quota AS quota_bytes, t.storage_used AS measured_used_bytes,
               kb.id AS knowledge_base_id, kb.name AS knowledge_base_name,
               sb.id AS storage_backend_id, sb.provider AS storage_provider,
               sb.status AS storage_backend_status
          FROM knowledges k
          JOIN tenants t ON t.id = k.tenant_id
          JOIN knowledge_bases kb ON kb.id = k.knowledge_base_id
          LEFT JOIN storage_backends sb ON sb.id = kb.storage_backend_id AND sb.deleted_at IS NULL
         WHERE ${where.join(' AND ')}
         ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]),
      pool.query(`
        SELECT COUNT(*)::int AS total FROM knowledges k
        JOIN tenants t ON t.id = k.tenant_id
        JOIN knowledge_bases kb ON kb.id = k.knowledge_base_id
        WHERE ${where.join(' AND ')}
      `, params),
    ])
    return {
      backends: backends.rows,
      usage: usage.rows[0],
      rows: rows.rows,
      total: total.rows[0]?.total || 0,
      page,
      page_size: pageSize,
    }
  }

  return { overview, users, knowledge, billing, identity, storage }
}

async function start() {
  const target = (process.argv[2] || 'test').toLowerCase()
  if (!['test', 'production'].includes(target)) throw new Error(`unknown environment: ${target}`)
  const runtime = loadRuntime(target)
  const port = Number.parseInt(process.env.MUSUW_ADMIN_PORT || String(DEFAULT_PORT), 10)
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error('MUSUW_ADMIN_PORT must be an integer between 1024 and 65535')
  }
  const host = '127.0.0.1'
  const assetDir = resolve(process.env.MUSUW_ADMIN_ASSET_DIR || resolve(repoRoot, 'weknora/frontend/dist'))
  const operationsHtml = resolve(assetDir, 'operations.html')
  if (!existsSync(operationsHtml)) throw new Error(`operations build is missing: ${operationsHtml}`)

  const platformKey = readPlatformKey(runtime.platformKeyAccount)
  const pool = new Pool({
    ...runtime.database,
    // Two durable connections keep the single-operator console responsive when
    // a page needs a count and a row query over the higher-latency SSH tunnel,
    // without creating the five simultaneous handshakes used by the default.
    max: 2,
    // Keep both tunnel-backed connections alive for the operator session.
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 60_000,
    options: '-c default_transaction_read_only=on -c statement_timeout=12000',
  })
  const readOnly = await pool.query('SHOW transaction_read_only')
  if (readOnly.rows[0]?.transaction_read_only !== 'on') {
    await pool.end().catch(() => {})
    throw new Error('operations database connection is not read-only')
  }
  const queries = createQueries(pool)
  const sessions = new Map()
  const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`])
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

  function ensureSession(request, response, pathname) {
    const cookies = parseCookies(request.headers.cookie)
    const current = sessions.get(cookies[SESSION_COOKIE])
    if (current && Date.now() - current.createdAt <= SESSION_MAX_AGE_MS) {
      return { id: cookies[SESSION_COOKIE], ...current }
    }
    if (current) sessions.delete(cookies[SESSION_COOKIE])
    if (request.method !== 'GET' || !['/', '/operations.html'].includes(pathname)) return null
    const id = randomBytes(32).toString('base64url')
    const csrf = randomBytes(24).toString('base64url')
    sessions.set(id, { csrf, createdAt: Date.now() })
    response.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict`,
      `${CSRF_COOKIE}=${csrf}; Path=/; SameSite=Strict`,
    ])
    return { id, csrf }
  }

  function validMutation(request, session) {
    const origin = request.headers.origin || ''
    const csrf = request.headers['x-musuw-csrf'] || ''
    return allowedOrigins.has(origin) && safeEqual(String(csrf), session.csrf)
  }

  async function proxyOperationsRequest(request, response, url, session) {
    if (!platformKey) return writeJSON(response, 503, { error: 'Musuw operations credential unavailable' })
    if (!isSafeOperationsPath(request.method, url.pathname)) {
      return writeJSON(response, 404, { error: 'operation is outside the console allowlist' })
    }
    if (!['GET', 'HEAD'].includes(request.method) && !validMutation(request, session)) {
      return writeJSON(response, 403, { error: 'same-origin confirmation token required' })
    }
    let body
    if (!['GET', 'HEAD'].includes(request.method)) {
      const parsed = await parseJSONBody(request)
      body = parsed == null ? undefined : JSON.stringify(parsed)
    }
    const upstream = new URL(url.pathname + url.search, runtime.backendBaseUrl)
    const { response: upstreamResponse, payload } = await fetchJSON(upstream, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': platformKey,
        'X-Request-ID': request.headers['x-request-id'] || randomBytes(12).toString('hex'),
      },
      body,
    })
    return writeJSON(response, upstreamResponse.status, payload ?? {})
  }

  async function paddleData() {
    if (!runtime.paddleApiKey) return { available: false, reason: 'Paddle API credential is not configured', subscriptions: [], transactions: [] }
    const headers = { Authorization: `Bearer ${runtime.paddleApiKey}`, Accept: 'application/json' }
    try {
      const [subscriptions, transactions] = await Promise.all([
        fetchJSON(`${runtime.paddleApiBase}/subscriptions?per_page=50`, { headers }),
        fetchJSON(`${runtime.paddleApiBase}/transactions?per_page=50`, { headers }),
      ])
      if (!subscriptions.response.ok || !transactions.response.ok) {
        const status = !subscriptions.response.ok ? subscriptions.response.status : transactions.response.status
        return { available: false, reason: `Paddle API returned HTTP ${status}`, subscriptions: [], transactions: [] }
      }
      return {
        available: true,
        reason: '',
        subscriptions: normalizeProviderItems(subscriptions.payload, 'subscriptions'),
        transactions: normalizeProviderItems(transactions.payload, 'transactions'),
      }
    } catch (error) {
      return { available: false, reason: publicError(error), subscriptions: [], transactions: [] }
    }
  }

  const server = createServer(async (request, response) => {
    secureHeaders(response)
    try {
      if (!allowedHosts.has(request.headers.host || '')) return writeJSON(response, 421, { error: 'invalid host' })
      const url = new URL(request.url || '/', `http://${request.headers.host}`)
      if (url.pathname === '/healthz') {
        return writeJSON(response, 200, { status: 'ok', environment: runtime.label })
      }
      const session = ensureSession(request, response, url.pathname)
      if (!session && !isPublicBrandAsset(request.method || 'GET', url.pathname)) {
        return writeJSON(response, 401, { error: 'open the console directly from this Mac to start an operator session' })
      }

      if (url.pathname.startsWith('/api/v1/system/')) {
        return await proxyOperationsRequest(request, response, url, session)
      }
      if (url.pathname.startsWith('/admin-api/')) {
        if (request.method !== 'GET') return writeJSON(response, 405, { error: 'method not allowed' })
        switch (url.pathname) {
          case '/admin-api/config':
            return writeJSON(response, 200, { data: {
              csrf_token: session.csrf,
              environment: runtime.label,
              target: runtime.target,
              providers: {
                weknora: { available: Boolean(platformKey), authority: 'Musuw scoped management API' },
                paddle: { available: Boolean(runtime.paddleApiKey), authority: `Paddle ${runtime.paddleEnvironment}` },
                supabase: { ...runtime.supabaseAdmin, authority: 'Supabase Auth Admin' },
                r2: { ...runtime.r2Admin, authority: 'Cloudflare R2 S3 API' },
                langfuse: { ...runtime.langfuse, authority: 'Langfuse' },
              },
              links: {
                paddle: runtime.paddleEnvironment === 'sandbox' ? 'https://sandbox-vendors.paddle.com/' : 'https://vendors.paddle.com/',
                supabase_staging: 'https://supabase.com/dashboard/project/achfnnicetupvtoqiwqd',
                supabase_production: 'https://supabase.com/dashboard/project/phtveqtlswzokwsztsvu',
                cloudflare_r2: 'https://dash.cloudflare.com/c692db4757e1454b71880ec6c431db9c/r2',
                openrouter: 'https://openrouter.ai/settings/keys',
                resend: 'https://resend.com/domains',
              },
            } })
          case '/admin-api/overview':
            return writeJSON(response, 200, { data: await queries.overview() })
          case '/admin-api/users':
            return writeJSON(response, 200, { data: await queries.users(url) })
          case '/admin-api/knowledge':
            return writeJSON(response, 200, { data: await queries.knowledge(url) })
          case '/admin-api/billing': {
            const [mirror, provider] = await Promise.all([queries.billing(), paddleData()])
            return writeJSON(response, 200, { data: { mirror, provider } })
          }
          case '/admin-api/identity':
            return writeJSON(response, 200, { data: {
              account_summary: await queries.identity(),
              provider: {
                available: runtime.supabaseAdmin.available,
                reason: `${runtime.supabaseAdmin.reason}; account data below is the Musuw mirror, not a fabricated Supabase response.`,
                projects: [
                  { environment: 'TEST', name: 'Musuw Staging', ref: 'achfnnicetupvtoqiwqd' },
                  { environment: 'PRODUCTION', name: 'Musuw Production', ref: 'phtveqtlswzokwsztsvu' },
                ],
              },
            } })
          case '/admin-api/storage':
            return writeJSON(response, 200, { data: await queries.storage(url) })
          default:
            return writeJSON(response, 404, { error: 'not found' })
        }
      }

      const requestedPath = url.pathname === '/' ? '/operations.html' : url.pathname
      let decodedPath
      try {
        decodedPath = decodeURIComponent(requestedPath)
      } catch {
        return writeJSON(response, 400, { error: 'invalid path' })
      }
      const filePath = resolve(assetDir, `.${decodedPath}`)
      if (filePath !== assetDir && !filePath.startsWith(`${assetDir}${sep}`)) return writeJSON(response, 403, { error: 'forbidden' })
      if (!existsSync(filePath) || !statSync(filePath).isFile()) return writeJSON(response, 404, { error: 'not found' })
      const ext = extname(filePath).toLowerCase()
      response.writeHead(200, {
        'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      })
      createReadStream(filePath).pipe(response)
    } catch (error) {
      console.error('[musuw-admin]', publicError(error))
      if (!response.headersSent) writeJSON(response, 500, { error: publicError(error) })
      else response.end()
    }
  })

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, host, () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  }).catch(async (error) => {
    await pool.end().catch(() => {})
    throw error
  })
  console.log(`Musuw operations console ${runtime.label} listening on http://${host}:${port}`)
  console.log(`Musuw management API: ${platformKey ? 'available' : 'unavailable'}`)

  const shutdown = async () => {
    server.close()
    await pool.end().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error) => {
    console.error(`musuw-admin: ${publicError(error)}`)
    process.exit(1)
  })
}
