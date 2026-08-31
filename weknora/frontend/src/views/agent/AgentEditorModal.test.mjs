import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AgentEditorModal.vue', import.meta.url), 'utf8')

test('editing an agent closes the editor after a successful save', () => {
  assert.match(
    source,
    /await updateAgent\(formData\.value\.id, formData\.value\);\s*MessagePlugin\.success\(t\('agent\.messages\.updated'\)\);\s*emit\('success'\);\s*handleClose\(\);/,
  )
})
test('the first successful create stays open for integration setup', () => {
  const createBranch = source.match(
    /if \(editorMode\.value === 'create'\) \{([\s\S]*?)^\s{4}\} else \{/m,
  )?.[1]
  assert.ok(createBranch, 'expected to find the create branch')
  assert.doesNotMatch(createBranch, /handleClose\(\)/)
  assert.match(createBranch, /savedAgent\.value = created;/)
})

test('save button labels distinguish create from save-and-close', () => {
  assert.match(
    source,
    /const saveButtonLabel = computed\(\(\) =>\s*editorMode\.value === 'create'\s*\? t\('agent\.editor\.buttons\.create'\)\s*: t\('agent\.editor\.buttons\.saveAndClose'\)\s*\)/,
  )
  assert.match(source, /saveButtonLabel/)
})

test('shows a post-create hint after the first successful save', () => {
  assert.match(source, /const isPostCreateSession = computed\(\(\) => !!savedAgent\.value\)/)
  assert.match(source, /settings-footer-note/)
  assert.match(source, /agent\.editor\.postCreateHint\.title/)
})

test('new agents use deterministic upstream defaults with a Lite scene fallback', () => {
  const defaultBlock = source.slice(
    source.indexOf('const applyDefaultModelsIfEmpty = () =>'),
    source.indexOf('const agentMode = computed'),
  )
  assert.match(defaultBlock, /selectInitialModelId\(allModels\.value, 'KnowledgeQA'\)/)
  assert.match(defaultBlock, /selectInitialModelId\(allModels\.value, 'Rerank'\)/)
  assert.match(defaultBlock, /consumerSceneOptions\.rag\?\.effective_model_id/)
  assert.match(defaultBlock, /config\.model_id = modelId/)
  assert.match(defaultBlock, /config\.rerank_model_id = rerankModelId/)
})

test('new and legacy agents keep upstream thinking disabled', () => {
  assert.match(source, /thinking:\s*false,\s*\/\/ 默认禁用思考模式/)
  assert.match(source, /if \(agentData\.config\.thinking == null\) \{\s*agentData\.config\.thinking = false;/)
})

test('agent dependencies retain the fail-together Promise.all contract', () => {
  const dependencies = source.slice(
    source.indexOf('const loadDependencies = async () =>'),
    source.indexOf('// 跳转到模型管理页面添加模型'),
  )
  assert.match(
    dependencies,
    /await Promise\.all\(\[\s*authStore\.isLiteMode \? Promise\.resolve\(\) : chatResources\.ensureModels\(\),\s*authStore\.isLiteMode \? chatResources\.ensureConsumerSceneOptions\('rag'\) : Promise\.resolve\(\),\s*chatResources\.ensureKnowledgeBases\(\),\s*chatResources\.ensureWebSearchProviders\(\),\s*chatResources\.ensureSandboxConfigs\(\),\s*editorResources\.prefetchAgentEditorDeps\(\),\s*\]\);/,
  )
  assert.doesNotMatch(dependencies, /Promise\.allSettled/)
})

test('consumer agent editor keeps the compact Lite tabs while Standard exposes main tabs', () => {
  const navBlock = source.match(
    /const navItems = computed\(\(\) => \{([\s\S]*?)^\}\);/m,
  )?.[1]
  const basicSection = source.slice(
    source.indexOf('<!-- 基础设置 -->'),
    source.indexOf('<!-- 提示词 -->'),
  )
  assert.ok(navBlock, 'expected the native agent navigation definition')
  assert.doesNotMatch(navBlock, /key: 'model'/)

  const standardStart = navBlock.indexOf("items.push({ key: 'conversation'")
  assert.ok(standardStart >= 0, 'expected the Standard navigation branch')
  const liteBranch = navBlock.slice(navBlock.indexOf('if (authStore.isLiteMode)'), standardStart)
  assert.match(liteBranch, /if \(authStore\.isLiteMode\)/)
  assert.match(liteBranch, /if \(isAgentMode\.value\)[\s\S]*key: 'mcp'/)
  assert.doesNotMatch(liteBranch, /hasKnowledgeBase/)
  for (const hidden of ['suggestions', 'conversation', 'retrieval', 'websearch', 'multimodal', 'tools', 'skills', 'share']) {
    assert.doesNotMatch(liteBranch, new RegExp(`key: '${hidden}'`))
  }

  const standardBranch = navBlock.slice(standardStart)
  for (const visible of ['conversation', 'websearch', 'multimodal', 'suggestions']) {
    assert.match(standardBranch, new RegExp(`key: '${visible}'`))
  }
  assert.match(standardBranch, /key: 'retrieval'/)
  assert.match(standardBranch, /key: 'tools'/)
  assert.match(standardBranch, /key: 'skills'/)
  assert.match(standardBranch, /key: 'mcp'/)
  assert.match(standardBranch, /key: 'share'/)
  for (const visible of ['basic', 'knowledge', 'prompts']) {
    assert.match(navBlock, new RegExp(`key: '${visible}'`))
  }

  assert.match(source, /const LITE_EDITOR_VISIBLE_SECTIONS = new Set\(\['basic', 'knowledge', 'prompts', 'mcp'\]\)/)
  assert.match(source, /const visibleSections = authStore\.isLiteMode\s*\?\s*LITE_EDITOR_VISIBLE_SECTIONS\s*:\s*EDITOR_VISIBLE_SECTIONS/)
  assert.match(source, /if \(resolved !== section \|\| !navItems\.value\.some\(\(item\) => item\.key === resolved\)\)/)
  assert.match(source, /key: 'retrieval'/)
  assert.match(basicSection, /data-agent-field="summary_model"/)
  assert.match(basicSection, /<ModelSelector model-type="KnowledgeQA"/)
  assert.match(basicSection, /:all-models="authStore\.isLiteMode \? \[\] : allModels"/)
  assert.match(basicSection, /:show-add-model="!authStore\.isLiteMode"/)
  assert.match(basicSection, /:scene-options="authStore\.isLiteMode \? agentModelSceneOptions : \[\]"/)
  assert.doesNotMatch(source, /data-guide="agent-create-agent-type"/)
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

test('quick agents retain hidden context validation and model errors return to Basic', () => {
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

test('conversation settings stay reachable in smart-reasoning mode', () => {
  assert.match(source, /v-show="currentSection === 'conversation'"/)
  assert.doesNotMatch(source, /currentSection === 'conversation' && !isAgentMode/)
  const navItems = source.match(/const navItems = computed\(\(\) => \{([\s\S]*?)^\}\);/m)?.[1]
  assert.ok(navItems, 'expected to find the nav items computed')
  assert.match(navItems, /^  items\.push\(\{ key: 'conversation'/m)
})

test('history turns is editable in smart-reasoning mode', () => {
  assert.match(source, /v-model="formData\.config\.history_turns"/)
  assert.match(source, /formData\.config\.multi_turn_enabled \|\| isAgentMode[\s\S]{0,500}history_turns/)
})

test('multi-turn switch stays hidden in smart-reasoning mode', () => {
  assert.match(source, /v-if="!isAgentMode" class="setting-row">[\s\S]{0,420}v-model="formData\.config\.multi_turn_enabled"/)
})

test('query rewrite stays hidden in smart-reasoning mode', () => {
  assert.match(source, /v-if="formData\.config\.multi_turn_enabled && !isAgentMode" class="setting-row">[\s\S]{0,420}v-model="formData\.config\.enable_rewrite"/)
})

test('the section description matches what the mode actually shows', () => {
  assert.match(source, /isAgentMode\.value\s*\?\s*t\('agentEditor\.desc\.conversationSectionAgent'\)/)
  assert.match(source, /<p class="section-description">\{\{ conversationSectionDesc \}\}<\/p>/)
})

test('history turns can be raised beyond the old 20 cap', () => {
  const input = source.match(/<t-input-number v-model="formData\.config\.history_turns"[^>]*>/)
  assert.ok(input, 'expected to find the history turns input')
  assert.match(input[0], /:max="100"/)
})

test('retrieval retention is offered to agents that actually have a knowledge base', () => {
  assert.match(source, /v-if="isAgentMode && hasKnowledgeBase" class="setting-row">[\s\S]{0,420}v-model="formData\.config\.retain_retrieval_history"/)
})

test('skills and sandbox share one editor section', () => {
  const navItems = source.match(/const navItems = computed\(\(\) => \{([\s\S]*?)^\}\);/m)?.[1]
  assert.ok(navItems, 'expected to find the nav items computed')
  assert.match(navItems, /key: 'skills'/)
  assert.match(navItems, /icon: SKILL_ICON/)
  assert.doesNotMatch(navItems, /key: 'sandbox'/)
  assert.match(source, /v-show="currentSection === 'skills' && isAgentMode"/)
  assert.doesNotMatch(source, /currentSection === 'sandbox' && isAgentMode/)
  assert.match(source, /sandbox: 'skills'/)
  assert.match(source, /formData\.value\.config\.sandbox_config_id/)
  assert.match(source, /:disabled="!canEnableSkills"/)
  assert.match(source, /sandbox-option/)
  assert.doesNotMatch(source, /skill-info-box/)
})

test('agent skill picker uses the catalog and only enables ready installs', () => {
  assert.match(source, /function autoBindSoleSandbox\(/)
  assert.match(source, /canEnableSkills/)
  assert.match(source, /catalogSkillRows/)
  assert.match(source, /showCatalogSkillList/)
  assert.match(source, /skillsSelectionMode\.value !== 'none'/)
  assert.match(source, /:disabled="!skill\.selectable"/)
  assert.match(source, /catalogPendingCount/)
  assert.match(source, /installPartial/)
  assert.match(source, /installCatalogToCurrent/)
  assert.match(source, /agent\.editor\.installToThisSandbox/)
  assert.match(source, /skill-pick-list/)
  assert.match(source, /skill-ready-stat/)
  assert.match(source, /skillsListSummaryReadyOnly/)
  assert.match(source, /selectedSandboxSummary/)
  assert.match(source, /line-clamp: 2/)
  assert.doesNotMatch(source, /skillsSelectionMode === 'selected' && catalogSkillRows/)
  assert.doesNotMatch(source, /skill-list-summary/)
})
