import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('frozen chat parent controller remains the original implementation', () => {
  assert.equal(
    blobSha(read('./business-baselines/ChatIndex.pre-view.vue')),
    'f2f5ceb08d7e6f2ee36ea12f8a67eea15b9c9612',
  )
})

test('rebuilt chat parent reuses normalized frozen setup without legacy shell classes', () => {
  const source = read('../views/chat/index.vue')
  assert.match(source, /import LegacyChatBusiness from .*ChatIndex\.pre-view\.vue/)
  assert.match(source, /const legacySetup = legacy\.setup/)
  assert.match(source, /return \{ \.\.\.state \}/)
  assert.match(source, /class="visual-chat-view"/)
  for (const token of [
    'class="chat"',
    'class="chat_scroll_box"',
    'class="msg_list"',
    'class="input-container"',
    'class="suggested-questions-container"',
  ]) assert.equal(source.includes(token), false, `chat parent still exposes ${token}`)
})

test('rebuilt chat layout retains history, suggestions, stream wait, follow-ups, composer and drawers', () => {
  const source = read('../views/chat/index.vue')
  for (const token of [
    'historyLoading && messagesList.length === 0',
    'suggestedQuestionsLoading',
    'fetchSuggestedQuestions',
    ':key="session.id || `${session.role}-${session.created_at}-${index}`"',
    'shouldRenderAssistantMessage(session)',
    'handleAnswerRenderComplete(session, ready)',
    'FollowUpSuggestions',
    'showGlobalTypingIndicator',
    'userHasScrolledUp',
    'onClickScrollToBottom',
    'InputField',
    'handleStopGeneration',
    'ChatReferencesDrawer',
    'ChatAttachmentPreviewDrawer',
  ]) assert.ok(source.includes(token), `chat parent lost ${token}`)
})
