<template>
  <div
    class="visual-model-selector"
    :class="[
      `is-${status}`,
      { 'is-disabled': disabled, 'is-loading': loading },
    ]"
  >
    <t-popup
      v-model:visible="menuVisible"
      trigger="click"
      placement="bottom-right"
      destroy-on-close
      :disabled="disabled || loading"
      :overlay-inner-style="{ padding: '5px' }"
    >
      <button
        type="button"
        class="visual-model-selector__trigger"
        :disabled="disabled || loading"
        :aria-expanded="menuVisible"
        aria-haspopup="listbox"
      >
        <span class="visual-model-selector__value" :title="selectedModelLabel">
          {{ selectedModelLabel }}
        </span>
        <t-loading v-if="loading" size="small" class="visual-model-selector__spinner" />
        <t-icon
          v-else
          name="chevron-down"
          class="visual-model-selector__chevron"
          :class="{ 'is-open': menuVisible }"
        />
      </button>

      <template #content>
        <div class="visual-model-selector__panel" role="listbox" :aria-label="placeholderText">
          <div v-if="models.length === 0" class="visual-model-selector__empty">
            {{ placeholderText }}
          </div>

          <button
            v-for="model in models"
            :key="model.id"
            type="button"
            class="visual-model-selector__option"
            :class="{ 'is-selected': model.id === selectedModelId }"
            role="option"
            :aria-selected="model.id === selectedModelId"
            @click="selectModel(model.id || '')"
          >
            <span class="visual-model-selector__option-check" aria-hidden="true">
              <t-icon v-if="model.id === selectedModelId" name="check" />
            </span>
            <span class="visual-model-selector__option-copy">
              <strong :title="modelDisplayName(model)">{{ modelDisplayName(model) }}</strong>
              <small v-if="model.display_name" :title="model.name">{{ model.name }}</small>
            </span>
            <span class="visual-model-selector__badges">
              <span v-if="model.is_builtin" class="visual-model-selector__badge">
                {{ $t('model.builtinTag') }}
              </span>
              <span v-if="model.is_default" class="visual-model-selector__badge is-default">
                {{ $t('model.defaultTag') }}
              </span>
            </span>
          </button>

          <button
            v-if="!disabled"
            type="button"
            class="visual-model-selector__option visual-model-selector__add"
            @click="requestAddModel"
          >
            <span class="visual-model-selector__option-check"><t-icon name="add" /></span>
            <span>{{ $t('model.addModelInSettings') }}</span>
          </button>
        </div>
      </template>
    </t-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { listModels, type ModelConfig } from '@/api/model'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  modelType: 'KnowledgeQA' | 'Embedding' | 'Rerank' | 'VLLM' | 'ASR'
  selectedModelId?: string
  disabled?: boolean
  placeholder?: string
  status?: 'default' | 'success' | 'warning' | 'error'
  allModels?: ModelConfig[]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: '',
  status: 'default',
})

const emit = defineEmits<{
  'update:selectedModelId': [value: string]
  'add-model': []
}>()

const models = ref<ModelConfig[]>([])
const loading = ref(false)
const menuVisible = ref(false)
const { t } = useI18n()

const placeholderText = computed(() => props.placeholder || t('model.selectModelPlaceholder'))

const modelDisplayName = (model: ModelConfig) => {
  const displayName = model.display_name?.trim()
  return displayName || model.name
}

watch(() => props.allModels, (newModels) => {
  if (newModels && Array.isArray(newModels)) {
    models.value = newModels.filter(m => m.type === props.modelType)
  }
}, { immediate: true })

watch(() => props.modelType, () => {
  if (props.allModels) {
    models.value = props.allModels.filter(m => m.type === props.modelType)
  } else {
    void loadModels()
  }
})

const selectedModel = computed(() => {
  if (!props.selectedModelId) return null
  return models.value.find(m => m.id === props.selectedModelId) || null
})

const selectedModelLabel = computed(() =>
  selectedModel.value ? modelDisplayName(selectedModel.value) : placeholderText.value,
)

const loadModels = async () => {
  if (props.allModels) return
  loading.value = true
  try {
    const result = await listModels()
    if (result && Array.isArray(result)) {
      models.value = result.filter(m => m.type === props.modelType)
    } else {
      models.value = []
    }
  } catch (error) {
    console.error(t('model.loadFailed'), error)
    MessagePlugin.error(t('model.loadFailed'))
    models.value = []
  } finally {
    loading.value = false
  }
}

const handleModelChange = (value: string) => {
  if (value === '__add_model__') {
    emit('add-model')
    return
  }
  emit('update:selectedModelId', value)
}

const selectModel = (value: string) => {
  if (!value) return
  menuVisible.value = false
  handleModelChange(value)
}

const requestAddModel = () => {
  menuVisible.value = false
  handleModelChange('__add_model__')
}

defineExpose({ refresh: loadModels })

onMounted(() => {
  if (!props.allModels) void loadModels()
})
</script>

<style scoped lang="less">
.visual-model-selector {
  width: 100%;
  min-width: 0;
}

.visual-model-selector__trigger {
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding: 6px 9px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  background: #fff;
  color: #4b5563;
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
}

.visual-model-selector__trigger:hover:not(:disabled) {
  border-color: #d1d5db;
  background: #f9fafb;
}

.visual-model-selector__trigger:focus-visible {
  outline: none;
  border-color: #9ca3af;
  box-shadow: 0 0 0 2px rgb(17 24 39 / 6%);
}

.visual-model-selector.is-success .visual-model-selector__trigger { border-color: #bbf7d0; }
.visual-model-selector.is-warning .visual-model-selector__trigger { border-color: #fde68a; }
.visual-model-selector.is-error .visual-model-selector__trigger { border-color: #fecaca; }

.visual-model-selector__trigger:disabled {
  cursor: default;
  background: #f9fafb;
  color: #9ca3af;
  opacity: .7;
}

.visual-model-selector__value {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-model-selector__chevron,
.visual-model-selector__spinner {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
  font-size: 12px;
  color: #9ca3af;
}

.visual-model-selector__chevron {
  transition: transform 140ms ease;
}

.visual-model-selector__chevron.is-open {
  transform: rotate(180deg);
}

.visual-model-selector__panel {
  width: min(320px, calc(100vw - 24px));
  min-width: 220px;
  max-height: min(360px, calc(100vh - 40px));
  overflow-y: auto;
  padding: 2px;
  box-sizing: border-box;
}

.visual-model-selector__option {
  width: 100%;
  min-height: 38px;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}

.visual-model-selector__option:hover,
.visual-model-selector__option.is-selected {
  background: #f3f4f6;
  color: #111827;
}

.visual-model-selector__option-check {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
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

.visual-model-selector__add {
  margin-top: 3px;
  border-top: 1px solid #f3f4f6;
  border-radius: 0 0 8px 8px;
  color: #4b5563;
  font-weight: 600;
}

.visual-model-selector__empty {
  padding: 14px 10px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .visual-model-selector__trigger,
  .visual-model-selector__chevron {
    transition: none !important;
  }
}
</style>
