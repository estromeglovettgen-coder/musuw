<template>
  <section v-if="visible" ref="rootElement" class="visual-rag-pipeline">
    <div class="visual-rag-pipeline__sr" role="status" aria-live="polite">{{ liveStatusText }}</div>

    <button
      v-if="showCollapsedRoot"
      type="button"
      class="visual-rag-pipeline__summary"
      :aria-expanded="showExpandedTimeline"
      :aria-label="collapsedStatusText"
      @click="toggleExpanded"
    >
      <span>{{ collapsedStatusText }}</span>
      <span v-if="referenceSummaryText" class="visual-rag-pipeline__reference-summary">{{ referenceSummaryText }}</span>
      <t-icon name="chevron-down" :class="{ 'is-folded': !showExpandedTimeline }" />
    </button>

    <div v-if="showExpandedTimeline" class="visual-rag-timeline">
      <div v-if="showPrePipelineWait" class="visual-rag-step is-running">
        <span class="visual-rag-step__rail" aria-hidden="true"><span class="visual-rag-step__spinner" /></span>
        <div class="visual-rag-step__body"><strong>{{ t('chat.preparingAnswer') }}</strong></div>
      </div>

      <button
        v-for="step in steps"
        :key="step.id"
        type="button"
        class="visual-rag-step"
        :class="{ 'is-running': step.pending, 'is-clickable': step.canOpenReferences }"
        :disabled="!step.canOpenReferences"
        @click="handleStepClick(step)"
      >
        <span class="visual-rag-step__rail" aria-hidden="true">
          <span v-if="step.pending" class="visual-rag-step__spinner" />
          <t-icon v-else :name="step.iconName" />
        </span>
        <span class="visual-rag-step__body">
          <strong>{{ step.title }}</strong>
          <span v-if="step.summaryHtml" class="visual-rag-step__summary" v-html="step.summaryHtml" />
        </span>
        <t-icon v-if="step.canOpenReferences" name="chevron-right" class="visual-rag-step__open" />
      </button>

      <div v-if="showWaitStep" class="visual-rag-step" :class="{ 'is-running': !waitStepStalled, 'is-stalled': waitStepStalled }">
        <span class="visual-rag-step__rail" aria-hidden="true">
          <span v-if="!waitStepStalled" class="visual-rag-step__spinner" />
          <t-icon v-else name="time" />
        </span>
        <div class="visual-rag-step__body"><strong>{{ waitStepText }}</strong></div>
      </div>

      <div v-if="showThinkingStep" class="visual-rag-step visual-rag-thinking" :class="{ 'is-running': thinkingPending }">
        <span class="visual-rag-step__rail" aria-hidden="true">
          <span v-if="thinkingPending" class="visual-rag-step__spinner" />
          <t-icon v-else name="lightbulb" />
        </span>
        <div class="visual-rag-step__body">
          <button
            type="button"
            class="visual-rag-thinking__toggle"
            :disabled="!thinkingContent"
            @click="toggleThinking"
          >
            <strong>{{ t('agent.think') }}</strong>
            <t-icon v-if="thinkingContent" name="chevron-down" :class="{ 'is-folded': !thinkingExpanded }" />
          </button>
          <div v-if="thinkingContent && thinkingExpanded" class="visual-rag-thinking__content">{{ thinkingContent }}</div>
        </div>
      </div>

      <div v-if="showDoneRow" class="visual-rag-step is-done">
        <span class="visual-rag-step__rail" aria-hidden="true"><t-icon name="check-circle" /></span>
        <div class="visual-rag-step__body"><strong>{{ t('common.finish') }}</strong></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAgentToolIconName } from '@/utils/agent-tool-icons'
import { getKnowledgeSearchSummaryHtml, getRagPipelineStepTitle, getRetrievalSearchSource } from '@/utils/agent-tool-display'
import { getAttachmentParsingSummaryHtml } from '@/utils/attachmentParsingDisplay'
import { RAG_RETRIEVAL_TOOL_NAMES, RAG_TIMELINE_TOOL_NAMES } from '@/utils/rag-pipeline-history'
import { useChatReferencesDrawer } from '@/composables/useChatReferencesDrawer'
import { buildReferenceSections } from '@/utils/referenceSources'
import { createRagWaitController, getRagPipelineWaitKind, type RagWaitView } from '@/utils/rag-pipeline-state'

