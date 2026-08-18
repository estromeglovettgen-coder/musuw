import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

const baseline = new Map([
  ['../components/menu.vue', 'c3914d4d4824890307790d2b8d6dcccfa35e91bf'],
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
  ['../views/knowledge/components/KbWikiBadge.vue', '51550c1c65be38b9f47a4e9e38c49a482f449d5c'],
  ['../views/knowledge/wiki/WikiFolderActions.vue', 'f461dacf3a42a51afee8535a1ceea90e350a84c2'],
  ['../views/knowledge/wiki/WikiRevisionDrawer.vue', 'ad87842ea929a642f6001bcf5c97ced49ab17cf5'],
  ['../components/settings/SettingDrawer.vue', 'f4469a321c483fd2d7f8db179e79549f01b2296e'],
])

test('unmigrated business implementations stay frozen', () => {
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

test('new-chat preserves create/send/navigation behavior', () => {
  assertContracts('../views/creatChat/creatChat.vue', 'new-chat', [
    'getSuggestedQuestions(agentId, settingsStore.getSuggestedQuestionsParams())',
    'inputFieldRef.value?.triggerSend(question)',
    'const res = await createSessions(sessionData)',
    'usemenuStore.changeFirstQuery(value, mentionedItems, modelId, imageFiles, attachmentFiles, thinking)',
    'router.push(`/platform/chat/${sessionId}`)',
    'navigateToKnowledgeBaseList(kbId)',
  ])
})

test('user menu preserves settings and logout behavior', () => {
  assertContracts('../components/UserMenu.vue', 'user menu', [
    'uiStore.openSettings("general")',
    'void router.push({ path: "/platform/settings", query: { section: "general" } })',
    'await logoutApi()',
    'authStore.logout()',
    'handoffToExternalAuth("logout")',
    'document.addEventListener("click", handleClickOutside)',
  ])
})

test('session source filter preserves bucket selection and popup lifecycle', () => {
  assertContracts('../components/SessionSourceFilter.vue', 'session source filter', [
    'props.sources.find((item) => item.value === props.current) ?? props.sources[0]',
    'updatePanelPosition()',
    "document.addEventListener('click', close)",
    "window.addEventListener('scroll', close, true)",
    'if (value === props.current) return',
    "emit('select', value)",
  ])
})

test('session row preserves navigation menu and rename behavior', () => {
  assertContracts('../components/SessionSidebarRow.vue', 'session row', [
    "emit('rename-submit', { title: nextTitle })",
    "const value = menuMode.value === 'clear' ? 'clearMessages' : 'delete'",
    "emit('menu-click', { value })",
    'normalizeSessionTitleDraft(titleDraft.value)',
    "if (option.value === 'rename')",
    "if (option.value === 'clearMessages')",
    "if (option.value === 'delete')",
  ])
})

test('document grid preserves open selection menu move and trace behavior', () => {
  assertContracts('../views/knowledge/components/DocumentCardView.vue', 'document grid', [
    "emit('open', item)",
    "emit('toggle-checkbox', item.id, !props.selectedIds.has(item.id))",
    "emit('menu-visible-change', visible, item)",
    "emit('move-to-folder', item, path)",
    "emit('action', action, item)",
    'folderPickerItemId.value = item.id',
    'props.traceAvailableById[item.id] === true',
  ])
})

test('document list preserves row selection trace probing folder move and move-state behavior', () => {
  assertContracts('../views/knowledge/components/DocumentListView.vue', 'document list', [
    "emit('toggle-all', checked)",
    "emit('toggle-row', item.id, checked, !!me?.shiftKey)",
    "if (it) emit('probe-trace', it)",
    "emit('reset-move-state')",
    "emit('move-to-folder', item, path)",
    'folderPickerItemId.value = item.id',
    "emit('action', action, item)",
    'stickyObserver.observe(stickySentinel.value)',
  ])
})

test('document action menu preserves every action contract', () => {
  assertContracts('../views/knowledge/components/DocumentActionMenu.vue', 'document actions', [
    "(e: 'edit'): void",
    "(e: 'view-trace'): void",
    "(e: 'reparse'): void",
    "(e: 'cancel-parse'): void",
    "(e: 'move'): void",
    "(e: 'move-folder'): void",
    "(e: 'batch-manage'): void",
    "(e: 'delete'): void",
    "CANCELABLE_PARSE_STATUSES.has(String(props.item.parse_status ?? ''))",
  ])
})

test('document batch bar preserves batch action contracts', () => {
  assertContracts('../views/knowledge/components/DocumentBatchBar.vue', 'document batch bar', [
    "(e: 'cancel'): void",
    "(e: 'delete'): void",
    "(e: 'reparse'): void",
    "(e: 'batchTag'): void",
    "(e: 'moveToFolder', folderPath: string): void",
    "emit('moveToFolder', path)",
    'folderPickerVisible.value = false',
  ])
})

test('folder picker preserves selection create and back contracts', () => {
  assertContracts('../views/knowledge/components/FolderPickerMenu.vue', 'folder picker', [
    'back: []',
    'confirm: [folderPath: string]',
    'create: [folderPath: string]',
    "emit('confirm', path)",
    "emit('create', path)",
    'normalizeFolderPath(newFolderName.value)',
    'joinFolderPath(creatingUnder.value, name)',
    'selectedPath.value = null',
  ])
})

test('folder tree preserves selection rename and collapse behavior', () => {
  assertContracts('../views/knowledge/components/KbFolderTree.vue', 'folder tree', [
    "emit('rename', { from: row.path, to: joinFolderPath(parent, name) })",
    'folderAncestorPaths(props.selectedPath).forEach((path) => next.add(path))',
    'tree.folders.forEach((folder) => next.add(folder.path))',
    'expanded.value = next',
    'renamingPath.value = row.path',
    'menuOpenPath.value = visible ? path : null',
  ])
})

test('upload source preserves file folder URL and manual creation behavior', () => {
  assertContracts('../views/knowledge/components/KbUploadSourceDropdown.vue', 'upload source', [
    'fileInputRef.value?.click()',
    'folderInputRef.value?.click()',
    "emit('manual')",
    "emit('files', result.validFiles)",
    "emit('url', url)",
    'new URL(url)',
    'defineExpose({ openUrlDialog })',
  ])
})

test('tag edit preserves selection creation confirmation and manage handoff', () => {
  assertContracts('../views/knowledge/components/TagEditDialog.vue', 'tag edit', [
    'selectedSet.value = new Set(props.selectedTags.map((t) => t.id))',
    'function toggleTag(tagId: string)',
    'function clearAll()',
    'await createKnowledgeBaseTag(props.kbId, { name })',
    "emit('tag-created')",
    "emit('confirm', Array.from(selectedSet.value))",
    "emit('update:visible', false)",
    "emit('open-manage')",
  ])
})

test('batch tag preserves preselection creation confirmation loading and manage handoff', () => {
  assertContracts('../views/knowledge/components/BatchTagDialog.vue', 'batch tag', [
    'selectedSet.value = new Set(props.preSelectedTagIds ?? [])',
    'function toggleTag(tagId: string)',
    'function clearAll()',
    'await createKnowledgeBaseTag(props.kbId, { name })',
    "emit('tag-created')",
    'if (props.confirmLoading) return',
    "emit('confirm', Array.from(selectedSet.value))",
    "emit('update:visible', false)",
    "emit('open-manage')",
  ])
})

test('tag management preserves paging search create edit delete and delayed change notification', () => {
  assertContracts('../views/knowledge/components/KbTagManageDrawer.vue', 'tag management', [
    'const TAG_PAGE_SIZE = 50',
    'await listKnowledgeTags(props.kbId',
    'keyword: searchQuery.value || undefined',
    'hasMore.value = tags.value.length < total.value',
    'await createKnowledgeBaseTag(props.kbId, { name })',
    'await updateKnowledgeBaseTag(props.kbId, editingTagId.value, { name })',
    'await deleteKnowledgeBaseTag(props.kbId, tag.seq_id, { force: true })',
    "emit('changed', { deletedTagId: tag.id })",
    'setTimeout(resolve, 800)',
    'searchDebounce = setTimeout(() =>',
  ])
})

test('settings shell preserves navigation and close behavior', () => {
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

test('general settings preserves preference and entitlement behavior', () => {
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

test('model settings preserves model lifecycle and permissions', () => {
  assertContracts('../views/settings/ModelSettings.vue', 'model settings', [
    'const models = await listModels()',
    "model.isBuiltin ? authStore.isSystemAdmin : authStore.hasRole('admin')",
    "authStore.hasRole('admin') && !model.isBuiltin",
    'await updateModelAPI(editingModel.value.id, apiModelData)',
    'await createModel(apiModelData)',
    'await deleteModelAPI(modelId)',
    'await createModel(newModel)',
    'new URL(modelData.baseUrl.trim())',
    'const showDebugDrawer = ref(false)',
  ])
})
