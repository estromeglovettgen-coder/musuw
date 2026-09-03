import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./KbCreateContextualGuide.vue', import.meta.url), 'utf8')

test('Lite knowledge-base submit guide stays beside the footer action on compact viewports', () => {
  const liteSubmit = source.match(/key:\s*'submitLite'[\s\S]*?\n\s*\},/)

  assert.ok(liteSubmit, 'Lite create guide must include a final submit step')
  assert.match(
    liteSubmit[0],
    /placement:\s*'left'/,
    'the footer action must keep the guide card to the left so the highlighted button remains visible and clickable',
  )
})
