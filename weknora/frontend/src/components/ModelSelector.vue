<template>
  <div class="visual-model-selector" :class="{ 'visual-model-selector--chat': mode === 'chat' }">
    <template v-if="mode === 'chat'">
      <section
        class="visual-model-selector__chat-panel"
        :aria-label="chatPanelLabel"
        @keydown="handlePanelKeydown"
      >
        <template v-if="view === 'overview'">
          <button
            ref="overviewFirstRef"
            type="button"
            class="visual-model-selector__chat-row"
            aria-haspopup="listbox"
            @click="openView('models')"
          >
            <span class="visual-model-selector__chat-row-copy">
              <span class="visual-model-selector__chat-row-label">{{ modelLabel }}</span>
              <span class="visual-model-selector__chat-row-value" :title="selectedModelDisplayName">{{ selectedModelDisplayName }}</span>
            </span>
            <t-icon name="chevron-right" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="visual-model-selector__chat-row"
            :class="{ 'is-disabled': !reasoningOptions.length }"
            :aria-disabled="!reasoningOptions.length"
            aria-haspopup="listbox"
            @click="reasoningOptions.length && openView('reasoning')"
          >
            <span class="visual-model-selector__chat-row-copy">
              <span class="visual-model-selector__chat-row-label">{{ reasoningLabel }}</span>
              <span class="visual-model-selector__chat-row-value" :title="selectedReasoningLabel">{{ selectedReasoningLabel }}</span>
            </span>
            <t-icon name="chevron-right" aria-hidden="true" />
          </button>
        </template>

        <template v-else>
          <header class="visual-model-selector__chat-header">
            <button type="button" class="visual-model-selector__chat-back" :aria-label="backLabel" @click="openView('overview')">
              <t-icon name="chevron-left" aria-hidden="true" />
            </button>
            <span class="visual-model-selector__chat-title">{{ view === 'models' ? modelLabel : reasoningLabel }}</span>
            <span class="visual-model-selector__chat-header-spacer" aria-hidden="true" />
          </header>

          <div
            v-if="view === 'models'"
            :id="modelListId"
            ref="modelListRef"
            class="visual-model-selector__chat-list"
            role="listbox"
            tabindex="0"
            :aria-label="modelLabel"
            :aria-activedescendant="activeModelId"
            @keydown="handleModelKeydown"
          >
            <button
              v-for="model in chatModels"
              :id="modelOptionId(model.id || '')"
              :key="model.id"
              type="button"
              role="option"
              tabindex="-1"
              class="visual-model-selector__chat-option"
              :class="{ 'is-selected': model.id === selectedModelId, 'is-active': modelIndex(model.id) === activeModelIndex }"
              :aria-selected="model.id === selectedModelId"
              @mouseenter="activeModelIndex = modelIndex(model.id)"
              @click="selectChatModel(model.id || '')"
            >
              <span class="visual-model-selector__chat-option-copy">
                <strong :title="modelDisplayName(model)">{{ modelDisplayName(model) }}</strong>
              </span>
              <span v-if="model.id === selectedModelId" class="visual-model-selector__chat-check" aria-hidden="true"><t-icon name="check" /></span>
            </button>
            <div v-if="!chatModels.length" class="visual-model-selector__chat-empty">{{ noModelsLabel }}</div>
          </div>

          <div
            v-else
            ref="reasoningListRef"
            class="visual-model-selector__chat-list"
            role="listbox"
            tabindex="0"
            :aria-label="reasoningLabel"
            :aria-activedescendant="activeReasoningId"
            @keydown="handleReasoningKeydown"
          >
            <button
              v-for="(option, index) in reasoningOptions"
              :id="reasoningOptionId(option.value)"
              :key="option.value"
              type="button"
              role="option"
              tabindex="-1"
              class="visual-model-selector__chat-option"
              :class="{ 'is-selected': option.value === reasoningEffort, 'is-active': index === activeReasoningIndex }"
              :aria-selected="option.value === reasoningEffort"
              @mouseenter="activeReasoningIndex = index"
              @click="selectChatReasoning(option.value)"
            >
              <span class="visual-model-selector__chat-option-copy">
                <strong>{{ option.label }}</strong>
              </span>
              <span v-if="option.value === reasoningEffort" class="visual-model-selector__chat-check" aria-hidden="true"><t-icon name="check" /></span>
            </button>
            <div v-if="!reasoningOptions.length" class="visual-model-selector__chat-empty">{{ noReasoningLabel }}</div>
          </div>
        </template>
      </section>
    </template>

    <t-select
      v-else
      :value="selectedModelId"
      @change="handleModelChange"
      :placeholder="placeholderText"
      :disabled="disabled"
      :loading="loading"
      :status="status"
      filterable
      class="visual-model-selector__control"
      style="width: 100%;"
    >
      <t-option
        v-for="model in catalogModels"
        :key="model.id"
        :value="model.id"
        :label="modelDisplayName(model)"
      >
        <div class="visual-model-selector__option">
          <span class="visual-model-selector__option-check" aria-hidden="true">
            <t-icon name="check-circle-filled" />
          </span>
          <span class="visual-model-selector__option-copy">
            <strong :title="modelDisplayName(model)">{{ modelDisplayName(model) }}</strong>
            <small v-if="model.display_name" :title="model.name">{{ model.name }}</small>
          </span>
          <span class="visual-model-selector__badges">
            <span v-if="model.is_builtin" class="visual-model-selector__badge">{{ $t('model.builtinTag') }}</span>
            <span v-if="model.is_default" class="visual-model-selector__badge is-default">{{ $t('model.defaultTag') }}</span>
          </span>
        </div>
      </t-option>

      <t-option v-if="!disabled" value="__add_model__" class="visual-model-selector__add-option">
        <div class="visual-model-selector__option is-add">
          <span class="visual-model-selector__option-check" aria-hidden="true"><t-icon name="add" /></span>
          <span class="visual-model-selector__option-copy"><strong>{{ $t('model.addModelInSettings') }}</strong></span>
        </div>
      </t-option>
    </t-select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { listModels, type ModelConfig } from '@/api/model'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  modelType?: 'KnowledgeQA' | 'Embedding' | 'Rerank' | 'VLLM' | 'ASR'
  selectedModelId?: string
  disabled?: boolean
  placeholder?: string
  status?: 'default' | 'success' | 'warning' | 'error'
  allModels?: ModelConfig[]
  mode?: 'catalog' | 'chat'
  models?: ModelConfig[]
  selectedModelDisplayName?: string
  selectedReasoningLabel?: string
  reasoningOptions?: Array<{ value: string; label: string }>
  reasoningEffort?: string
  view?: 'overview' | 'models' | 'reasoning'
}

