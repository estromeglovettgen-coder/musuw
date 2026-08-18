import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')
const scriptOf = (path) => read(path).match(/<script setup(?: lang="ts")?>([\s\S]*?)<\/script>/)?.[1] || ''

const frozen = new Map([
  ['./business-baselines/Input-field.pre-view.vue', 'a34d09f5f9dbe44d4b3835213fdab662c4b7446a'],
  ['./business-baselines/KnowledgeBase.pre-view.vue', 'c6c7c53a9f1eda91b645733256eb04221bf816da'],
  ['./business-baselines/manual-knowledge-editor.pre-view.vue', '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e'],
  ['../composables/useChatCitationPopover.ts', '948dad67061997eafc97664fabdf2d1307b203c4'],
  ['../views/knowledge/components/KbWikiBadge.vue', '51550c1c65be38b9f47a4e9e38c49a482f449d5c'],
  ['../views/knowledge/wiki/WikiFolderActions.vue', 'f461dacf3a42a51afee8535a1ceea90e350a84c2'],
  ['../views/knowledge/wiki/WikiRevisionDrawer.vue', 'ad87842ea929a642f6001bcf5c97ced49ab17cf5'],
  ['../components/settings/SettingDrawer.vue', 'f4469a321c483fd2d7f8db179e79549f01b2296e'],
])

test('protected controllers, compatibility bridges and excluded Graph/Wiki implementations stay byte-for-byte frozen', () => {
  for (const [path, sha] of frozen) {
    assert.equal(blobSha(read(path)), sha, `${path} changed outside its allowed migration boundary`)
  }
})

test('citation hover bridge follows the rebuilt float class without restoring legacy float styling', () => {
  const citation = read('../composables/useChatCitationPopover.ts')
  const floatView = read('../components/ChatCitationFloat.vue')
  assert.ok(citation.includes("document.querySelector('.visual-citation-float:hover')"))
  assert.ok(citation.includes("closest?.('.citation-kb, .citation-web, .visual-citation-float')"))
  assert.ok(floatView.includes('class="visual-citation-float"'))
  assert.equal(floatView.includes('class="chat-citation-float"'), false)
})

const contracts = new Map([
  ['../components/menu.vue', [
    'buildBucketDefinitions(',
    'mergeBucketPage(',
    'ensureBucketFillsViewport',
    'await deleteAllSessions()',
    'await batchDelSessions([...batchSelectedIds.value])',
    'await renameSession(item.id, title, item.description || "")',
    'setSessionPinned(item.id, pin)',
    'clearSession(item.id)',
    'removeSession(item.id)',
    'window.addEventListener(SESSION_MUTATION_EVENT, handleSessionMutation)',
    'handoffToExternalAuth("logout")',
  ]],
  ['../views/creatChat/creatChat.vue', [
    'getSuggestedQuestions(agentId, settingsStore.getSuggestedQuestionsParams())',
    'inputFieldRef.value?.triggerSend(question)',
    'const res = await createSessions(sessionData)',
    'usemenuStore.changeFirstQuery(value, mentionedItems, modelId, imageFiles, attachmentFiles, thinking)',
    'router.push(`/platform/chat/${sessionId}`)',
  ]],
  ['../views/knowledge/components/DocumentCardView.vue', [
    "emit('open', item)",
    "emit('toggle-checkbox', item.id, !props.selectedIds.has(item.id))",
    "emit('move-to-folder', item, path)",
    "emit('action', action, item)",
  ]],
  ['../views/knowledge/components/DocumentListView.vue', [
    "emit('toggle-all', checked)",
    "emit('toggle-row', item.id, checked, !!me?.shiftKey)",
    "if (it) emit('probe-trace', it)",
    "emit('move-to-folder', item, path)",
  ]],
  ['../views/knowledge/components/KbTagManageDrawer.vue', [
    'await listKnowledgeTags(props.kbId',
    'await createKnowledgeBaseTag(props.kbId, { name })',
    'await updateKnowledgeBaseTag(props.kbId, editingTagId.value, { name })',
    'await deleteKnowledgeBaseTag(props.kbId, tag.seq_id, { force: true })',
    'setTimeout(resolve, 800)',
  ]],
  ['../views/settings/Settings.vue', [
    "route.path === '/platform/settings' || uiStore.showSettingsModal",
    'uiStore.closeSettings()',
    'router.back()',
  ]],
  ['../views/settings/GeneralSettings.vue', [
    "savedLocale = localStorage.getItem('locale')",
    'getCurrentEntitlement()',
    'const persisted = persistLocalePreference(localLanguage.value)',
    'if (!setTheme(value))',
  ]],
  ['../views/settings/ModelSettings.vue', [
    'const models = await listModels()',
    "model.isBuiltin ? authStore.isSystemAdmin : authStore.hasRole('admin')",
    'await updateModelAPI(editingModel.value.id, apiModelData)',
    'await createModel(apiModelData)',
    'await deleteModelAPI(modelId)',
  ]],
])

test('migrated View shells retain their load-bearing native business contracts', () => {
  for (const [path, tokens] of contracts) {
    const script = scriptOf(path)
    for (const token of tokens) assert.ok(script.includes(token), `${path} lost business contract: ${token}`)
  }
})
