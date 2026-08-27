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

test('a successful configured create closes after using the native create contract', () => {
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
  assert.match(createBranch, /indexing_strategy:/)
  assert.match(createBranch, /wiki_config:/)
})

test('save button labels match the reference create and edit actions', () => {
  assert.match(
    source,
    /const saveButtonLabel = computed\(\(\) =>\s*editorMode\.value === 'create'\s*\? t\('knowledgeEditor\.buttons\.confirmCreate'\)\s*: t\('knowledgeEditor\.buttons\.save'\)\s*\)/
  )
})

test('create exposes native RAG, Wiki, Wiki instructions, and summary model while leaving embedding platform-owned', () => {
  assert.doesNotMatch(source, /applyDefaultModelsIfEmpty|type ModelConfig/)
  assert.match(
    source,
    /const initFormData = \(type: 'document' \| 'faq' = 'document'\) => \(\{[\s\S]*indexingStrategy:[\s\S]*wikiConfig:[\s\S]*modelConfig:/,
  )

  const visibilityWatcher = source.slice(
    source.indexOf('watch(() => props.visible'),
    source.indexOf('// 监听全局设置弹窗关闭后刷新模型列表'),
  )
  const createOpenBranch = visibilityWatcher.match(
    /if \(props\.mode === 'create'\) \{([\s\S]*?)^\s{4}\}/m,
  )?.[1]
  assert.ok(createOpenBranch, 'expected the zero-config create open branch')
  assert.match(createOpenBranch, /loadAllModels/)
  assert.doesNotMatch(createOpenBranch, /loadTenantDefaultStorageProvider|kbEditorInitialSection/)

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
  assert.match(source, /data-guide="kb-create-indexing"/)
  assert.match(source, /v-model="formData\.wikiConfig\.contentInstructions"/)
  assert.match(source, /v-model="formData\.wikiConfig\.extractionInstructions"/)
  assert.match(source, /:selected-model-id="formData\.modelConfig\.llmModelId"/)

  const settingsRefreshWatcher = source.slice(
    source.indexOf('watch(\n  () => uiStore.showSettingsModal'),
    source.indexOf('</script>'),
  )
  assert.match(settingsRefreshWatcher, /editorMode\.value !== 'create'/)
})

test('create mode reuses native TDesign fields and API payload', () => {
  assert.match(source, /<form v-if="formData" class="kb-config-form" @submit\.prevent="handleSubmit">/)
  assert.match(
    source,
    /<t-textarea[\s\S]*?v-model="formData\.description"[\s\S]*?:placeholder="\$t\('knowledgeEditor\.basic\.descriptionPlaceholder'\)"[\s\S]*?:maxlength="200"/,
  )
  assert.doesNotMatch(source, /visual-kb-create-textarea|<textarea/)
  assert.match(source, /const sceneModels = consumerSceneModelsForCreate\(\)[\s\S]*createKnowledgeBase\(\{[\s\S]*name: formData\.value\.name\.trim\(\),[\s\S]*description: formData\.value\.description\.trim\(\),[\s\S]*\.\.\.sceneModels,[\s\S]*indexing_strategy:[\s\S]*wiki_config:/)
})

test('create dialog is a scrollable consumer settings modal with mobile-safe bounds', () => {
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /aria-labelledby="kb-config-title"/)
  assert.match(source, /<h2 id="kb-config-title">/)
  assert.match(source, /\.kb-config-form\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;/s)
})

test('create and edit mechanically share the reference knowledge-base configuration surface', () => {
  const template = source.slice(0, source.indexOf('<script setup'))

  assert.match(template, /class="kb-config-overlay"/)
  assert.match(template, /class="kb-config-modal"/)
  assert.match(template, /id="kb-config-title"[\s\S]*?editorMode === 'create'[\s\S]*?knowledgeEditor\.titleCreate[\s\S]*?knowledgeEditor\.titleEdit/)
  assert.match(template, /knowledgeEditor\.modalDescription/)
  assert.match(template, /<form v-if="formData" class="kb-config-form" @submit\.prevent="handleSubmit">/)
  assert.doesNotMatch(template, /settings-container|settings-sidebar|settings-nav|currentSection ===/)
  assert.doesNotMatch(template, /:autofocus="editorMode === 'create'"/)

  const orderedFields = [
    'data-guide="kb-create-indexing"',
    'class="kb-config-granularity"',
    'v-model="formData.wikiConfig.contentInstructions"',
    'v-model="formData.wikiConfig.extractionInstructions"',
    'data-guide="kb-create-name"',
    'v-model="formData.description"',
    'data-guide="kb-create-llm"',
  ]
  let previousIndex = -1
  for (const field of orderedFields) {
    const index = template.indexOf(field)
    assert.ok(index > previousIndex, `expected ${field} after the preceding reference field`)
    previousIndex = index
  }

  assert.match(source, /\.kb-config-modal\s*\{[\s\S]*?width:\s*min\(672px, calc\(100vw - 24px\)\);[\s\S]*?max-height:\s*90dvh;[\s\S]*?border-radius:\s*24px;/)
  assert.match(source, /\.kb-config-header\s*\{[\s\S]*?padding:\s*24px 32px 16px;/)
  assert.match(source, /\.kb-config-form\s*\{[\s\S]*?padding:\s*20px 32px;[\s\S]*?gap:\s*24px;/)
  assert.match(source, /\.kb-config-textarea :deep\(\.t-textarea__info_wrapper\)\s*\{\s*display:\s*none;/)
  assert.match(source, /:root\[theme-mode="dark"\] body \.kb-config-modal/)
  assert.match(source, /:root\[theme-mode="dark"\] body \.kb-config-field/)
  assert.match(source, /:root\[theme-mode="dark"\] body \.kb-config-summary-model \.visual-model-selector__control \.t-input/)
})

test('consumer editor does not call the unimplemented whole-library rebuild endpoint', () => {
  assert.match(source, /const isIndexingLocked = computed\(\(\) => editorMode\.value === 'edit' && hasFiles\.value\)/)
  assert.doesNotMatch(source, /const isIndexingLocked[^\n]*authStore\.isLiteMode/)
  assert.doesNotMatch(source, /rebuildKBIndex/)
  assert.doesNotMatch(source, /rebuildConfirmTitle|rebuildConfirmBody/)
})

test('description is explicitly optional in every shipped locale', () => {
  assert.match(en, /descriptionLabel: 'Knowledge Base Description \(optional\)'/)
  assert.match(zh, /descriptionLabel: '知识库描述（可选）'/)
  assert.match(ru, /descriptionLabel: 'Описание базы знаний \(необязательно\)'/)
  assert.match(ko, /descriptionLabel: '지식베이스 설명\(선택\)'/)
})
