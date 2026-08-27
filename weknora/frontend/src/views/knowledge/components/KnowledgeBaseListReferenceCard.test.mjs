import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./KnowledgeBaseListReferenceCard.vue', import.meta.url), 'utf8')
const list = readFileSync(new URL('../KnowledgeBaseList.vue', import.meta.url), 'utf8')

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

test('the native three-dot menu opens the existing knowledge-base editor', () => {
  assert.match(
    source,
    /const requestEdit = \(\) => \{\s*props\.kb\.showMore = false\s*emit\('edit'\)\s*\}/,
  )
  assert.match(
    source,
    /v-if="canManage"[^>]*@click="requestEdit"[\s\S]*?name="setting"[\s\S]*?knowledgeList\.menu\.editConfig/,
  )
  assert.match(source, /visual-reference-kb-card-menu__separator/)
  assert.match(list, /@edit="uiStore\.openEditKB\(kb\.id\)"/)
  assert.doesNotMatch(list, /editingKb|showConfigModal|new (?:Map|Set).*editor/i)
})

test('knowledge-base cards share the restrained Agent card geometry in light and dark themes', () => {
  assert.match(source, /\.visual-reference-kb-card\s*\{[\s\S]*?min-height:\s*154px;/)
  for (const token of [
    ':root[theme-mode="dark"] .visual-reference-kb-card',
    'background: #18181b',
    ':root[theme-mode="dark"] .visual-reference-kb-card__title strong',
    ':root[theme-mode="dark"] .visual-reference-kb-card__footer',
    ':root[theme-mode="dark"] .visual-reference-kb-card__badge',
  ]) assert.ok(source.includes(token), `KB card dark visual contract lost ${token}`)
  assert.match(list, /\.visual-kb-list__content\s*\{[^}]*padding:\s*24px 4px 12px 2px;/)
  assert.match(source, /transition:\s*border-color 180ms ease,\s*box-shadow 180ms ease;/)
  assert.match(source, /\.visual-reference-kb-card:hover\s*\{[^}]*box-shadow:\s*0 4px 6px -1px rgb\(0 0 0 \/ 10%\),0 2px 4px -2px rgb\(0 0 0 \/ 10%\);[^}]*transform:\s*none;/)
  assert.match(source, /:root\[theme-mode="dark"\] \.visual-reference-kb-card:hover\s*\{[^}]*background:\s*var\(--mvc-hover, #25272c\) !important;[^}]*box-shadow:\s*var\(--mvc-shadow\) !important;/)
  assert.match(list, /:root\[theme-mode="dark"\] \.visual-kb-workspace,[\s\S]*?\.visual-kb-list\s*\{[^}]*background:\s*var\(--mvc-page, #151619\) !important;/)
  assert.match(list, /:root\[theme-mode="dark"\] \.visual-kb-list__header\s*\{[^}]*background:\s*var\(--mvc-page, #151619\) !important;/)
})
