import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('frozen Input-field business controller remains the original implementation', () => {
  const controller = read('./business-baselines/Input-field.pre-view.vue')
  assert.equal(blobSha(controller), 'a34d09f5f9dbe44d4b3835213fdab662c4b7446a')
})

test('rebuilt Input-field reuses the frozen component setup and replaces only its active View', () => {
  const current = read('../components/Input-field.vue')
  assert.match(current, /import LegacyInputFieldBusiness from .*Input-field\.pre-view\.vue/)
  assert.match(current, /\.\.\.LegacyInputFieldBusiness/)
  assert.match(current, /class="visual-chat-composer"/)
  for (const legacy of ['class="answers-input"', 'class="rich-input-container"', 'class="control-bar"', 'class="control-right"']) {
    assert.equal(current.includes(legacy), false, `Input-field still exposes active legacy shell ${legacy}`)
  }
})
