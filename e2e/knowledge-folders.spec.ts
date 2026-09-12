import { expect, test, type Page } from '@playwright/test'

// Run the real knowledge page, folder tree, document views and API client.
// Only the remote API is replaced: one root document and two nested documents
// distinguish direct document counts from the total including subfolders.
const kb = {
  id: 'upload-kb', tenant_id: 42, creator_id: 'upload-user', name: '目录验收',
  type: 'document', capabilities: { ready: true, storage_ready: true },
}
const documents = [
  { id: 'root-file', folder_path: '' },
  { id: 'child-a-file', folder_path: '父目录/子文件夹A' },
  { id: 'child-b-file', folder_path: '父目录/子文件夹B' },
].map(document => ({
  ...document, knowledge_base_id: kb.id,
  title: `${document.id}.pdf`, file_name: `${document.id}.pdf`,
  file_type: 'pdf', type: 'file', parse_status: 'completed', summary_status: 'completed',
  created_at: '2026-09-11T10:00:00Z', updated_at: '2026-09-11T10:00:00Z',
}))
const folders = {
  total_document_count: 3, root_document_count: 1,
  folders: [{
    path: '父目录', name: '父目录', document_count: 0, total_count: 2,
    children: [
      { path: '父目录/子文件夹A', name: '子文件夹A', document_count: 1, total_count: 1, children: [] },
      { path: '父目录/子文件夹B', name: '子文件夹B', document_count: 1, total_count: 1, children: [] },
    ],
  }],
}

async function installApi(page: Page) {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const ok = (body: object) => route.fulfill({ json: { success: true, ...body } })
    if (path === '/api/v1/entitlements/current') return ok({ data: {
      plan: 'max', plan_status: 'complimentary', max_documents_per_kb: 0,
      storage_bytes: 107374182400, storage_used: 0,
    } })
    if (path === '/api/v1/knowledge-bases') return ok({ data: [kb], total: 1 })
    if (path === '/api/v1/knowledge-bases/upload-kb') return ok({ data: kb })
    if (path.endsWith('/parser-engines')) return ok({ data: [
      { Name: 'builtin', Available: true, FileTypes: ['pdf'] },
    ] })
    if (path.endsWith('/folders')) return ok({ data: folders })
    if (path === '/api/v1/knowledge-bases/upload-kb/knowledge') {
      const folder = url.searchParams.get('folder_path')
      const recursive = url.searchParams.get('folder_recursive') === 'true'
      const keyword = url.searchParams.get('keyword') || ''
      const data = documents.filter(document => (
        folder === null || document.folder_path === folder ||
        (recursive && (!folder || document.folder_path.startsWith(`${folder}/`)))
      ) && document.title.includes(keyword))
      return ok({ data, total: data.length })
    }
    return ok({ data: [], total: 0 })
  })
}

test.beforeEach(async ({ page }) => {
  await installApi(page)
  await page.goto('/e2e/knowledge-upload-harness.html')
  await expect(page.getByRole('heading', { name: 'root-file', exact: true })).toBeVisible()
})

test('root keeps its direct document and distinguishes direct and recursive counts', async ({ page }) => {
  const root = page.locator('.visual-folder-row.is-root')
  await expect(root.locator('.visual-folder-row__count')).toHaveText('3')
  await expect(root.locator('.visual-folder-row__count')).toHaveAttribute('title', '本层 1 个文档，含子目录共 3 个')
  const parent = page.locator('.visual-folder-row').filter({ hasText: '父目录' }).first()
  await expect(parent.locator('.visual-folder-row__count')).toHaveAttribute('title', '本层 0 个文档，含子目录共 2 个')
  await parent.click()
  await expect(page.locator('.visual-knowledge-path-pill .is-current')).toHaveText('父目录')
  await expect(page.locator('.visual-knowledge-scroll')).not.toContainText('root-file')
  await root.click()
  await expect(page.getByRole('heading', { name: 'root-file', exact: true })).toBeVisible()
  await expect(page.locator('.visual-folder-card')).toHaveCount(1)
  await expect(page.locator('.visual-knowledge-scroll')).not.toContainText('child-a-file')
})

for (const view of ['grid', 'list'] as const) {
  test(`${view} keeps the same child folders when the sidebar is expanded or collapsed`, async ({ page }) => {
    if (view === 'list') await page.locator('.visual-knowledge-view-toggle button').nth(1).click()
    await page.locator('.visual-folder-row').filter({ hasText: '父目录' }).first().click()
    const content = page.locator('.visual-knowledge-scroll')
    const childFolders = content.locator(view === 'grid' ? '.visual-folder-card' : '.visual-document-list__row.is-folder')
    const expectChildren = async () => {
      await expect(childFolders).toHaveCount(2)
      await expect(content.getByText('子文件夹A', { exact: true })).toBeVisible()
      await expect(content.getByText('子文件夹B', { exact: true })).toBeVisible()
      await expect(content.locator('.visual-knowledge-empty')).toHaveCount(0)
    }
    await expectChildren()
    await page.locator('.visual-folder-tree__collapse').click()
    await expectChildren()
    await page.locator('.visual-folder-tree__collapsed-trigger').click()
    await expectChildren()
  })
}
