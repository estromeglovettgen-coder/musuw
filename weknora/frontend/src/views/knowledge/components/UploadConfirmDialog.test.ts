import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const knowledgeBase = readFileSync(new URL('../KnowledgeBaseReference.vue', import.meta.url), 'utf8')
const app = readFileSync(new URL('../../../App.vue', import.meta.url), 'utf8')
const manualEditor = readFileSync(new URL('../../../components/manual-knowledge-editor.vue', import.meta.url), 'utf8')

test('reference knowledge detail keeps platform-default upload actions', () => {
  assert.match(knowledgeBase, /const uploadFiles = async/)
  assert.match(knowledgeBase, /uploadKnowledgeFile\(kbId\.value, payload\)/)
  assert.match(knowledgeBase, /const importUrl = async/)
  assert.match(knowledgeBase, /createKnowledgeFromURL\(kbId\.value/)
  assert.match(knowledgeBase, /@files="uploadFiles"/)
  assert.match(knowledgeBase, /@url="importUrl"/)
  assert.match(knowledgeBase, /@manual="createManual"/)
  assert.doesNotMatch(knowledgeBase, /openUploadConfirmDialog/)
  assert.doesNotMatch(knowledgeBase, /process_config/)
  assert.doesNotMatch(manualEditor, /process_config/)
  assert.doesNotMatch(manualEditor, /uploadConfirmStore/)
  assert.doesNotMatch(app, /UploadConfirmHost/)
})
