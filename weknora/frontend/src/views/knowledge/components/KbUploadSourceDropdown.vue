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
        <t-icon :name="triggerIcon" class="visual-upload-source__trigger-plus" />
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

    <button
      type="button"
      :class="['visual-upload-source__trigger', 'visual-upload-source__link-trigger', triggerClass]"
      data-guide="kb-detail-import-url"
      :aria-label="t('knowledgeBase.importURL')"
      :title="t('knowledgeBase.importURL')"
      @click="openUrlDialog()"
    >
      <t-icon name="link" />
      <span>{{ t('knowledgeBase.importURL') }}</span>
      <span v-if="authStore.isLiteMode" class="visual-upload-source__paid-badge">Plus</span>
    </button>

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
              <div class="visual-url-modal__input-heading">
                <label class="visual-url-modal__label" for="visual-url-import-input">
                  {{ t('knowledgeBase.urlLabel') }}
                </label>
              </div>
              <div class="visual-url-modal__textarea-wrap">
                <t-textarea
                  id="visual-url-import-input"
                  v-model="urlInputValue"
                  :placeholder="t('knowledgeBase.urlPlaceholder')"
                  :autosize="{ minRows: 3, maxRows: 3 }"
                  autofocus
                />
                <button
                  v-if="urlInputValue"
                  type="button"
                  class="visual-url-modal__clear"
                  :aria-label="t('knowledgeBase.urlClear')"
                  @click="clearUrlInput"
                >
                  <t-icon name="close" aria-hidden="true" />
                  <span>{{ t('knowledgeBase.urlClear') }}</span>
                </button>
              </div>
              <div
                class="visual-url-modal__platforms"
                :aria-label="t('knowledgeBase.urlSupportedPlatforms')"
              >
                <span class="visual-url-modal__platforms-label">
                  {{ t('knowledgeBase.urlSupportedPlatforms') }}
                </span>
                <div class="visual-url-modal__platform-list" role="list">
                  <span class="visual-url-modal__platform" role="listitem">
                    <t-icon name="logo-instagram" aria-hidden="true" />
                    <span>Instagram</span>
                  </span>
                  <span class="visual-url-modal__platform" role="listitem">
                    <t-icon name="logo-twitter" aria-hidden="true" />
                    <span>X</span>
                  </span>
                  <span class="visual-url-modal__platform" role="listitem">
                    <span class="visual-url-modal__platform-mark" aria-hidden="true">小</span>
                    <span>小红书</span>
                  </span>
                  <span class="visual-url-modal__platform" role="listitem" data-platform-label="抖音·TikTok">
                    <span class="visual-url-modal__platform-mark" aria-hidden="true">抖·TK</span>
                    <span>{{ t('knowledgeBase.douyinTikTok') }}</span>
                  </span>
                  <span class="visual-url-modal__platform" role="listitem">
                    <t-icon name="logo-youtube" aria-hidden="true" />
                    <span>YouTube</span>
                  </span>
                </div>
              </div>
              <p class="visual-url-modal__hint">{{ t('knowledgeBase.urlInputHint') }}</p>
              <p class="visual-url-modal__notice">{{ t('knowledgeBase.urlUsageNotice') }}</p>
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
import { getCurrentEntitlement, type ConsumerEntitlement } from '@/api/entitlement'
import { exceedsConsumerStorageQuota } from '@/utils/consumerUploadLimits'
import { useAuthStore } from '@/stores/auth'
import { useConsumerUpgradePrompt } from '@/hooks/useConsumerUpgradePrompt'
import { filterUploadFiles, partitionFilesForConsumerPlan } from '../utils/uploadSources'

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
const authStore = useAuthStore()
const showConsumerUpgradePrompt = useConsumerUpgradePrompt()

const fileInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const menuVisible = ref(false)
const urlDialogVisible = ref(false)
const urlInputValue = ref('')

const resolveConsumerEntitlement = async (): Promise<ConsumerEntitlement | null> => {
  if (!authStore.isLiteMode) return null
  try {
    return (await getCurrentEntitlement()).data
  } catch {
    return null
  }
}

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
    case 'manualCreate':
      emit('manual')
      break
    default:
      break
  }
}

const notifyFilterResult = (result: ReturnType<typeof filterUploadFiles>, emptyAllSkippedKey: string) => {
  const { validFiles, skippedCount, oversizedVideoCount } = result
  if (oversizedVideoCount > 0) {
    MessagePlugin.error(t('uploadConfirm.videoTooLarge'))
  }
  const otherSkippedCount = skippedCount - oversizedVideoCount
  if (validFiles.length === 0) {
    if (otherSkippedCount > 0) {
      MessagePlugin.warning(t(emptyAllSkippedKey))
    }
    return false
  }
  if (otherSkippedCount > 0) {
    MessagePlugin.warning(t('knowledgeBase.filesSkippedNoEngine', { count: otherSkippedCount }))
  }
  return true
}

