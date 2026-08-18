import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

// Business implementation baseline from 367a0c76e48fcf8a3762c33b672cfa2e16b679f4.
// Files that have not entered the view-rebuild track remain byte-for-byte frozen.
const baseline = new Map([
  ['../components/menu.vue', 'c3914d4d4824890307790d2b8d6dcccfa35e91bf'],
  ['../components/UserMenu.vue', 'f5c813ced2e0e7b98af86e814aa7b4f788661752'],
  ['../components/SessionSidebarRow.vue', '0ff2076685ff1d4c779eaa002ea57ac1dc4cd798'],
  ['../components/SessionSourceFilter.vue', '4f307ffe65e4fc433dace9b69d32cda1cf94d2eb'],
  ['../components/ChatHeader.vue', '79aec898f1e90c21a9f63fa77bce0dca509750c4'],
  ['../components/ChatCitationFloat.vue', 'b2a42b84fc7a76ecbe8fb5f1c8079dddf6ef555b'],
  ['../components/ChatReferencesDrawer.vue', '9001acea76aae131cc7420f3e1ffd275b58fce52'],
  ['../components/ChatRequestInfoButton.vue', '2919cfc635677812f2e407c06ebf0f5661952900'],
  ['../components/Input-field.vue', 'a34d09f5f9dbe44d4b3835213fdab662c4b7446a'],
  ['../components/KBSwitcherDropdown.vue', 'f06ecd48d12d6bb9dcd364720826ac7f9e37f946'],
  ['../components/KnowledgeBaseSelector.vue', '98fc31d76351af5988a3b2445daa147048bab6fd'],
  ['../components/MentionSelector.vue', 'd165e6e1d27be75acafc62298946fde2235c7167'],
  ['../components/ModelDebugDrawer.vue', '9a4e8055dd52f862edc19f4e703cf4e068852dc5'],
  ['../components/ModelSelector.vue', '402713d0904156e32aba974b144b3e745511e344'],
  ['../components/manual-knowledge-editor.vue', '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e'],
  ['../components/AttachmentUpload.vue', '088d5164a770d213e2175a9ca27afb339aeff4e4'],
  ['../components/ChatAttachmentPreviewDrawer.vue', '5eb43fdb5487589133fd867c0e75081270bc86aa'],
  ['../composables/useChatCitationPopover.ts', 'b1142ec34ee9dec81600e6f3bda0c418cd478967'],
  ['../views/chat/components/botmsg.vue', 'f696550fc980c2a648ce19a631729950fe3b0e6b'],
  ['../views/chat/components/usermsg.vue', '6dd0f2e44e4fc382d6f40702aa4b5eebc2467fea'],
  ['../views/chat/components/docInfo.vue', '927afa7a36e30a65fe4695e1e40aaa3664b4dbfe'],
  ['../views/knowledge/KnowledgeBase.vue', 'c6c7c53a9f1eda91b645733256eb04221bf816da'],
  ['../views/knowledge/components/DocumentListView.vue', 'dc553565d2c1818878c3c34631dc4d33010f96c6'],
  ['../views/knowledge/components/KbUploadSourceDropdown.vue', 'e0e83fcb20897a205f9b6ee1f65b1ebe8ca1da68'],
  ['../views/knowledge/components/DocumentActionMenu.vue', '0d85aa2ab1ce2b5f85412427e9ee16530b6dab71'],
  ['../views/knowledge/components/BatchTagDialog.test.ts', '2cecdf2012ef924bfabe6f7fdbf3a3ab55c7ef8d'],
  ['../views/knowledge/components/BatchTagDialog.vue', 'dde15cb2dd4c8019b2f5f7b03277039a4c5af0b0'],
  ['../views/knowledge/components/DocumentBatchBar.vue', 'de5e7b6ed2685b9754a4d7c1becbf574a27abdfe'],
  ['../views/knowledge/components/FolderPickerMenu.vue', 'ecc3a74e8bda5b96691c89fd00fd5803edac6c4f'],
  ['../views/knowledge/components/KbTagManageDrawer.vue', 'cc60b273a36ce031dc906cb3a680bb48496745b3'],
  ['../views/knowledge/components/KbWikiBadge.vue', '51550c1c65be38b9f47a4e9e38c49a482f449d5c'],
  ['../views/knowledge/components/TagEditDialog.test.ts', '9c26837db390555b9a97372775b5738b19b0f1ce'],
  ['../views/knowledge/components/TagEditDialog.vue', '9127b181a073395a3b2de2e3b527594ba0a7ec86'],
  ['../views/knowledge/wiki/WikiFolderActions.vue', 'f461dacf3a42a51afee8535a1ceea90e350a84c2'],
  ['../views/knowledge/wiki/WikiRevisionDrawer.vue', 'ad87842ea929a642f6001bcf5c97ced49ab17cf5'],
  ['../views/settings/ModelSettings.vue', '6c6cd4255277e24d754b0017eac708148d92e935'],
  ['../components/settings/SettingDrawer.vue', 'f4469a321c483fd2d7f8db179e79549f01b2296e'],
])

