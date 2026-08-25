import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const editor = readFileSync(new URL('./KnowledgeBaseEditorModal.vue', import.meta.url), 'utf8')
const modelConfig = readFileSync(new URL('./settings/KBModelConfig.vue', import.meta.url), 'utf8')

test('Wiki model selector uses scene options while preserving existing wiki_config payload', () => {
  assert.match(editor, /wiki-scene-options="wikiSceneOptions"/)
  assert.match(editor, /ensureConsumerSceneOptions\('wiki'\)/)
  assert.match(editor, /syncWikiSceneCandidate/)
  assert.match(editor, /resolveConsumerSceneCandidate/)
  assert.match(editor, /synthesis_model_id: formData\.value\.modelConfig\?\.wikiSynthesisModelId/)
  assert.match(modelConfig, /scene-options="wikiSceneOptions"/)
  assert.match(modelConfig, /show-add-model="false"/)
  assert.match(modelConfig, /wikiSynthesisModelId: modelId/)
  assert.match(modelConfig, /model-type="Embedding"/)
})
