import { readFile, readdir } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { expect, test } from '@playwright/test'

// Unlike the development component harnesses, this serves the unmodified Vite
// production HTML and every emitted module. Only API responses are synthetic:
// real router navigation must evaluate the actual split module dependency graph.
const dist = resolve(process.env.MUSUW_APP_DIST || 'weknora/frontend/dist')
const origin = 'http://musuw-production-bundle.test'
const kb = {
  id: 'bundle-kb', tenant_id: 42, creator_id: 'bundle-user', name: '生产构建验收知识库',
  type: 'document', knowledge_count: 1, document_count: 1,
  indexing_strategy: { wiki_enabled: true },
  capabilities: { ready: true, storage_ready: true },
}
const document = {
  id: 'bundle-document', knowledge_base_id: kb.id, title: '构建验收文档.pdf',
  file_name: '构建验收文档.pdf', file_type: 'pdf', type: 'file', folder_path: '',
  parse_status: 'completed', summary_status: 'completed', summary: '仅供离线浏览器验收。',
  created_at: '2026-09-28T00:00:00Z', updated_at: '2026-09-28T00:00:00Z',
}
const wikiPage = {
  id: 'bundle-wiki-page', tenant_id: 42, knowledge_base_id: kb.id,
  slug: 'concept/bundle', title: '构建验收概念', page_type: 'concept', status: 'published',
  content: '# 构建验收概念\n\n这是离线验收正文。', summary: '离线验收概念摘要',
  aliases: [], source_refs: [], in_links: [], out_links: [], page_metadata: {}, version: 1,
  created_at: document.created_at, updated_at: document.updated_at,
}
const contentTypes: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
}

