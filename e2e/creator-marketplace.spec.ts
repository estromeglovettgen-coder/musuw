import { test, expect, type Page } from '@playwright/test'

const taylor = { id: 'taylor', title: '泰勒·测试环境样例', description: 'A curated question-answering service.', category: '知识', agent_id: 'platform-agent', agent_name: '泰勒专属智能体', knowledge_base_ids: ['platform-kb'], knowledge_base_names: ['泰勒知识库'], sample_questions: ['如何理解长期主义？'], default_model_id: 'builtin-deepseek-v4-flash', currency: 'USD', monthly_amount: 1900, yearly_amount: 19000, status: 'published', featured: true, fixture: false, checkout_available: true, created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', access: { can_chat: false, cancel_at_period_end: false } }
async function mockMarket(page: Page, options: { paid?: boolean; max?: boolean; pending?: boolean; creatorDraft?: boolean; pendingOrder?: boolean; refundedOrder?: boolean; existingSubscription?: 'refunded' | 'canceled'; checkoutAvailable?: boolean } = {}) {
  let paid = options.paid || false
  const requests: Array<{ path: string; body: any }> = []
  const counts = { chat: 0, suggestion: 0, details: 0 }
  let creatorProduct = options.creatorDraft ? { ...taylor, status: 'draft', contact: 'creator@example.test', authorization: 'I own these materials.', authorization_confirmed: true } : null
  await page.addInitScript(() => {
    let callback: any
    ;(window as any).PaddleBillingV1 = { Environment: { set() {} }, Initialize({ eventCallback }: any) { callback = eventCallback }, Update() {}, Checkout: { open({ transactionId, settings }: any) { const frame = document.createElement('iframe'); frame.title = 'Paddle checkout'; frame.dataset.transactionId = transactionId; document.querySelector(`.${settings.frameTarget}`)?.append(frame) }, close() {} } }
    ;(window as any).__completePaddle = () => callback?.({ name: 'checkout.completed' })
    ;(window as any).__emitPaddleEvent = (name: string) => callback?.({ name })
  })
  const product = () => ({ ...taylor, checkout_available: options.checkoutAvailable ?? taylor.checkout_available, access: { can_chat: paid, portal_available: paid || Boolean(options.existingSubscription), subscription_id: paid || options.existingSubscription ? 'sub_owned' : undefined, status: options.existingSubscription || (paid ? 'active' : undefined), paid_through: paid || options.existingSubscription ? '2026-10-22T00:00:00Z' : undefined, cancel_at_period_end: false } })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (method !== 'GET') requests.push({ path, body: route.request().postDataJSON() })
    if (path.includes('suggested-questions')) counts.suggestion++
    if (path.includes('/agent-chat/') || path.includes('/knowledge-chat/')) { counts.chat++; return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"response_type":"complete","data":{"is_completed":true}}\n\n' }) }
    if (path === '/api/v1/sessions' && method === 'POST') return route.fulfill({ json: { data: { id: 'chat-fixture' } } })
    if (path === '/api/v1/sessions/chat-fixture') return route.fulfill({ json: { data: { id: 'chat-fixture', title: 'Marketplace chat' } } })
    if (path.endsWith('/creator-marketplace/products/taylor/checkout')) return route.fulfill({ json: { configured: true, environment: 'sandbox', client_token: 'test_fixture', transaction_id: 'txn_fixture', subscription_id: '' } })
    if (path.endsWith('/creator-marketplace/subscriptions/sub_owned/portal')) return route.fulfill({ json: { authorization_url: `${new URL(route.request().url()).origin}/portal-confirmed` } })
    if (path.endsWith('/creator-marketplace/orders')) return route.fulfill({ json: { subscriptions: [{ id: 'sub_owned', portal_available: !options.pendingOrder, product_id: 'taylor', product_title: taylor.title, billing_period: 'monthly', amount: 1900, currency: 'USD', status: options.refundedOrder ? 'refunded' : options.pendingOrder ? 'creating' : 'active', paid_through: '2026-10-22T00:00:00Z', cancel_at_period_end: true, can_chat: !options.pendingOrder && !options.refundedOrder }], transactions: [{ id: 'txn_paid', product_id: 'taylor', product_title: taylor.title, status: 'completed', currency: 'USD', amount: '1900', billing_period: 'monthly', occurred_at: '2026-09-22T00:00:00Z' }], membership_management_path: '/plans' } })
    if (path.endsWith('/system/creator-marketplace/products/taylor/review')) return route.fulfill({ json: { data: product() } })
    if (path.endsWith('/system/creator-marketplace/products')) return route.fulfill({ json: { data: [{ ...product(), status: options.pending ? 'pending' : 'published', platform_agent_id: 'platform-agent', platform_knowledge_base_ids: ['platform-kb'], paddle_product_id: 'pro_configured', monthly_price_id: 'pri_monthly', yearly_price_id: 'pri_yearly', contact: 'creator@example.test', authorization: 'Review fixture rights', authorization_confirmed: true }], total: 1 } })
    if (path.endsWith('/creator-marketplace/creator/products/taylor/submit')) { creatorProduct = { ...creatorProduct!, status: 'pending' }; return route.fulfill({ json: { data: creatorProduct } }) }
    if (path.endsWith('/creator-marketplace/creator/products/taylor') && method === 'PUT') { const input = route.request().postDataJSON(); creatorProduct = { ...creatorProduct!, ...input, yearly_amount: input.monthly_amount * 10 }; return route.fulfill({ json: { data: creatorProduct } }) }
    if (path.endsWith('/creator-marketplace/creator/products')) return route.fulfill({ json: { data: creatorProduct ? [creatorProduct] : [], total: creatorProduct ? 1 : 0 } })
    if (path.endsWith('/creator-marketplace/products/taylor')) { counts.details++; return route.fulfill({ json: { data: product() } }) }
    if (path.endsWith('/creator-marketplace/products')) return route.fulfill({ json: { data: [{ ...product(), id: 'test', title: '测试商品一', fixture: true }, product()], total: 2 } })
    if (path.endsWith('/entitlements/current')) return route.fulfill({ json: { data: { plan: options.max ? 'max' : 'free', plan_status: options.max ? 'complimentary' : 'free', plan_source: 'complimentary', storage_bytes: 100000000, storage_used: 0 }, billing: { configured: false } } })
    if (path.endsWith('/agents')) return route.fulfill({ json: { data: [{ id: 'platform-agent', name: 'Platform delivery agent', is_builtin: false, config: { agent_mode: 'smart-reasoning', knowledge_bases: ['platform-kb'] } }] } })
    if (path.endsWith('/knowledge-bases')) return route.fulfill({ json: { data: [{ id: 'platform-kb', name: 'Platform delivery knowledge', type: 'document' }] } })
    if (path.endsWith('/models')) return route.fulfill({ json: { success: true, data: [{ id: 'builtin-deepseek-v4-flash', name: 'DeepSeek V4 Flash', type: 'KnowledgeQA', is_builtin: true, parameters: {} }] } })
    return route.fulfill({ json: { success: true, data: [] } })
  })
  return { requests, counts, activate: () => { paid = true } }
}
const visit = (page: Page, path = '/platform/marketplace') => page.goto(`/e2e/marketplace-harness.html?path=${encodeURIComponent(path)}`)