test('unmigrated business implementations stay on the pre-view-rebuild baseline', () => {
  for (const [path, sha] of baseline) {
    assert.equal(blobSha(read(path)), sha, `${path} changed before its view was explicitly migrated`)
  }
})

function scriptOf(path) {
  const source = read(path)
  return source.match(/<script setup(?: lang="ts")?>([\s\S]*?)<\/script>/)?.[1] || ''
}

function assertContracts(path, label, contracts) {
  const script = scriptOf(path)
  for (const contract of contracts) {
    assert.ok(script.includes(contract), `${label} contract changed: ${contract}`)
  }
}

test('new-chat view may replace markup and CSS but must preserve its business contract', () => {
  assertContracts('../views/creatChat/creatChat.vue', 'new-chat', [
    'getSuggestedQuestions(agentId, settingsStore.getSuggestedQuestionsParams())',
    'inputFieldRef.value?.triggerSend(question)',
    'const selectedKbs = settingsStore.settings.selectedKnowledgeBases || []',
    'const selectedFiles = settingsStore.settings.selectedFiles || []',
    'const res = await createSessions(sessionData)',
    'usemenuStore.changeFirstQuery(value, mentionedItems, modelId, imageFiles, attachmentFiles, thinking)',
    'router.push(`/platform/chat/${sessionId}`)',
    'navigateToKnowledgeBaseList(kbId)',
  ])
})

test('document-card view may replace markup and CSS but must preserve its event contract', () => {
  assertContracts('../views/knowledge/components/DocumentCardView.vue', 'document-card', [
    "emit('open', item)",
    "emit('toggle-checkbox', item.id, !props.selectedIds.has(item.id))",
    "emit('menu-visible-change', visible, item)",
    "emit('move-to-folder', item, path)",
    "emit('action', action, item)",
    "folderPickerItemId.value = item.id",
    "props.traceAvailableById[item.id] === true",
  ])
})

test('folder tree may replace markup and CSS but must preserve selection/rename/collapse behavior', () => {
  assertContracts('../views/knowledge/components/KbFolderTree.vue', 'folder tree', [
    "emit('rename', { from: row.path, to: joinFolderPath(parent, name) })",
    "folderAncestorPaths(props.selectedPath).forEach((path) => next.add(path))",
    "tree.folders.forEach((folder) => next.add(folder.path))",
    'expanded.value = next',
    'renamingPath.value = row.path',
    'menuOpenPath.value = visible ? path : null',
  ])
})

test('settings shell may replace markup and CSS but must preserve navigation/close behavior', () => {
  assertContracts('../views/settings/Settings.vue', 'settings shell', [
    "route.path === '/platform/settings' || uiStore.showSettingsModal",
    "void router.replace({ path: '/platform/settings', query: nextQuery })",
    "void router.replace({ path: '/platform/settings', query: { section } })",
    'uiStore.closeSettings()',
    'router.back()',
    "if (event.key === 'Escape' && visible.value) handleClose()",
    "window.addEventListener('settings-nav', handleSettingsNav)",
  ])
})

test('general settings may replace markup and CSS but must preserve preference/entitlement behavior', () => {
  assertContracts('../views/settings/GeneralSettings.vue', 'general settings', [
    "savedLocale = localStorage.getItem('locale')",
    'getCurrentEntitlement()',
    'entitlement.value = response.data',
    'billingConfigured.value = response.billing.configured',
    'const persisted = persistLocalePreference(localLanguage.value)',
    'locale.value = persisted',
    'if (!setTheme(value))',
    'MessagePlugin.success',
  ])
})
