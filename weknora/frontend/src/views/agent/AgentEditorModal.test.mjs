import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AgentEditorModal.vue', import.meta.url), 'utf8')

test('editing an agent closes the editor after a successful save', () => {
  assert.match(
    source,
    /await updateAgent\(formData\.value\.id, formData\.value\);\s*MessagePlugin\.success\(t\('agent\.messages\.updated'\)\);\s*emit\('success'\);\s*handleClose\(\);/
  )
})

test('the first successful create stays open for integration setup', () => {
  const createBranch = source.match(
    /if \(editorMode\.value === 'create'\) \{([\s\S]*?)^\s{4}\} else \{/m
  )?.[1]

  assert.ok(createBranch, 'expected to find the create branch')
  assert.doesNotMatch(createBranch, /handleClose\(\)/)
  assert.match(createBranch, /savedAgent\.value = created;/)
})

test('save button labels distinguish create from save-and-close', () => {
  assert.match(
    source,
    /const saveButtonLabel = computed\(\(\) =>\s*editorMode\.value === 'create'\s*\? t\('agent\.editor\.buttons\.create'\)\s*: t\('agent\.editor\.buttons\.saveAndClose'\)\s*\)/
  )
  assert.match(source, /saveButtonLabel/)
})

test('shows a post-create hint after the first successful save', () => {
  assert.match(source, /const isPostCreateSession = computed\(\(\) => !!savedAgent\.value\)/)
  assert.match(source, /settings-footer-note/)
  assert.match(source, /agent\.editor\.postCreateHint\.title/)
})

test('new agents keep the upstream default and use the existing Lite model catalog as fallback', () => {
  const defaultBlock = source.match(
    /const applyDefaultChatModelIfEmpty = \(\) => \{([\s\S]*?)^\}/m
  )?.[1]

  assert.ok(defaultBlock, 'expected the upstream chat-model initializer')
  assert.match(defaultBlock, /m\.type === 'KnowledgeQA' && m\.is_default/)
  assert.match(defaultBlock, /m\.type === 'KnowledgeQA'/)
  assert.match(defaultBlock, /consumerSceneOptions\.rag\?\.effective_model_id/)
  assert.match(defaultBlock, /config\.model_id = modelID/)
  assert.doesNotMatch(source, /applyDefaultModelsIfEmpty|pick\('(?:Rerank|VLLM|ASR)'\)/)
  assert.doesNotMatch(source, /consumerSceneModels|resolveConsumerSceneCandidate/)
})

test('new and legacy agents keep upstream thinking disabled', () => {
  assert.match(source, /thinking:\s*false,\s*\/\/ 默认禁用思考模式/)
  assert.match(source, /if \(agentData\.config\.thinking == null\) \{\s*agentData\.config\.thinking = false;/)
})

test('agent dependencies retain the upstream fail-together Promise.all contract', () => {
  const dependencies = source.slice(
    source.indexOf('const loadDependencies = async () =>'),
    source.indexOf('// 跳转到模型管理页面添加模型'),
  )

  assert.match(
    dependencies,
    /await Promise\.all\(\[\s*chatResources\.ensureModels\(\),\s*authStore\.isLiteMode \? chatResources\.ensureConsumerSceneOptions\('rag'\) : Promise\.resolve\(\),\s*chatResources\.ensureKnowledgeBases\(\),\s*chatResources\.ensureWebSearchProviders\(\),\s*editorResources\.prefetchAgentEditorDeps\(\),\s*\]\);/,
  )
  assert.doesNotMatch(dependencies, /Promise\.allSettled/)
})

test('consumer agent editor keeps the model in Basic and hides the agent type', () => {
  const navBlock = source.match(
    /const navItems = computed\(\(\) => \{([\s\S]*?)^\}\);/m,
  )?.[1]
  const basicSection = source.slice(
    source.indexOf('<!-- 基础设置 -->'),
    source.indexOf('<!-- 提示词 -->'),
  )

  assert.ok(navBlock, 'expected the native agent navigation definition')
  assert.doesNotMatch(navBlock, /key: 'model'/)
  for (const hidden of ['suggestions', 'conversation', 'retrieval', 'websearch', 'multimodal', 'tools', 'skills', 'share']) {
    assert.doesNotMatch(navBlock, new RegExp(`key: '${hidden}'`))
  }
  for (const visible of ['basic', 'knowledge', 'prompts', 'mcp']) {
    assert.match(source, new RegExp(`key: '${visible}'`))
  }
  assert.match(basicSection, /data-agent-field="summary_model"/)
  assert.match(basicSection, /<ModelSelector model-type="KnowledgeQA"/)
  assert.match(basicSection, /:all-models="allModels"/)
  assert.match(basicSection, /:show-add-model="!authStore\.isLiteMode"/)
  assert.match(basicSection, /:scene-options="authStore\.isLiteMode \? agentModelSceneOptions : \[\]"/)
  assert.doesNotMatch(source, /data-guide="agent-create-agent-type"/)
  assert.match(source, /currentSection\.value = 'basic'/)
})

test('prompt configuration exposes only the system prompt while preserving hidden values', () => {
  const promptNavBlock = source.match(
    /const promptNavItems = computed\(\(\) => \{([\s\S]*?)^\}\);/m,
  )?.[1]

  assert.ok(promptNavBlock, 'expected the native prompt navigation definition')
  assert.doesNotMatch(promptNavBlock, /key: '(?:context|intent|rewrite-system|rewrite-user|fallback)'/)
  assert.match(source, /v-if="false"\s+data-agent-hidden-prompts="advanced"/)
  assert.match(source, /context_template: ''/)
})

test('quick agents retain upstream hidden context validation and model errors return to Basic', () => {
  const saveBlock = source.slice(source.indexOf('const handleSave = async () =>'))
  assert.match(
    saveBlock,
    /!isAgentMode\.value && \(!formData\.value\.config\.context_template \|\| !formData\.value\.config\.context_template\.trim\(\)\)[\s\S]*?contextTemplateRequired[\s\S]*?currentSection\.value = 'prompts'/,
  )
  assert.match(saveBlock, /modelRequired[\s\S]*?currentSection\.value = 'basic'/)
})

test('knowledge scope keeps native selection controls but hides file type restrictions', () => {
  const knowledgeSection = source.slice(
    source.indexOf('<!-- 知识库配置 -->'),
    source.indexOf('<!-- 网络搜索设置 -->'),
  )

  assert.match(knowledgeSection, /kbSelectionMode/)
  assert.match(knowledgeSection, /kbSelectionMode === 'selected'/)
  assert.match(knowledgeSection, /retrieve_kb_only_when_mentioned/)
  assert.match(knowledgeSection, /v-if="false"\s+data-agent-hidden-field="supported-file-types"/)
})
