import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const globalGuide = read('../components/NewUserGuide.vue')
const agentCreateGuide = read('../components/AgentCreateContextualGuide.vue')
const guideConfig = read('./contextualGuides.ts')
const userMenu = read('../components/UserMenu.vue')
const workspaceOnboarding = read('../views/auth/WorkspaceOnboarding.vue')
const knowledgeBase = read('../views/knowledge/KnowledgeBase.vue')

test('Lite onboarding follows the shortest current Musuw activation path', () => {
  const liteStart = globalGuide.indexOf('const liteSteps')
  const standardStart = globalGuide.indexOf('const standardSteps')

  assert.notEqual(liteStart, -1, 'Lite must own an explicit onboarding path')
  assert.ok(standardStart > liteStart, 'Lite and Standard paths must remain separate')

  const liteBlock = globalGuide.slice(liteStart, standardStart)
  const keys = [...liteBlock.matchAll(/key:\s*'([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(keys, ['welcomeLite', 'knowledgeLite', 'chatLite', 'agentsLite', 'doneLite'])
  for (const legacyStep of ['settings', 'models', 'members', 'workspace']) {
    assert.equal(liteBlock.includes(`key: '${legacyStep}'`), false)
  }

  assert.match(globalGuide, /<GlobalInvitationBell v-if="!authStore\.isLiteMode"/)
  assert.match(globalGuide, /<AgentListContextualGuideBridge v-if="!authStore\.isLiteMode"/)
  assert.match(globalGuide, /@dismiss="onFinish"/)
})

test('guide completion is isolated per signed-in account', () => {
  assert.match(guideConfig, /from '@\/composables\/preferenceStorage'/)
  assert.match(guideConfig, /userKey\(GLOBAL_USER_GUIDE_KEY\)/)
  assert.match(guideConfig, /userKey\(config\.storageKey\)/)
  assert.match(guideConfig, /export function markGlobalUserGuideDone/)
  assert.doesNotMatch(globalGuide, /localStorage\.(?:getItem|setItem)\(GLOBAL_USER_GUIDE_KEY/)
})

test('guide storage namespace follows the active account at runtime', async () => {
  const values = new Map()
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }

  try {
    const preferences = await import(`../composables/preferenceStorage.ts?guide-scope=${Date.now()}`)

    values.set('weknora_user', JSON.stringify({ id: 'lite-user-a' }))
    const accountAKey = preferences.userKey('musuw:new-user-guide-done:v2')

    values.set('weknora_user', JSON.stringify({ id: 'lite-user-b' }))
    const accountBKey = preferences.userKey('musuw:new-user-guide-done:v2')

    assert.equal(accountAKey, 'WeKnora_lite-user-a_musuw:new-user-guide-done:v2')
    assert.equal(accountBKey, 'WeKnora_lite-user-b_musuw:new-user-guide-done:v2')
    assert.notEqual(accountAKey, accountBKey)
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previousStorage
  }
})

test('Lite users can reopen the guide without exposing a management surface', () => {
  assert.match(
    userMenu,
    /class="visual-user-menu__guide"[^>]*@click\.stop="reopenGuide"/,
  )
  assert.doesNotMatch(
    userMenu,
    /v-if="!authStore\.isLiteMode"[^>]*class="visual-user-menu__guide"/,
  )
})

test('Lite agent creation guide stays inside the compact editor', () => {
  assert.match(agentCreateGuide, /useAuthStore/)
  assert.match(agentCreateGuide, /authStore\.isLiteMode\s*\?\s*liteSteps\s*:\s*standardSteps/)

  const liteStart = agentCreateGuide.indexOf('const liteSteps')
  const standardStart = agentCreateGuide.indexOf('const standardSteps')
  assert.notEqual(liteStart, -1)
  assert.ok(standardStart > liteStart)
  const liteBlock = agentCreateGuide.slice(liteStart, standardStart)

  for (const key of ['modeLite', 'nameLite', 'modelLite', 'knowledgeLite', 'submitLite']) {
    assert.ok(liteBlock.includes(`key: '${key}'`), `missing compact Lite step ${key}`)
  }
  for (const hiddenTarget of [
    'agent-editor-nav-model',
    'agent-editor-nav-websearch',
    'agent-editor-nav-multimodal',
    'agent-editor-nav-tools',
  ]) {
    assert.equal(liteBlock.includes(hiddenTarget), false, `Lite guide targets hidden ${hiddenTarget}`)
  }
})

test('tenantless Lite fallback explains automatic personal-space preparation', () => {
  assert.match(workspaceOnboarding, /authStore\.isLiteMode[\s\S]*workspaceOnboarding\.liteTitle/)
  assert.match(workspaceOnboarding, /workspaceOnboarding\.liteDescription/)
  assert.match(workspaceOnboarding, /workspaceOnboarding\.retry/)
  assert.doesNotMatch(
    workspaceOnboarding,
    /v-if="authStore\.isLiteMode"[\s\S]{0,500}<CreateTenantDialog/,
  )
})

test('an empty Lite knowledge base continues the onboarding path at the existing upload control', () => {
  assert.match(knowledgeBase, /import ContextualGuide from '@\/components\/ContextualGuide\.vue'/)
  assert.match(
    knowledgeBase,
    /<ContextualGuide\s+tour="kbDetail"\s+:when="authStore\.isLiteMode\s*&&\s*!isFAQ\s*&&\s*canEdit[^"]*"\s*\/>/,
  )
  assert.match(knowledgeBase, /data-guide="kb-detail-add-doc"/)
})

test('all supported locales carry the complete Lite onboarding copy', () => {
  for (const locale of ['zh-CN', 'en-US', 'ko-KR', 'ru-RU']) {
    const source = read(`../i18n/locales/${locale}.ts`)
    for (const key of [
      'welcomeLite:',
      'chatLite:',
      'knowledgeLite:',
      'agentsLite:',
      'doneLite:',
      'modeLite:',
      'nameLite:',
      'modelLite:',
      'submitLite:',
      'liteTitle:',
      'liteDescription:',
    ]) {
      assert.ok(source.includes(key), `${locale} is missing ${key}`)
    }
  }
})
