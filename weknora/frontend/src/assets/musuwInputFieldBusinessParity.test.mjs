import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('audited Input-field controller remains locked after marketplace delivery and draft preservation', () => {
  const controller = read('./business-baselines/Input-field.pre-view.vue')
  assert.equal(blobSha(controller), '57a5ae94ad8fb21b61f57e73d2ae6796670a6d31')
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

test('active composer keeps one concise localized invitation across every selection state', () => {
  const current = read('../components/Input-field.vue')
  const chinese = read('../i18n/locales/zh-CN.ts')
  const english = read('../i18n/locales/en-US.ts')
  const embed = read('../i18n/embed.ts')

  assert.match(current, /const inputPlaceholder = computed\(\(\) => t\('input\.placeholder'\)\)/)
  assert.match(current, /\.\.\.state,[\s\S]*inputPlaceholder,/)
  assert.equal((chinese.match(/placeholder(?:WithContext|WebOnly|KbAndWeb|Agent)?: '随心输入'/g) || []).length, 5)
  assert.equal((english.match(/placeholder(?:WithContext|WebOnly|KbAndWeb|Agent)?: 'Do anything'/g) || []).length, 5)
  assert.match(embed, /"placeholder": "随心输入"/)
  assert.match(embed, /"placeholder": "Do anything"/)
})
