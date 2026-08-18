import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('frozen manual editor controller remains the original implementation', () => {
  assert.equal(
    blobSha(read('./business-baselines/manual-knowledge-editor.pre-view.vue')),
    '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
  )
})

test('rebuilt manual editor reuses normalized frozen setup and has no active SettingDrawer shell', () => {
  const source = read('../components/manual-knowledge-editor.vue')
  assert.match(source, /import LegacyManualEditorBusiness from .*manual-knowledge-editor\.pre-view\.vue/)
  assert.match(source, /const legacySetup = legacy\.setup/)
  assert.match(source, /return \{ \.\.\.state \}/)
  assert.match(source, /class="visual-manual-editor"/)
  for (const token of ['<SettingDrawer', 'class="manual-editor"', 'class="setting-drawer__section"']) {
    assert.equal(source.includes(token), false, `manual editor still exposes ${token}`)
  }
})

test('rebuilt manual editor keeps edit preview markdown status and save workflows visible', () => {
  const source = read('../components/manual-knowledge-editor.vue')
  for (const token of [
    'form.title',
    'form.kbId',
    'form.status',
    'toolbarGroups',
    'handleToolbarAction(btn.action)',
    "activeTab === 'edit'",
    "activeTab === 'preview'",
    'previewHTML',
    "handleSave('draft')",
    "handleSave('publish')",
    'savingAction',
    'lastUpdatedText',
  ]) assert.ok(source.includes(token), `manual editor active View lost ${token}`)
})
