import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const knowledgeBase = readFileSync(new URL('../KnowledgeBase.vue', import.meta.url), 'utf8')
const platform = readFileSync(new URL('../../platform/index.vue', import.meta.url), 'utf8')
const app = readFileSync(new URL('../../../App.vue', import.meta.url), 'utf8')
const manualEditor = readFileSync(new URL('../../../components/manual-knowledge-editor.vue', import.meta.url), 'utf8')

test('uses platform defaults for managed uploads without exposing the configuration dialog', () => {
  assert.match(knowledgeBase, /const startPlatformDefaultUpload = async/)
  assert.match(knowledgeBase, /await executeUploadBatch\(files, \{[\s\S]*?tagIds,[\s\S]*?targetFolder: selectedFolderPath\.value,[\s\S]*?\}\)/)
  assert.match(knowledgeBase, /await executeUrlImport\(url, tagIds\)/)
  assert.doesNotMatch(knowledgeBase, /openUploadConfirmDialog/)
  assert.doesNotMatch(knowledgeBase, /process_config/)
  assert.doesNotMatch(manualEditor, /process_config/)
  assert.doesNotMatch(manualEditor, /uploadConfirmStore/)
  assert.doesNotMatch(app, /UploadConfirmHost/)
})

test('routes global knowledge file drops straight to platform-default uploads', () => {
  assert.match(platform, /weknora:knowledge-file-drop/)
  assert.match(knowledgeBase, /handleKnowledgeFileDrop/)
  assert.match(knowledgeBase, /handleUploadSourceFiles\(files\)/)
})
