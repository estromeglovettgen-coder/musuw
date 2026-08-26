import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./KnowledgeBaseEditorModal.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en-US.ts', import.meta.url), 'utf8')
const zh = readFileSync(new URL('../../i18n/locales/zh-CN.ts', import.meta.url), 'utf8')
const ru = readFileSync(new URL('../../i18n/locales/ru-RU.ts', import.meta.url), 'utf8')
const ko = readFileSync(new URL('../../i18n/locales/ko-KR.ts', import.meta.url), 'utf8')

test('editing a knowledge base closes the editor after a successful save', () => {
  assert.match(source, /emit\('success', kbId\)\s*handleClose\(\)/)
})

test('a successful create closes instead of exposing configuration', () => {
  const doSubmit = source.slice(
    source.indexOf('const doSubmit = async () => {'),
    source.indexOf('// 重置所有状态'),
  )
  const createBranch = doSubmit.match(
    /if \(editorMode\.value === 'create'\) \{([\s\S]*?)^\s{4}\}/m
  )?.[1]

  assert.ok(createBranch, 'expected to find the create branch')
  assert.match(createBranch, /handleClose\(\)/)
  assert.doesNotMatch(createBranch, /savedKbId\.value|loadKBData\(createdKbId\)/)
})

test('save button labels distinguish create from save-and-close', () => {
  assert.match(
    source,
    /const saveButtonLabel = computed\(\(\) =>\s*editorMode\.value === 'create'\s*\? t\('knowledgeEditor\.buttons\.create'\)\s*: t\('knowledgeEditor\.buttons\.saveAndClose'\)\s*\)/
  )
})

test('create forwards only the four consumer scene candidates and leaves embedding platform-owned', () => {
  assert.doesNotMatch(source, /applyDefaultModelsIfEmpty|type ModelConfig/)
  assert.match(
    source,
    /const initFormData = \(type: 'document' \| 'faq' = 'document'\) => \(\{\s*type,\s*name: '',\s*description: '',\s*\}\)/,
  )

  const visibilityWatcher = source.slice(
    source.indexOf('watch(() => props.visible'),
    source.indexOf('// 监听全局设置弹窗关闭后刷新模型列表'),
  )
  const createOpenBranch = visibilityWatcher.match(
    /if \(props\.mode === 'create'\) \{([\s\S]*?)^\s{4}\}/m,
  )?.[1]
  assert.ok(createOpenBranch, 'expected the zero-config create open branch')
  assert.doesNotMatch(createOpenBranch, /loadAllModels|loadTenantDefaultStorageProvider|kbEditorInitialSection/)

  assert.ok(source.includes('const consumerSceneModelsForCreate = () => {'))
  assert.match(source, /settingsStore\.getConsumerSceneModel\('rag'\)/)
  assert.match(source, /settingsStore\.getConsumerSceneModel\('wiki'\)/)
  assert.match(source, /settingsStore\.getConsumerSceneModel\('vision'\)/)
  assert.match(source, /settingsStore\.getConsumerSceneModel\('asr'\)/)
  assert.match(source, /payload\.summary_model_id = rag/)
  assert.match(source, /payload\.wiki_config = \{ synthesis_model_id: wiki \}/)
  assert.match(source, /payload\.vlm_config = \{ enabled: true, model_id: vision \}/)
  assert.match(source, /payload\.asr_config = \{ enabled: true, model_id: asr \}/)
  assert.doesNotMatch(source, /payload\.embedding_model_id/)

  const settingsRefreshWatcher = source.slice(
    source.indexOf('watch(\n  () => uiStore.showSettingsModal'),
    source.indexOf('</script>'),
  )
  assert.match(settingsRefreshWatcher, /editorMode\.value !== 'create'/)
})

test('create mode reuses the existing TDesign description field and API payload', () => {
  assert.match(source, /v-if="editorMode === 'create'" class="zero-config-create"/)
  assert.match(
    source,
    /<t-textarea[\s\S]*?v-model="formData\.description"[\s\S]*?:placeholder="\$t\('knowledgeEditor\.basic\.descriptionPlaceholder'\)"[\s\S]*?:maxlength="200"[\s\S]*?:autosize="\{ minRows: 2, maxRows: 4 \}"/,
  )
  assert.doesNotMatch(source, /visual-kb-create-textarea|<textarea/)
  assert.match(source, /createKnowledgeBase\(\{[\s\S]*name: formData\.value\.name\.trim\(\),[\s\S]*description: formData\.value\.description\.trim\(\),[\s\S]*\.\.\.consumerSceneModelsForCreate\(\),[\s\S]*\}\)/)
})

test('create dialog is a compact content-driven modal with mobile-safe bounds', () => {
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /:aria-labelledby="editorMode === 'create' \? 'kb-create-title' : 'kb-edit-title'"/)
  assert.match(source, /<h2 id="kb-create-title" class="sidebar-title"/)
  assert.match(source, /\.settings-modal--compact\s*\{[^}]*width:\s*min\(448px, calc\(100vw - 32px\)\);[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*max-height:\s*calc\(100dvh - 32px\);/s)
  assert.match(source, /\.zero-config-create\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*0 1 auto;/s)
})

test('description is explicitly optional in every shipped locale', () => {
  assert.match(en, /descriptionLabel: 'Knowledge Base Description \(optional\)'/)
  assert.match(zh, /descriptionLabel: '知识库描述（可选）'/)
  assert.match(ru, /descriptionLabel: 'Описание базы знаний \(необязательно\)'/)
  assert.match(ko, /descriptionLabel: '지식베이스 설명\(선택\)'/)
})
