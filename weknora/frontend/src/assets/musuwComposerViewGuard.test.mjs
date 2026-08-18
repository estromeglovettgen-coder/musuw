import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('migrated composer subviews use visual roots and no legacy presentation shells', () => {
  const cases = [
    ['../components/ModelSelector.vue', 'class="visual-model-selector"', ['class="model-selector"', 'class="model-option"', '<t-select']],
    ['../components/AttachmentUpload.vue', 'class="visual-attachment-upload"', ['class="attachment-upload"', 'class="attachment-preview-bar"', 'class="attachment-preview-item"']],
  ]
  for (const [path, root, legacy] of cases) {
    const source = read(path)
    assert.ok(source.includes(root), `${path} lost ${root}`)
    for (const token of legacy) assert.equal(source.includes(token), false, `${path} still contains ${token}`)
  }
})

test('attachment visual layer exposes every native upload/parse terminal state', () => {
  const source = read('../components/AttachmentUpload.vue')
  for (const token of [
    "attachment.status === 'uploading'",
    "attachment.status === 'uploaded'",
    "attachment.status === 'processing'",
    "attachment.status === 'ready'",
    "attachment.status === 'failed'",
    'attachment.progress',
    'visual-attachment-card__progress',
  ]) assert.ok(source.includes(token), `AttachmentUpload lost state presentation: ${token}`)
})