test('featured product is above test collection and public cards have no author metadata', async ({ page }) => {
  await mockMarket(page)
  await visit(page)
  await expect(page.locator('.market-featured')).toContainText(taylor.title)
  await expect(page.getByRole('heading', { name: '测试商品', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '市场管理', exact: true })).toBeVisible()
  await expect(page.locator('main')).not.toContainText('creator@example.test')
})

test('yearly checkout waits for server access after Paddle completion', async ({ page }) => {
  const api = await mockMarket(page)
  await visit(page, '/platform/marketplace/taylor')
  await page.getByRole('button', { name: '年付', exact: true }).click()
  await expect(page.locator('.market-price')).toContainText('190.00')
  expect(api.requests).toHaveLength(0)
  await page.getByRole('button', { name: '订阅使用', exact: true }).click()
  await expect(page.locator('iframe[title="Paddle checkout"]')).toBeAttached()
  expect(api.requests[0].body.billing_period).toBe('yearly')
  expect(api.requests[0].body.operation_key).toMatch(/^[a-f0-9-]{36}$/)
  await page.evaluate(() => (window as any).__completePaddle())
  await expect(page.getByRole('heading', { name: '已收到付款结果，正在确认订阅。' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始提问', exact: true })).toHaveCount(0)
  api.activate()
  await expect(page.getByRole('heading', { name: '订阅已生效' })).toBeVisible()
  expect(api.counts.chat).toBe(0)
})

test('a declined payment keeps the same checkout available for retry without an opening error', async ({ page }) => {
  const api = await mockMarket(page)
  await visit(page, '/platform/marketplace/taylor')
  await page.getByRole('button', { name: '订阅使用', exact: true }).click()
  const frame = page.locator('iframe[title="Paddle checkout"]')
  await expect(frame).toBeAttached()
  const originalFrame = await frame.elementHandle()
  const initialDetails = api.counts.details
  await page.evaluate(() => (window as any).__emitPaddleEvent('checkout.payment.failed'))
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '重试结账', exact: true })).toHaveCount(0)
  expect(await originalFrame!.evaluate(element => element.isConnected)).toBe(true)
  await expect(frame).toHaveAttribute('data-transaction-id', 'txn_fixture')
  expect(api.counts.details).toBe(initialDetails)
  await expect(page.getByRole('button', { name: '开始提问', exact: true })).toHaveCount(0)
  // Paddle retries payment inside this checkout; our integration must not reopen it or create another intent.
  await page.evaluate(() => (window as any).__emitPaddleEvent('checkout.payment.initiated'))
  expect(await originalFrame!.evaluate(element => element.isConnected)).toBe(true)
  await page.evaluate(() => (window as any).__completePaddle())
  await expect(page.getByRole('heading', { name: '已收到付款结果，正在确认订阅。' })).toBeVisible()
  api.activate()
  await expect(page.getByRole('heading', { name: '订阅已生效' })).toBeVisible()
  expect(api.requests.filter(request => request.path.endsWith('/checkout'))).toHaveLength(1)
  expect(api.counts.chat).toBe(0)
})

