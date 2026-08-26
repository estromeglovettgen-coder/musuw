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
  assert.doesNotMatch(modelConfig, /model-type="Embedding"/)
  assert.doesNotMatch(modelConfig, /handleEmbeddingChange/)
  assert.match(editor, /embeddingModelId: data\.embedding_model_id/)
  assert.match(editor, /embedding_model_id: formData\.value\.modelConfig\.embeddingModelId/)
  assert.match(editor, /consumerSceneModelsForCreate/)
  assert.match(editor, /\.\.\.consumerSceneModelsForCreate\(\)/)
  const doSubmit = editor.slice(editor.indexOf('const doSubmit = async () => {'), editor.indexOf('// 重置所有状态'))
  const createStart = doSubmit.indexOf("if (editorMode.value === 'create')")
  const editStart = doSubmit.indexOf('const data = buildSubmitData()')
  assert.ok(createStart >= 0 && editStart > createStart, 'expected create and edit branches')
  assert.doesNotMatch(doSubmit.slice(createStart, editStart), /embedding_model_id/)
})
