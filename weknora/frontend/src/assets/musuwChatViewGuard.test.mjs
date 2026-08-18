import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('rebuilt chat message surfaces expose visual roots without legacy shells', () => {
  const cases = [
    ['../views/chat/components/usermsg.vue', 'class="visual-user-message"', ['class="user_msg_container"', 'class="user_msg"', 'class="mentioned_tag"', 'class="user_attachment_card"']],
    ['../views/chat/components/botmsg.vue', 'class="visual-assistant-message"', ['class="bot_msg"', 'class="content-wrapper"', 'class="answer-toolbar"', 'class="mentioned_tag"']],
    ['../views/chat/components/docInfo.vue', 'class="visual-answer-references"', ['class="refer"', 'class="refer_header"', 'class="doc-group"', 'class="doc doc-web"']],
  ]
  for (const [path, root, legacy] of cases) {
    const source = read(path)
    assert.ok(source.includes(root), `${path} lost ${root}`)
    for (const token of legacy) assert.equal(source.includes(token), false, `${path} still contains ${token}`)
  }
})

test('assistant visual surface still exposes all non-reference native answer states', () => {
  const source = read('../views/chat/components/botmsg.vue')
  for (const token of [
    'session.isRagMode',
    'session.isAgentMode',
    'session.showThink',
    'session.hideContent',
    'answerFullyRendered',
    'session.is_fallback',
    'followUpLoading',
    'isImgLoading',
    'RagPipelineProgress',
    'AgentStreamDisplay',
    'deepThink',
    'ChatRequestInfoButton',
    'ChatCitationFloat',
  ]) assert.ok(source.includes(token), `botmsg lost state surface: ${token}`)
})

test('user message visual surface keeps image and attachment preview affordances', () => {
  const source = read('../views/chat/components/usermsg.vue')
  for (const token of [
    'hydrateProtectedFileImages',
    'isPreviewableAttachment',
    'resolveAttachmentFileType',
    'attachmentPreviewDrawer.open({',
    'reviewImg.value = true',
    'visual-user-message__images',
    'visual-user-message__attachments',
  ]) assert.ok(source.includes(token), `usermsg lost ${token}`)
})
