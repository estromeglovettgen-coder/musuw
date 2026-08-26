import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./ModelSelector.vue', import.meta.url), 'utf8')
const inputField = readFileSync(new URL('./Input-field.vue', import.meta.url), 'utf8')
const finalContract = readFileSync(new URL('../assets/musuw-final-contract-closure.css', import.meta.url), 'utf8')

const chatTemplate = source.slice(source.indexOf('<template v-if="mode === \'chat\'">'), source.indexOf('\n    <t-select'))

test('chat picker mirrors the compact Codex two-row/listbox contract', () => {
  for (const token of [
    "mode === 'chat'",
    "view === 'overview'",
    'visual-model-selector__chat-row',
    'role="listbox"',
    'tabindex="0"',
    'aria-activedescendant',
    'handleModelKeydown',
    'handleReasoningKeydown',
    'ArrowDown',
    'ArrowUp',
    "event.key === 'Escape'",
    "event.key === ' '",
    'v-for="model in chatModels"',
    'v-for="(option, index) in reasoningOptions"',
    'max-height: min(250px, calc(var(--visual-model-menu-max-height, 340px) - 52px), 48vh)',
    'props.models.filter(model => !!model.id)',
    "props.mode === 'catalog' && !props.allModels",
  ]) {
    assert.ok(source.includes(token), `chat picker lost ${token}`)
  }
  const modelKeyboard = source.slice(
    source.indexOf('const handleModelKeydown'),
    source.indexOf('const handleReasoningKeydown'),
  )
  const reasoningKeyboard = source.slice(
    source.indexOf('const handleReasoningKeydown'),
    source.indexOf('const handlePanelKeydown'),
  )
  assert.match(modelKeyboard, /event\.key === ' '/, 'model listbox Space must select the active option')
  assert.match(reasoningKeyboard, /event\.key === ' '/, 'reasoning listbox Space must select the active option')

  for (const removedToken of [
    'role="combobox"',
    'visual-model-selector__chat-search',
    'searchQuery',
    'modelGroups',
    'providerLabel',
    'model.description',
    'reasoningDescription',
  ]) assert.equal(chatTemplate.includes(removedToken), false, `chat template still contains ${removedToken}`)
  assert.equal(chatTemplate.includes('<small'), false, 'chat list options must remain single-line labels')
})

test('chat picker preserves the native business state and keeps catalog mode intact', () => {
  for (const token of [
    "'select-model'",
    "'select-reasoning'",
    "'update:view'",
    "emit('update:selectedModelId', value)",
    '@change="handleModelChange"',
    'value="__add_model__"',
    ':models="availableModels"',
    ':selected-model-id="selectedModelId"',
    ':reasoning-options="reasoningOptions"',
    ':reasoning-effort="reasoningEffort"',
  ]) {
    const haystack = `${source}\n${inputField}`
    assert.ok(haystack.includes(token), `business contract lost ${token}`)
  }
  assert.equal(inputField.includes('<AgentSelector'), false)
  assert.equal(inputField.includes('__thinking-switch'), false)
})

test('chat picker keeps locked scene options visible but navigates instead of selecting them', () => {
  for (const token of [
    'locked',
    'selectable',
    'aria-disabled',
    "router.push('/plans')",
    "if (option.locked || !option.selectable)",
  ]) assert.ok(source.includes(token), `scene picker lost ${token}`)
  assert.match(source, /option\.locked[\s\S]*?router\.push\('\/plans'\)/)
})

test('chat picker keeps long names in a single aligned column and adapts to narrow screens', () => {
  for (const token of [
    'display: flex',
    'gap: 4px',
    'min-height: 44px',
    'padding: 6px 10px',
    'text-overflow: ellipsis',
    'white-space: nowrap',
    '@media (max-width: 430px)',
    'calc(100vw - 32px)',
    'max-height: min(250px, calc(var(--visual-model-menu-max-height, 340px) - 52px), 48vh)',
    'overflow-y: auto',
    'visualModelDropdownStyle',
    'window.innerHeight - rect.top + 6',
    'window.innerWidth - rect.right',
    ':style="visualModelDropdownStyle"',
    'width: min(224px, calc(100vw - 32px))',
  ]) assert.ok(inputField.includes(token) || source.includes(token), `layout contract lost ${token}`)
  const optionRule = source.match(/\.visual-model-selector__chat-option\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  assert.doesNotMatch(optionRule, /min-height:/, 'reference flyout rows must keep their source compact height')
  assert.equal(inputField.includes('height: style.maxHeight'), false, 'overview must size to content')
  assert.equal(inputField.includes('visual-model-selector__chat-search-wrap'), false, 'legacy search layout must stay removed')
})

test('chat picker owns complete light and dark surface tokens', () => {
  for (const token of [
    '--chat-picker-ink:',
    '--chat-picker-hover:',
    '--chat-picker-selected:',
    ':root[theme-mode="dark"] .visual-model-selector__chat-panel',
    '@media (prefers-color-scheme: dark)',
  ]) assert.ok(source.includes(token), `theme contract lost ${token}`)
  for (const token of [
    ':root[theme-mode="dark"] .visual-chat-composer__model-picker',
    ':root[theme-mode="dark"] .visual-chat-composer__model-picker-effort',
  ]) assert.ok(finalContract.includes(token), `composer theme contract lost ${token}`)
})
