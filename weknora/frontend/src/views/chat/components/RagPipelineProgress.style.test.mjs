import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'RagPipelineProgress.vue'), 'utf8')

test('RAG timeline preserves pending, tool, thinking, done, and collapsed states', () => {
  for (const token of [
    'showPrePipelineWait', 'v-for="step in steps"', 'showWaitStep', 'showThinkingStep',
    'showDoneRow', 'showCollapsedRoot', 'showExpandedTimeline', 'toggleExpanded',
    'getAgentToolIconName', 'getRagPipelineStepTitle', 'getAttachmentParsingSummaryHtml',
  ]) assert.ok(source.includes(token), `RAG timeline lost ${token}`)
})

test('RAG timeline uses the native wait controller and a stable live region', () => {
  assert.match(source, /class="visual-rag-pipeline__sr" role="status" aria-live="polite"/)
  assert.match(source, /createRagWaitController/)
  assert.match(source, /getRagPipelineWaitKind/)
  assert.match(source, /waitController\.dispose\(\)/)
  assert.match(source, /chat\.connectingModelAndGeneratingAnswer/)
  assert.match(source, /chat\.modelStillResponding/)
})

test('RAG retrieval opens the shared references drawer and keeps thinking scroll behavior', () => {
  assert.match(source, /useChatReferencesDrawer/)
  assert.match(source, /canOpenReferences/)
  assert.match(source, /handleStepClick/)
  assert.match(source, /referencesDrawer\.toggle\(/)
  assert.match(source, /scrollThinkingDetailToBottom/)
  assert.match(source, /watch\(thinkingContent/)
})

test('RAG visual layer is compact, clickable only when actionable, and reduced-motion safe', () => {
  assert.match(source, /button\.visual-rag-step\.is-clickable \{ cursor: pointer; \}/)
  assert.match(source, /\.visual-rag-step\s*\{[^\n]*padding: 0 0 14px/)
  assert.match(source, /\.visual-rag-thinking__content \{ max-height: 220px; overflow-y: auto;/)
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/)
})
