import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('citation source and click surfaces stay on the pre-Task1 business baseline', () => {
  const sources = new Map([
    ['../views/chat/components/docInfo.vue', '927afa7a36e30a65fe4695e1e40aaa3664b4dbfe'],
    ['../components/ChatCitationFloat.vue', 'b2a42b84fc7a76ecbe8fb5f1c8079dddf6ef555b'],
    ['../components/ChatReferencesDrawer.vue', '9001acea76aae131cc7420f3e1ffd275b58fce52'],
    ['../composables/useChatCitationPopover.ts', 'b1142ec34ee9dec81600e6f3bda0c418cd478967'],
  ])
  for (const [path, sha] of sources) {
    assert.equal(blobSha(read(path)), sha, `${path} must keep its original click/navigation behavior`)
  }
})

test('mechanical CSS selectors still map to the native WeKnora DOM', () => {
  const menu = read('../components/menu.vue')
  const input = read('../components/Input-field.vue')
  const bot = read('../views/chat/components/botmsg.vue')
  const knowledge = read('../views/knowledge/KnowledgeBase.vue')
  const settings = read('../views/settings/Settings.vue')

  for (const token of ['aside_box', 'menu_item', 'menu_top', 'menu_bottom']) assert.ok(menu.includes(token))
  for (const token of ['rich-input-container', '<t-textarea', 'model-selector-trigger', 'control-right']) assert.ok(input.includes(token))
  for (const token of ['bot_msg', 'content-wrapper', 'ai-markdown-template markdown-content', 'answer-toolbar']) assert.ok(bot.includes(token))
  for (const token of ['knowledge-layout', 'document-header', 'document-breadcrumb', 'knowledge-main', 'doc-filter-bar', 'doc-card-list']) assert.ok(knowledge.includes(token))
  for (const token of ['settings-overlay', 'settings-modal', 'settings-sidebar', 'settings-content', 'content-wrapper']) assert.ok(settings.includes(token))
})

test('source/index palette adapter cannot restyle the excluded processing timeline', () => {
  const css = read('./musuw-reference-citation-sources.css')
  assert.match(css, /\.refer:not\(\.refer-timeline\)/)
  assert.equal(css.includes('.refer-timeline{'), false)
})