const props = defineProps<{
  session?: {
    id?: string | number
    agentEventStream?: Array<Record<string, unknown>>
    content?: string
    knowledge_references?: Array<{ chunk_type?: string; knowledge_id?: string; knowledge_title?: string }>
    is_completed?: boolean
  }
  embeddedMode?: boolean
}>()

const { t } = useI18n()
const referencesDrawer = useChatReferencesDrawer()
const userExpanded = ref(false)
const thinkingExpanded = ref(true)
const rootElement = ref<HTMLElement | null>(null)
const waitView = ref<RagWaitView>({ kind: 'none', stalled: false })
const waitController = createRagWaitController((view) => { waitView.value = view })

const thinkingContent = computed(() => {
  const stream = props.session?.agentEventStream
  if (!Array.isArray(stream)) return ''
  return stream.filter((event) => event.type === 'thinking').map((event) => String(event.content || '')).join('')
})
const hasThinking = computed(() => thinkingContent.value.trim().length > 0)
const hasThinkingEvent = computed(() => {
  const stream = props.session?.agentEventStream
  if (!Array.isArray(stream)) return false
  return stream.some((event) => event.type === 'thinking')
})
const hasAnswer = computed(() => {
  const sessionContent = props.session?.content
  if (typeof sessionContent === 'string' && sessionContent.trim().length > 0) return true
  const stream = props.session?.agentEventStream
  if (!stream?.length) return false
  return stream.some((event) => {
    if (event.type !== 'answer' || event.superseded) return false
    const content = event.content
    return typeof content === 'string' && content.trim().length > 0
  })
})
const hasReferences = computed(() => (props.session?.knowledge_references?.length ?? 0) > 0)
const referenceSections = computed(() => buildReferenceSections(props.session?.knowledge_references))

const steps = computed(() => {
  const stream = props.session?.agentEventStream
  if (!stream?.length) return []
  return stream
    .filter((event) => event.type === 'tool_call' && typeof event.tool_name === 'string' && RAG_TIMELINE_TOOL_NAMES.has(event.tool_name))
    .map((event) => {
      const toolName = String(event.tool_name)
      const pending = event.pending === true
      const toolData = event.tool_data && typeof event.tool_data === 'object' ? (event.tool_data as Record<string, unknown>) : null
      const isSearchTool = RAG_RETRIEVAL_TOOL_NAMES.has(toolName)
      const isAttachmentTool = toolName === 'attachment_parsing' || toolName === 'image_analysis'
      const searchSource = isSearchTool ? getRetrievalSearchSource(event.arguments, toolData) : undefined
      let summaryHtml = ''
      if (!pending && isSearchTool && toolData) summaryHtml = getKnowledgeSearchSummaryHtml(t, toolData)
      else if (!pending && isAttachmentTool) summaryHtml = getAttachmentParsingSummaryHtml(t, event)
      const canOpenReferences = !pending && isSearchTool && hasReferences.value
      return {
        id: String(event.tool_call_id || `${toolName}-${event.timestamp || 0}`),
        toolName,
        pending,
        iconName: getAgentToolIconName(toolName, searchSource),
        title: getRagPipelineStepTitle(t, {
          tool_name: toolName,
          pending,
          success: event.success as boolean | undefined,
          arguments: event.arguments,
          tool_data: toolData,
        }),
        summaryHtml,
        canOpenReferences,
      }
    })
})

