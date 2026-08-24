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