const handleFilesChange = async (event: Event, fromFolder: boolean) => {
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

  let allowedFiles = result.validFiles
  let blockedVideoFiles: File[] = []
  let entitlement: ConsumerEntitlement | null = null
  if (authStore.isLiteMode) {
    entitlement = await resolveConsumerEntitlement()
    const restricted = partitionFilesForConsumerPlan(result.validFiles, { videoUpload: false })
    if (restricted.blockedVideoFiles.length > 0) {
      if (!entitlement) {
        if (restricted.allowedFiles.length > 0) emit('files', restricted.allowedFiles)
        MessagePlugin.error(t('entitlement.usageUnavailable'))
        input.value = ''
        return
      }
      if (entitlement.video_upload !== true) {
        allowedFiles = restricted.allowedFiles
        blockedVideoFiles = restricted.blockedVideoFiles
      }
    }
  }
  let storageUpgradeShown = false
  if (allowedFiles.length > 0 && exceedsConsumerStorageQuota(entitlement, allowedFiles)) {
    allowedFiles = []
    storageUpgradeShown = true
    showConsumerUpgradePrompt(String(t('entitlement.storageQuotaUpgradeBody')))
  }
  if (allowedFiles.length > 0) emit('files', allowedFiles)
  if (blockedVideoFiles.length > 0 && !storageUpgradeShown) {
    const body = allowedFiles.length > 0
      ? t('entitlement.videoMixedUpgradeBody', {
        blocked: blockedVideoFiles.length,
        allowed: allowedFiles.length,
      })
      : t('entitlement.videoUploadUpgradeBody')
    showConsumerUpgradePrompt(String(body))
  }
  input.value = ''
}

const handleUrlDialogConfirm = async () => {
  const url = urlInputValue.value.trim()
  if (!url) {
    MessagePlugin.warning(t('knowledgeBase.urlRequired'))
    return
  }
  if (new TextEncoder().encode(url).length > 4096) {
    MessagePlugin.warning(t('knowledgeBase.urlTooLong'))
    return
  }
  const entitlement = await resolveConsumerEntitlement()
  if (authStore.isLiteMode && !entitlement) {
    MessagePlugin.error(t('entitlement.usageUnavailable'))
    return
  }
  if (authStore.isLiteMode && entitlement?.plan === 'free') {
    urlDialogVisible.value = false
    showConsumerUpgradePrompt(String(t('entitlement.urlImportUpgradeBody')), {
      onCancel: () => {
        urlDialogVisible.value = true
      },
    })
    return
  }
  if (exceedsConsumerStorageQuota(entitlement)) {
    urlDialogVisible.value = false
    showConsumerUpgradePrompt(String(t('entitlement.storageQuotaUpgradeBody')), {
      onCancel: () => {
        urlDialogVisible.value = true
      },
    })
    return
  }
  urlDialogVisible.value = false
  urlInputValue.value = ''
  emit('url', url)
}

const clearUrlInput = () => {
  urlInputValue.value = ''
}

const handleUrlDialogCancel = () => {
  urlDialogVisible.value = false
  urlInputValue.value = ''
}

const openUrlDialog = (initialValue = '') => {
  urlInputValue.value = initialValue
  urlDialogVisible.value = true
}

const openFileDialog = () => {
  fileInputRef.value?.click()
}

defineExpose({ openFileDialog, openUrlDialog })
</script>

