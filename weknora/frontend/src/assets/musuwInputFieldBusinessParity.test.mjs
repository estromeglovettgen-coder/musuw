import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const scriptOf = (source) => source.match(/<script setup(?: lang="ts")?>([\s\S]*?)<\/script>/)?.[1] || ''

test('Input-field view rebuild keeps the original business script byte-for-byte', () => {
  const baseline = read('./business-baselines/Input-field.pre-view.vue')
  const current = read('../components/Input-field.vue')
  assert.equal(scriptOf(current), scriptOf(baseline))
})