for (const blockedDetail of [false, true]) {
test(blockedDetail
  ? 'production route download failure retains the list and shows a visible retry message'
  : 'production bundles navigate knowledge list → documents → Wiki → rendered graph', async ({ page }) => {
  const html = await readFile(resolve(dist, 'index.html'), 'utf8')
  expect(html).toMatch(/type="module"[^>]+src="\/assets\/[^"\s]+\.js"/)
  expect(html).not.toContain('/src/main.ts')
  const errors: string[] = []
  const requested = new Set<string>()
  const missingAssets: string[] = []
  const outsideRequests: string[] = []
  const unexpectedWrites: string[] = []
  const blockedModules: string[] = []
  let canBlockDetail = false
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'zh-CN')
    localStorage.setItem('weknora_token', 'synthetic-offline-session')
  })
  // A fresh synthetic account can show the delayed onboarding tour. Dismiss it
  // through its real control instead of letting machine speed decide coverage.
  await page.addLocatorHandler(page.locator('.guide'), async () => {
    await page.locator('.guide__skip').click()
  })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      outsideRequests.push(url.origin)
      return route.abort('blockedbyclient')
    }
    const path = url.pathname
    if (path.startsWith('/api/')) {
      requested.add(path)
      if (path === '/api/v1/client-diagnostics') return route.fulfill({ status: 204 })
      if (route.request().method() !== 'GET') {
        unexpectedWrites.push(`${route.request().method()} ${path}`)
        return route.fulfill({ status: 405, json: { success: false } })
      }
      const ok = (data: unknown, extra: object = {}) => route.fulfill({ json: { success: true, data, ...extra } })
      if (path === '/api/v1/auth/me') return ok({
        user: { id: 'bundle-user', username: '离线验收', tenant_id: 42 },
        tenant: { id: 42, name: '离线验收空间', owner_id: 'bundle-user' },
        memberships: [{ tenant_id: 42, tenant_name: '离线验收空间', role: 'owner' }],
        capabilities: { can_create_tenant: false },
      })
      if (path === '/api/v1/system/info') return ok({ edition: 'lite' })
      if (path === '/api/v1/entitlements/current') return ok({
        plan: 'max', plan_status: 'active', max_documents_per_kb: 0,
        storage_bytes: 107374182400, storage_used: 0,
      })
      if (path === '/api/v1/knowledge-bases') return ok([kb], { total: 1 })
      if (path === '/api/v1/knowledge-bases/bundle-kb') return ok(kb)
      if (path === '/api/v1/knowledge-bases/bundle-kb/knowledge') return ok([document], { total: 1 })
      if (path === '/api/v1/knowledge-bases/bundle-kb/folders') return ok({ total_document_count: 1, root_document_count: 1, folders: [] })
      if (path.endsWith('/parser-engines')) return ok([{ Name: 'builtin', Available: true, FileTypes: ['pdf'] }])
      if (path === '/api/v1/knowledgebase/bundle-kb/wiki/stats') return ok({
        total_pages: 1, pages_by_type: { concept: 1 }, total_links: 1, orphan_count: 0,
        recent_updates: [], pending_tasks: 0, pending_issues: 0, is_active: false,
      })
      if (path === '/api/v1/knowledgebase/bundle-kb/wiki/index') return ok({ intro: '# 离线知识索引\n\n生产构建 Wiki 验收正文。', groups: [] })
      if (path === '/api/v1/knowledgebase/bundle-kb/wiki/pages') {
        const pages = (url.searchParams.get('page_type') || 'concept').includes('concept') ? [wikiPage] : []
        return ok({ pages, total: pages.length, page: 1, page_size: 50, total_pages: 1 })
      }
      if (path === '/api/v1/knowledgebase/bundle-kb/wiki/folders') return ok({ parent_id: '', folders: [] })
      if (path === '/api/v1/knowledgebase/bundle-kb/wiki/graph') return ok({
        nodes: [
          { slug: 'concept/bundle', title: '构建验收概念', page_type: 'concept', link_count: 1 },
          { slug: 'summary/document', title: '构建验收摘要', page_type: 'summary', link_count: 1 },
        ],
        edges: [{ source: 'concept/bundle', target: 'summary/document' }],
        meta: { mode: 'overview', total: 2, returned: 2, truncated: false },
      })
      if (path === '/api/v1/knowledgebase/bundle-kb/wiki/pages/concept/bundle') return ok(wikiPage)
      return ok([], { total: 0 })
    }
    if (path.startsWith('/platform/')) return route.fulfill({ contentType: 'text/html', body: html })
    if (blockedDetail && canBlockDetail && /^\/assets\/KnowledgeBase-[^/]+\.js$/.test(path)) {
      blockedModules.push(path)
      return route.abort('failed')
    }
    const file = resolve(dist, `.${decodeURIComponent(path)}`)
    if (!file.startsWith(`${dist}${sep}`)) return route.abort('blockedbyclient')
    try {
      return await route.fulfill({ body: await readFile(file), contentType: contentTypes[extname(file)] || 'application/octet-stream' })
    } catch {
      missingAssets.push(path)
      return route.fulfill({ status: 404, body: 'Missing production asset' })
    }
  })
  try {
    await page.goto(`${origin}/platform/knowledge-bases`)
    canBlockDetail = true
    await page.locator('.visual-reference-kb-card__title').filter({ hasText: kb.name }).click()
    if (blockedDetail) {
      await expect(page.getByText('页面未能加载，请刷新后重试', { exact: true })).toBeVisible()
      await expect(page).toHaveURL(`${origin}/platform/knowledge-bases`)
      await expect(page.locator('.visual-reference-kb-card__title').filter({ hasText: kb.name })).toBeVisible()
      expect(blockedModules.length).toBeGreaterThan(0)
      expect(errors.some(error => /dynamically imported module|loading dynamically imported module/i.test(error))).toBe(true)
      expect(missingAssets).toEqual([])
      expect(outsideRequests).toEqual([])
      expect(unexpectedWrites).toEqual([])
      return
    }
    await expect(page).toHaveURL(`${origin}/platform/knowledge-bases/${kb.id}`)
    await expect(page.getByRole('heading', { name: '构建验收文档', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Wiki', exact: true }).click()
    await expect(page.locator('.wiki-browser')).toContainText('生产构建 Wiki 验收正文。')
    await page.getByRole('tab', { name: '图谱', exact: true }).click()
    await expect(page.locator('.wiki-graph-canvas canvas')).toBeVisible()
    await expect(page.locator('.wiki-graph-legend')).toBeVisible()
    // Also evaluate optional graph/Mermaid engines even when the default graph
    // renderer changes; they must remain independently importable after splitting.
    const modules = (await readdir(resolve(dist, 'assets'))).filter(name => /^(g6WikiGraphRenderer|vendor-mermaid)-.*\.js$/.test(name))
    expect(modules).toHaveLength(2)
    await page.evaluate(async modules => {
      for (const name of modules) await import(`/assets/${name}`)
    }, modules)
    expect(requested).toContain('/api/v1/knowledge-bases/bundle-kb/knowledge')
    expect(requested).toContain('/api/v1/knowledgebase/bundle-kb/wiki/index')
    expect(requested).toContain('/api/v1/knowledgebase/bundle-kb/wiki/graph')
    expect(missingAssets).toEqual([])
    expect(outsideRequests).toEqual([])
    expect(unexpectedWrites).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await test.info().attach('production-module-evidence', { contentType: 'application/json', body: JSON.stringify({ errors, requested: [...requested], missingAssets, outsideRequests, unexpectedWrites, blockedModules }, null, 2) })
  }
})
}