const props = withDefaults(defineProps<Props>(), {
  modelType: 'KnowledgeQA',
  disabled: false,
  placeholder: '',
  status: 'default',
  mode: 'catalog',
  models: () => [],
  selectedModelDisplayName: '',
  selectedReasoningLabel: '',
  reasoningOptions: () => [],
  reasoningEffort: 'none',
  view: 'overview',
})

const emit = defineEmits<{
  'update:selectedModelId': [value: string]
  'add-model': []
  'select-model': [value: string]
  'select-reasoning': [value: string]
  'update:view': [value: 'overview' | 'models' | 'reasoning']
  close: []
}>()

const catalogModels = ref<ModelConfig[]>([])
const loading = ref(false)
const { t } = useI18n()

const placeholderText = computed(() => {
  return props.placeholder || t('model.selectModelPlaceholder')
})

const modelDisplayName = (model: ModelConfig) => {
  const displayName = model.display_name?.trim()
  return displayName || model.name
}

watch(() => props.allModels, (newModels) => {
  if (newModels && Array.isArray(newModels)) {
    catalogModels.value = newModels.filter(m => m.type === props.modelType)
  }
}, { immediate: true })

const selectedCatalogModel = computed(() => {
  if (!props.selectedModelId) return null
  return catalogModels.value.find(m => m.id === props.selectedModelId)
})
void selectedCatalogModel

const loadModels = async () => {
  if (props.allModels) {
    return
  }

  loading.value = true
  try {
    const result = await listModels()
    if (result && Array.isArray(result)) {
      catalogModels.value = result.filter(m => m.type === props.modelType)
    } else {
      catalogModels.value = []
    }
  } catch (error) {
    console.error(t('model.loadFailed'), error)
    MessagePlugin.error(t('model.loadFailed'))
    catalogModels.value = []
  } finally {
    loading.value = false
  }
}

