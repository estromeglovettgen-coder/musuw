import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./KnowledgeBaseListReferenceCard.vue', import.meta.url), 'utf8')

test('knowledge-base cards show persisted descriptions and only fall back for blank text', () => {
  assert.match(
    source,
    /class="visual-reference-kb-card__description">\{\{ kb\.description\?\.trim\(\) \|\| \$t\('knowledgeBase\.noDescription'\) \}\}/,
  )
})

test('card action handoff closes its controlled popup before emitting', () => {
  assert.match(source, /<t-popup[^>]*v-model:visible="menuVisible"[^>]*trigger="click"/)
  assert.match(
    source,
    /const requestDuplicate = \(\) => \{\s*menuVisible\.value = false\s*emit\('duplicate'\)\s*\}/,
  )
  assert.match(
    source,
    /const requestDelete = \(\) => \{\s*menuVisible\.value = false\s*emit\('delete'\)\s*\}/,
  )
  assert.match(source, /v-if="canDuplicate"[^>]*@click="requestDuplicate"/)
  assert.match(source, /class="is-danger" @click="requestDelete"/)
})
