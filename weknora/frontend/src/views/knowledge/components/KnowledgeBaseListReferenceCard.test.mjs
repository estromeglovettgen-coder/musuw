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

test('card actions close the native kb.showMore popup before emitting', () => {
  assert.match(source, /<t-popup[^>]*v-model="kb\.showMore"[^>]*trigger="click"/)
  assert.match(
    source,
    /const requestDuplicate = \(\) => \{\s*props\.kb\.showMore = false\s*emit\('duplicate'\)\s*\}/,
  )
  assert.match(
    source,
    /const requestDelete = \(\) => \{\s*props\.kb\.showMore = false\s*emit\('delete'\)\s*\}/,
  )
  assert.match(source, /v-if="canDuplicate"[^>]*@click="requestDuplicate"/)
  assert.match(source, /class="is-danger" @click="requestDelete"/)
  assert.doesNotMatch(source, /menuVisible|import \{ ref \} from 'vue'/)
})