<style scoped lang="less">
.visual-upload-source {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.visual-upload-source__hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.visual-upload-source__trigger {
  box-sizing: border-box;
  height: 36px;
  min-height: 36px;
  padding: 8px 14px;
  border: 0;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #111827;
  color: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
}

.visual-upload-source__trigger:hover {
  background: #000;
  box-shadow: 0 2px 5px rgb(0 0 0 / 8%);
}

.visual-upload-source__link-trigger {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  box-shadow: none;
}

.visual-upload-source__link-trigger:hover {
  border-color: #d1d5db;
  background: #f9fafb;
  color: #111827;
}

.visual-upload-source__paid-badge {
  padding: 0 5px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 9px;
  line-height: 16px;
  font-weight: 700;
  text-transform: uppercase;
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

@media (min-width: 640px) {
  .visual-upload-source__trigger { font-size: 14px; line-height: 20px; }
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

.visual-url-modal__input-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.visual-url-modal__label {
  display: block;
  margin: 0;
  color: #374151;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.visual-url-modal__textarea-wrap {
  position: relative;
}

.visual-url-modal__clear {
  border: 0;
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  min-height: 24px;
  padding: 3px 6px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  color: #9ca3af;
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
}

.visual-url-modal__clear :deep(.t-icon) {
  width: 12px;
  height: 12px;
  font-size: 12px;
}

.visual-url-modal__clear:hover {
  color: #374151;
}

.visual-url-modal__body :deep(.t-textarea) {
  border-color: #e5e7eb;
  border-radius: 11px;
  background: #fff;
  color: #1f2937;
  font-size: 12px;
}

.visual-url-modal__body :deep(.t-textarea__inner) {
  min-height: 96px;
  padding: 10px 72px 10px 12px;
  color: #1f2937;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.visual-url-modal__platforms {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 9px 11px;
  border: 1px solid #f0f1f3;
  border-radius: 10px;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 11px;
  line-height: 18px;
}

.visual-url-modal__platforms-label {
  flex: 0 0 auto;
  color: #6b7280;
  font-weight: 600;
}

.visual-url-modal__platform-list {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.visual-url-modal__platform {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.visual-url-modal__platform :deep(.t-icon) {
  width: 14px;
  height: 14px;
  color: #9ca3af;
  font-size: 14px;
}

.visual-url-modal__platform-mark {
  width: 14px;
  height: 14px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  color: #9ca3af;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}

.visual-url-modal__hint {
  margin: 10px 0 0;
  color: #6b7280;
  font-size: 11px;
  line-height: 17px;
}

.visual-url-modal__notice {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
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

:root[theme-mode="dark"] .visual-upload-menu {
  border-color: var(--mvc-line) !important;
  background: var(--mvc-surface) !important;
  color: var(--mvc-text) !important;
  box-shadow: var(--mvc-shadow) !important;
}

:root[theme-mode="dark"] .visual-upload-source__link-trigger {
  border-color: var(--mvc-line) !important;
  background: var(--mvc-surface) !important;
  color: var(--mvc-text) !important;
}

:root[theme-mode="dark"] .visual-upload-source__link-trigger:hover {
  background: var(--mvc-hover) !important;
  color: var(--mvc-text-strong) !important;
}

:root[theme-mode="dark"] .visual-upload-menu__item {
  color: var(--mvc-muted-strong) !important;
}

:root[theme-mode="dark"] .visual-upload-menu__item:hover {
  background: var(--mvc-hover) !important;
  color: var(--mvc-text-strong) !important;
}

:root[theme-mode="dark"] .visual-upload-menu__item :deep(.t-icon) {
  color: var(--mvc-muted) !important;
}

:root[theme-mode="dark"] .visual-upload-menu__item:hover :deep(.t-icon) {
  color: var(--mvc-text-strong) !important;
}

:root[theme-mode="dark"] .visual-url-modal {
  border-color: var(--mvc-line) !important;
  background: var(--mvc-surface) !important;
  color: var(--mvc-text) !important;
  box-shadow: var(--mvc-shadow) !important;
}

:root[theme-mode="dark"] .visual-url-modal__header {
  border-bottom-color: var(--mvc-line) !important;
}

:root[theme-mode="dark"] .visual-url-modal__header h3,
:root[theme-mode="dark"] .visual-url-modal__label {
  color: var(--mvc-text-strong) !important;
}

:root[theme-mode="dark"] .visual-url-modal__header p,
:root[theme-mode="dark"] .visual-url-modal__hint,
:root[theme-mode="dark"] .visual-url-modal__notice,
:root[theme-mode="dark"] .visual-url-modal__platforms {
  color: var(--mvc-muted) !important;
}

:root[theme-mode="dark"] .visual-url-modal__close,
:root[theme-mode="dark"] .visual-url-modal__clear {
  color: var(--mvc-muted) !important;
}

:root[theme-mode="dark"] .visual-url-modal__close:hover,
:root[theme-mode="dark"] .visual-url-modal__clear:hover {
  background: var(--mvc-hover) !important;
  color: var(--mvc-text-strong) !important;
}

:root[theme-mode="dark"] .visual-url-modal__body :deep(.t-textarea),
:root[theme-mode="dark"] .visual-url-modal__body :deep(.t-textarea__inner) {
  border-color: var(--mvc-line) !important;
  background: var(--mvc-surface-raised) !important;
  color: var(--mvc-text) !important;
  caret-color: var(--mvc-text) !important;
}

:root[theme-mode="dark"] .visual-url-modal__body :deep(.t-textarea__inner::placeholder) {
  color: var(--mvc-faint) !important;
}

:root[theme-mode="dark"] .visual-url-modal__platforms {
  border-color: var(--mvc-line) !important;
  background: var(--mvc-surface-raised) !important;
}

:root[theme-mode="dark"] .visual-url-modal__platforms-label {
  color: var(--mvc-muted-strong) !important;
}

:root[theme-mode="dark"] .visual-url-modal__platform :deep(.t-icon),
:root[theme-mode="dark"] .visual-url-modal__platform-mark {
  border-color: var(--mvc-line-strong) !important;
  color: var(--mvc-muted) !important;
}

:root[theme-mode="dark"] .visual-url-modal__footer {
  border-top-color: var(--mvc-line) !important;
  background: var(--mvc-surface-raised) !important;
}

:root[theme-mode="dark"] .visual-url-modal__button.is-secondary {
  border-color: var(--mvc-line-strong) !important;
  background: var(--mvc-surface) !important;
  color: var(--mvc-text) !important;
}

:root[theme-mode="dark"] .visual-url-modal__button.is-secondary:hover {
  background: var(--mvc-hover) !important;
  color: var(--mvc-text-strong) !important;
}

:root[theme-mode="dark"] .visual-url-modal__button.is-primary {
  border-color: #f2f2f2 !important;
  background: #f2f2f2 !important;
  color: #111214 !important;
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
