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

    <div v-if="urlDialogVisible" class="reference-url-modal" @click.self="handleUrlDialogCancel">
      <div class="reference-url-modal__panel" role="dialog" aria-modal="true" aria-labelledby="reference-url-modal-title">
        <header class="reference-url-modal__header">
          <div class="reference-url-modal__heading">
            <div class="reference-url-modal__icon"><ReferenceIcon name="globe" :size="16" /></div>
            <div>
              <h3 id="reference-url-modal-title">导入网页 / 抓取 URL</h3>
              <p>自动提取网页 HTML 内容并转换为知识文档</p>
            </div>
          </div>
          <button type="button" class="reference-url-modal__close" aria-label="关闭" @click="handleUrlDialogCancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <div class="reference-url-modal__body">
          <label for="reference-url-input">网页链接 (URL)</label>
          <input
            id="reference-url-input"
            v-model="urlInputValue"
            type="text"
            placeholder="https://example.com/article"
            autofocus
            @keydown.enter="handleUrlDialogConfirm"
          />
        </div>

        <footer class="reference-url-modal__footer">
          <button type="button" class="reference-url-modal__cancel" @click="handleUrlDialogCancel">取消</button>
          <button
            type="button"
            class="reference-url-modal__submit"
            :disabled="!urlInputValue.trim()"
            @click="handleUrlDialogConfirm"
          >
            <ReferenceIcon name="globe" :size="12" />
            <span>开始抓取入库</span>
          </button>
        </footer>
      </div>
    </div>
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
  }
}

const notifyFilterResult = (result: ReturnType<typeof filterUploadFiles>, emptyAllSkippedKey: string) => {
  const { validFiles, skippedCount, videoFilteredCount } = result
  if (validFiles.length === 0) {
    if (skippedCount > 0) MessagePlugin.warning(t(emptyAllSkippedKey))
    return false
  }
  if (videoFilteredCount > 0) MessagePlugin.warning(t('knowledgeBase.videosFilteredNoVLM', { count: videoFilteredCount }))
  if (skippedCount > 0) MessagePlugin.warning(t('knowledgeBase.filesSkippedNoEngine', { count: skippedCount }))
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
/* Neutralize the old parent pseudo-label while that parent file is being removed. */
.kb-upload-source-trigger::after { content: none !important; }
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

.reference-url-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.40);
  backdrop-filter: blur(2px);
}
.reference-url-modal__panel {
  width: 100%;
  max-width: 448px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
  color: #111827;
  text-align: left;
}
.reference-url-modal__header {
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: rgb(249 250 251 / 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.reference-url-modal__heading { display: flex; align-items: center; gap: 8px; min-width: 0; }
.reference-url-modal__icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 12px;
  background: #111827;
  color: #fff;
  display: grid;
  place-items: center;
}
.reference-url-modal__heading h3 { margin: 0; color: #030712; font-size: 14px; line-height: 20px; font-weight: 800; }
.reference-url-modal__heading p { margin: 0; color: #9ca3af; font-size: 11px; line-height: 16px; }
.reference-url-modal__close { width: 24px; height: 24px; border: 0; border-radius: 8px; background: transparent; color: #9ca3af; display: grid; place-items: center; cursor: pointer; }
.reference-url-modal__close:hover { background: #f3f4f6; color: #4b5563; }
.reference-url-modal__body { padding: 16px 24px 20px; }
.reference-url-modal__body label { display: block; margin-bottom: 4px; color: #374151; font-size: 12px; line-height: 16px; font-weight: 700; }
.reference-url-modal__body input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  color: #111827;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  outline: none;
}
.reference-url-modal__body input:focus { border-color: #9ca3af; }
.reference-url-modal__footer {
  padding: 12px 24px;
  border-top: 1px solid #f3f4f6;
  background: rgb(249 250 251 / 0.5);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.reference-url-modal__cancel,
.reference-url-modal__submit {
  height: 30px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  cursor: pointer;
}
.reference-url-modal__cancel { border: 1px solid #e5e7eb; background: #fff; color: #4b5563; }
.reference-url-modal__cancel:hover { background: #f3f4f6; }
.reference-url-modal__submit { border: 1px solid #111827; background: #111827; color: #fff; display: inline-flex; align-items: center; gap: 6px; }
.reference-url-modal__submit:hover:not(:disabled) { background: #000; }
.reference-url-modal__submit:disabled { border-color: #e5e7eb; background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
</style>
