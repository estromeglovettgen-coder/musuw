import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const scriptOf = (source) => source.match(/<script setup(?: lang="ts")?>([\s\S]*?)<\/script>/)?.[1] || ''

const normalizeViewSelector = (script) =>
  script.replaceAll('.visual-chat-composer__surface', '.rich-input-container')

test('Input-field view rebuild keeps the original business script except its rebuilt DOM hitbox selector', () => {
  const baseline = scriptOf(read('./business-baselines/Input-field.pre-view.vue'))
  const current = scriptOf(read('../components/Input-field.vue'))
  assert.equal(normalizeViewSelector(current), baseline)
})
