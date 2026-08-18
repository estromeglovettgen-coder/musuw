<template>
  <div class="visual-upload-source">
    <input
      ref="fileInputRef"
      type="file"
      class="visual-upload-source__hidden-input"
      multiple
      :accept="acceptFileTypes || undefined"
      @change="(e) => handleFilesChange(e, false)"
    />
    <input
      ref="folderInputRef"
      type="file"
      class="visual-upload-source__hidden-input"
      webkitdirectory
      multiple
      @change="(e) => handleFilesChange(e, true)"
    />

    <t-popup
      v-model:visible="menuVisible"
      trigger="click"
      :placement="placement"
      :overlay-inner-style="{ padding: '0' }"
      destroy-on-close
    >
      <button
        type="button"
        :class="['visual-upload-source__trigger', triggerClass]"
        :data-guide="dataGuide || undefined"
        :aria-label="tooltipText"
        :title="tooltipText"
      >
        <t-icon name="add" class="visual-upload-source__trigger-plus" />
        <span>{{ tooltipText }}</span>
        <t-icon name="chevron-down" class="visual-upload-source__trigger-caret" />
      </button>

      <template #content>
        <div class="visual-upload-menu" role="menu" :aria-label="tooltipText">
          <button
            v-for="option in dropdownOptions"
            :key="option.value"
            type="button"
            class="visual-upload-menu__item"
            role="menuitem"
            @click="selectAction(option.value)"
          >
            <t-icon :name="option.icon" />
            <span>{{ option.content }}</span>
          </button>
        </div>
      </template>
    </t-popup>

    <Teleport to="body">
      <Transition name="visual-url-modal">
        <div
          v-if="urlDialogVisible"
          class="visual-url-modal__overlay"
          role="presentation"
          @click.self="handleUrlDialogCancel"
        >
          <section
            class="visual-url-modal"
            role="dialog"
            aria-modal="true"
            :aria-label="t('knowledgeBase.importURLTitle')"
          >
            <header class="visual-url-modal__header">
              <div>
                <h3>{{ t('knowledgeBase.importURLTitle') }}</h3>
                <p>{{ t('knowledgeBase.urlTip') }}</p>
              </div>
              <button
                type="button"
                class="visual-url-modal__close"
                :aria-label="t('common.cancel')"
                @click="handleUrlDialogCancel"
              >
                <t-icon name="close" />
              </button>
            </header>

            <div class="visual-url-modal__body">
              <label class="visual-url-modal__label" for="visual-url-import-input">
                {{ t('knowledgeBase.urlLabel') }}
              </label>
              <t-input
                id="visual-url-import-input"
                v-model="urlInputValue"
                :placeholder="t('knowledgeBase.urlPlaceholder')"
                clearable
                autofocus
                @enter="handleUrlDialogConfirm"
              />
            </div>

            <footer class="visual-url-modal__footer">
              <button type="button" class="visual-url-modal__button is-secondary" @click="handleUrlDialogCancel">
                {{ t('common.cancel') }}
              </button>
              <button type="button" class="visual-url-modal__button is-primary" @click="handleUrlDialogConfirm">
                {{ t('common.confirm') }}
              </button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
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
const menuVisible = ref(false)
const urlDialogVisible = ref(false)
const urlInputValue = ref('')

const tooltipText = computed(() => props.tooltip || t('knowledgeBase.addDocument'))

const dropdownOptions = computed(() => {
  const options = [
    {
      content: t('upload.uploadDocument'),
      value: 'upload',
      icon: 'upload',
    },
    {
      content: t('upload.uploadFolder'),
      value: 'uploadFolder',
      icon: 'folder-add',
    },
    {
      content: t('knowledgeBase.importURL'),
      value: 'importURL',
      icon: 'link',
    },
  ]
  if (props.includeManual) {
    options.push({
      content: t('upload.onlineEdit'),
      value: 'manualCreate',
      icon: 'edit',
    })
  }
  return options
})

const selectAction = (value: string) => {
  menuVisible.value = false
  handleActionSelect({ value })
}

const handleActionSelect = (data: { value: string }) => {
  switch (data.value) {
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
    if (skippedCount > 0) {
      MessagePlugin.warning(t(emptyAllSkippedKey))
    }
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

<style scoped lang="less">
.visual-upload-source {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.visual-upload-source__hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.visual-upload-source__trigger {
  min-height: 36px;
  padding: 8px 14px;
  border: 0;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: #111827;
  color: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
}

.visual-upload-source__trigger:hover {
  background: #000;
  box-shadow: 0 2px 5px rgb(0 0 0 / 8%);
}

.visual-upload-source__trigger:active {
  transform: scale(.98);
}

.visual-upload-source__trigger-plus,
.visual-upload-source__trigger-caret {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

.visual-upload-source__trigger-caret {
  width: 12px;
  height: 12px;
  font-size: 12px;
  opacity: .72;
}

.visual-upload-menu {
  min-width: 176px;
  padding: 6px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 30px rgb(0 0 0 / 12%);
}

.visual-upload-menu__item {
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #374151;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
}

.visual-upload-menu__item:hover {
  background: #f3f4f6;
  color: #111827;
}

.visual-upload-menu__item :deep(.t-icon) {
  flex: 0 0 15px;
  width: 15px;
  height: 15px;
  font-size: 15px;
  color: #6b7280;
}

.visual-url-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 35%);
  backdrop-filter: blur(3px);
}

.visual-url-modal {
  width: min(480px, 100%);
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  color: #1f2937;
  box-shadow: 0 24px 60px rgb(0 0 0 / 18%);
}

.visual-url-modal__header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.visual-url-modal__header h3 {
  margin: 0 0 3px;
  color: #111827;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
}

.visual-url-modal__header p {
  margin: 0;
  color: #9ca3af;
  font-size: 11px;
  line-height: 16px;
}

.visual-url-modal__close {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  padding: 6px;
  border: 0;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.visual-url-modal__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.visual-url-modal__body {
  padding: 20px;
}

.visual-url-modal__label {
  display: block;
  margin: 0 0 8px;
  color: #374151;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.visual-url-modal__body :deep(.t-input) {
  min-height: 38px;
  border-color: #e5e7eb;
  border-radius: 11px;
  background: #fff;
  color: #1f2937;
  font-size: 12px;
}

.visual-url-modal__footer {
  padding: 14px 20px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: #f9fafb;
}

.visual-url-modal__button {
  min-height: 34px;
  padding: 7px 14px;
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  cursor: pointer;
}

.visual-url-modal__button.is-secondary {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
}

.visual-url-modal__button.is-primary {
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
}

.visual-url-modal-enter-active,
.visual-url-modal-leave-active {
  transition: opacity 150ms ease;
}

.visual-url-modal-enter-from,
.visual-url-modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .visual-upload-source__trigger,
  .visual-url-modal-enter-active,
  .visual-url-modal-leave-active {
    transition: none !important;
  }
}
</style>
