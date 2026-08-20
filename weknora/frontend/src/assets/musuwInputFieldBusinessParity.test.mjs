import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('audited Input-field controller remains locked after consumer picker integration', () => {
  const controller = read('./business-baselines/Input-field.pre-view.vue')
  assert.equal(blobSha(controller), 'a54b22494ebaecf39119dcb0717f5d3d0cb448ea')
})

test('rebuilt Input-field reuses the frozen component options and replaces only its active View', () => {
  const current = read('../components/Input-field.vue')
  assert.match(current, /import LegacyInputFieldBusiness from .*Input-field\.pre-view\.vue/)
  assert.match(current, /const legacy = LegacyInputFieldBusiness as any/)
  assert.match(current, /\.\.\.legacy,/)
  assert.match(current, /class="visual-chat-composer"/)
  for (const token of ['class="answers-input"', 'class="rich-input-container"', 'class="control-bar"', 'class="control-right"']) {
    assert.equal(current.includes(token), false, `Input-field still exposes active legacy shell ${token}`)
  }
})
