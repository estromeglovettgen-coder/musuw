<template>
  <SettingDrawer
    v-model:visible="drawerVisible"
    :title="$t('modelSettings.debug.title')"
    :description="$t('modelSettings.debug.description')"
    icon="play-circle-stroke"
    width="560px"
    :min-width="480"
    :max-width="900"
    storage-key="setting-drawer:width:model-debug"
    :confirm-text="$t('modelSettings.debug.run')"
    :confirm-loading="running"
    :confirm-disabled="!canRun"
    :cancel-text="$t('common.close')"
    @confirm="runDebug"
  >
    <template v-if="result" #footer-left>
      <button type="button" class="reference-debug-copy" @click="copyResult">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        {{ $t('modelSettings.debug.copyResult') }}
      </button>
    </template>

    <div class="reference-model-debug">
      <section class="setting-drawer__section">
        <h4 class="setting-drawer__section-title">{{ $t('modelSettings.debug.groupModel') }}</h4>

        <div v-if="availableModelTypes.length > 1" class="reference-debug-type-grid" role="radiogroup" :aria-label="$t('modelSettings.debug.modelType')">
          <button
            v-for="option in availableModelTypes"
            :key="option.value"
            type="button"
            class="reference-debug-type"
            :class="{ active: selectedModelType === option.value }"
            role="radio"
            :aria-checked="selectedModelType === option.value"
            @click="selectModelType(option.value)"
          >
            <ReferenceIcon :name="referenceTypeIcon(option.value)" :size="15" />
            <span>{{ option.label }}</span>
          </button>
        </div>

        <label class="reference-debug-field">
          <span>{{ $t('modelSettings.debug.model') }}</span>
          <select v-model="selectedModelId" :disabled="filteredModels.length === 0" @change="resetResult">
            <option value="" disabled>{{ $t('modelSettings.debug.modelPlaceholder') }}</option>
            <option v-for="model in filteredModels" :key="model.id" :value="model.id!">
              {{ modelLabel(model) }} · {{ vendorLabel(model) }}
            </option>
          </select>
          <small v-if="filteredModels.length === 0">{{ $t('modelSettings.debug.noModelsForType') }}</small>
        </label>
      </section>

      <template v-if="selectedModel">
        <section class="setting-drawer__section">
          <h4 class="setting-drawer__section-title">{{ $t('modelSettings.debug.groupInput') }}</h4>

          <label v-if="selectedModel.type !== 'ASR'" class="reference-debug-field">
            <span>{{ inputLabel }}</span>
            <textarea v-model="input" :placeholder="inputPlaceholder" rows="5" />
          </label>

          <label v-if="selectedModel.type === 'Rerank'" class="reference-debug-field">
            <span>{{ $t('modelSettings.debug.documents') }}</span>
            <textarea v-model="documentsText" :placeholder="$t('modelSettings.debug.documentsPlaceholder')" rows="5" />
            <small>{{ $t('modelSettings.debug.documentsHint') }}</small>
          </label>

          <div v-if="needsFile" class="reference-debug-field">
            <span>{{ fileLabel }}</span>
            <input ref="fileInputRef" class="reference-debug-file-input" type="file"
              :accept="selectedModel.type === 'VLLM' ? 'image/*' : 'audio/*'" @change="onNativeFileChange">
            <button type="button" class="reference-debug-file-button" @click="fileInputRef?.click()">
              <ReferenceIcon name="upload" :size="14" />
              {{ $t('modelSettings.debug.chooseFile') }}
            </button>
            <small v-if="file">{{ file.name }} · {{ formatBytes(file.size) }}</small>
          </div>
        </section>

        <section v-if="isChat" class="setting-drawer__section">
          <h4 class="setting-drawer__section-title">{{ $t('modelSettings.debug.parameters') }}</h4>
          <div class="reference-debug-parameter-grid">
            <label class="reference-debug-field"><span>Temperature</span><input v-model.number="temperature" type="number" min="0" max="2" step="0.1"></label>
            <label class="reference-debug-field"><span>Top P</span><input v-model.number="topP" type="number" min="0.01" max="1" step="0.1"></label>
            <label class="reference-debug-field"><span>Max Tokens</span><input v-model.number="maxTokens" type="number" min="1" max="8192" step="128"></label>
          </div>
          <label class="reference-debug-field">
            <span>{{ $t('modelSettings.debug.systemPrompt') }}</span>
            <textarea v-model="systemPrompt" :placeholder="$t('modelSettings.debug.systemPromptPlaceholder')" rows="3" />
          </label>
          <label v-if="supportsThinking" class="reference-debug-toggle-row">
            <input v-model="thinking" type="checkbox">
            <span class="reference-debug-toggle" aria-hidden="true"><i /></span>
            <span><strong>{{ $t('modelSettings.debug.thinking') }}</strong><small>{{ $t('modelSettings.debug.thinkingDesc') }}</small></span>
          </label>
        </section>

        <section v-if="result || history.length > 0" class="setting-drawer__section">
          <h4 class="setting-drawer__section-title">{{ $t('modelSettings.debug.groupResult') }}</h4>

          <div v-if="history.length > 1" class="reference-debug-history">
            <button
              v-for="run in history"
              :key="run.id"
              type="button"
              :class="{ active: result === run.result }"
              @click="result = run.result"
            >
              <span>{{ run.label }}</span><small>{{ run.result.elapsed_ms }} ms</small>
            </button>
          </div>

          <div v-if="result" class="reference-debug-result">
            <div class="reference-debug-banner" :class="result.ok ? 'success' : 'error'">
              <ReferenceIcon :name="result.ok ? 'check-circle-2' : 'stop-circle'" :size="16" />
              <strong>{{ result.ok ? $t('modelSettings.debug.success') : $t('modelSettings.debug.failed') }}</strong>
              <span>{{ result.elapsed_ms }} ms</span>
            </div>

            <div v-if="resultMetrics.length" class="reference-debug-metrics">
              <span v-for="metric in resultMetrics" :key="metric.key">{{ metric.label }}: {{ metric.value }}</span>
            </div>
            <p v-if="result.error" class="reference-debug-error">{{ result.error }}</p>

            <div class="reference-debug-tabs">
              <button type="button" :class="{ active: resultTab === 'response' }" @click="resultTab = 'response'">{{ $t('modelSettings.debug.rawResponse') }}</button>
              <button type="button" :class="{ active: resultTab === 'request' }" @click="resultTab = 'request'">{{ $t('modelSettings.debug.requestPreview') }}</button>
            </div>
            <pre>{{ formattedResult }}</pre>
          </div>
        </section>
      </template>
    </div>
  </SettingDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import SettingDrawer from '@/components/settings/SettingDrawer.vue'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { debugModel, type ModelConfig, type ModelDebugResult } from '@/api/model'
