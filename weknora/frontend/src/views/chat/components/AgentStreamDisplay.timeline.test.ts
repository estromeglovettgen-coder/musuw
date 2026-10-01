import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { computed, reactive, ref } from 'vue'
import { thinkingEqualsAnswer } from '../../../utils/finalAnswer'

// Run the component's actual timeline getters with Vue's computed caching.
// In particular, reading the collapse state first matches template rendering
// and catches dependencies that otherwise change which thinking card is shown.
const source = readFileSync(new URL('./AgentStreamDisplay.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const ast = ts.createSourceFile('AgentStreamDisplay.ts', descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true)
const names = [
  'hasAnswerStarted', 'isConversationDone', 'finalContent', 'intermediateStepsCount',
  'reasoningRoundsCount', 'toolCallsCount', 'intermediateStepsSummary',
  'shouldShowCollapsedSteps', 'isThinkingLikeEvent', 'getThinkingContent',
  'buildFullEventList', 'hiddenThinkingEventIds', 'intermediateEvents',
  'visibleIntermediateEvents', 'displayEvents',
]
const declarations = names.map(name => {
  const statement = ast.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name))
  assert.ok(statement, `Missing component timeline binding: ${name}`)
  return statement.getText(ast)
})
const javascript = ts.transpileModule(`${declarations.join('\n')}\nreturn { ${names.join(', ')} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText

function timeline(stream: any[], steps?: any[]) {
  const props = reactive({ ragMode: false, session: { agent_steps: steps } })
  const eventStream = ref(stream)
  const state = new Function('context', `const { computed, props, eventStream, agentDurationMs, t, formatDuration, thinkingEqualsAnswer } = context; ${javascript}`)({
    computed, props, eventStream, agentDurationMs: ref(0), thinkingEqualsAnswer,
    t: (key: string, values?: Record<string, number>) => key === 'agent.reasoningRounds'
      ? `${values!.rounds} rounds` : key === 'agent.toolCalls' ? `${values!.tools} tools` : ' · ',
    formatDuration: (value: number) => String(value),
  })
  return { ...state, eventStream, props }
}

function fiftyRoundsWithEmptySynthesis() {
  const events: any[] = []
  let round = 0
  // Eight pairs of adjacent reasoning events merge into single cards. The
  // remaining 34 cards each represent one round: 50 rounds, 42 visible cards.
  for (let card = 0; card < 42; card += 1) {
    for (let part = 0; part < (card < 8 ? 2 : 1); part += 1) {
      events.push({ type: 'thinking', event_id: `thought-${round}`, content: `Reasoning round ${round}.`, done: true })
      round += 1
    }
    if (card < 41) events.push({ type: 'tool_call', tool_call_id: `tool-${card}`, tool_name: 'web_search', pending: false })
  }
  events.push({ type: 'answer', event_id: 'synthesis', content: '', done: true })
  events.push({ type: 'agent_complete', total_steps: 50 })
  return events
}

test('empty synthesis reports all 50 executed rounds and keeps all 42 merged thinking cards', () => {
  const fixture = fiftyRoundsWithEmptySynthesis()
  assert.equal(fixture.filter(event => event.type === 'thinking').length, 50)
  for (const firstRead of ['tree', 'summary']) {
    const app = timeline(fixture)
    assert.equal(app.buildFullEventList(fixture).filter((event: any) => event.type === 'thinking').length, 42)
    if (firstRead === 'tree') assert.equal(app.shouldShowCollapsedSteps.value, true)
    else void app.intermediateStepsSummary.value
    assert.equal(app.reasoningRoundsCount.value, 50, `${firstRead} first must use the completion contract`)
    assert.equal(app.intermediateStepsSummary.value, '50 rounds · 41 tools')
    const thinking = app.visibleIntermediateEvents.value.filter((event: any) => event.type === 'thinking')
    assert.equal(thinking.length, 42, `${firstRead} first must preserve the final thinking card`)
    assert.equal(thinking.at(-1).event_id, 'thought-49')
    assert.equal(app.hiddenThinkingEventIds.value.size, 0)
    assert.equal(app.finalContent.value, null, 'empty synthesis must not promote reasoning to an answer')
  }
})

test('history counts persisted execution rounds even when some rounds contain no reasoning text', () => {
  const fixture = fiftyRoundsWithEmptySynthesis().filter(event => event.type !== 'agent_complete')
  const steps = Array.from({ length: 50 }, (_, iteration) => ({ iteration }))
  const app = timeline(fixture, steps)
  assert.equal(app.reasoningRoundsCount.value, 50)
  assert.equal(app.visibleIntermediateEvents.value.filter((event: any) => event.type === 'thinking').length, 42)
  app.props.session.agent_steps = steps.map(() => ({}))
  assert.equal(app.reasoningRoundsCount.value, 50, 'older history without iteration retains its execution-step count')
})

test('live reasoning is counted before merging when completion metadata is absent', () => {
  const fixture = fiftyRoundsWithEmptySynthesis().filter(event => event.type !== 'agent_complete')
  const app = timeline(fixture)
  assert.equal(app.shouldShowCollapsedSteps.value, true)
  assert.equal(app.reasoningRoundsCount.value, 50)
  assert.equal(app.visibleIntermediateEvents.value.filter((event: any) => event.type === 'thinking').length, 42)
  app.eventStream.value.push({ type: 'agent_complete', total_steps: 51 })
  assert.equal(app.reasoningRoundsCount.value, 51, 'the completed final answer round may have no thinking event')
})

test('real answer duplicates remain hidden without hiding distinct intermediate reasoning', () => {
  const app = timeline([
    { type: 'thinking', event_id: 'research', content: 'Look up the evidence.', done: true },
    { type: 'tool_call', tool_call_id: 'lookup', tool_name: 'web_search', pending: false },
    { type: 'thinking', event_id: 'answer-copy', content: 'Here is the final answer.', done: true },
    { type: 'answer', event_id: 'answer', content: 'Here is the final answer.', done: true },
    { type: 'agent_complete', total_steps: 2 },
  ])
  assert.equal(app.shouldShowCollapsedSteps.value, true)
  assert.equal(app.reasoningRoundsCount.value, 2)
  assert.deepEqual(app.visibleIntermediateEvents.value.filter((event: any) => event.type === 'thinking')
    .map((event: any) => event.event_id), ['research'])
  assert.deepEqual(app.displayEvents.value.map((event: any) => event.content), ['Here is the final answer.'])

  const answerOnly = timeline([
    { type: 'thinking', event_id: 'answer-copy', content: 'Here is the final answer.', done: true },
    { type: 'answer', event_id: 'answer', content: 'Here is the final answer.', done: true },
    { type: 'agent_complete', total_steps: 1 },
  ])
  assert.equal(answerOnly.shouldShowCollapsedSteps.value, false, 'duplicate answer reasoning must not create an empty steps tree')
  assert.equal(answerOnly.displayEvents.value.length, 1)
})
