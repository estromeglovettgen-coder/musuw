import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

const frozen = new Map([
  ['../components/menu.vue', 'c3914d4d4824890307790d2b8d6dcccfa35e91bf'],
  ['../components/ChatCitationFloat.vue', 'b2a42b84fc7a76ecbe8fb5f1c8079dddf6ef555b'],
  ['../components/ChatRequestInfoButton.vue', '2919cfc635677812f2e407c06ebf0f5661952900'],
  ['../components/Input-field.vue', 'a34d09f5f9dbe44d4b3835213fdab662c4b7446a'],
  ['../components/ModelDebugDrawer.vue', '9a4e8055dd52f862edc19f4e703cf4e068852dc5'],
  ['../components/manual-knowledge-editor.vue', '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e'],
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
  for (const [path, sha] of frozen) assert.equal(blobSha(read(path)), sha, `${path} changed before its view was explicitly migrated`)
})

const scriptOf = (path) => read(path).match(/<script setup(?: lang="ts")?>([\s\S]*?)<\/script>/)?.[1] || ''
const contracts = new Map([
  ['../views/creatChat/creatChat.vue', ['getSuggestedQuestions(agentId, settingsStore.getSuggestedQuestionsParams())','inputFieldRef.value?.triggerSend(question)','const res = await createSessions(sessionData)','usemenuStore.changeFirstQuery(value, mentionedItems, modelId, imageFiles, attachmentFiles, thinking)','router.push(`/platform/chat/${sessionId}`)','navigateToKnowledgeBaseList(kbId)']],
  ['../components/UserMenu.vue', ['uiStore.openSettings("general")','await logoutApi()','authStore.logout()','handoffToExternalAuth("logout")']],
  ['../components/SessionSourceFilter.vue', ['updatePanelPosition()',"window.addEventListener('scroll', close, true)","emit('select', value)"]],
  ['../components/SessionSidebarRow.vue', ["emit('rename-submit', { title: nextTitle })","emit('menu-click', { value })",'normalizeSessionTitleDraft(titleDraft.value)']],
  ['../components/ModelSelector.vue', ['newModels.filter(m => m.type === props.modelType)','const result = await listModels()',"models.value = result.filter(m => m.type === props.modelType)","emit('add-model')","emit('update:selectedModelId', value)",'defineExpose({ refresh: loadModels })']],
  ['../components/AttachmentUpload.vue', ['const response = await getParserEngines()','if (attachments.value.length >= maxFiles.value)','if (file.size > maxSize.value)','if (!supportedTypes.value.includes(ext))','await uploadTemporaryAttachment(','attachment.progress = progress','scheduleStatusPoll(attachment)','const response = await getTemporaryAttachment(props.sessionId, attachment.documentId)',"attachment.status = 'failed'","emit('update:files', [...attachments.value])","emit('remove', id)",'void deleteTemporaryAttachment(props.sessionId, attachment.documentId)']],
  ['../components/KnowledgeBaseSelector.vue', ['knowledgeBases.value.filter(k => k.embedding_model_id && k.summary_model_id)','settingsStore.removeKnowledgeBase(id) : settingsStore.addKnowledgeBase(id)','settingsStore.selectKnowledgeBases(filteredKnowledgeBases.value.map(k => k.id))','settingsStore.clearKnowledgeBases()','const res: any = await listKnowledgeBases()','getRootZoom()','rectToCssPx(rawRect, zoom)','cssViewportSize(zoom)',"querySelectorAll('.visual-kb-option')"]],
  ['../components/KBSwitcherDropdown.vue', ['const current = all.find((kb) => kb.id === props.currentKbId)','return [current, ...all.filter((kb) => kb.id !== props.currentKbId)]','if (id === props.currentKbId) return',"emit('select', id)"]],
  ['../components/ChatAttachmentPreviewDrawer.vue', ["const MAIN_DRAWER_WIDTH_KEY = 'weknora-chat-attachment-drawer-width'",'localStorage.getItem(MAIN_DRAWER_WIDTH_KEY)','localStorage.setItem(MAIN_DRAWER_WIDTH_KEY, String(mainDrawerWidth.value))','mainDrawerWidth.value = clampMainDrawerWidth(mainResizeStartWidth + delta)','drawer?.close()','cleanupMainDrawerResize()']],
  ['../components/MentionSelector.vue', ['props.items.filter((item) => item.type === "kb")','props.items.filter((item) => item.type === "file")','props.groupCounts?.[def.type] ?? loadedCount','if (group.type === "file" && props.hasMore)','const isFlatMode = computed','emit("update:activeIndex", group.offset)','defineExpose({ moveActive, confirmActive, leaveGroup })','agent_id: agentIdForDetail.value','agent_source_tenant_id: agentSourceTenantIdForDetail.value','await getKnowledgeBaseById(item.id, opts)','await getKnowledgeDetails(item.id, opts)','router.push(`/platform/knowledge-bases/${kbId}`)','router.push("/platform/organizations")','emit("loadMore")',"querySelectorAll(\".visual-mention-item\")"]],
  ['../components/ChatHeader.vue', ['normalizeSessionTitleDraft(titleDraft.value)','await renameSession(session.id, title, session.description || \'\')','await setSessionPinned(session.id, pinned)','await copyText(props.session.id)','await copyText(currentSessionLink())','collectAllSessionMessages','buildSessionMarkdown','await clearSession(session.id)','await removeSession(session.id)','window.open(currentSessionLink(), \'_blank\', \'noopener,noreferrer\')']],
  ['../components/ChatReferencesDrawer.vue', ['buildReferenceSections(references.value)','resolveReferenceHighlightKey(references.value, highlight.value)','if (item.knowledgeId) query.knowledge_id = item.knowledgeId','path: `/platform/knowledge-bases/${item.knowledgeBaseId}`','watch(highlight, () => { void scrollToHighlight() })']],
  ['../views/knowledge/components/DocumentCardView.vue', ["emit('open', item)","emit('toggle-checkbox', item.id, !props.selectedIds.has(item.id))","emit('move-to-folder', item, path)","emit('action', action, item)",'props.traceAvailableById[item.id] === true']],
  ['../views/knowledge/components/DocumentListView.vue', ["emit('toggle-all', checked)","emit('toggle-row', item.id, checked, !!me?.shiftKey)","if (it) emit('probe-trace', it)","emit('reset-move-state')","emit('move-to-folder', item, path)"]],
  ['../views/knowledge/components/DocumentActionMenu.vue', ["(e: 'edit'): void","(e: 'view-trace'): void","(e: 'reparse'): void","(e: 'cancel-parse'): void","(e: 'move'): void","(e: 'move-folder'): void","(e: 'batch-manage'): void","(e: 'delete'): void"]],
  ['../views/knowledge/components/DocumentBatchBar.vue', ["(e: 'cancel'): void","(e: 'delete'): void","(e: 'reparse'): void","(e: 'batchTag'): void","(e: 'moveToFolder', folderPath: string): void","emit('moveToFolder', path)"]],
  ['../views/knowledge/components/FolderPickerMenu.vue', ['back: []','confirm: [folderPath: string]','create: [folderPath: string]',"emit('confirm', path)","emit('create', path)",'normalizeFolderPath(newFolderName.value)','joinFolderPath(creatingUnder.value, name)']],
  ['../views/knowledge/components/KbFolderTree.vue', ["emit('rename', { from: row.path, to: joinFolderPath(parent, name) })",'folderAncestorPaths(props.selectedPath).forEach((path) => next.add(path))','expanded.value = next']],
  ['../views/knowledge/components/KbUploadSourceDropdown.vue', ['fileInputRef.value?.click()','folderInputRef.value?.click()',"emit('manual')","emit('files', result.validFiles)","emit('url', url)",'new URL(url)','defineExpose({ openUrlDialog })']],
  ['../views/knowledge/components/TagEditDialog.vue', ['selectedSet.value = new Set(props.selectedTags.map((t) => t.id))','function toggleTag(tagId: string)','await createKnowledgeBaseTag(props.kbId, { name })',"emit('confirm', Array.from(selectedSet.value))","emit('open-manage')"]],
  ['../views/knowledge/components/BatchTagDialog.vue', ['selectedSet.value = new Set(props.preSelectedTagIds ?? [])','if (props.confirmLoading) return','await createKnowledgeBaseTag(props.kbId, { name })',"emit('confirm', Array.from(selectedSet.value))","emit('open-manage')"]],
  ['../views/knowledge/components/KbTagManageDrawer.vue', ['const TAG_PAGE_SIZE = 50','await listKnowledgeTags(props.kbId','keyword: searchQuery.value || undefined','await createKnowledgeBaseTag(props.kbId, { name })','await updateKnowledgeBaseTag(props.kbId, editingTagId.value, { name })','await deleteKnowledgeBaseTag(props.kbId, tag.seq_id, { force: true })','setTimeout(resolve, 800)']],
  ['../views/settings/Settings.vue', ["route.path === '/platform/settings' || uiStore.showSettingsModal",'uiStore.closeSettings()','router.back()',"window.addEventListener('settings-nav', handleSettingsNav)"]],
  ['../views/settings/GeneralSettings.vue', ["savedLocale = localStorage.getItem('locale')",'getCurrentEntitlement()','const persisted = persistLocalePreference(localLanguage.value)','if (!setTheme(value))']],
  ['../views/settings/ModelSettings.vue', ['const models = await listModels()',"model.isBuiltin ? authStore.isSystemAdmin : authStore.hasRole('admin')",'await updateModelAPI(editingModel.value.id, apiModelData)','await createModel(apiModelData)','await deleteModelAPI(modelId)','await createModel(newModel)','new URL(modelData.baseUrl.trim())']],
])

test('migrated views retain their native business contracts', () => {
  for (const [path, tokens] of contracts) {
    const script = scriptOf(path)
    for (const token of tokens) assert.ok(script.includes(token), `${path} lost business contract: ${token}`)
  }
})
