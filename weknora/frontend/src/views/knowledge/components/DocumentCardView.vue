<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import type { FolderOption } from './FolderPickerMenu.vue'

interface Tag {
  id: string
  name: string
  color?: string
}

interface KnowledgeCard {
  id: string
  knowledge_base_id?: string
  parse_status: string
  summary_status?: string
  description?: string
  file_name?: string
  folder_path?: string
  original_file_name?: string
  display_name?: string
  title?: string
  type?: string
  updated_at?: string
  file_type?: string
  metadata?: any
  error_message?: string
  tags?: Array<{ id: string; name: string; color?: string }>
  source?: string
  created_at?: string
  file_size?: number | string
  channel?: string
}

const props = defineProps<{
  items: KnowledgeCard[]
  selectedIds: Set<string>
  batchMode: boolean
  canEdit: boolean
  canDownload: boolean
  canMutateKnowledge: boolean
  traceAvailableById: Record<string, boolean>
  tagList: Tag[]
  folders?: Array<{ path: string; name: string; total_count: number }>
  folderOptions?: FolderOption[]
  showFolderPath?: boolean
  moveMenuMode: 'normal' | 'targets' | 'confirm'
  moveTargetKbs: any[]
  moveTargetsLoading: boolean
  moveSelectedTargetName: string
  moveMode: 'reuse_vectors' | 'reparse'
  moveSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'open', item: KnowledgeCard): void
  (e: 'toggle-checkbox', id: string, checked: boolean, ctx?: { e?: Event }): void
  (e: 'menu-visible-change', visible: boolean, item: KnowledgeCard): void
  (e: 'action', action: 'download' | 'edit' | 'view-trace' | 'reparse' | 'cancel-parse' | 'move' | 'move-folder' | 'batch-manage' | 'delete', item: KnowledgeCard): void
  (e: 'tag-edit', item: KnowledgeCard): void
  (e: 'open-folder', path: string): void
  (e: 'move-to-folder', item: KnowledgeCard, folderPath: string): void
  (e: 'move-select-target', kb: any): void
  (e: 'move-back'): void
  (e: 'move-confirm'): void
  (e: 'update:moveMode', mode: 'reuse_vectors' | 'reparse'): void
}>()

const { t } = useI18n()
const activeMenuItemId = ref<string | null>(null)
const folderPickerItemId = ref<string | null>(null)
const CANCELABLE_PARSE_STATUSES = new Set(['pending', 'processing', 'finalizing'])

const folderRows = computed(() => [
  { path: '', name: t('knowledgeBase.folderTree.rootRow'), depth: 0 },
  ...(props.folderOptions || []),
])

const isParseInFlight = (status?: string) => CANCELABLE_PARSE_STATUSES.has(String(status || ''))
const isTraceVisible = (item: KnowledgeCard) => isParseInFlight(item.parse_status) || props.traceAvailableById[item.id] === true
const cardTitle = (item: KnowledgeCard) => item.display_name || item.file_name || item.title || item.original_file_name || item.id
const cardSummary = (item: KnowledgeCard) => item.description || item.metadata?.summary || item.metadata?.content || '暂无内容摘录...'

const getExtension = (item: KnowledgeCard) => {
  if (item.file_type) return String(item.file_type).replace(/^\./, '').toUpperCase()
  const name = cardTitle(item)
  const dot = name.lastIndexOf('.')
  if (dot > -1 && dot < name.length - 1) return name.slice(dot + 1).toUpperCase()
  if (item.type === 'url') return 'URL'
  if (item.type === 'manual') return 'TXT'
  return 'TXT'
}

const fileIconName = (item: KnowledgeCard): 'image' | 'volume-2' | 'file-spreadsheet' | 'file-code' | 'file-text' => {
  const ext = getExtension(item)
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'SVG'].includes(ext)) return 'image'
  if (['WAV', 'MP3', 'OGG', 'M4A', 'FLAC'].includes(ext)) return 'volume-2'
  if (['CSV', 'XLS', 'XLSX'].includes(ext)) return 'file-spreadsheet'
  if (['MD', 'JSON', 'JS', 'TS', 'PY'].includes(ext)) return 'file-code'
  return 'file-text'
}