test('an actual checkout opening error still allows retry using the same transaction', async ({ page }) => {
  const api = await mockMarket(page)
  await visit(page, '/platform/marketplace/taylor')
  await page.getByRole('button', { name: '订阅使用', exact: true }).click()
  await expect(page.locator('iframe[title="Paddle checkout"]')).toBeAttached()
  await page.evaluate(() => (window as any).__emitPaddleEvent('checkout.error'))
  await expect(page.getByRole('alert')).toContainText('结账页打开失败')
  await page.getByRole('button', { name: '重试结账', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('iframe[title="Paddle checkout"]').last()).toHaveAttribute('data-transaction-id', 'txn_fixture')
  expect(api.requests.filter(request => request.path.endsWith('/checkout'))).toHaveLength(1)
})

test('paid product returns to the existing composer with draft, agent, KB and Flash, without generating a question', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  const api = await mockMarket(page, { paid: true })
  await visit(page, '/platform/creatChat')
  const textarea = page.locator('textarea').first()
  await textarea.fill('This is my unsent draft')
  await expect.poll(() => page.evaluate(() => (window as any).__marketplaceHarness.menu.newChatDraft)).toBe('This is my unsent draft')
  await page.getByRole('button', { name: 'Visit market', exact: true }).click()
  await page.getByRole('button', { name: '查看详情', exact: true }).first().click()
  expect(await page.evaluate(() => (window as any).__marketplaceHarness.menu.newChatDraft)).toBe('This is my unsent draft')
  const priorSuggestions = api.counts.suggestion
  await page.getByRole('button', { name: '开始提问', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('泰勒·测试环境样例')
  const serviceBounds = await page.locator('.market-service-selection').evaluate(element => {
    const notice = element.getBoundingClientRect()
    const exit = element.querySelector('button')!.getBoundingClientRect()
    return { noticeLeft: notice.left, noticeRight: notice.right, exitLeft: exit.left, exitRight: exit.right, viewport: window.innerWidth }
  })
  expect(serviceBounds.noticeLeft).toBeGreaterThanOrEqual(0)
  expect(serviceBounds.noticeRight).toBeLessThanOrEqual(serviceBounds.viewport)
  expect(serviceBounds.exitLeft).toBeGreaterThanOrEqual(serviceBounds.noticeLeft)
  expect(serviceBounds.exitRight).toBeLessThanOrEqual(Math.min(serviceBounds.noticeRight, serviceBounds.viewport))
  await expect(page.locator('textarea').first()).toHaveValue('This is my unsent draft')
  const state = await page.evaluate(() => { const h = (window as any).__marketplaceHarness; return { product: h.settings.settings.marketplaceProductId, agent: h.settings.selectedAgentId, kbs: h.settings.settings.selectedKnowledgeBases, model: h.settings.conversationModels.selectedChatModelId } })
  expect(state.product).toBe('taylor'); expect(state.agent).toBe('platform-agent'); expect(state.kbs).toEqual(['platform-kb'])
  expect(state.model).toBe('builtin-deepseek-v4-flash')
  await expect(page.locator('.visual-chat-resource__remove')).toHaveCount(0)
  await expect(page.locator('[data-guide="chat-kb-mention"]')).toHaveAttribute('aria-disabled', 'true')
  expect(api.counts.chat).toBe(0); expect(api.counts.suggestion).toBe(priorSuggestions)
})

test('orders consume the top-level API and open the selected subscription portal', async ({ page }) => {
  const api = await mockMarket(page, { paid: true })
  await visit(page, '/platform/orders')
  await expect(page.locator('.subscription-row')).toContainText('已取消续费')
  await expect(page.locator('.subscription-row')).toContainText(/可使用至.*2026/)
  await expect(page.getByRole('button', { name: '开始提问', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '付款记录' }).click()
  await expect(page.locator('.market-table')).toContainText('txn_paid')
  await expect(page.locator('.market-table')).toContainText('19.00')
  await page.getByRole('tab', { name: '我的订阅' }).click()
  await page.getByRole('button', { name: '管理订阅', exact: true }).click()
  await expect(page).toHaveURL(/portal-confirmed/)
  expect(api.requests.some(r => r.path.endsWith('/subscriptions/sub_owned/portal'))).toBe(true)
})

test('only Max enables a new creator submission', async ({ page }) => {
  await mockMarket(page)
  await visit(page, '/platform/creator-products')
  await expect(page.getByRole('button', { name: '提交新商品' })).toBeDisabled()
  await expect(page.getByText('创建和提交商品需要有效的 Max 会员。')).toBeVisible()
})

test('admin approves explicit platform delivery resources and both prices', async ({ page }) => {
  const api = await mockMarket(page, { max: true, pending: true })
  await visit(page, '/platform/marketplace-admin')
  await page.getByRole('button', { name: '审核商品', exact: true }).click()
  await page.getByRole('button', { name: '通过并上架', exact: true }).click()
  await expect.poll(() => api.requests.find(r => r.path.endsWith('/review'))?.body).toMatchObject({ action: 'approve', platform_agent_id: 'platform-agent', platform_knowledge_base_ids: ['platform-kb'], monthly_price_id: 'pri_monthly', yearly_price_id: 'pri_yearly' })
})

test('historical marketplace references stay snippets-only after the composer changes', async ({ page }) => {
  await mockMarket(page)
  await visit(page, '/references')
  await page.getByRole('button', { name: 'Switch composer to normal' }).click()
  await expect(page.getByRole('link', { name: /查看文档|打开文档/ })).toHaveCount(0)
  await page.locator('.visual-answer-references__header').click()
  await expect(page.locator('.visual-reference-item')).toContainText('Restricted source document')
  await expect(page.locator('.visual-reference-item__open')).toHaveCount(0)
})


test('explicit sending from the paid product reaches the existing chat transport with its product ID', async ({ page }) => {
  const api = await mockMarket(page, { paid: true })
  await visit(page, '/platform/marketplace/taylor')
  await page.getByRole('button', { name: '开始提问', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(taylor.title)
  await page.locator('textarea').first().fill('Explain this method')
  await page.locator('[data-guide="chat-send"]').click()
  await expect.poll(() => api.requests.find(r => r.path.includes('/agent-chat/'))?.body).toMatchObject({ marketplace_product_id: 'taylor', agent_id: 'platform-agent', query: 'Explain this method', summary_model_id: 'builtin-deepseek-v4-flash' })
  expect(api.requests.find(r => r.path.includes('/agent-chat/'))?.body.agent_source_tenant_id).toBeUndefined()
})


test('Max creator edits exact-cent pricing and submits the saved draft for review', async ({ page }) => {
  const api = await mockMarket(page, { max: true, creatorDraft: true })
  await visit(page, '/platform/creator-products')
  await page.getByRole('button', { name: '编辑商品', exact: true }).click()
  const monthly = page.locator('.market-form label').filter({ hasText: '月费（美元）' }).locator('input')
  await monthly.fill('25.50')
  await expect(page.locator('.market-form label').filter({ hasText: '年费（美元）' }).locator('input')).toHaveValue('255.00')
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await expect.poll(() => api.requests.find(r => r.path.endsWith('/creator/products/taylor'))?.body.monthly_amount).toBe(2550)
  await page.getByRole('button', { name: '提交审核', exact: true }).click()
  await expect(page.locator('article')).toContainText('待审核')
  expect(api.requests.some(r => r.path.endsWith('/taylor/submit'))).toBe(true)
})

test('market and product pricing fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockMarket(page)
  await visit(page)
  await expect(page.locator('.market-featured')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: '查看详情', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '订阅使用', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/creator-marketplace-mobile.png', fullPage: true })
})


test('an unbound checkout order shows its status without an unusable portal action', async ({ page }) => {
  await mockMarket(page, { pendingOrder: true })
  await visit(page, '/platform/orders')
  await expect(page.locator('.subscription-row')).toContainText('正在准备结账')
  await expect(page.locator('.subscription-row')).not.toContainText('可使用至')
  await expect(page.getByRole('button', { name: '管理订阅', exact: true })).toHaveCount(0)
})

test('a refunded subscription does not promise access through its retained paid-through date', async ({ page }) => {
  await mockMarket(page, { refundedOrder: true })
  await visit(page, '/platform/orders')
  await expect(page.locator('.subscription-row .market-badge')).toHaveText('已退款')
  await expect(page.getByRole('button', { name: '开始提问', exact: true })).toHaveCount(0)
  await expect(page.locator('.subscription-row')).not.toContainText('可使用至')
})

test('mobile market pages own their scrolling and keep payment status labels on one line', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await mockMarket(page, { paid: true })
  await page.goto('/e2e/mobile-harness.html?page=/platform/orders')
  await expect(page.locator('.subscription-row')).toBeVisible()
  const outlet = page.locator('.platform-route-outlet')
  const bounds = await outlet.evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight }))
  expect.soft(bounds.scrollHeight).toBe(bounds.height)
  await page.getByRole('tab', { name: '付款记录', exact: true }).click()
  const lines = await page.locator('.market-table .market-badge').evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getClientRects().length
  })
  expect.soft(lines).toBe(1)
  // Focus/navigation must not leave the persistent shell scrolled behind its fixed mobile header.
  await outlet.evaluate(element => { element.scrollTop = 32 })
  await page.locator('.market-table').getByRole('link', { name: taylor.title, exact: true }).click()
  await expect(page.locator('.market-detail-copy h1')).toHaveText(taylor.title)
  const headingBounds = await page.locator('.market-header h1').boundingBox()
  const headerBounds = await page.locator('.visual-mobile-header').boundingBox()
  expect(headingBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y + headerBounds!.height)
  expect(await outlet.evaluate(element => element.scrollTop)).toBe(0)
})

