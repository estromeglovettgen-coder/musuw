import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./MemoryWorkspaceSettings.vue', import.meta.url), 'utf8')
const template = source.slice(0, source.indexOf('<script setup'))
const script = source.slice(source.indexOf('<script setup'), source.indexOf('<style'))

test('workspace memory keeps every setting visible and groups low-frequency controls under Advanced', () => {
  assert.doesNotMatch(template, /authStore\.isLiteMode/)

  const advancedToggleIndex = template.indexOf('memoryWorkspaceSettings.advancedLabel')
  assert.ok(advancedToggleIndex > 0, 'the full memory surface needs one compact Advanced disclosure')

  for (const basic of [
    'enableLabel',
    'writeModeLabel',
    'conditioningLabel',
    'maxItemsLabel',
  ]) {
    const index = template.indexOf(`memoryWorkspaceSettings.${basic}`)
    assert.ok(index > 0 && index < advancedToggleIndex, `${basic} should remain in Basic settings`)
  }

  for (const advanced of [
    'extractModelLabel',
    'extractDelayLabel',
    'extractMinIntervalLabel',
    'vectorRecallLabel',
    'embeddingModelLabel',
    'interestThresholdLabel',
    'instructionsLabel',
  ]) {
    const index = template.indexOf(`memoryWorkspaceSettings.${advanced}`)
    assert.ok(index > advancedToggleIndex, `${advanced} should be available in Advanced settings`)
  }

  assert.match(template, /:aria-expanded="advancedOpen"/)
  assert.match(script, /const advancedOpen = ref\(false\)/)
  assert.match(template, /:disabled="advancedDisabled \|\| config\.write_mode !== 'auto'"/)
  assert.match(template, /:disabled="advancedDisabled \|\| !config\.vector_recall"/)
  assert.match(
    template,
    /<ModelSelector\s+model-type="KnowledgeQA"[\s\S]*?:clearable="true"[\s\S]*?@update:selected-model-id="handleModelChange"/,
    'the optional extractor model must be clearable so users can restore the session-model fallback',
  )
})

test('one user action persists the workspace memory policy exactly once', () => {
  const saveBody = script.match(/const saveConfig = async \(\) => \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.equal(
    (saveBody.match(/updateTenantMemoryConfig\(/g) || []).length,
    1,
    'duplicate writes can race and show two success/error outcomes for one setting change',
  )
})

test('clearing the extractor model persists the empty session-model fallback', () => {
  assert.match(
    script,
    /const handleModelChange = \(modelId: string\) => \{\s*config\.extract_model_id = modelId \|\| ''[\s\S]*?debouncedSave\(\)/,
    'a cleared selector value must normalize to the empty backend value',
  )
})