import { fileSizeVerification } from '@/utils'
import { modelSupportsThinking } from '@/utils/thinkingControl'

const props = defineProps<{ visible: boolean; models: ModelConfig[] }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()
const { t, te } = useI18n()
const drawerVisible = computed({ get: () => props.visible, set: value => emit('update:visible', value) })
type DebugModelType = ModelConfig['type']
const selectedModelType = ref<DebugModelType>('KnowledgeQA')
const selectedModelId = ref('')
const input = ref('')
const documentsText = ref('')
const file = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const thinking = ref(false)
const temperature = ref(0.7)
const topP = ref(1)
const maxTokens = ref(1024)
const systemPrompt = ref('')
const running = ref(false)
const result = ref<ModelDebugResult | null>(null)
const resultTab = ref<'response' | 'request'>('response')
const history = ref<Array<{ id: number; label: string; result: ModelDebugResult }>>([])
let runSequence = 0
const selectedModel = computed(() => props.models.find(model => model.id === selectedModelId.value))
const filteredModels = computed(() => props.models.filter(model => model.type === selectedModelType.value))
const isChat = computed(() => selectedModel.value?.type === 'KnowledgeQA')
const supportsThinking = computed(() => selectedModel.value ? modelSupportsThinking(selectedModel.value) : false)
const needsFile = computed(() => ['VLLM', 'ASR'].includes(selectedModel.value?.type || ''))
const documents = computed(() => documentsText.value.split('\n').map(item => item.trim()).filter(Boolean))
const canRun = computed(() => {
  if (!selectedModel.value) return false
  if (needsFile.value && !file.value) return false
  if (selectedModel.value.type === 'ASR') return true
  if (selectedModel.value.type === 'Rerank') return !!input.value.trim() && documents.value.length > 0
  return !!input.value.trim()
})
const allModelTypeOptions = computed(() => {
  const keys: Record<DebugModelType, { short: string; icon: string }> = {
    KnowledgeQA: { short: 'chat', icon: 'chat' }, Embedding: { short: 'embedding', icon: 'chart-bubble' },
    Rerank: { short: 'rerank', icon: 'filter-sort' }, VLLM: { short: 'vllm', icon: 'image' }, ASR: { short: 'asr', icon: 'sound' },
  }
  return (Object.keys(keys) as DebugModelType[]).map(value => ({ value, label: t(`modelSettings.typeShort.${keys[value].short}`), icon: keys[value].icon }))
})
const referenceTypeIcon = (type: DebugModelType): 'message-square-plus' | 'network' | 'list' | 'image' | 'volume-2' => {
  if (type === 'KnowledgeQA') return 'message-square-plus'
  if (type === 'Embedding') return 'network'
  if (type === 'Rerank') return 'list'
  if (type === 'VLLM') return 'image'
  return 'volume-2'
}
const modelCount = (type: DebugModelType) => props.models.filter(model => model.type === type).length
const availableModelTypes = computed(() => allModelTypeOptions.value.filter(option => modelCount(option.value) > 0))
const modelLabel = (model: ModelConfig) => model.display_name?.trim() || model.name
const vendorLabel = (model: ModelConfig) => {
  const provider = model.parameters.provider || ''
  if (model.source === 'local') return 'Ollama'
  if (provider === 'generic') return t('modelSettings.source.custom')
  const key = `model.editor.providers.${provider}.label`
  return te(key) ? t(key) : provider || model.source
}
const inputLabel = computed(() => {
  if (selectedModel.value?.type === 'Embedding') return t('modelSettings.debug.embeddingInput')
  if (selectedModel.value?.type === 'VLLM') return t('modelSettings.debug.vlmPrompt')
  return t('modelSettings.debug.query')
})
const inputPlaceholder = computed(() => selectedModel.value?.type === 'Embedding' ? t('modelSettings.debug.embeddingPlaceholder') : selectedModel.value?.type === 'VLLM' ? t('modelSettings.debug.vlmPromptPlaceholder') : t('modelSettings.debug.queryPlaceholder'))
const fileLabel = computed(() => selectedModel.value?.type === 'VLLM' ? t('modelSettings.debug.imageFile') : t('modelSettings.debug.audioFile'))
const formattedResult = computed(() => {
  if (!result.value) return ''
  return JSON.stringify(resultTab.value === 'response' ? result.value.raw_response : result.value.request, null, 2)
})
const OBSERVATION_LABELS: Record<string, string> = {
  dimension: 'modelSettings.debug.metrics.dimension', result_count: 'modelSettings.debug.metrics.resultCount',
  answer_characters: 'modelSettings.debug.metrics.answerChars', reasoning_characters: 'modelSettings.debug.metrics.reasoningChars',
  reasoning_returned: 'modelSettings.debug.metrics.reasoningReturned', text_characters: 'modelSettings.debug.metrics.textChars',
  segment_count: 'modelSettings.debug.metrics.segmentCount',
}
const resultMetrics = computed(() => {
  if (!result.value?.observations) return []
  const obs = result.value.observations
  return Object.keys(OBSERVATION_LABELS).filter(key => obs[key] !== undefined && obs[key] !== null).map(key => ({ key, label: t(OBSERVATION_LABELS[key]), value: formatMetricValue(key, obs[key]) }))
})
const formatMetricValue = (_key: string, value: unknown) => typeof value === 'boolean' ? (value ? t('common.yes') : t('common.no')) : String(value)
const ensureDefaultSelection = () => {
  const types = availableModelTypes.value
  if (!types.length) { selectedModelId.value = ''; return }
  if (!types.some(option => option.value === selectedModelType.value)) selectedModelType.value = types[0].value
  const models = filteredModels.value
  if (!models.some(model => model.id === selectedModelId.value)) selectedModelId.value = models[0]?.id || ''
}
watch(() => props.visible, visible => { if (visible) ensureDefaultSelection() })
watch(availableModelTypes, () => { if (props.visible) ensureDefaultSelection() })
watch(() => selectedModel.value?.id, () => { if (!supportsThinking.value) thinking.value = false })
watch(() => selectedModel.value?.type, () => { file.value = null; result.value = null; history.value = []; resultTab.value = 'response' })
const resetResult = () => { result.value = null; history.value = []; resultTab.value = 'response' }
const selectModelType = (type: DebugModelType) => {
  if (selectedModelType.value === type) return
  selectedModelType.value = type; selectedModelId.value = filteredModels.value[0]?.id || ''; input.value = ''; documentsText.value = ''; file.value = null; resetResult()
}
const onNativeFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const selectedFile = target.files?.[0] || null
  if (selectedFile && fileSizeVerification(selectedFile)) { target.value = ''; file.value = null; resetResult(); return }
  file.value = selectedFile; resetResult()
}
const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
const historyLabel = (thinkingValue: boolean) => supportsThinking.value ? (thinkingValue ? t('modelSettings.debug.thinkOn') : t('modelSettings.debug.thinkOff')) : t('modelSettings.debug.runLabel', { n: runSequence })
const runDebug = async () => {
  if (!selectedModel.value?.id || !canRun.value || running.value) return
  running.value = true
  try {
    const thinkingValue = supportsThinking.value ? thinking.value : false
    const nextResult = await debugModel(selectedModel.value.id, {
      input: input.value.trim(), documents: documents.value, file: file.value,
      options: isChat.value ? { system_prompt: systemPrompt.value.trim() || undefined, temperature: temperature.value, top_p: topP.value, max_tokens: maxTokens.value, thinking: thinkingValue } : {},
    })
    result.value = nextResult
    history.value.unshift({ id: ++runSequence, label: historyLabel(thinkingValue), result: nextResult })
    history.value = history.value.slice(0, 6)
    resultTab.value = 'response'
  } catch (error: any) { MessagePlugin.error(error?.message || t('modelSettings.debug.requestFailed')) }
  finally { running.value = false }
}
const copyResult = async () => {
  if (!result.value) return
  try { await navigator.clipboard.writeText(JSON.stringify(result.value, null, 2)); MessagePlugin.success(t('common.copied')) }
  catch { MessagePlugin.error(t('common.copyFailed')) }
}
onBeforeUnmount(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
</script>

<style scoped>
.reference-model-debug{display:flex;flex-direction:column;gap:0;color:#111827;font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif}
.reference-debug-copy,.reference-debug-file-button{height:30px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;color:#4b5563;font-size:10px;font-weight:700;cursor:pointer}.reference-debug-copy:hover,.reference-debug-file-button:hover{border-color:#d1d5db;color:#111827}.reference-debug-copy svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.reference-debug-type-grid{display:flex;flex-wrap:wrap;gap:7px}.reference-debug-type{height:31px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;color:#6b7280;font-size:10px;font-weight:700;cursor:pointer}.reference-debug-type:hover{background:#f9fafb;color:#374151}.reference-debug-type.active{border-color:#111827;background:#111827;color:#fff}
.reference-debug-field{display:flex;flex-direction:column;gap:6px;margin:0}.reference-debug-field>span{color:#374151;font-size:10px;line-height:14px;font-weight:700}.reference-debug-field>small,.reference-debug-toggle-row small{color:#9ca3af;font-size:9px;line-height:14px;font-weight:500}
.reference-debug-field select,.reference-debug-field input[type="number"],.reference-debug-field textarea{width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#111827;font:500 11px/1.5 Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif;outline:none;transition:border-color 120ms ease,box-shadow 120ms ease}.reference-debug-field select,.reference-debug-field input[type="number"]{height:34px;padding:0 10px}.reference-debug-field textarea{min-height:88px;padding:9px 10px;resize:vertical}.reference-debug-field select:focus,.reference-debug-field input:focus,.reference-debug-field textarea:focus{border-color:#9ca3af;box-shadow:0 0 0 3px rgb(17 24 39 / 5%)}.reference-debug-field select:disabled{background:#f9fafb;color:#9ca3af}
.reference-debug-file-input{position:absolute;width:0;height:0;opacity:0;pointer-events:none}.reference-debug-file-button{align-self:flex-start}
.reference-debug-parameter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.reference-debug-toggle-row{position:relative;display:flex;align-items:center;gap:8px;cursor:pointer}.reference-debug-toggle-row>input{position:absolute;opacity:0;pointer-events:none}.reference-debug-toggle{width:30px;height:17px;flex:0 0 30px;border-radius:999px;background:#e5e7eb;padding:2px;box-sizing:border-box;transition:background 150ms ease}.reference-debug-toggle i{display:block;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / 18%);transition:transform 150ms ease}.reference-debug-toggle-row>input:checked+.reference-debug-toggle{background:#111827}.reference-debug-toggle-row>input:checked+.reference-debug-toggle i{transform:translateX(13px)}.reference-debug-toggle-row>span:last-child{display:flex;flex-direction:column;gap:1px}.reference-debug-toggle-row strong{font-size:10px;color:#374151}
.reference-debug-history{display:flex;flex-wrap:wrap;gap:6px}.reference-debug-history button{height:28px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#4b5563;font-size:9px;font-weight:700;cursor:pointer}.reference-debug-history button small{color:#9ca3af;font-size:8px}.reference-debug-history button.active{border-color:#9ca3af;background:#f3f4f6;color:#111827}
.reference-debug-result{display:flex;flex-direction:column;gap:10px}.reference-debug-banner{min-height:36px;display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid;border-radius:10px;font-size:10px}.reference-debug-banner.success{border-color:#bbf7d0;background:#f0fdf4;color:#15803d}.reference-debug-banner.error{border-color:#fecaca;background:#fef2f2;color:#b91c1c}.reference-debug-banner strong{color:#111827}.reference-debug-banner span{margin-left:auto;color:#9ca3af;font:500 9px/1.4 "JetBrains Mono",monospace}
.reference-debug-metrics{display:flex;flex-wrap:wrap;gap:6px}.reference-debug-metrics span{padding:3px 7px;border-radius:6px;background:#f3f4f6;color:#6b7280;font-size:8px;font-weight:700}.reference-debug-error{margin:0;padding:8px 10px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:10px;line-height:1.5;white-space:pre-wrap}
.reference-debug-tabs{display:inline-flex;align-self:flex-start;padding:2px;border:1px solid #e5e7eb;border-radius:9px;background:#f3f4f6}.reference-debug-tabs button{height:26px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:#9ca3af;font-size:9px;font-weight:700;cursor:pointer}.reference-debug-tabs button.active{background:#fff;color:#111827;box-shadow:0 1px 2px rgb(0 0 0 / 6%)}
.reference-debug-result pre{max-height:420px;min-height:120px;overflow:auto;margin:0;padding:11px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#374151;font:9px/1.65 "JetBrains Mono",ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}
@media(max-width:640px){.reference-debug-parameter-grid{grid-template-columns:1fr}}
</style>
