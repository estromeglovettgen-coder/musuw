<template>
  <div class="reference-model-selector" :class="[`status-${status}`, { disabled }]">
    <button
      type="button"
      class="reference-model-selector__trigger"
      :disabled="disabled"
      @click="open = !open"
    >
      <span v-if="loading" class="reference-model-selector__spinner" aria-hidden="true" />
      <ReferenceIcon v-else name="message-square-plus" :size="13" class="reference-model-selector__trigger-icon" />
      <span class="reference-model-selector__value" :class="{ placeholder: !selectedModel }">
        {{ selectedModel ? modelDisplayName(selectedModel) : placeholderText }}
      </span>
      <span v-if="selectedModel?.display_name" class="reference-model-selector__raw">{{ selectedModel.name }}</span>
      <ReferenceIcon name="chevron-down" :size="12" class="reference-model-selector__chevron" />
    </button>

    <template v-if="open && !disabled">
      <div class="reference-model-selector__backdrop" @click="close" />
      <div class="reference-model-selector__menu">
        <div class="reference-model-selector__search">
          <ReferenceIcon name="search" :size="13" />
          <input ref="searchRef" v-model.trim="query" type="text" :placeholder="placeholderText" @keydown.esc="close">
        </div>
        <div class="reference-model-selector__list">
          <button
            v-for="model in filteredModels"
            :key="model.id"
            type="button"
            class="reference-model-selector__row"
            :class="{ active: model.id === selectedModelId }"
            @click="handleModelChange(model.id || '')"
          >
            <ReferenceIcon :name="model.id === selectedModelId ? 'check-circle-2' : 'message-square-plus'" :size="13" class="reference-model-selector__row-icon" />
            <span class="reference-model-selector__row-copy">
              <strong>{{ modelDisplayName(model) }}</strong>
              <small v-if="model.display_name">{{ model.name }}</small>
            </span>
            <span v-if="model.is_builtin" class="reference-model-selector__badge">{{ $t('model.builtinTag') }}</span>
            <span v-if="model.is_default" class="reference-model-selector__badge reference-model-selector__badge--dark">{{ $t('model.defaultTag') }}</span>
          </button>
          <div v-if="!filteredModels.length" class="reference-model-selector__empty">{{ $t('common.noData') }}</div>
        </div>
        <div class="reference-model-selector__divider" />
        <button type="button" class="reference-model-selector__add" @click="handleModelChange('__add_model__')">
          <ReferenceIcon name="plus" :size="13" />
          <span>{{ $t('model.addModelInSettings') }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { listModels, type ModelConfig } from '@/api/model'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'

interface Props {
  modelType: 'KnowledgeQA' | 'Embedding' | 'Rerank' | 'VLLM' | 'ASR'
  selectedModelId?: string
  disabled?: boolean
  placeholder?: string
  status?: 'default' | 'success' | 'warning' | 'error'
  allModels?: ModelConfig[]
}

const props = withDefaults(defineProps<Props>(), { disabled: false, placeholder: '', status: 'default' })
const emit = defineEmits<{ 'update:selectedModelId': [value: string]; 'add-model': [] }>()
const models = ref<ModelConfig[]>([])
const loading = ref(false)
const open = ref(false)
const query = ref('')
const searchRef = ref<HTMLInputElement | null>(null)
const { t } = useI18n()

const placeholderText = computed(() => props.placeholder || t('model.selectModelPlaceholder'))
const modelDisplayName = (model: ModelConfig) => model.display_name?.trim() || model.name
watch(() => props.allModels, (newModels) => {
  if (newModels && Array.isArray(newModels)) models.value = newModels.filter(m => m.type === props.modelType)
}, { immediate: true })
watch(() => props.modelType, () => {
  if (props.allModels) models.value = props.allModels.filter(m => m.type === props.modelType)
})
const selectedModel = computed(() => props.selectedModelId ? models.value.find(m => m.id === props.selectedModelId) || null : null)
const filteredModels = computed(() => {
  const q = query.value.toLowerCase()
  if (!q) return models.value
  return models.value.filter(model => `${modelDisplayName(model)} ${model.name}`.toLowerCase().includes(q))
})

const loadModels = async () => {
  if (props.allModels) return
  loading.value = true
  try {
    const result = await listModels()
    models.value = Array.isArray(result) ? result.filter(m => m.type === props.modelType) : []
  } catch (error) {
    console.error(t('model.loadFailed'), error)
    MessagePlugin.error(t('model.loadFailed'))
    models.value = []
  } finally { loading.value = false }
}
const close = () => { open.value = false; query.value = '' }
watch(open, async value => { if (value) { await nextTick(); searchRef.value?.focus() } })
const handleModelChange = (value: string) => {
  close()
  if (value === '__add_model__') { emit('add-model'); return }
  emit('update:selectedModelId', value)
}
defineExpose({ refresh: loadModels })
onMounted(() => { if (!props.allModels) loadModels() })
</script>

<style scoped>
.reference-model-selector{position:relative;width:100%;font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif}.reference-model-selector__trigger{width:100%;height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#374151;text-align:left;cursor:pointer}.reference-model-selector__trigger:hover:not(:disabled){border-color:#d1d5db}.reference-model-selector__trigger:disabled{background:#f9fafb;color:#9ca3af;cursor:not-allowed}.reference-model-selector.status-error .reference-model-selector__trigger{border-color:#fca5a5}.reference-model-selector.status-warning .reference-model-selector__trigger{border-color:#fcd34d}.reference-model-selector.status-success .reference-model-selector__trigger{border-color:#86efac}.reference-model-selector__trigger-icon{color:#9ca3af}.reference-model-selector__value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:15px;font-weight:600;color:#374151}.reference-model-selector__value.placeholder{color:#9ca3af;font-weight:500}.reference-model-selector__raw{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9ca3af;font-size:9px}.reference-model-selector__chevron{margin-left:auto;color:#9ca3af}.reference-model-selector__spinner{width:12px;height:12px;border:2px solid #e5e7eb;border-top-color:#6b7280;border-radius:50%;animation:reference-model-selector-spin .8s linear infinite}@keyframes reference-model-selector-spin{to{transform:rotate(360deg)}}
.reference-model-selector__backdrop{position:fixed;inset:0;z-index:90}.reference-model-selector__menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:100;min-width:240px;max-height:360px;display:flex;flex-direction:column;padding:6px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 20px 25px -5px rgb(0 0 0 / 10%),0 8px 10px -6px rgb(0 0 0 / 10%)}.reference-model-selector__search{height:32px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid #e5e7eb;border-radius:9px;color:#9ca3af}.reference-model-selector__search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#111827;font:500 10px/1.4 inherit}.reference-model-selector__list{min-height:0;overflow:auto;margin-top:5px}.reference-model-selector__row,.reference-model-selector__add{width:100%;min-height:34px;display:flex;align-items:center;gap:8px;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:#4b5563;text-align:left;cursor:pointer}.reference-model-selector__row:hover,.reference-model-selector__add:hover{background:#f3f4f6;color:#111827}.reference-model-selector__row.active{background:#f3f4f6;color:#111827}.reference-model-selector__row-icon{flex:0 0 auto;color:#9ca3af}.reference-model-selector__row.active .reference-model-selector__row-icon{color:#374151}.reference-model-selector__row-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}.reference-model-selector__row-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:14px;font-weight:700}.reference-model-selector__row-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9ca3af;font-size:8px;line-height:11px}.reference-model-selector__badge{flex:0 0 auto;padding:2px 5px;border-radius:5px;background:#f3f4f6;color:#6b7280;font-size:7px;line-height:10px;font-weight:800}.reference-model-selector__badge--dark{background:#111827;color:#fff}.reference-model-selector__empty{padding:18px 8px;text-align:center;color:#9ca3af;font-size:9px}.reference-model-selector__divider{height:1px;margin:5px 2px;background:#f3f4f6}.reference-model-selector__add{min-height:31px;color:#374151;font-size:10px;font-weight:700}
</style>