const formatDocTime = (time?: string) => {
  if (!time) return '--'
  const d = new Date(time)
  if (Number.isNaN(d.getTime())) return '--'
  const yy = String(d.getFullYear()).slice(2)
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yy}-${MM}-${dd} ${hh}:${mm}`
}

const openMenu = (item: KnowledgeCard) => {
  if (activeMenuItemId.value === item.id) {
    closeMenu(item)
    return
  }
  activeMenuItemId.value = item.id
  folderPickerItemId.value = null
  emit('menu-visible-change', true, item)
}

const closeMenu = (item?: KnowledgeCard) => {
  if (item) emit('menu-visible-change', false, item)
  activeMenuItemId.value = null
  folderPickerItemId.value = null
}

const onCardClick = (item: KnowledgeCard) => {
  if (props.batchMode) {
    emit('toggle-checkbox', item.id, !props.selectedIds.has(item.id))
    return
  }
  emit('open', item)
}

const runAction = (action: 'download' | 'view-trace' | 'reparse' | 'cancel-parse' | 'move' | 'batch-manage' | 'delete', item: KnowledgeCard) => {
  if (action === 'delete') {
    if (!window.confirm(`确定删除文档 "${cardTitle(item)}" 吗？`)) return
  }

  if (action === 'move') {
    emit('action', 'move', item)
    return
  }

  emit('action', action, item)
  closeMenu(item)
}

const openFolderPicker = (item: KnowledgeCard) => {
  folderPickerItemId.value = item.id
}

const pickFolder = (item: KnowledgeCard, path: string) => {
  emit('move-to-folder', item, path)
  closeMenu(item)
}
</script>

<template>
  <div class="reference-card-grid">
    <button
      v-for="folder in folders || []"
      :key="`folder-${folder.path}`"
      type="button"
      class="reference-folder-card"
      :title="folder.path"
      @click="emit('open-folder', folder.path)"
    >
      <div class="reference-folder-card__top">
        <ReferenceIcon name="folder" :size="18" :stroke-width="1.8" />
        <span>{{ folder.name }}</span>
      </div>
      <div class="reference-folder-card__footer">
        {{ t('knowledgeBase.folderTree.folderCardCount', { count: folder.total_count }) }}
      </div>
    </button>

    <article
      v-for="item in items"
      :key="item.id"
      class="reference-document-card"
      :class="{ 'is-selected': selectedIds.has(item.id) }"
      :data-select-id="item.id"
      @click="onCardClick(item)"
    >
      <div class="reference-document-card__body">
        <div class="reference-document-card__header">
          <div class="reference-document-card__title-wrap">
            <ReferenceIcon :name="fileIconName(item)" :size="16" class="reference-document-card__file-icon" />
            <h4 :title="cardTitle(item)">{{ cardTitle(item) }}</h4>
          </div>

          <div v-if="canEdit || canDownload" class="reference-document-card__menu-anchor">
            <button
              type="button"
              class="reference-document-card__more"
              :aria-label="t('knowledgeBase.moreOptions')"
              @click.stop="openMenu(item)"
            >
              <ReferenceIcon name="more-horizontal" :size="14" />
            </button>

            <template v-if="activeMenuItemId === item.id">
              <div class="reference-document-card__backdrop" @click.stop="closeMenu(item)" />

              <div v-if="folderPickerItemId === item.id" class="reference-document-card__menu reference-folder-picker" @click.stop>
                <button type="button" class="reference-menu-item reference-menu-back" @click="folderPickerItemId = null">
                  <ReferenceIcon name="chevron-left" :size="14" />
                  <span>{{ t('knowledgeBase.moveToFolder.action') }}</span>
                </button>
                <div class="reference-menu-divider" />
                <button
                  v-for="row in folderRows"
                  :key="row.path || '__root__'"
                  type="button"
                  class="reference-menu-item"
                  :class="{ current: (item.folder_path || '') === row.path }"
                  :style="{ paddingLeft: `${12 + Math.min(row.depth, 5) * 10}px` }"
                  @click="pickFolder(item, row.path)"
                >
                  <ReferenceIcon name="folder" :size="14" class="reference-menu-icon" />
                  <span class="reference-menu-ellipsis">{{ row.name }}</span>
                </button>
              </div>

              <div v-else-if="moveMenuMode === 'targets'" class="reference-document-card__menu reference-move-target-menu" @click.stop>
                <button type="button" class="reference-menu-item reference-menu-back" @click="emit('move-back')">
                  <ReferenceIcon name="chevron-left" :size="14" />
                  <span>{{ t('knowledgeBase.moveToKnowledgeBase') }}</span>
                </button>
                <div class="reference-menu-divider" />
                <div v-if="moveTargetsLoading" class="reference-menu-state">加载中...</div>
                <div v-else-if="moveTargetKbs.length === 0" class="reference-menu-state">{{ t('knowledgeBase.moveNoTargets') }}</div>
                <button
                  v-for="kb in moveTargetKbs"
                  v-else
                  :key="kb.id"
                  type="button"
                  class="reference-menu-item"
                  @click="emit('move-select-target', kb)"
                >
                  <ReferenceIcon name="folder" :size="14" class="reference-menu-icon" />
                  <span class="reference-menu-ellipsis">{{ kb.name }}</span>
                </button>
              </div>

              <div v-else-if="moveMenuMode === 'confirm'" class="reference-document-card__menu reference-move-confirm" @click.stop>
                <button type="button" class="reference-menu-item reference-menu-back" @click="emit('move-back')">
                  <ReferenceIcon name="chevron-left" :size="14" />
                  <span>{{ t('knowledgeBase.moveConfirmTitle') }}</span>
                </button>
                <div class="reference-menu-divider" />
                <div class="reference-move-confirm__target">{{ moveSelectedTargetName }}</div>
                <label class="reference-move-mode" :class="{ active: moveMode === 'reuse_vectors' }">
                  <input
                    type="radio"
                    name="reference-card-move-mode"
                    value="reuse_vectors"
                    :checked="moveMode === 'reuse_vectors'"
                    @change="emit('update:moveMode', 'reuse_vectors')"
                  />
                  <span>{{ t('knowledgeBase.moveModeReuseVectors') }}</span>
                </label>
                <label class="reference-move-mode" :class="{ active: moveMode === 'reparse' }">
                  <input
                    type="radio"
                    name="reference-card-move-mode"
                    value="reparse"
                    :checked="moveMode === 'reparse'"
                    @change="emit('update:moveMode', 'reparse')"
                  />
                  <span>{{ t('knowledgeBase.moveModeReparse') }}</span>
                </label>
                <div class="reference-move-confirm__actions">
                  <button type="button" class="reference-move-cancel" @click="emit('move-back')">{{ t('common.cancel') }}</button>
                  <button type="button" class="reference-move-submit" :disabled="moveSubmitting" @click="emit('move-confirm')">
                    {{ moveSubmitting ? '...' : t('knowledgeBase.moveConfirm') }}
                  </button>
                </div>
              </div>

              <div v-else class="reference-document-card__menu" @click.stop>
                <button
                  v-if="canDownload && (item.type === 'file' || item.type === 'manual')"
                  type="button"
                  class="reference-menu-item"
                  @click="runAction('download', item)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="reference-menu-inline-icon"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  <span>{{ t('common.download') }}</span>
                </button>
                <button
                  v-if="canEdit && isTraceVisible(item)"
                  type="button"
                  class="reference-menu-item"
                  @click="runAction('view-trace', item)"
                >
                  <ReferenceIcon name="activity" :size="14" class="reference-menu-icon" />
                  <span>查看 Trace</span>
                </button>
                <button v-if="canEdit" type="button" class="reference-menu-item" @click="runAction('reparse', item)">
                  <ReferenceIcon name="rotate-cw" :size="14" class="reference-menu-icon" />
                  <span>{{ t('knowledgeBase.rebuildDocument') }}</span>
                </button>
                <button
                  v-if="canEdit && isParseInFlight(item.parse_status)"
                  type="button"
                  class="reference-menu-item reference-menu-item--warning"
                  @click="runAction('cancel-parse', item)"
                >
                  <ReferenceIcon name="stop-circle" :size="14" />
                  <span>停止解析</span>
                </button>
                <button v-if="canMutateKnowledge" type="button" class="reference-menu-item" @click="openFolderPicker(item)">
                  <ReferenceIcon name="folder" :size="14" class="reference-menu-icon" />
                  <span>{{ t('knowledgeBase.moveToFolder.action') }}</span>
                </button>
                <button v-if="canMutateKnowledge" type="button" class="reference-menu-item" @click="runAction('move', item)">
                  <ReferenceIcon name="arrow-right-left" :size="14" class="reference-menu-icon" />
                  <span>移动到...</span>
                </button>
                <button v-if="canMutateKnowledge" type="button" class="reference-menu-item" @click="runAction('batch-manage', item)">
                  <ReferenceIcon name="check-square" :size="14" class="reference-menu-icon" />
                  <span>{{ t('menu.batchManage') }}</span>
                </button>
                <div v-if="canEdit" class="reference-menu-divider" />
                <button v-if="canEdit" type="button" class="reference-menu-item reference-menu-item--danger" @click="runAction('delete', item)">
                  <ReferenceIcon name="trash-2" :size="14" />
                  <span>{{ t('knowledgeBase.deleteDocument') }}</span>
                </button>
              </div>
            </template>
          </div>
        </div>

        <p class="reference-document-card__summary">{{ cardSummary(item) }}</p>

        <div v-if="isParseInFlight(item.parse_status)" class="reference-status-badge reference-status-badge--working">
          <ReferenceIcon name="loader-circle" :size="10" class="reference-spin" />
          <span>{{ item.parse_status === 'finalizing' ? '优化中 📈' : '解析中' }}</span>
        </div>
        <div v-else-if="item.parse_status === 'failed'" class="reference-status-badge reference-status-badge--failed">
          <span>解析失败</span>
        </div>
      </div>

      <footer class="reference-document-card__footer">
        <button
          v-if="showFolderPath && item.folder_path"
          type="button"
          class="reference-card-folder-path"
          :title="item.folder_path"
          @click.stop="emit('open-folder', item.folder_path)"
        >
          <ReferenceIcon name="folder" :size="11" />
          <span>{{ item.folder_path }}</span>
        </button>
        <span v-else>{{ formatDocTime(item.updated_at) }}</span>
        <span class="reference-document-card__extension">{{ getExtension(item) }}</span>
      </footer>

      <label v-if="batchMode && canEdit" class="reference-card-checkbox" @click.stop>
        <input
          type="checkbox"
          :checked="selectedIds.has(item.id)"
          @change="emit('toggle-checkbox', item.id, ($event.target as HTMLInputElement).checked, { e: $event })"
        />
      </label>
    </article>
  </div>
</template>

<style scoped>
.reference-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-content: start;
  grid-auto-rows: max-content;
  min-height: 0;
  padding-bottom: 16px;
}
.reference-document-card,
.reference-folder-card {
  box-sizing: border-box;
  height: 192px;
  border: 1px solid rgb(229 231 235 / 0.9);
  border-radius: 16px;
  background: #fff;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.reference-document-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  color: #111827;
  cursor: pointer;
  text-align: left;
}
.reference-document-card:hover {
  border-color: #9ca3af;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06);
}
.reference-document-card.is-selected {
  border-color: #111827;
  box-shadow: 0 0 0 2px rgb(17 24 39 / 0.10), 0 1px 2px rgb(0 0 0 / 0.05);
}
.reference-document-card__body { min-width: 0; }
.reference-document-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.reference-document-card__title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.reference-document-card__file-icon {
  flex: 0 0 auto;
  color: #4b5563;
}
.reference-document-card__title-wrap h4 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #030712;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
}
.reference-document-card__menu-anchor { position: relative; flex: 0 0 auto; }
.reference-document-card__more {
  width: 22px;
  height: 22px;
  margin: -3px -4px 0 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.reference-document-card__more:hover { background: #f3f4f6; color: #374151; }
.reference-document-card__summary {
  display: -webkit-box;
  margin: 8px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: #6b7280;
  font-size: 11px;
  line-height: 17px;
  font-weight: 400;
}
.reference-status-badge {
  width: fit-content;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
}
.reference-status-badge--working { color: #b45309; background: #fffbeb; border: 1px solid rgb(253 230 138 / 0.8); }
.reference-status-badge--failed { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }
.reference-spin { animation: reference-spin 1s linear infinite; }
@keyframes reference-spin { to { transform: rotate(360deg); } }
.reference-document-card__footer {
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #9ca3af;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  line-height: 14px;
}
.reference-document-card__extension {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 9px;
  line-height: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.reference-card-folder-path {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #9ca3af;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: inherit;
  cursor: pointer;
}
.reference-card-folder-path span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-card-checkbox {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 5;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.94);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}
.reference-card-checkbox input { width: 13px; height: 13px; margin: 0; accent-color: #111827; cursor: pointer; }

.reference-document-card__backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}
.reference-document-card__menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  width: 144px;
  padding: 4px 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10);
  color: #374151;
  text-align: left;
}
.reference-folder-picker,
.reference-move-target-menu,
.reference-move-confirm { width: 190px; max-height: 300px; overflow-y: auto; }
.reference-menu-item {
  width: 100%;
  min-height: 28px;
  padding: 6px 12px;
  border: 0;
  background: transparent;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
}
.reference-menu-item:hover { background: #f9fafb; }
.reference-menu-icon { color: #6b7280; }
.reference-menu-item--warning { color: #b45309; }
.reference-menu-item--warning:hover { background: #fffbeb; }
.reference-menu-item--danger { color: #dc2626; }
.reference-menu-item--danger:hover { background: #fef2f2; }
.reference-menu-back { font-weight: 600; }
.reference-menu-divider { height: 1px; margin: 2px 0; background: #f3f4f6; }
.reference-menu-ellipsis { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-menu-state { padding: 10px 12px; color: #9ca3af; font-size: 11px; }
.reference-menu-item.current { background: #f3f4f6; color: #111827; font-weight: 600; }
.reference-move-confirm { padding-bottom: 8px; }
.reference-move-confirm__target { padding: 8px 12px 4px; color: #111827; font-size: 12px; font-weight: 700; }
.reference-move-mode { margin: 4px 8px; padding: 7px 8px; border: 1px solid #e5e7eb; border-radius: 9px; display: flex; align-items: center; gap: 7px; color: #4b5563; font-size: 11px; cursor: pointer; }
.reference-move-mode.active { border-color: #9ca3af; background: #f9fafb; color: #111827; }
.reference-move-mode input { margin: 0; accent-color: #111827; }
.reference-move-confirm__actions { display: flex; justify-content: flex-end; gap: 6px; padding: 8px 8px 0; }
.reference-move-cancel,
.reference-move-submit { height: 26px; padding: 0 9px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
.reference-move-cancel { border: 1px solid #e5e7eb; background: #fff; color: #4b5563; }
.reference-move-submit { border: 1px solid #111827; background: #111827; color: #fff; }
.reference-move-submit:disabled { opacity: .55; cursor: default; }

.reference-folder-card {
  padding: 0;
  overflow: hidden;
  color: #111827;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
  cursor: pointer;
}
.reference-folder-card:hover { border-color: #9ca3af; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.06); }
.reference-folder-card__top { padding: 18px 16px; display: flex; flex-direction: column; gap: 10px; color: #2563eb; }
.reference-folder-card__top span { color: #111827; font-size: 12px; line-height: 16px; font-weight: 700; }
.reference-folder-card__footer { padding: 10px 16px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 10px; line-height: 14px; }

@media (max-width: 1279px) {
  .reference-card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1023px) {
  .reference-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 639px) {
  .reference-card-grid { grid-template-columns: 1fr; }
}
</style>
