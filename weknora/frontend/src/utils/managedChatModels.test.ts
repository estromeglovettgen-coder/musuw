import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MANAGED_CHAT_MODEL_IDS,
  filterManagedChatModels,
  resolveManagedChatModelId,
} from './managedChatModels'

const models = [
  { id: 'custom-chat-model', type: 'KnowledgeQA', name: 'custom' },
  { id: 'builtin-deepseek-v4-pro', type: 'KnowledgeQA', name: 'deepseek-v4-pro' },
  { id: 'builtin-deepseek-v4-flash', type: 'KnowledgeQA', name: 'deepseek-v4-flash' },
]

test('managed chat exposes only Flash and Pro in the product order', () => {
  assert.deepEqual(
    filterManagedChatModels(models).map((model) => model.id),
    [...MANAGED_CHAT_MODEL_IDS],
  )
})

test('managed chat rejects stale model selections and falls back to Flash', () => {
  const available = filterManagedChatModels(models)

  assert.equal(resolveManagedChatModelId('custom-chat-model', available), 'builtin-deepseek-v4-flash')
  assert.equal(resolveManagedChatModelId('builtin-deepseek-v4-flash', available), 'builtin-deepseek-v4-flash')
})
