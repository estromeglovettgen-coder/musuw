import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./KnowledgeBaseEditorModal.vue', import.meta.url), 'utf8')

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

test('create delegates model and capability defaults to the server', () => {
  assert.doesNotMatch(source, /applyDefaultModelsIfEmpty|type ModelConfig/)
  assert.match(
    source,
    /const initFormData = \(type: 'document' \| 'faq' = 'document'\) => \(\{\s*type,\s*name: '',\s*\}\)/,
  )

  const visibilityWatcher = source.slice(
    source.indexOf('watch(() => props.visible'),
    source.indexOf('// 监听全局设置弹窗关闭后刷新模型列表'),
  )
  const createOpenBranch = visibilityWatcher.match(
    /if \(props\.mode === 'create'\) \{([\s\S]*?)^\s{4}\}/m,
  )?.[1]
  assert.ok(createOpenBranch, 'expected the name-only create open branch')
  assert.doesNotMatch(createOpenBranch, /loadAllModels|loadTenantDefaultStorageProvider|kbEditorInitialSection/)

  const settingsRefreshWatcher = source.slice(
    source.indexOf('watch(\n  () => uiStore.showSettingsModal'),
    source.indexOf('</script>'),
  )
  assert.match(settingsRefreshWatcher, /editorMode\.value !== 'create'/)
})

test('create mode exposes only the knowledge-base name', () => {
  assert.match(source, /v-if="editorMode === 'create'" class="zero-config-create"/)
  assert.match(source, /createKnowledgeBase\(\{ name: formData\.value\.name\.trim\(\) \}\)/)
})