const allStepsDone = computed(() => steps.value.length > 0 && steps.value.every((step) => !step.pending))
const hasCompletedRetrievalStep = computed(() => steps.value.some((step) => RAG_RETRIEVAL_TOOL_NAMES.has(step.toolName) && !step.pending))
const waitKind = computed(() => getRagPipelineWaitKind({
  isCompleted: Boolean(props.session?.is_completed),
  hasAnswer: hasAnswer.value,
  hasThinkingEvent: hasThinkingEvent.value,
  stepCount: steps.value.length,
  allStepsDone: allStepsDone.value,
  hasCompletedRetrievalStep: hasCompletedRetrievalStep.value,
}))
const showWaitStep = computed(() => waitView.value.kind !== 'none')
const waitStepStalled = computed(() => waitView.value.stalled)
const waitStepText = computed(() => {
  if (waitView.value.stalled) return t('chat.modelStillResponding')
  return waitView.value.kind === 'model' ? t('chat.connectingModelAndGeneratingAnswer') : t('chat.preparingAnswer')
})
const showCollapsedRoot = computed(() => (hasAnswer.value || Boolean(props.session?.is_completed)) && (steps.value.length > 0 || hasThinking.value))
const showExpandedTimeline = computed(() => !showCollapsedRoot.value || userExpanded.value)
const showDoneRow = computed(() => {
  const turnDone = hasAnswer.value || Boolean(props.session?.is_completed)
  if (!turnDone) return false
  if (steps.value.length > 0 && !allStepsDone.value) return false
  return true
})
const showPrePipelineWait = computed(() => !(hasAnswer.value || props.session?.is_completed || steps.value.length > 0 || hasThinking.value))
const showThinkingStep = computed(() => hasThinkingEvent.value)
const thinkingPending = computed(() => showThinkingStep.value && !hasThinking.value && !hasAnswer.value && !props.session?.is_completed)
const isThinkingStreaming = computed(() => showThinkingStep.value && thinkingExpanded.value && !hasAnswer.value && !props.session?.is_completed)
const visible = computed(() => steps.value.length > 0 || showPrePipelineWait.value || showThinkingStep.value)
const liveStatusText = computed(() => {
  if (showPrePipelineWait.value) return t('chat.preparingAnswer')
  if (showWaitStep.value) return waitStepText.value
  return ''
})
const collapsedStatusText = computed(() => {
  if (steps.value.length === 0) return hasThinking.value ? t('agentStream.toolStatus.thinkingDone') : ''
  return t('agentStream.ragPipeline.searchDone')
})
const referenceSummaryText = computed(() => {
  const docCount = referenceSections.value.find((section) => section.id === 'documents')?.items.length ?? 0
  const webCount = referenceSections.value.find((section) => section.id === 'web')?.items.length ?? 0
  if (docCount > 0 && webCount > 0) return t('chat.referencesDocAndWebCount', { docCount, webCount })
  if (docCount > 0) return t('chat.referencesDocCount', { count: docCount })
  if (webCount > 0) return t('chat.referencesWebCount', { count: webCount })
  return ''
})

function toggleReferencesDrawer() {
  const refs = props.session?.knowledge_references
  if (!referencesDrawer || !refs?.length) return
  referencesDrawer.toggle({
    references: refs,
    highlight: null,
    messageId: props.session?.id ? String(props.session.id) : '',
    sourceKey: `rag:${props.session?.id || refs.map((item) => item.knowledge_id || item.knowledge_title).join('|')}`,
  })
}
function handleStepClick(step: { canOpenReferences?: boolean }) { if (step.canOpenReferences) toggleReferencesDrawer() }
function toggleExpanded() { userExpanded.value = !userExpanded.value }
function toggleThinking() { if (showThinkingStep.value && thinkingContent.value) thinkingExpanded.value = !thinkingExpanded.value }
function scrollThinkingDetailToBottom() {
  nextTick(() => {
    if (!rootElement.value) return
    rootElement.value.querySelectorAll('.visual-rag-thinking__content').forEach((el) => {
      const htmlEl = el as HTMLElement
      htmlEl.scrollTop = htmlEl.scrollHeight
    })
  })
}

watch(thinkingPending, (pending) => { if (pending) thinkingExpanded.value = true })
watch(waitKind, (kind) => waitController.update(kind), { immediate: true })
watch(hasAnswer, (answered) => { if (answered && hasThinking.value) thinkingExpanded.value = false })
watch(thinkingContent, () => { if (isThinkingStreaming.value) scrollThinkingDetailToBottom() })
watch(thinkingExpanded, (expanded) => { if (expanded && isThinkingStreaming.value) scrollThinkingDetailToBottom() })
onBeforeUnmount(() => { waitController.dispose() })
</script>

