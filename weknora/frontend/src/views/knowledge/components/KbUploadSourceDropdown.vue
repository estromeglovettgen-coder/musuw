<template>
  <div class="kb-upload-source-dropdown">
    <input
      ref="fileInputRef"
      type="file"
      class="hidden-file-input"
      multiple
      :accept="acceptFileTypes || undefined"
      @change="(e) => handleFilesChange(e, false)"
    />
    <input
      ref="folderInputRef"
      type="file"
      class="hidden-file-input"
      webkitdirectory
      multiple
      @change="(e) => handleFilesChange(e, true)"
    />

    <button
      type="button"
      :class="['kb-upload-source-trigger', triggerClass]"
      :data-guide="dataGuide || undefined"
      :title="tooltipText"
      @click="menuVisible = !menuVisible"
    >
      <ReferenceIcon name="plus" :size="14" />
      <span>{{ t('knowledgeBase.addDocument') }}</span>
      <ReferenceIcon name="chevron-down" :size="12" class="kb-upload-source-trigger__chevron" />
    </button>

    <template v-if="menuVisible">
      <div class="kb-upload-source-backdrop" @click="menuVisible = false" />
      <div class="kb-upload-source-menu" role="menu">
        <button type="button" role="menuitem" @click="handleActionSelect('upload')">
          <ReferenceIcon name="upload" :size="16" />
          <span>{{ t('upload.uploadDocument') }}</span>
        </button>
        <button type="button" role="menuitem" @click="handleActionSelect('uploadFolder')">
          <ReferenceIcon name="folder-plus" :size="16" />
          <span>{{ t('upload.uploadFolder') }}</span>
        </button>
        <button type="button" role="menuitem" @click="handleActionSelect('importURL')">
          <ReferenceIcon name="globe" :size="16" />
          <span>{{ t('knowledgeBase.importURL') }}</span>
        </button>
        <button v-if="includeManual" type="button" role="menuitem" @click="handleActionSelect('manualCreate')">
          <ReferenceIcon name="pen-line" :size="16" />
          <span>{{ t('upload.onlineEdit') }}</span>
        </button>
      </div>
    </template>

    <t-dialog
      v-model:visible="urlDialogVisible"
      :header="t('knowledgeBase.importURLTitle')"
      :confirm-btn="{ content: t('common.confirm'), theme: 'primary' }"
      :cancel-btn="{ content: t('common.cancel') }"
      width="500px"
      @confirm="handleUrlDialogConfirm"
      @cancel="handleUrlDialogCancel"
    >
      <div class="url-import-form">
        <div class="url-input-label">{{ t('knowledgeBase.urlLabel') }}</div>
        <t-input
          v-model="urlInputValue"
          :placeholder="t('knowledgeBase.urlPlaceholder')"
          clearable
          autofocus
          @enter="handleUrlDialogConfirm"
        />
        <div class="url-input-tip">{{ t('knowledgeBase.urlTip') }}</div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { filterUploadFiles } from '../utils/uploadSources'

const props = withDefaults(defineProps<{
  acceptFileTypes?: string
  supportedFileTypes?: string[]
  includeManual?: boolean
  triggerIcon?: string
  triggerClass?: string
  dataGuide?: string
  tooltip?: string
  placement?: 'top' | 'bottom' | 'bottom-right' | 'bottom-left'
}>(), {
  acceptFileTypes: '',
  supportedFileTypes: () => [],
  includeManual: false,
  triggerIcon: 'file-add',
  triggerClass: '',
  dataGuide: '',
  tooltip: '',
  placement: 'bottom-right',
})

const emit = defineEmits<{
  files: [files: File[]]
  url: [url: string]
  manual: []
}>()

const { t } = useI18n()
const fileInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const urlDialogVisible = ref(false)
const urlInputValue = ref('')
const menuVisible = ref(false)
const tooltipText = computed(() => props.tooltip || t('knowledgeBase.addDocument'))

const handleActionSelect = (value: string) => {
  menuVisible.value = false
  switch (value) {
    case 'upload':
      fileInputRef.value?.click()
      break
    case 'uploadFolder':
      folderInputRef.value?.click()
      break
    case 'importURL':
      urlInputValue.value = ''
      urlDialogVisible.value = true
      break
    case 'manualCreate':
      emit('manual')
      break
    default:
      break
  }
}

const notifyFilterResult = (result: ReturnType<typeof filterUploadFiles>, emptyAllSkippedKey: string) => {
  const { validFiles, skippedCount, videoFilteredCount } = result
  if (validFiles.length === 0) {
    if (skippedCount > 0) MessagePlugin.warning(t(emptyAllSkippedKey))
    return false
  }
  if (videoFilteredCount > 0) {
    MessagePlugin.warning(t('knowledgeBase.videosFilteredNoVLM', { count: videoFilteredCount }))
  }
  if (skippedCount > 0) {
    MessagePlugin.warning(t('knowledgeBase.filesSkippedNoEngine', { count: skippedCount }))
  }
  return true
}

const handleFilesChange = (event: Event, fromFolder: boolean) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  const result = filterUploadFiles(files, {
    supportedFileTypes: props.supportedFileTypes,
    fromFolder,
    multiFile: files.length > 1,
  })

  if (!notifyFilterResult(result, 'knowledgeBase.allFilesSkippedNoEngine')) {
    input.value = ''
    return
  }

  emit('files', result.validFiles)
  input.value = ''
}

const handleUrlDialogConfirm = () => {
  const url = urlInputValue.value.trim()
  if (!url) {
    MessagePlugin.warning(t('knowledgeBase.urlRequired'))
    return
  }
  try {
    new URL(url)
  } catch {
    MessagePlugin.warning(t('knowledgeBase.invalidURL'))
    return
  }
  urlDialogVisible.value = false
  urlInputValue.value = ''
  emit('url', url)
}

const handleUrlDialogCancel = () => {
  urlDialogVisible.value = false
  urlInputValue.value = ''
}

const openUrlDialog = () => {
  urlInputValue.value = ''
  urlDialogVisible.value = true
}

defineExpose({ openUrlDialog })
</script>

<style scoped>
.kb-upload-source-dropdown {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}
.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.kb-upload-source-trigger {
  height: 30px;
  border: 0;
  border-radius: 12px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #111827;
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  cursor: pointer;
  transition: background-color 150ms ease, transform 150ms ease;
}
.kb-upload-source-trigger:hover { background: #000; }
.kb-upload-source-trigger:active { transform: scale(.98); }
.kb-upload-source-trigger__chevron { color: #9ca3af; }
.kb-upload-source-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
}
.kb-upload-source-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 40;
  width: 176px;
  padding: 6px 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10);
  text-align: left;
}
.kb-upload-source-menu button {
  width: 100%;
  height: 32px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
}
.kb-upload-source-menu button:hover { background: #f9fafb; }
.kb-upload-source-menu button :deep(.reference-icon) { color: #4b5563; }
.url-import-form { font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif; }
.url-input-label { margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #111827; }
.url-input-tip { margin-top: 8px; font-size: 12px; line-height: 1.5; color: #9ca3af; }
</style>
