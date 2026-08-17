<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import FolderPickerMenu, { type FolderOption } from './FolderPickerMenu.vue'

const props = defineProps<{
  count: number
  deleteLoading?: boolean
  reparseLoading?: boolean
  tagLoading?: boolean
  // Keep the original visibility contract: batch mode may be open with 0 selected rows.
  visible?: boolean
  showMoveToFolder?: boolean
  folderOptions?: FolderOption[]
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'delete'): void
  (e: 'reparse'): void
  (e: 'batchTag'): void
  (e: 'moveToFolder', folderPath: string): void
}>()

const { t } = useI18n()
const folderPickerVisible = ref(false)
const confirmAction = ref<'reparse' | 'delete' | null>(null)

const busy = computed(() => Boolean(props.deleteLoading || props.reparseLoading || props.tagLoading))
const disabled = computed(() => props.count === 0 || busy.value)

const closeTransientUi = () => {
  folderPickerVisible.value = false
  confirmAction.value = null
}

const requestConfirm = (action: 'reparse' | 'delete') => {
  if (disabled.value) return
  folderPickerVisible.value = false
  confirmAction.value = action
}

const confirm = () => {
  const action = confirmAction.value
  confirmAction.value = null
  if (action === 'reparse') emit('reparse')
  if (action === 'delete') emit('delete')
}

const confirmTitle = computed(() =>
  confirmAction.value === 'delete'
    ? t('knowledgeBase.confirmBatchDeleteDocument', { count: props.count })
    : t('knowledgeBase.confirmBatchReparseDocument', { count: props.count }),
)
</script>

<template>
  <transition name="reference-batch-bar">
    <div
      v-if="visible || count > 0"
      class="reference-batch-bar"
      role="region"
      :aria-label="t('knowledgeBase.selectedCount', { count })"
    >
      <div class="reference-batch-bar__inner">
        <div class="reference-batch-bar__selection">
          <span>{{ t('knowledgeBase.selectedCount', { count }) }}</span>
          <button type="button" class="reference-batch-bar__clear" @click="emit('cancel')">
            {{ t('knowledgeBase.clearSelection') }}
          </button>
        </div>

        <div class="reference-batch-bar__actions">
          <button
            type="button"
            class="reference-batch-action"
            :disabled="disabled"
            @click="requestConfirm('reparse')"
          >
            <ReferenceIcon name="rotate-cw" :size="14" :class="{ 'is-spinning': reparseLoading }" />
            <span>{{ t('knowledgeBase.rebuildDocument') }}</span>
          </button>

          <button
            type="button"
            class="reference-batch-action"
            :disabled="disabled"
            @click="emit('batchTag')"
          >
            <ReferenceIcon name="tag" :size="14" />
            <span>{{ t('knowledgeBase.batchTag') }}</span>
          </button>

          <div v-if="showMoveToFolder" class="reference-batch-folder">
            <button
              type="button"
              class="reference-batch-action"
              :class="{ active: folderPickerVisible }"
              :disabled="disabled"
              @click="folderPickerVisible = !folderPickerVisible; confirmAction = null"
            >
              <ReferenceIcon name="folder" :size="14" />
              <span>{{ t('knowledgeBase.moveToFolder.action') }}</span>
            </button>
            <template v-if="folderPickerVisible">
              <div class="reference-batch-backdrop" @click="closeTransientUi" />
              <div class="reference-batch-folder__menu" @click.stop>
                <FolderPickerMenu
                  :options="folderOptions || []"
                  @confirm="(path: string) => { folderPickerVisible = false; emit('moveToFolder', path) }"
                />
              </div>
            </template>
          </div>

          <button
            type="button"
            class="reference-batch-action reference-batch-action--danger"
            :disabled="disabled"
            @click="requestConfirm('delete')"
          >
            <ReferenceIcon name="trash-2" :size="14" />
            <span>{{ t('knowledgeBase.batchDelete') }}</span>
          </button>
        </div>

        <template v-if="confirmAction">
          <div class="reference-batch-backdrop" @click="confirmAction = null" />
          <div class="reference-batch-confirm" role="dialog" aria-modal="true">
            <p>{{ confirmTitle }}</p>
            <div class="reference-batch-confirm__actions">
              <button type="button" @click="confirmAction = null">{{ t('common.cancel') }}</button>
              <button
                type="button"
                class="reference-batch-confirm__primary"
                :class="{ danger: confirmAction === 'delete' }"
                @click="confirm"
              >
                {{ confirmAction === 'delete' ? t('knowledgeBase.confirmDelete') : t('knowledgeBase.confirmBatchReparse') }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.reference-batch-bar {
  position: relative;
  z-index: 20;
  width: max-content;
  max-width: min(760px, calc(100vw - 40px));
  margin: 0 auto;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-batch-bar__inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 46px;
  padding: 6px 8px 6px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.10);
  color: #374151;
}
.reference-batch-bar__selection {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;
  border-right: 1px solid #e5e7eb;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}
.reference-batch-bar__clear {
  border: 0;
  background: transparent;
  padding: 2px 0;
  color: #9ca3af;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.reference-batch-bar__clear:hover { color: #111827; }
.reference-batch-bar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.reference-batch-action {
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.reference-batch-action:hover:not(:disabled),
.reference-batch-action.active { background: #f3f4f6; color: #111827; }
.reference-batch-action--danger { color: #dc2626; }
.reference-batch-action--danger:hover:not(:disabled) { background: #fef2f2; color: #b91c1c; }
.reference-batch-action:disabled { opacity: .4; cursor: default; }
.reference-batch-folder { position: relative; }
.reference-batch-backdrop { position: fixed; inset: 0; z-index: 40; }
.reference-batch-folder__menu {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 50;
  min-width: 240px;
  transform: translateX(-50%);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / .10), 0 8px 10px -6px rgb(0 0 0 / .10);
  overflow: hidden;
}
.reference-batch-confirm {
  position: absolute;
  right: 8px;
  bottom: calc(100% + 8px);
  z-index: 50;
  width: 280px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / .10), 0 8px 10px -6px rgb(0 0 0 / .10);
}
.reference-batch-confirm p {
  margin: 0;
  color: #374151;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
}
.reference-batch-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 12px;
}
.reference-batch-confirm__actions button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.reference-batch-confirm__actions .reference-batch-confirm__primary {
  border-color: #111827;
  background: #111827;
  color: #fff;
}
.reference-batch-confirm__actions .reference-batch-confirm__primary.danger {
  border-color: #dc2626;
  background: #dc2626;
}
.is-spinning { animation: reference-spin 900ms linear infinite; }
.reference-batch-bar-enter-active,
.reference-batch-bar-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.reference-batch-bar-enter-from,
.reference-batch-bar-leave-to { opacity: 0; transform: translateY(6px); }
@keyframes reference-spin { to { transform: rotate(360deg); } }
</style>
