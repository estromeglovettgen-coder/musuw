<template>
  <div class="visual-model-selector">
    <t-select
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
        v-for="model in models"
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
    models.value = newModels.filter(m => m.type === props.modelType)
  }
}, { immediate: true })

const selectedModel = computed(() => {
  if (!props.selectedModelId) return null
  return models.value.find(m => m.id === props.selectedModelId)
})
void selectedModel

const loadModels = async () => {
  if (props.allModels) {
    return
  }

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

defineExpose({
  refresh: loadModels
})

onMounted(() => {
  if (!props.allModels) {
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

@media (prefers-reduced-motion: reduce) {
  .visual-model-selector__control :deep(.t-input) {
    transition: none !important;
  }
}
</style>