<style scoped lang="less">
.visual-rag-pipeline { width: 100%; margin: 0 0 12px; color: #6b7280; }
.visual-rag-pipeline__sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.visual-rag-pipeline__summary { margin-left: -6px; padding: 4px 6px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #6b7280; font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; transition: color 150ms ease, background-color 150ms ease; }
.visual-rag-pipeline__summary:hover { background: rgb(243 244 246 / 60%); color: #111827; }
.visual-rag-pipeline__reference-summary { display: inline-flex; align-items: center; gap: 5px; color: #9ca3af; font-size: 11px; }
.visual-rag-pipeline__reference-summary::before { content: ''; width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
.visual-rag-pipeline__summary :deep(.t-icon) { flex: 0 0 14px; width: 14px; height: 14px; font-size: 14px; color: #9ca3af; transition: transform 200ms ease; }
.visual-rag-pipeline__summary :deep(.t-icon).is-folded { transform: rotate(-90deg); }
.visual-rag-timeline { position: relative; margin: 10px 0 8px; padding: 4px 0 0 4px; }
.visual-rag-step { position: relative; width: 100%; min-height: 16px; padding: 0 0 14px; border: 0; display: flex; align-items: flex-start; gap: 14px; background: transparent; color: #6b7280; font: inherit; text-align: left; }
.visual-rag-step:last-child { padding-bottom: 4px; }
button.visual-rag-step { cursor: default; }
button.visual-rag-step.is-clickable { cursor: pointer; }
button.visual-rag-step.is-clickable:hover .visual-rag-step__body strong { color: #111827; }
.visual-rag-step__rail { position: relative; z-index: 1; flex: 0 0 16px; width: 16px; height: 16px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #9ca3af; transition: color 150ms ease; }
.visual-rag-step:not(:last-child) .visual-rag-step__rail::after { content: ''; position: absolute; top: 18px; bottom: -14px; left: 50%; width: 1px; background: #e5e7eb; transform: translateX(-50%); }
.visual-rag-step:hover .visual-rag-step__rail { color: #374151; }
.visual-rag-step__rail :deep(.t-icon) { width: 14px; height: 14px; font-size: 14px; }
.visual-rag-step__spinner { width: 12px; height: 12px; border: 1.5px solid #9ca3af; border-right-color: transparent; border-radius: 50%; animation: visual-rag-spin .8s linear infinite; }
.visual-rag-step__body { min-width: 0; flex: 1 1 auto; padding-top: .5px; display: flex; flex-direction: column; gap: 2px; }
.visual-rag-step__body strong { color: #374151; font-size: 12.5px; line-height: 1.625; font-weight: 500; transition: color 150ms ease; }
.visual-rag-step.is-running .visual-rag-step__body strong { color: #6b7280; font-weight: 400; }
.visual-rag-step.is-stalled .visual-rag-step__body strong { color: #9ca3af; }
.visual-rag-step.is-done .visual-rag-step__body strong { color: #1f2937; }
.visual-rag-step__summary { color: #9ca3af; font-size: 11px; line-height: 1.375; letter-spacing: -.01em; }
.visual-rag-step__summary :deep(strong) { color: #6b7280; font-size: inherit; font-weight: 600; }
.visual-rag-step__open { flex: 0 0 14px; margin-top: 1px; width: 14px; height: 14px; font-size: 14px; color: #9ca3af; }
.visual-rag-thinking__toggle { width: 100%; padding: 0; border: 0; display: flex; align-items: center; justify-content: space-between; gap: 6px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.visual-rag-thinking__toggle:disabled { cursor: default; }
.visual-rag-thinking__toggle :deep(.t-icon) { flex: 0 0 14px; width: 14px; height: 14px; font-size: 14px; color: #9ca3af; transition: transform 200ms ease; }
.visual-rag-thinking__toggle :deep(.t-icon).is-folded { transform: rotate(-90deg); }
.visual-rag-thinking__content { max-height: 220px; overflow-y: auto; margin-top: 6px; padding: 0; color: #9ca3af; font-size: 11px; line-height: 1.375; letter-spacing: -.01em; white-space: pre-wrap; word-break: break-word; }
@keyframes visual-rag-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .visual-rag-step__spinner { animation: none; } .visual-rag-pipeline__summary,.visual-rag-step__body strong,.visual-rag-step__rail,.visual-rag-thinking__toggle :deep(.t-icon) { transition: none !important; } }
</style>
