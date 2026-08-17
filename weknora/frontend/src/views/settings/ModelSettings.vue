<template>
  <div class="reference-model-settings">
    <div class="reference-model-toolbar">
      <div class="reference-model-note" role="note">
        <div class="reference-model-note__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></svg>
        </div>
        <div class="reference-model-note__copy">
          <strong>{{ $t('modelSettings.builtinModels.title') }}</strong>
          <p>{{ $t(authStore.isSystemAdmin ? 'modelSettings.builtinModels.descriptionAdmin' : 'modelSettings.builtinModels.description') }}</p>
          <a href="https://github.com/Tencent/WeKnora/blob/main/docs/BUILTIN_MODELS.md" target="_blank" rel="noopener noreferrer">
            <span>{{ $t('modelSettings.builtinModels.viewGuide') }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>
      </div>

      <button
        v-if="authStore.hasRole('admin')"
        id="btn-debug-model"
        type="button"
        class="reference-model-debug"
        @click="showDebugDrawer = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
        <span>{{ $t('modelSettings.actions.debugModel') }}</span>
      </button>
    </div>

    <div class="reference-model-tabs" data-guide="settings-models" role="tablist">
      <button type="button" role="tab" :aria-selected="activeTypeFilter === 'all'" :class="{ active: activeTypeFilter === 'all' }" @click="activeTypeFilter = 'all'">
        {{ $t('common.all') }} <span>{{ allLegacyModels.length }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="activeTypeFilter === 'chat'" :class="{ active: activeTypeFilter === 'chat' }" @click="activeTypeFilter = 'chat'">
        {{ $t('modelSettings.typeShort.chat') }} <span>{{ countByType('chat') }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="activeTypeFilter === 'embedding'" :class="{ active: activeTypeFilter === 'embedding' }" @click="activeTypeFilter = 'embedding'">
        {{ $t('modelSettings.typeShort.embedding') }} <span>{{ countByType('embedding') }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="activeTypeFilter === 'rerank'" :class="{ active: activeTypeFilter === 'rerank' }" @click="activeTypeFilter = 'rerank'">
        {{ $t('modelSettings.typeShort.rerank') }} <span>{{ countByType('rerank') }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="activeTypeFilter === 'vllm'" :class="{ active: activeTypeFilter === 'vllm' }" @click="activeTypeFilter = 'vllm'">
        {{ $t('modelSettings.typeShort.vllm') }} <span>{{ countByType('vllm') }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="activeTypeFilter === 'asr'" :class="{ active: activeTypeFilter === 'asr' }" @click="activeTypeFilter = 'asr'">
        {{ $t('modelSettings.typeShort.asr') }} <span>{{ countByType('asr') }}</span>
      </button>
    </div>

    <div v-if="loading" class="reference-model-grid" aria-busy="true">
      <div v-for="n in 4" :key="n" class="reference-model-skeleton"><span/><span/><span/></div>
    </div>

    <div v-else-if="filteredModels.length === 0 && !authStore.hasRole('admin')" class="reference-model-empty">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M9 9h6v6H9z"/></svg>
      <strong>{{ emptyHint }}</strong>
    </div>

    <div v-else class="reference-model-grid">
      <article
        v-for="model in filteredModels"
        :key="`${model._modelType}-${model.id}`"
        class="reference-model-card"
        :class="{ builtin: model.isBuiltin, clickable: isModelCardClickable(model) }"
        :role="isModelCardClickable(model) ? 'button' : undefined"
        :tabindex="isModelCardClickable(model) ? 0 : undefined"
        @click="onModelCardClick($event, model._modelType, model)"
        @keydown.enter="onModelCardClick($event, model._modelType, model)"
      >
        <div class="reference-model-card__icon" :class="`type-${model._modelType}`" :aria-label="typeLabel(model._modelType)">
          <svg v-if="model._modelType === 'chat'" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>
          <svg v-else-if="model._modelType === 'embedding'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="m7.7 7 3.2 8"/><path d="m16.3 7-3.2 8"/><path d="M8 6h8"/></svg>
          <svg v-else-if="model._modelType === 'rerank'" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M6 12h12"/><path d="M10 18h4"/></svg>
          <svg v-else-if="model._modelType === 'vllm'" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-3 0l-6 6"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
        </div>

        <div class="reference-model-card__body">
          <div class="reference-model-card__title-row">
            <h4 :title="modelDisplayName(model)">{{ modelDisplayName(model) }}</h4>
            <span v-if="model.isDefault" class="reference-model-default">{{ $t('model.defaultTag') }}</span>
            <span v-if="model.isBuiltin" class="reference-model-builtin" :title="$t('modelSettings.builtinTag')">
              <svg v-if="authStore.isSystemAdmin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
          </div>
          <p>
            <span>{{ vendorLabel(model) }}</span>
            <template v-if="model._modelType === 'embedding' && model.dimension"><span>·</span><span>{{ $t('model.editor.dimensionLabel') }} {{ model.dimension }}</span></template>
            <template v-if="model._modelType === 'chat' && model.supportsVision"><span>·</span><span>{{ $t('model.editor.supportsVisionLabel') }}</span></template>
          </p>
          <span class="reference-model-type-label">{{ typeLabel(model._modelType) }}</span>
        </div>

        <div v-if="canManageModel(model)" class="model-card__actions reference-model-actions" @click.stop>
          <button type="button" :title="$t('common.edit')" @click="editModel(model._modelType, model)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button v-if="!model.isBuiltin" type="button" :title="$t('common.copy')" @click="copyModel(model._modelType, model.id)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
          </button>
          <button v-if="canDeleteModel(model)" type="button" class="danger" :title="$t('common.delete')" @click="deleteConfirmModel = model">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
          </button>
        </div>
      </article>

      <button
        v-if="authStore.hasRole('admin')"
        type="button"
        class="reference-model-card reference-model-add"
        data-guide="settings-add-model"
        @click="openAddDialog"
      >
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></span>
        <strong>{{ $t('modelSettings.actions.addModel') }}</strong>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="deleteConfirmModel" class="reference-model-confirm-backdrop" @mousedown.self="deleteConfirmModel = null">
        <div class="reference-model-confirm">
          <div class="reference-model-confirm__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z"/></svg></div>
          <h4>{{ $t('common.delete') }}</h4>
          <p>{{ $t('modelSettings.confirmDelete', { name: modelDisplayName(deleteConfirmModel) }) }}</p>
          <div class="reference-model-confirm__actions">
            <button type="button" @click="deleteConfirmModel = null">{{ $t('common.cancel') }}</button>
            <button type="button" class="danger" @click="confirmDeleteModel">{{ $t('common.delete') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <ModelEditorDialog v-model:visible="showDialog" :model-type="currentModelType" :model-data="editingModel" @confirm="handleModelSave" />
    <ModelDebugDrawer v-model:visible="showDebugDrawer" :models="allModels" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import ModelEditorDialog from '@/components/ModelEditorDialog.vue'
import ModelDebugDrawer from '@/components/ModelDebugDrawer.vue'
import { listModels, createModel, updateModel as updateModelAPI, deleteModel as deleteModelAPI, type ModelConfig } from '@/api/model'
import { useAuthStore } from '@/stores/auth'

const { t, te } = useI18n()
const authStore = useAuthStore()
const props = defineProps<{ initialType?: string | null }>()
type ModelType = 'chat' | 'embedding' | 'rerank' | 'vllm' | 'asr'
type FilterType = 'all' | ModelType

const showDialog = ref(false)
const showDebugDrawer = ref(false)
const currentModelType = ref<ModelType>('chat')
const editingModel = ref<any>(null)
const loading = ref(true)
const activeTypeFilter = ref<FilterType>('all')
const deleteConfirmModel = ref<any>(null)

const normalizeInitialType = (value?: string | null): FilterType => {
  const key = (value || '').toLowerCase()
  if (key === 'knowledgeqa' || key === 'chat') return 'chat'
  if (key === 'embedding' || key === 'rerank' || key === 'vllm' || key === 'asr') return key
  return 'all'
}

watch(() => props.initialType, value => {
  activeTypeFilter.value = normalizeInitialType(value)
}, { immediate: true })

const allModels = ref<ModelConfig[]>([])

const backendTypeToModelType: Record<string, ModelType> = {
  KnowledgeQA: 'chat',
  Embedding: 'embedding',
  Rerank: 'rerank',
  VLLM: 'vllm',
  ASR: 'asr'
}

function convertToLegacyFormat(model: ModelConfig) {
  return {
    id: model.id!,
    name: model.name,
    displayName: model.display_name || '',
    source: model.source,
    modelName: model.name,
    baseUrl: model.parameters.base_url || '',
    apiKey: '',
    provider: model.parameters.provider || '',
    dimension: model.parameters.embedding_parameters?.dimension,
    supportsDimensionOverride: model.parameters.embedding_parameters?.supports_dimension_override || false,
    isBuiltin: model.is_builtin || false,
    isDefault: model.is_default || false,
    supportsVision: model.parameters.supports_vision || false,
    maxConcurrency: model.parameters.max_concurrency,
    customHeaders: model.parameters.custom_headers
      ? Object.entries(model.parameters.custom_headers).map(([key, value]) => ({ key, value: String(value) }))
      : [],
    lkeapRegion: model.parameters.extra_config?.region || 'ap-guangzhou',
    thinkingControl: model.parameters.extra_config?.thinking_control,
    _modelType: backendTypeToModelType[model.type] || 'chat' as ModelType,
    credentials: model.credentials,
  }
}

const allLegacyModels = computed(() => allModels.value.map(convertToLegacyFormat))
const filteredModels = computed(() => {
  if (activeTypeFilter.value === 'all') return allLegacyModels.value
  return allLegacyModels.value.filter(m => m._modelType === activeTypeFilter.value)
})

const countByType = (type: ModelType) => allLegacyModels.value.filter(m => m._modelType === type).length

const typeLabel = (type: ModelType) => {
  const map: Record<ModelType, string> = {
    chat: t('modelSettings.typeShort.chat'),
    embedding: t('modelSettings.typeShort.embedding'),
    rerank: t('modelSettings.typeShort.rerank'),
    vllm: t('modelSettings.typeShort.vllm'),
    asr: t('modelSettings.typeShort.asr')
  }
  return map[type]
}

const sourceLabel = (type: ModelType) => {
  if (type === 'vllm' || type === 'asr') return t('modelSettings.source.openaiCompatible')
  return t('modelSettings.source.remote')
}

const providerLabel = (model: any): string => {
  const id = model.provider
  if (!id) return ''
  const key = `model.editor.providers.${id}.label`
  return te(key) ? t(key) : id
}

const vendorLabel = (model: any): string => {
  if (model.source === 'local') return 'Ollama'
  if (model.provider === 'generic') return t('modelSettings.source.custom')
  return providerLabel(model) || sourceLabel(model._modelType)
}

const modelDisplayName = (model: any) => {
  const displayName = typeof model.displayName === 'string' ? model.displayName.trim() : ''
  return displayName || model.name
}

const emptyHint = computed(() => {
  if (activeTypeFilter.value === 'all') return t('modelSettings.chat.empty')
  const map: Record<ModelType, string> = {
    chat: t('modelSettings.chat.empty'),
    embedding: t('modelSettings.embedding.empty'),
    rerank: t('modelSettings.rerank.empty'),
    vllm: t('modelSettings.vllm.empty'),
    asr: t('modelSettings.asr.empty')
  }
  return map[activeTypeFilter.value as ModelType]
})

const loadModels = async () => {
  loading.value = true
  try {
    const models = await listModels()
    allModels.value = models
  } catch (error: any) {
    console.error('加载模型列表失败:', error)
    MessagePlugin.error(error.message)
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  currentModelType.value = activeTypeFilter.value === 'all' ? 'chat' : activeTypeFilter.value
  editingModel.value = null
  showDialog.value = true
}

const canEditModel = (model: any) =>
  model.isBuiltin ? authStore.isSystemAdmin : authStore.hasRole('admin')

const isModelCardClickable = (model: any) => canEditModel(model)
const canManageModel = (model: any) => canEditModel(model)
const canDeleteModel = (model: any) => authStore.hasRole('admin') && !model.isBuiltin

const onModelCardClick = (event: Event, type: ModelType, model: any) => {
  if (!isModelCardClickable(model)) return
  if (event.type === 'keydown') {
    const ke = event as KeyboardEvent
    if (ke.key !== 'Enter' && ke.key !== ' ') return
    ke.preventDefault()
  }
  const target = event.target as HTMLElement | null
  if (target?.closest('.model-card__actions')) return
  editModel(type, model)
}

const editModel = (type: ModelType, model: any) => {
  if (model.isBuiltin && !authStore.isSystemAdmin) {
    MessagePlugin.warning(t('modelSettings.toasts.builtinCannotEdit'))
    return
  }
  if (!model.isBuiltin && !authStore.hasRole('admin')) return
  currentModelType.value = type
  editingModel.value = { ...model }
  showDialog.value = true
}

const handleModelSave = async (modelData: any) => {
  const saveType: ModelType = modelData.modelType ?? currentModelType.value
  currentModelType.value = saveType

  try {
    if (!modelData.modelName || !modelData.modelName.trim()) {
      MessagePlugin.warning(t('modelSettings.toasts.nameRequired'))
      return
    }
    if (modelData.modelName.trim().length > 100) {
      MessagePlugin.warning(t('modelSettings.toasts.nameTooLong'))
      return
    }
    if (modelData.displayName && modelData.displayName.trim().length > 100) {
      MessagePlugin.warning(t('modelSettings.toasts.displayNameTooLong'))
      return
    }
    if (modelData.source === 'remote') {
      if (!modelData.baseUrl || !modelData.baseUrl.trim()) {
        MessagePlugin.warning(t('modelSettings.toasts.baseUrlRequired'))
        return
      }
      try { new URL(modelData.baseUrl.trim()) }
      catch {
        MessagePlugin.warning(t('modelSettings.toasts.baseUrlInvalid'))
        return
      }
    }
    if (saveType === 'embedding') {
      if (!modelData.dimension || modelData.dimension < 128 || modelData.dimension > 4096) {
        MessagePlugin.warning(t('modelSettings.toasts.dimensionInvalid'))
        return
      }
    }

    const customHeadersMap: Record<string, string> = {}
    if (Array.isArray(modelData.customHeaders)) {
      for (const item of modelData.customHeaders) {
        const key = (item?.key ?? '').trim()
        const value = (item?.value ?? '').trim()
        if (key && value) customHeadersMap[key] = value
      }
    }

    const trimmedApiKey = (modelData.apiKey ?? '').trim()
    const apiKeyFields: { api_key?: string } = !editingModel.value && trimmedApiKey ? { api_key: trimmedApiKey } : {}
    const trimmedAppSecret = (modelData.appSecret ?? '').trim()
    const appSecretFields: { app_secret?: string } = !editingModel.value && trimmedAppSecret ? { app_secret: trimmedAppSecret } : {}
    const extraConfig: Record<string, string> = {}
    if (modelData.provider === 'lkeap' && saveType === 'rerank') extraConfig.region = (modelData.lkeapRegion || 'ap-guangzhou').trim()
    if (saveType === 'chat' && modelData.source === 'remote' && modelData.thinkingControl) extraConfig.thinking_control = modelData.thinkingControl
    const extraConfigFields = Object.keys(extraConfig).length > 0 ? { extra_config: extraConfig } : {}

    const apiModelData: ModelConfig = {
      name: modelData.modelName.trim(),
      display_name: modelData.displayName?.trim() || '',
      type: getModelType(saveType),
      source: modelData.source,
      description: '',
      is_default: modelData.isDefault ?? false,
      parameters: {
        base_url: modelData.baseUrl?.trim() || '',
        ...apiKeyFields,
        ...appSecretFields,
        provider: modelData.provider || '',
        ...extraConfigFields,
        ...(Object.keys(customHeadersMap).length > 0 ? { custom_headers: customHeadersMap } : {}),
        ...(saveType === 'embedding' && modelData.dimension ? {
          embedding_parameters: {
            dimension: modelData.dimension,
            truncate_prompt_tokens: 0,
            supports_dimension_override: modelData.supportsDimensionOverride ?? false
          }
        } : {}),
        ...(saveType === 'vllm' ? { supports_vision: true } : saveType === 'chat' ? { supports_vision: modelData.supportsVision ?? false } : {}),
        ...(['chat', 'embedding', 'vllm'].includes(saveType) && Number(modelData.maxConcurrency) > 0
          ? { max_concurrency: Number(modelData.maxConcurrency) }
          : {})
      }
    }

    if (editingModel.value && editingModel.value.id) {
      await updateModelAPI(editingModel.value.id, apiModelData)
      MessagePlugin.success(t('modelSettings.toasts.updated'))
    } else {
      await createModel(apiModelData)
      MessagePlugin.success(t('modelSettings.toasts.added'))
    }
    showDialog.value = false
    await loadModels()
  } catch (error: any) {
    console.error('保存模型失败:', error)
    MessagePlugin.error(error.message || t('modelSettings.toasts.saveFailed'))
  }
}

const deleteModel = async (_type: ModelType, modelId: string) => {
  const model = allModels.value.find(m => m.id === modelId)
  if (model?.is_builtin) {
    MessagePlugin.warning(t('modelSettings.toasts.builtinCannotDelete'))
    return
  }
  try {
    await deleteModelAPI(modelId)
    MessagePlugin.success(t('modelSettings.toasts.deleted'))
    await loadModels()
  } catch (error: any) {
    console.error('删除模型失败:', error)
    MessagePlugin.error(error.message || t('modelSettings.toasts.deleteFailed'))
  }
}

const generateCopyName = (originalName: string): string => {
  const suffix = t('modelSettings.copySuffix')
  const existingNames = new Set(allModels.value.map(m => m.name))
  let candidate = `${originalName}${suffix}`
  let counter = 2
  while (existingNames.has(candidate)) {
    candidate = `${originalName}${suffix} ${counter}`
    counter += 1
  }
  return candidate
}

const copyModel = async (_type: ModelType, modelId: string) => {
  const source = allModels.value.find(m => m.id === modelId)
  if (!source) return
  if (source.is_builtin) {
    MessagePlugin.warning(t('modelSettings.toasts.builtinCannotCopy'))
    return
  }
  try {
    const newModel: ModelConfig = {
      name: generateCopyName(source.name),
      display_name: source.display_name || '',
      type: source.type,
      source: source.source,
      description: source.description || '',
      is_default: false,
      parameters: JSON.parse(JSON.stringify(source.parameters || {}))
    }
    await createModel(newModel)
    MessagePlugin.success(t('modelSettings.toasts.copied'))
    await loadModels()
  } catch (error: any) {
    console.error('复制模型失败:', error)
    MessagePlugin.error(error.message || t('modelSettings.toasts.copyFailed'))
  }
}

function getModelType(type: ModelType): 'KnowledgeQA' | 'Embedding' | 'Rerank' | 'VLLM' | 'ASR' {
  const typeMap = {
    chat: 'KnowledgeQA' as const,
    embedding: 'Embedding' as const,
    rerank: 'Rerank' as const,
    vllm: 'VLLM' as const,
    asr: 'ASR' as const
  }
  return typeMap[type]
}

const confirmDeleteModel = async () => {
  const model = deleteConfirmModel.value
  if (!model) return
  deleteConfirmModel.value = null
  await deleteModel(model._modelType, model.id)
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.reference-model-settings { width: 100%; color: #111827; font-family: Inter, "Noto Sans SC", ui-sans-serif, system-ui, sans-serif; }
.reference-model-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
.reference-model-note { min-width: 0; flex: 1; display: flex; gap: 10px; padding: 12px; border: 1px solid #f3f4f6; border-radius: 16px; background: rgb(249 250 251 / 65%); }
.reference-model-note__icon { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; border-radius: 9px; background: #fff; color: #4b5563; border: 1px solid #e5e7eb; }
.reference-model-note svg,.reference-model-debug svg,.reference-model-card svg,.reference-model-confirm svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.reference-model-note__icon svg { width: 15px; height: 15px; }
.reference-model-note__copy { min-width: 0; }
.reference-model-note__copy strong { display: block; color: #374151; font-size: 11px; line-height: 16px; font-weight: 700; }
.reference-model-note__copy p { margin: 2px 0 5px; color: #9ca3af; font-size: 10px; line-height: 15px; }
.reference-model-note__copy a { display: inline-flex; align-items: center; gap: 4px; color: #6b7280; font-size: 10px; line-height: 14px; font-weight: 600; text-decoration: none; }
.reference-model-note__copy a:hover { color: #111827; }
.reference-model-note__copy a svg { width: 11px; height: 11px; }
.reference-model-debug { height: 32px; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; padding: 0 11px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; color: #4b5563; font-size: 11px; font-weight: 700; cursor: pointer; }
.reference-model-debug:hover { border-color: #d1d5db; color: #111827; background: #f9fafb; }
.reference-model-debug svg { width: 14px; height: 14px; }
.reference-model-tabs { display: flex; align-items: center; gap: 2px; max-width: 100%; margin-bottom: 16px; padding: 3px; overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 12px; background: #f3f4f6; scrollbar-width: none; }
.reference-model-tabs::-webkit-scrollbar { display: none; }
.reference-model-tabs button { height: 28px; flex: 0 0 auto; padding: 0 9px; border: 0; border-radius: 8px; background: transparent; color: #6b7280; font-size: 10px; line-height: 14px; font-weight: 600; cursor: pointer; }
.reference-model-tabs button span { margin-left: 3px; color: #9ca3af; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; }
.reference-model-tabs button.active { background: #fff; color: #111827; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.reference-model-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.reference-model-card { position: relative; min-width: 0; min-height: 82px; display: flex; align-items: flex-start; gap: 11px; padding: 13px 14px; box-sizing: border-box; border: 1px solid rgb(229 231 235 / 80%); border-radius: 16px; background: #fff; color: #111827; text-align: left; transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
.reference-model-card.clickable { cursor: pointer; }
.reference-model-card.clickable:hover { border-color: #d1d5db; box-shadow: 0 4px 10px rgb(0 0 0 / 6%); transform: translateY(-1px); }
.reference-model-card.builtin { background: rgb(249 250 251 / 55%); }
.reference-model-card__icon { width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center; margin-top: 1px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb; color: #4b5563; }
.reference-model-card__icon svg { width: 16px; height: 16px; }
.reference-model-card__body { min-width: 0; flex: 1; }
.reference-model-card__title-row { display: flex; align-items: center; gap: 5px; min-width: 0; padding-right: 2px; }
.reference-model-card__title-row h4 { min-width: 0; flex: 1; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #111827; font-size: 11px; line-height: 16px; font-weight: 700; }
.reference-model-card__body p { display: flex; align-items: center; gap: 4px; min-width: 0; margin: 2px 0 4px; overflow: hidden; color: #9ca3af; font-size: 9px; line-height: 13px; white-space: nowrap; text-overflow: ellipsis; }
.reference-model-type-label { display: inline-flex; align-items: center; height: 17px; padding: 0 6px; border-radius: 5px; background: #f3f4f6; color: #6b7280; font-size: 8px; line-height: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .025em; }
.reference-model-default { flex: 0 0 auto; padding: 1px 5px; border-radius: 5px; background: #dcfce7; color: #15803d; font-size: 8px; line-height: 13px; font-weight: 800; }
.reference-model-builtin { width: 16px; height: 16px; flex: 0 0 16px; display: grid; place-items: center; color: #9ca3af; }
.reference-model-builtin svg { width: 12px; height: 12px; }
.reference-model-actions { position: absolute; top: 9px; right: 9px; display: flex; align-items: center; gap: 1px; padding: 2px; border: 1px solid #f3f4f6; border-radius: 9px; background: rgb(255 255 255 / 95%); opacity: 0; transform: translateY(-2px); transition: opacity 120ms ease, transform 120ms ease; }
.reference-model-card:hover .reference-model-actions,.reference-model-card:focus-within .reference-model-actions { opacity: 1; transform: none; }
.reference-model-actions button { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #9ca3af; cursor: pointer; }
.reference-model-actions button:hover { background: #f3f4f6; color: #374151; }
.reference-model-actions button.danger:hover { background: #fef2f2; color: #dc2626; }
.reference-model-actions svg { width: 13px; height: 13px; }
.reference-model-add { width: 100%; align-items: center; justify-content: center; flex-direction: column; gap: 5px; border-style: dashed; background: rgb(249 250 251 / 30%); color: #9ca3af; cursor: pointer; }
.reference-model-add:hover { border-color: #9ca3af; background: #f9fafb; color: #4b5563; }
.reference-model-add > span { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 8px; background: #f3f4f6; }
.reference-model-add svg { width: 14px; height: 14px; }
.reference-model-add strong { font-size: 10px; font-weight: 700; }
.reference-model-skeleton { height: 82px; padding: 13px; box-sizing: border-box; border: 1px solid #f3f4f6; border-radius: 16px; background: #fff; }
.reference-model-skeleton span { display: block; height: 8px; margin-bottom: 8px; border-radius: 999px; background: linear-gradient(90deg,#f3f4f6,#e5e7eb,#f3f4f6); background-size: 200% 100%; animation: reference-model-pulse 1.3s linear infinite; }
.reference-model-skeleton span:nth-child(1){width:45%}.reference-model-skeleton span:nth-child(2){width:70%}.reference-model-skeleton span:nth-child(3){width:30%}
@keyframes reference-model-pulse { to { background-position: -200% 0; } }
.reference-model-empty { min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px dashed #e5e7eb; border-radius: 16px; color: #9ca3af; }
.reference-model-empty svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.reference-model-empty strong { max-width: 360px; color: #6b7280; font-size: 10px; line-height: 15px; font-weight: 600; text-align: center; }
.reference-model-confirm-backdrop { position: fixed; inset: 0; z-index: 1600; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(0 0 0 / 40%); backdrop-filter: blur(3px); }
.reference-model-confirm { width: 100%; max-width: 360px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 20px; background: #fff; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%); }
.reference-model-confirm__icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; background: #fef2f2; color: #dc2626; }
.reference-model-confirm__icon svg { width: 17px; height: 17px; }
.reference-model-confirm h4 { margin: 12px 0 4px; color: #111827; font-size: 13px; line-height: 18px; font-weight: 700; }
.reference-model-confirm p { margin: 0; color: #6b7280; font-size: 11px; line-height: 17px; }
.reference-model-confirm__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.reference-model-confirm__actions button { height: 30px; padding: 0 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; color: #4b5563; font-size: 10px; font-weight: 700; cursor: pointer; }
.reference-model-confirm__actions button:hover { background: #f9fafb; }
.reference-model-confirm__actions button.danger { border-color: #dc2626; background: #dc2626; color: #fff; }
.reference-model-confirm__actions button.danger:hover { background: #b91c1c; }
@media (max-width: 760px) { .reference-model-grid { grid-template-columns: 1fr; } .reference-model-toolbar { flex-direction: column; } .reference-model-debug { align-self: flex-end; } }
</style>
