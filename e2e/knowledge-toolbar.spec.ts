import { expect, test, type Page } from '@playwright/test'

// Run the real knowledge page and styles, replacing only the remote API.
const parent = '3、舒良树《普通地质学》课程资料非常长的目录'
const child = '3、舒良树《普通地质学》思维导图完整知识'
const nested = `${parent}/${child}`
const kb = { id: 'upload-kb', tenant_id: 42, creator_id: 'upload-user', name: '工具栏验收',
  type: 'document', capabilities: { ready: true, storage_ready: true } }

async function openPage(page: Page, sidebarWidth = 256) {
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const ok = (body: object) => route.fulfill({ json: { success: true, ...body } })
    if (path === '/api/v1/entitlements/current') return ok({ data: {
      plan: 'max', plan_status: 'complimentary', max_documents_per_kb: 0,
      storage_bytes: 107374182400, storage_used: 0,
    } })
    if (path === '/api/v1/knowledge-bases') return ok({ data: [kb], total: 1 })
    if (path === '/api/v1/knowledge-bases/upload-kb') return ok({ data: kb })
    if (path.endsWith('/parser-engines')) return ok({ data: [{ Name: 'builtin', Available: true, FileTypes: ['pdf'] }] })
    if (path.endsWith('/folders')) return ok({ data: {
      total_document_count: 2, root_document_count: 1, folders: [{
        path: parent, name: parent, document_count: 0, total_document_count: 1,
        children: [{ path: nested, name: child, document_count: 1, total_document_count: 1, children: [] }],
      }],
    } })
    if (path.endsWith('/knowledge')) return ok({ total: 1, data: [{
      id: 'toolbar-doc', knowledge_base_id: kb.id, title: '工具栏文档.pdf', file_name: '工具栏文档.pdf',
      type: 'file', file_type: 'pdf', folder_path: url.searchParams.get('folder_path') || '',
      parse_status: 'completed', summary_status: 'completed',
      created_at: '2026-09-11T10:00:00Z', updated_at: '2026-09-11T10:00:00Z',
    }] })
    return ok({ data: [], total: 0 })
  })
  await page.goto('/e2e/knowledge-upload-harness.html')
  // The harness omits the surrounding application navigation.
  await page.addStyleTag({ content: `#app { width: calc(100% - ${sidebarWidth}px); margin-left: ${sidebarWidth}px; }` })
  await expect(page.getByRole('heading', { name: '工具栏文档', exact: true })).toBeVisible()
}

async function controls(page: Page) {
  return page.locator('.visual-knowledge-toolbar').evaluate(toolbar => {
    const rect = (el: Element) => {
      const box = el.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    return {
      toolbar: rect(toolbar), scrollWidth: toolbar.scrollWidth, clientWidth: toolbar.clientWidth,
      items: [...toolbar.querySelectorAll('.visual-knowledge-filter-button, .visual-knowledge-view-toggle, .visual-upload-source__trigger')].map(rect),
    }
  })
}

async function expectOneRow(page: Page, scrollable = false) {
  const geometry = await controls(page)
  expect(geometry.items).toHaveLength(6)
  const center = geometry.items[0].y + geometry.items[0].height / 2
  for (const [index, item] of geometry.items.entries()) {
    expect(Math.abs(item.y + item.height / 2 - center)).toBeLessThan(1)
    if (index) expect(item.x).toBeGreaterThanOrEqual(geometry.items[index - 1].x + geometry.items[index - 1].width - 1)
  }
  if (!scrollable) expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
  return geometry.items
}

test('root and nested paths keep all toolbar controls in one row with either directory width', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 950 })
  await openPage(page)
  const expanded = await expectOneRow(page)
  await page.locator('.visual-folder-tree__collapse').click()
  const collapsed = await expectOneRow(page)
  await page.locator('.visual-folder-tree__collapsed-trigger').click()
  for (const path of [parent, nested]) {
    await page.locator('.visual-folder-row').filter({ hasText: path === parent ? parent : child }).first().click()
    await expect(page.locator('.visual-knowledge-path-pill__segment.is-current')).toHaveText(path === parent ? parent : child)
    expect(await expectOneRow(page)).toEqual(expanded)
    await page.locator('.visual-folder-tree__collapse').click()
    expect(await expectOneRow(page)).toEqual(collapsed)
    await page.locator('.visual-folder-tree__collapsed-trigger').click()
  }
})

test('search reports busy without inserting a visible loading item or moving controls', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 950 })
  await openPage(page)
  await page.locator('.visual-folder-tree__collapse').click()
  const before = await controls(page)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/knowledge-bases/upload-kb/knowledge?**', async route => { await pending; await route.fallback() })
  try {
    await page.getByPlaceholder('搜索文档名称...').fill('工具栏')
    await expect(page.locator('.visual-knowledge-scroll')).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('heading', { name: '工具栏文档', exact: true })).toBeVisible()
    const status = page.locator('.visual-knowledge-toolbar').getByRole('status')
    await expect(status).toContainText('加载中')
    const statusBox = await status.boundingBox()
    expect(statusBox?.width).toBeLessThanOrEqual(1)
    expect(statusBox?.height).toBeLessThanOrEqual(1)
    expect(await controls(page)).toEqual(before)
  } finally { release() }
  await expect(page.locator('.visual-knowledge-scroll')).toHaveAttribute('aria-busy', 'false')
})

test('a narrow toolbar scrolls horizontally without wrapping or overlapping its controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPage(page, 0)
  await page.locator('.visual-folder-tree__collapse').click()
  await expectOneRow(page, true)
  const geometry = await controls(page)
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth)
  await page.locator('.visual-knowledge-toolbar').evaluate(el => { el.scrollLeft = el.scrollWidth })
  await expect(page.getByRole('button', { name: '导入网页', exact: true })).toBeInViewport({ ratio: 1 })
  await expectOneRow(page, true)
})
