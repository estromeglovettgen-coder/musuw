import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

/**
 * @视觉文件 is the sole visual authority. This suite protects the other half
 * of the contract: native Musuw / WeKnora UI capabilities must remain reachable
 * after the visual transplant, but reference-only demo behavior must not be
 * invented.
 */

test('WeKnora application routes remain reachable instead of being hidden by the skin', () => {
  const router = read('../router/index.ts')
  assert.ok(router.includes('path: "agents"'))
  assert.ok(router.includes('name: "agentList"'))
  assert.ok(router.includes('import("../views/agent/AgentList.vue")'))
  assert.ok(router.includes('path: "organizations"'))
  assert.ok(router.includes('name: "organizationList"'))
  assert.ok(router.includes('import("../views/organization/OrganizationList.vue")'))
  assert.ok(router.includes('section: "integrations"'))
  assert.ok(router.includes('section: "system-global"'))
  assert.ok(router.includes('section: "runtime-queues"'))
  assert.ok(router.includes('requiresSystemAdmin: true'))
  assert.ok(router.includes("path: '/platform/organizations'"), 'join link must still resolve through organization behavior')
})

test('native sidebar capabilities stay exposed while visual structure remains rebuilt', () => {
  const store = read('../stores/menu.ts')
  const sidebar = read('../components/menu.vue')
  for (const path of ['agents', 'organizations']) {
    assert.ok(store.includes(`path: '${path}'`), `menu store lost ${path}`)
    assert.ok(sidebar.includes(`handleMenuClick('${path}')`), `visual sidebar lost ${path} entry`)
  }
  assert.ok(store.includes("item.path === 'organizations' && !authStore.hasRole('admin')"), 'organization visibility role gate changed')
  assert.ok(sidebar.includes('<TenantSelector v-if="authStore.canAccessAllTenants"'), 'cross-tenant selector behavior disappeared')
  assert.ok(sidebar.includes('<UserMenu />'), 'settings/logout user menu disappeared')
})

test('chat composer keeps native Agent/WebSearch behavior inside reference topology', () => {
  const input = read('../components/Input-field.vue')
  const baseline = read('./business-baselines/Input-field.pre-view.vue')
  assert.ok(input.includes('<textarea'), 'reference native textarea topology disappeared')
  assert.equal(input.includes('<t-textarea'), false, 'composer must not restore the vendor textarea wrapper')
  assert.ok(input.includes('<AgentSelector'))
  assert.ok(input.includes('@select="handleSelectAgent"'))
  assert.ok(input.includes('@not-ready="handleAgentNotReady"'))
  assert.ok(input.includes('v-if="showWebSearchButton"'))
  assert.ok(input.includes('@click.stop="toggleWebSearch"'))
  for (const token of ['handleSelectAgent', 'handleAgentNotReady', 'showWebSearchButton', 'toggleWebSearch']) {
    assert.ok(baseline.includes(token), `visual adapter exposed non-native behavior: ${token}`)
  }
  assert.ok(baseline.includes('if (textareaRef.value instanceof HTMLTextAreaElement)'), 'frozen controller no longer supports reference native textarea')
})

test('knowledge list exposes the native v0.7.2 scope contract through the rebuilt visual shell', () => {
  const active = read('../views/knowledge/KnowledgeBaseList.vue')
  const controller = read('./business-baselines/KnowledgeBaseList.pre-view.vue')
  assert.ok(active.includes('<ListSpaceSidebar'))
  assert.ok(active.includes('v-model="spaceSelection"'))
  assert.ok(active.includes(':count-all="allKnowledgeBases"'))
  assert.ok(active.includes(':count-favorites="kbFavoritesCount"'))
  assert.ok(active.includes(':count-recents="kbRecentsCount"'))
  assert.ok(active.includes('v-if="hasUninitializedKbs"'))
  assert.ok(active.includes('<ContextualGuide tour="kbList"'))
  assert.ok(controller.includes("const defaultScope: 'all' | 'mine' = authStore.hasRole('contributor') ? 'mine' : 'all'"))
  assert.ok(controller.includes("val === 'all' || val === 'mine' || val === 'favorites' || val === 'recents'"))
  assert.ok(controller.includes('listOrganizationSharedKnowledgeBases(val)'))
  assert.ok(controller.includes('orgStore.fetchSharedKnowledgeBases({ force })'))
  assert.ok(controller.includes('orgStore.fetchOrganizations({ force })'))
  assert.equal(controller.includes('spaceSelection.value !== "mine"'), false)
})

test('full WeKnora settings capability set remains mounted in the reference SettingsModal shell', () => {
  const settings = read('../views/settings/Settings.vue')
  const access = read('../config/settingsAccess.ts')
  const requiredComponents = [
    'GeneralSettings', 'UserProfile', 'TenantInfo', 'TenantMembers', 'ChatHistorySettings',
    'ModelSettings', 'OllamaSettings', 'WeKnoraCloudSettings', 'IntegrationSettingsSection',
    'VectorStoreSettings', 'ParserEngineSettings', 'StorageEngineSettings', 'WebSearchSettings',
    'McpSettings', 'SystemSettings', 'RuntimeQueues', 'PlatformAPIKeys', 'SystemAuditLog', 'SystemInfo',
  ]
  for (const component of requiredComponents) {
    assert.ok(settings.includes(component), `Settings visual shell lost native section ${component}`)
  }
  for (const token of ['width: min(896px, 100%);', 'height: 520px;', 'flex: 0 0 224px;', 'padding: 32px;']) {
    assert.ok(settings.includes(token), `Settings drifted from @视觉文件 shell token ${token}`)
  }
  assert.ok(access.includes("models: 'viewer'"), 'read-only model list visibility no longer matches WeKnora contract')
  assert.ok(settings.includes('canSeeSection(currentSection)'), 'settings permission gate disappeared')
  assert.ok(settings.includes('INTEGRATION_TAB_MIN_ROLE'))
  assert.ok(settings.includes('SYSTEM_ADMIN_SETTINGS_SECTIONS'))
})

test('General Settings keeps upstream preference behavior while using reference row styling', () => {
  const general = read('../views/settings/GeneralSettings.vue')
  for (const token of ['setTheme', 'setSansFont', 'setMonoFont', 'setFontSize', 'isAutoCheckUpdateEnabled']) {
    assert.ok(general.includes(token), `General Settings lost native preference behavior: ${token}`)
  }
  assert.equal(general.includes('getCurrentEntitlement'), false, 'later entitlement card is outside the selected behavior authority')
  assert.ok(general.includes('class="visual-setting-row"'))
})

test('reference-only demo actions are not invented as business behavior', () => {
  const batch = read('../components/SessionBatchManageModal.vue')
  assert.equal(batch.includes("emit('pin')"), false)
  assert.equal(batch.includes("emit('unpin')"), false)

  const bot = read('../views/chat/components/botmsg.vue')
  assert.equal(bot.includes('createReactionAPI'), false)
  assert.equal(bot.includes('createReceiptAPI'), false)
})

test('batch adapter preserves event payload and native all-session semantics', () => {
  const child = read('../components/SessionBatchManageModal.vue')
  const parent = read('../components/menu.vue')
  assert.ok(child.includes("'toggle-all': [checked: boolean]"))
  assert.ok(child.includes("emit('toggle-all', !allSelected)"))
  assert.ok(parent.includes("menuArr.find(item => item.path === 'creatChat')?.children || []"))
  assert.ok(parent.includes('@toggle-all="toggleBatchSelectAll"'))
})