for (const marketplace of [true, false]) {
  test(`restored ${marketplace ? 'marketplace' : 'ordinary'} history keeps citation permissions after changing the composer`, async ({ page }) => {
    const api = await mockMarket(page)
    let chunkRequests = 0
    const reference = { id: '11111111-1111-4111-8111-111111111111', knowledge_id: 'source-doc', knowledge_base_id: 'source-kb', knowledge_title: 'Saved source', content: 'Saved citation snippet', chunk_type: 'text' }
    await page.route('**/api/v1/chunks/by-id/*', route => { chunkRequests++; return route.fulfill({ json: { data: { content: 'Source-only chunk text' } } }) })
    await page.route('**/api/v1/messages/chat-fixture/load?*', route => route.fulfill({ json: { success: true, data: [
      { id: 'saved-user', role: 'user', content: 'A saved question', is_completed: true, created_at: '2026-09-22T00:00:00Z' },
      { id: 'saved-answer', role: 'assistant', marketplace_product_id: marketplace ? 'taylor' : undefined, content: `Saved answer <kb doc="Saved source" chunk_id="${reference.id}" kb_id="source-kb" />`, is_completed: true, created_at: '2026-09-22T00:00:01Z', model_id: 'builtin-deepseek-v4-flash', knowledge_references: [reference], agent_steps: [{ iteration: 0, thought: '', timestamp: '2026-09-22T00:00:01Z', tool_calls: [{ id: 'saved-search', name: 'knowledge_search', args: {}, result: { success: true, data: { results: [reference], count: 1 } } }] }] },
    ] } }))
    await visit(page)
    await expect(page.locator('.market-featured')).toBeVisible()
    await page.evaluate(async () => {
      const harness = (window as any).__marketplaceHarness
      harness.settings.selectAgent('builtin-quick-answer')
      await harness.router.push('/platform/chat/chat-fixture')
    })
    const citation = page.locator('.visual-chat-message-row.is-assistant .citation-kb').first()
    await expect(citation).toBeVisible()
    await page.evaluate(() => (window as any).__marketplaceHarness.settings.selectAgent('builtin-smart-reasoning'))
    await citation.hover()
    await expect(page.locator('.visual-citation-float')).toContainText(/Saved citation snippet|Source-only chunk text/)
    expect.soft(chunkRequests).toBe(marketplace ? 0 : 1)
    await citation.click()
    await expect(page.locator('.visual-references-panel')).toContainText('Saved citation snippet')
    await expect.soft(page.locator('.visual-reference-item__open')).toHaveCount(marketplace ? 0 : 1)
    await page.locator('.visual-references-panel__close').click()
    await page.locator('.visual-rag-pipeline__summary').first().click()
    await page.locator('.visual-rag-step.is-clickable').first().click()
    await expect(page.locator('.visual-references-panel')).toContainText('Saved citation snippet')
    await expect(page.locator('.visual-reference-item__open')).toHaveCount(marketplace ? 0 : 1)
    expect(api.counts.chat).toBe(0)
  })
}

