import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('unmigrated inline citation parsing logic stays byte-for-byte frozen', () => {
  assert.equal(blobSha(read('../composables/useChatCitationPopover.ts')), 'b1142ec34ee9dec81600e6f3bda0c418cd478967')
})

test('rebuilt answer reference summary preserves grouping, drawer handoff and KB navigation', () => {
  const source = read('../views/chat/components/docInfo.vue')
  for (const token of [
    "referencesDrawer.open({ references: refs })", "item.chunk_type === 'web_search'",
    'knowledgeId: item.knowledge_id', 'knowledgeBaseId: item.knowledge_base_id',
    'if (group.knowledgeId) query.knowledge_id = group.knowledgeId',
    'path: `/platform/knowledge-bases/${group.knowledgeBaseId}`', ':href="getDocumentHref(group)"',
  ]) assert.ok(source.includes(token), `docInfo lost ${token}`)
  for (const legacy of ['class="refer"', 'class="refer_header"', 'class="doc-group"']) assert.equal(source.includes(legacy), false)
})

test('rebuilt citation hover and drawer retain citation states and navigation', () => {
  const float = read('../components/ChatCitationFloat.vue')
  for (const token of ["float.type === 'web'", ':href="float.url"', 'float.loading', 'float.error', 'float.content', 'class="visual-citation-float"']) {
    assert.ok(float.includes(token), `ChatCitationFloat lost ${token}`)
  }
  const drawer = read('../components/ChatReferencesDrawer.vue')
  for (const token of [
    'buildReferenceSections(references.value)', 'resolveReferenceHighlightKey(references.value, highlight.value)',
    'if (item.knowledgeId) query.knowledge_id = item.knowledgeId',
    'path: `/platform/knowledge-bases/${item.knowledgeBaseId}`', 'watch(highlight, () => { void scrollToHighlight() })',
    'class="visual-references-panel"',
  ]) assert.ok(drawer.includes(token), `ChatReferencesDrawer lost ${token}`)
})

test('rebuilt sidebar owns its DOM while mechanical contracts remain only on unmigrated mothers', () => {
  const menu = read('../components/menu.vue')
  assert.match(menu, /class="visual-sidebar"/)
  for (const token of ['class="aside_box"', 'class="menu_top"', 'class="menu_bottom"', "'menu_item'"]) {
    assert.equal(menu.includes(token), false, `sidebar still exposes legacy shell ${token}`)
  }

  const input = read('../components/Input-field.vue')
  for (const token of ['rich-input-container', '<t-textarea', 'model-selector-trigger', 'control-right']) assert.ok(input.includes(token))

  const knowledge = read('../views/knowledge/KnowledgeBase.vue')
  for (const token of ['knowledge-layout', 'document-header', 'document-breadcrumb', 'knowledge-main', 'doc-filter-bar', 'doc-card-list']) assert.ok(knowledge.includes(token))
})

test('source/index palette adapter cannot restyle the excluded processing timeline', () => {
  const css = read('./musuw-reference-citation-sources.css')
  assert.match(css, /\.refer:not\(\.refer-timeline\)/)
  assert.equal(css.includes('.refer-timeline{'), false)
})
