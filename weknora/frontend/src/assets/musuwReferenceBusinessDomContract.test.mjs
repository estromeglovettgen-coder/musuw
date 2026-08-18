import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('unmigrated inline citation parsing logic stays byte-for-byte frozen', () => {
  const source = read('../composables/useChatCitationPopover.ts')
  assert.equal(blobSha(source), 'b1142ec34ee9dec81600e6f3bda0c418cd478967')
})

test('rebuilt answer reference summary preserves grouping, web links, drawer handoff and KB navigation', () => {
  const source = read('../views/chat/components/docInfo.vue')
  for (const token of [
    "referencesDrawer.open({ references: refs })",
    "item.chunk_type === 'web_search'",
    "item.chunk_type !== 'web_search'",
    'const key = item.knowledge_id || item.knowledge_title || item.id',
    'title: item.knowledge_title || item.knowledge_filename || key',
    'knowledgeId: item.knowledge_id',
    'knowledgeBaseId: item.knowledge_base_id',
    'const sanitized = sanitizeHTML(content)',
    'if (group.knowledgeId) query.knowledge_id = group.knowledgeId',
    'path: `/platform/knowledge-bases/${group.knowledgeBaseId}`',
    'return router.resolve({',
    ':href="getDocumentHref(group)"',
    'target="_blank"',
    'rel="noopener noreferrer"',
    'class="visual-answer-references"',
  ]) assert.ok(source.includes(token), `docInfo lost reference contract: ${token}`)
  for (const legacy of ['class="refer"', 'class="refer_header"', 'class="doc-group"', 'class="doc doc-web"']) {
    assert.equal(source.includes(legacy), false, `docInfo still contains legacy shell ${legacy}`)
  }
})

test('rebuilt citation hover card preserves web and document state semantics', () => {
  const source = read('../components/ChatCitationFloat.vue')
  for (const token of ["float.type === 'web'",':href="float.url"','target="_blank"','rel="noopener noreferrer"','float.loading','float.error','float.content','@mouseenter="onEnter?.()"','@mouseleave="onLeave?.()"','class="visual-citation-float"']) {
    assert.ok(source.includes(token), `ChatCitationFloat lost citation state contract: ${token}`)
  }
  assert.equal(source.includes('class="chat-citation-float"'), false)
})

test('rebuilt references drawer preserves native citation grouping, highlight and KB navigation semantics', () => {
  const source = read('../components/ChatReferencesDrawer.vue')
  for (const token of ['buildReferenceSections(references.value)','resolveReferenceHighlightKey(references.value, highlight.value)','if (item.knowledgeId) query.knowledge_id = item.knowledgeId','path: `/platform/knowledge-bases/${item.knowledgeBaseId}`','return router.resolve({ path: `/platform/knowledge-bases/${item.knowledgeBaseId}`, query }).href',"window.getSelection()?.toString().trim()",'if (selectedText || pointerDownSelectionText.value)','watch(highlight, () => { void scrollToHighlight() })',':href="getDocumentHref(item)"','target="_blank"','class="visual-references-panel"']) {
    assert.ok(source.includes(token), `ChatReferencesDrawer lost citation contract: ${token}`)
  }
  for (const legacy of ['class="chat-references-panel"', 'class="reference-item"', 'class="reference-item__body"']) {
    assert.equal(source.includes(legacy), false, `ChatReferencesDrawer still contains legacy shell ${legacy}`)
  }
})

test('unmigrated mechanical selectors still map only to the remaining native roots', () => {
  const menu = read('../components/menu.vue')
  const input = read('../components/Input-field.vue')
  const bot = read('../views/chat/components/botmsg.vue')
  const knowledge = read('../views/knowledge/KnowledgeBase.vue')
  for (const token of ['aside_box', 'menu_item', 'menu_top', 'menu_bottom']) assert.ok(menu.includes(token))
  for (const token of ['rich-input-container', '<t-textarea', 'model-selector-trigger', 'control-right']) assert.ok(input.includes(token))
  for (const token of ['bot_msg', 'content-wrapper', 'ai-markdown-template markdown-content', 'answer-toolbar']) assert.ok(bot.includes(token))
  for (const token of ['knowledge-layout', 'document-header', 'document-breadcrumb', 'knowledge-main', 'doc-filter-bar', 'doc-card-list']) assert.ok(knowledge.includes(token))
})

test('source/index palette adapter cannot restyle the excluded processing timeline', () => {
  const css = read('./musuw-reference-citation-sources.css')
  assert.match(css, /\.refer:not\(\.refer-timeline\)/)
  assert.equal(css.includes('.refer-timeline{'), false)
})