test('a provider-bound refunded product offers subscription management instead of another checkout', async ({ page }) => {
  const api = await mockMarket(page, { existingSubscription: 'refunded', checkoutAvailable: false })
  await visit(page, '/platform/marketplace/taylor')
  await expect(page.locator('.market-purchase')).toContainText('已退款')
  await expect(page.locator('.market-purchase')).toContainText('该商品已有订阅，请先管理现有订阅。')
  await expect(page.getByRole('button', { name: '订阅使用', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开始提问', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '管理订阅', exact: true }).click()
  await expect(page).toHaveURL(/portal-confirmed/)
  expect(api.requests.map(request => request.path)).toEqual(['/api/v1/creator-marketplace/subscriptions/sub_owned/portal'])
})

test('a terminal canceled product can start a new checkout when the server allows it', async ({ page }) => {
  const api = await mockMarket(page, { existingSubscription: 'canceled', checkoutAvailable: true })
  await visit(page, '/platform/marketplace/taylor')
  await page.getByRole('button', { name: '年付', exact: true }).click()
  await page.getByRole('button', { name: '订阅使用', exact: true }).click()
  await expect(page.locator('iframe[title="Paddle checkout"]')).toBeAttached()
  expect(api.requests.find(request => request.path.endsWith('/checkout'))?.body.billing_period).toBe('yearly')
})
