import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const controller = readFileSync(
  new URL('../../assets/business-baselines/KnowledgeBaseList.pre-view.vue', import.meta.url),
  'utf8',
)
const api = readFileSync(
  new URL('../../api/knowledge-base/index.ts', import.meta.url),
  'utf8',
)

test('duplicate UI reuses the native content-copy endpoint and refreshes without navigation', () => {
  const duplicateRequest = api.match(
    /export function duplicateKnowledgeBase\(id: string\) \{[\s\S]*?\n\}/,
  )?.[0] ?? ''
  const duplicateFlow = controller.match(
    /const duplicateKB = async \(id: string\) => \{[\s\S]*?\n\}/,
  )?.[0] ?? ''

  assert.match(duplicateRequest, /return copyKnowledgeBase\(\{ source_id: id \}\)/)
  assert.doesNotMatch(duplicateRequest, /post\(/)
  assert.doesNotMatch(duplicateRequest, /\/duplicate/)
  assert.match(duplicateFlow, /await duplicateKnowledgeBase\(id\)/)
  assert.match(duplicateFlow, /await fetchList\(true\)/)
  assert.doesNotMatch(duplicateFlow, /goDetail|router\.(?:push|replace)/)
})
