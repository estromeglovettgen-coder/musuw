import assert from 'node:assert/strict'
import test from 'node:test'
import { userFacingAIError } from './userFacingAIError'

test('hides provider internals behind the localized fallback', () => {
  const fallback = 'AI service is temporarily unavailable'
  assert.equal(
    userFacingAIError(
      'LLM call failed: Post "https://openrouter.ai/api/v1/chat/completions": OPENROUTER_MANAGEMENT_API_KEY is not configured',
      fallback,
    ),
    fallback,
  )
})

test('keeps ordinary actionable errors', () => {
  assert.equal(userFacingAIError('Attachment is still processing', 'fallback'), 'Attachment is still processing')
  assert.equal(userFacingAIError('', 'fallback'), 'fallback')
})
