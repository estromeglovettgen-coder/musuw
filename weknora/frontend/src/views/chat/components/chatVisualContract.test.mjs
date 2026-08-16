import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relativePath) => readFileSync(join(here, relativePath), 'utf8')

const agent = read('AgentStreamDisplay.vue')
const rag = read('RagPipelineProgress.vue')
const input = read('../../../components/Input-field.vue')
const createChat = read('../../creatChat/creatChat.vue')
const chat = read('../index.vue')

test('new chat keeps greeting, starter cards, and composer on one reading column', () => {
  assert.match(createChat, /\.dialogue-answers\s*\{[\s\S]*max-width:\s*640px/)
  assert.match(createChat, /\.dialogue-title\s*\{[\s\S]*font-size:\s*24px/)
  assert.match(createChat, /\.suggested-questions-container\s*\{[\s\S]*max-width:\s*640px/)
  assert.doesNotMatch(createChat, /transform:\s*translateX\(-(?:250|329)px\)/)
})

test('composer preserves every existing action surface', () => {
  for (const className of [
    'control-btn image-upload-btn',
    'control-btn attachment-upload-btn',
    'control-btn kb-btn',
    'control-btn stop-btn',
    'control-btn send-btn',
  ]) {
    assert.equal((input.match(new RegExp(`class="${className}"`, 'g')) || []).length, 1, className)
  }
  assert.match(input, /@mousedown\.prevent="triggerMention"/)
  assert.match(input, /@click="createSession\(query\)"/)
})

test('agent and RAG timelines use one shared rail and aligned reasoning body', () => {
  for (const source of [agent, rag]) {
    assert.match(source, /--agent-step-rail-offset:\s*28px/)
    assert.match(source, /--agent-step-rail-x:\s*8px/)
    assert.match(source, /padding-left:\s*var\(--agent-step-rail-offset\)/)
    assert.match(source, /left:\s*var\(--agent-step-rail-x\)|left:\s*calc\(-1 \* var\(--agent-step-rail-offset\)\)/)
    assert.doesNotMatch(source, /padding-left:\s*42px/)
    assert.doesNotMatch(source, /margin-left:\s*10px/)
    assert.doesNotMatch(source, /bottom:\s*-18px/)
  }
  assert.match(agent, /\.event-item:not\(\.tree-child\) \.thinking-detail-content\s*\{[\s\S]*padding-left:\s*24px/)
  assert.match(agent, /\.thinking-inline-content\s*\{[\s\S]*margin-top:\s*0/)
  assert.match(rag, /\.rag-thinking-step\s*\{[\s\S]*\.thinking-detail-content\s*\{[\s\S]*margin-top:\s*0/)
})

test('chat presentation honors reduced motion without changing message flow', () => {
  for (const source of [createChat, input, chat, agent, rag]) {
    assert.match(source, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  }
  assert.match(chat, /\.msg_list\s*\{[\s\S]*gap:\s*24px/)
  assert.match(chat, /\.input-container\s*\{[\s\S]*max-width:\s*640px/)
})