const handleCatalogModelChange = (value: string) => {
  if (value === '__add_model__') {
    emit('add-model')
    return
  }
  emit('update:selectedModelId', value)
}
// Keep the native catalog callback name stable for the management surfaces;
// the chat branch emits its own select-model event and never mutates catalog state.
const handleModelChange = handleCatalogModelChange

const chatPanelLabel = computed(() => `${t('input.modelLabel')} / ${t('input.reasoningEffort')}`)
const modelLabel = computed(() => t('input.modelLabel'))
const reasoningLabel = computed(() => t('input.reasoningEffort'))
const backLabel = computed(() => t('input.back'))
const noModelsLabel = computed(() => t('input.noModel'))
const noReasoningLabel = computed(() => t('input.noReasoningEfforts'))

const activeModelIndex = ref(0)
const activeReasoningIndex = ref(0)
const modelListRef = ref<HTMLElement | null>(null)
const reasoningListRef = ref<HTMLElement | null>(null)
const overviewFirstRef = ref<HTMLButtonElement | null>(null)
const modelListId = `visual-model-list-${Math.random().toString(36).slice(2, 9)}`

// `props.models` is deliberately the caller-owned, plan-filtered catalog.  The
// picker only presents this array; it never fetches or synthesizes records.
const chatModels = computed(() => props.models.filter(model => !!model.id))
const modelOptionId = (id: string) => `${modelListId}-option-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
const reasoningOptionId = (value: string) => `${modelListId}-reasoning-${value.replace(/[^a-zA-Z0-9_-]/g, '-')}`
const activeModelId = computed(() => {
  const model = chatModels.value[activeModelIndex.value]
  return model?.id ? modelOptionId(model.id) : undefined
})
const activeReasoningId = computed(() => {
  const option = props.reasoningOptions[activeReasoningIndex.value]
  return option ? reasoningOptionId(option.value) : undefined
})
const modelIndex = (id?: string) => chatModels.value.findIndex(model => model.id === id)

const openView = (nextView: 'overview' | 'models' | 'reasoning') => {
  emit('update:view', nextView)
  nextTick(() => {
    if (nextView === 'models') modelListRef.value?.focus()
    if (nextView === 'reasoning') reasoningListRef.value?.focus()
  })
}
const selectChatModel = (value: string) => {
  if (!chatModels.value.some(model => model.id === value)) return
  emit('select-model', value)
}
const selectChatReasoning = (value: string) => {
  if (!props.reasoningOptions.some(option => option.value === value)) return
  emit('select-reasoning', value)
}
const moveModelActive = (delta: number) => {
  const count = chatModels.value.length
  if (!count) return
  activeModelIndex.value = (activeModelIndex.value + delta + count) % count
  nextTick(() => {
    const active = activeModelId.value ? document.getElementById(activeModelId.value) : null
    active?.scrollIntoView({ block: 'nearest' })
  })
}
const moveReasoningActive = (delta: number) => {
  const count = props.reasoningOptions.length
  if (!count) return
  activeReasoningIndex.value = (activeReasoningIndex.value + delta + count) % count
  nextTick(() => {
    const option = props.reasoningOptions[activeReasoningIndex.value]
    const active = option ? document.getElementById(reasoningOptionId(option.value)) : null
    active?.scrollIntoView({ block: 'nearest' })
  })
}
const handleModelKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
    event.stopPropagation()
  }
  if (event.key === 'ArrowDown') { event.preventDefault(); moveModelActive(1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveModelActive(-1) }
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const model = chatModels.value[activeModelIndex.value]
    if (model?.id) selectChatModel(model.id)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('update:view', 'overview')
  }
}
const handleReasoningKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
    event.stopPropagation()
  }
  if (event.key === 'ArrowDown') { event.preventDefault(); moveReasoningActive(1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveReasoningActive(-1) }
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = props.reasoningOptions[activeReasoningIndex.value]
    if (option) selectChatReasoning(option.value)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('update:view', 'overview')
  }
}
const handlePanelKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (props.view === 'overview') emit('close')
    else emit('update:view', 'overview')
  }
}

watch(() => props.view, (view) => {
  if (view === 'overview') {
    nextTick(() => overviewFirstRef.value?.focus())
  }
  if (view === 'models') {
    activeModelIndex.value = Math.max(0, chatModels.value.findIndex(model => model.id === props.selectedModelId))
    nextTick(() => modelListRef.value?.focus())
  }
  if (view === 'reasoning') {
    activeReasoningIndex.value = Math.max(0, props.reasoningOptions.findIndex(option => option.value === props.reasoningEffort))
    nextTick(() => reasoningListRef.value?.focus())
  }
}, { immediate: true })
watch(() => props.models, () => { activeModelIndex.value = Math.max(0, chatModels.value.findIndex(model => model.id === props.selectedModelId)) }, { deep: true })

defineExpose({
  refresh: loadModels
})

onMounted(() => {
  // The chat branch receives the already plan-filtered catalog from the
  // frozen composer controller.  Never perform a second unrestricted model
  // read from this presentation component.
  if (props.mode === 'catalog' && !props.allModels) {
    loadModels()
  }
})
</script>

<style scoped lang="less">
.visual-model-selector {
  width: 100%;
  min-width: 0;
}

.visual-model-selector__control {
  width: 100%;
}

.visual-model-selector__control :deep(.t-input) {
  min-height: 32px;
  border-color: #e5e7eb;
  border-radius: 9px;
  background: #fff;
  box-shadow: none;
  color: #4b5563;
  font-size: 11px;
  line-height: 18px;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
}

.visual-model-selector__control :deep(.t-input:hover:not(.t-is-disabled)),
.visual-model-selector__control :deep(.t-input.t-is-focused) {
  border-color: #d1d5db;
  background: #f9fafb;
}

.visual-model-selector__control :deep(.t-input.t-is-focused) {
  box-shadow: 0 0 0 2px rgb(17 24 39 / 6%);
}

.visual-model-selector__control :deep(.t-input__inner) {
  font: inherit;
  font-size: 11px;
  line-height: 18px;
}

.visual-model-selector__option {
  min-width: 0;
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #4b5563;
  font-size: 11px;
  line-height: 16px;
}

.visual-model-selector__option-check {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.visual-model-selector__option-check :deep(.t-icon) {
  font-size: 13px;
}

.visual-model-selector__option-copy {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.visual-model-selector__option-copy strong,
.visual-model-selector__option-copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-model-selector__option-copy strong {
  color: #374151;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
}

.visual-model-selector__option-copy small {
  color: #9ca3af;
  font-size: 10px;
  line-height: 14px;
}

.visual-model-selector__badges {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
}

.visual-model-selector__badge {
  padding: 2px 5px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 9px;
  line-height: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.visual-model-selector__badge.is-default {
  background: #ecfdf5;
  color: #047857;
}

.visual-model-selector__option.is-add {
  color: #4b5563;
  font-weight: 600;
}

/* The chat picker mirrors the compact Codex-style menu: a two-row overview
 * and single-line listbox views.  The caller still owns model availability. */
.visual-model-selector--chat {
  width: 100%;
  min-width: 0;
}

.visual-model-selector__chat-panel {
  --chat-picker-ink: #1f2937;
  --chat-picker-title: #111827;
  --chat-picker-copy: #374151;
  --chat-picker-muted: #6b7280;
  --chat-picker-subtle: #9ca3af;
  --chat-picker-hover: #f5f6f8;
  --chat-picker-selected: #f0f2f4;
  --chat-picker-selected-hover: #eaedf0;
  --chat-picker-soft: #f3f4f6;
  --chat-picker-focus-ring: rgb(17 24 39 / 20%);
  width: 100%;
  min-width: 0;
  color: var(--chat-picker-ink);
}

.visual-model-selector__chat-row {
  width: 100%;
  min-height: 44px;
  padding: 7px 8px 7px 10px;
  border: 0;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.visual-model-selector__chat-row:hover,
.visual-model-selector__chat-row:focus-visible {
  outline: none;
  background: var(--chat-picker-hover);
}

.visual-model-selector__chat-row.is-disabled {
  opacity: .58;
  cursor: not-allowed;
}

.visual-model-selector__chat-row-copy {
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(76px, 34%) minmax(0, 1fr);
  align-items: baseline;
  gap: 12px;
}

.visual-model-selector__chat-row-label {
  color: var(--chat-picker-ink);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

.visual-model-selector__chat-row-value {
  min-width: 0;
  overflow: hidden;
  color: var(--chat-picker-muted);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-model-selector__chat-row > :deep(.t-icon) {
  flex: 0 0 16px;
  color: var(--chat-picker-subtle);
  font-size: 16px;
}

.visual-model-selector__chat-header {
  min-height: 36px;
  padding: 0 4px 3px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.visual-model-selector__chat-back {
  width: 30px;
  height: 30px;
  padding: 5px;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--chat-picker-muted);
  cursor: pointer;
}

.visual-model-selector__chat-back:hover,
.visual-model-selector__chat-back:focus-visible {
  outline: none;
  background: var(--chat-picker-soft);
  color: var(--chat-picker-title);
}

.visual-model-selector__chat-back :deep(.t-icon) {
  font-size: 18px;
}

.visual-model-selector__chat-title {
  min-width: 0;
  overflow: hidden;
  color: var(--chat-picker-title);
  font-size: 15px;
  line-height: 22px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-model-selector__chat-header-spacer {
  width: 30px;
  flex: 0 0 30px;
}

.visual-model-selector__chat-list {
  max-height: min(250px, calc(var(--visual-model-menu-max-height, 340px) - 52px), 48vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 3px 2px;
  scrollbar-width: thin;
}

.visual-model-selector__chat-list:focus-visible {
  outline: 2px solid var(--chat-picker-focus-ring);
  outline-offset: -2px;
  border-radius: 10px;
}

.visual-model-selector__chat-option {
  width: 100%;
  min-height: 40px;
  padding: 6px 10px 6px 11px;
  border: 0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: transparent;
  color: var(--chat-picker-copy);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.visual-model-selector__chat-option:hover,
.visual-model-selector__chat-option.is-active {
  outline: none;
  background: var(--chat-picker-hover);
}

.visual-model-selector__chat-option.is-selected {
  background: var(--chat-picker-selected);
}

.visual-model-selector__chat-option.is-selected.is-active,
.visual-model-selector__chat-option.is-selected:hover {
  background: var(--chat-picker-selected-hover);
}

.visual-model-selector__chat-option-copy {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.visual-model-selector__chat-option-copy strong {
  min-width: 0;
  display: block;
  overflow: hidden;
  color: var(--chat-picker-ink);
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-model-selector__chat-check {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--chat-picker-copy);
}

.visual-model-selector__chat-check :deep(.t-icon) {
  font-size: 16px;
}

.visual-model-selector__chat-empty {
  padding: 24px 10px;
  color: var(--chat-picker-subtle);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

@media (max-width: 430px) {
  .visual-model-selector__chat-row-copy {
    grid-template-columns: minmax(64px, 30%) minmax(0, 1fr);
    gap: 8px;
  }

  .visual-model-selector__chat-row-label,
  .visual-model-selector__chat-row-value {
    font-size: 13px;
  }

  .visual-model-selector__chat-list {
    max-height: min(250px, calc(var(--visual-model-menu-max-height, 340px) - 52px), 52vh);
  }
}

:root[theme-mode="dark"] .visual-model-selector__chat-panel {
  --chat-picker-ink: #f1f3f4;
  --chat-picker-title: #f8f9fa;
  --chat-picker-copy: #e0e3e7;
  --chat-picker-muted: #bdc1c6;
  --chat-picker-subtle: #9aa0a6;
  --chat-picker-hover: #292c31;
  --chat-picker-selected: #30343a;
  --chat-picker-selected-hover: #373b42;
  --chat-picker-soft: #303238;
  --chat-picker-focus-ring: rgb(138 180 248 / 55%);
}

@media (prefers-color-scheme: dark) {
  :root:not([theme-mode="light"]) .visual-model-selector__chat-panel {
    --chat-picker-ink: #f1f3f4;
    --chat-picker-title: #f8f9fa;
    --chat-picker-copy: #e0e3e7;
    --chat-picker-muted: #bdc1c6;
    --chat-picker-subtle: #9aa0a6;
    --chat-picker-hover: #292c31;
    --chat-picker-selected: #30343a;
    --chat-picker-selected-hover: #373b42;
    --chat-picker-soft: #303238;
    --chat-picker-focus-ring: rgb(138 180 248 / 55%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .visual-model-selector__control :deep(.t-input) {
    transition: none !important;
  }
}
</style>
