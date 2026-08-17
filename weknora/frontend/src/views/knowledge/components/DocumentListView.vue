<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { formatFileSize } from '@/utils/files'
import type { FolderOption } from './FolderPickerMenu.vue'

interface Tag {
  id: string
  name: string
  color?: string
}

interface KnowledgeItem {
  id: string
  file_name: string
  folder_path?: string
  file_type?: string
  file_size?: number | string
  type?: string
  tags?: Tag[]
  parse_status?: string
  summary_status?: string
  updated_at?: string
  source?: string
  description?: string
  channel?: string
}

const props = defineProps<{
  items: KnowledgeItem[]
  selectedIds: Set<string>
  canEdit: boolean
  canMutateKnowledge: boolean
  traceVisibleIds: Record<string, boolean>
  tagList: Tag[]
  loading?: boolean
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
  (e: 'open', item: KnowledgeItem): void
  (e: 'toggle-row', id: string, checked: boolean, shiftKey: boolean): void
  (e: 'toggle-all', checked: boolean): void
  (e: 'action', action: 'edit' | 'reparse' | 'cancel-parse' | 'move' | 'move-folder' | 'delete' | 'view-trace' | 'batch-manage', item: KnowledgeItem): void
  (e: 'probe-trace', item: KnowledgeItem): void
  (e: 'tag-edit', item: KnowledgeItem): void
  (e: 'open-folder', path: string): void
  (e: 'move-to-folder', item: KnowledgeItem, folderPath: string): void
  (e: 'move-select-target', kb: any): void
  (e: 'move-back'): void
  (e: 'move-confirm'): void
  (e: 'update:moveMode', mode: 'reuse_vectors' | 'reparse'): void
  (e: 'reset-move-state'): void
}>()

const { t } = useI18n()
const activeMenuItemId = ref<string | null>(null)
const folderPickerItemId = ref<string | null>(null)
const CANCELABLE_PARSE_STATUSES = new Set(['pending', 'processing', 'finalizing'])
const allSelected = computed(() => props.items.length > 0 && props.items.every(item => props.selectedIds.has(item.id)))
const folderRows = computed(() => [
  { path: '', name: t('knowledgeBase.folderTree.rootRow'), depth: 0 },
  ...(props.folderOptions || []),
])

const isParseInFlight = (status?: string) => CANCELABLE_PARSE_STATUSES.has(String(status || ''))
const isTraceVisible = (item: KnowledgeItem) => isParseInFlight(item.parse_status) || props.traceVisibleIds[item.id] === true
const getExtension = (item: KnowledgeItem) => {
  if (item.file_type) return String(item.file_type).replace(/^\./, '').toUpperCase()
  const dot = item.file_name.lastIndexOf('.')
  if (dot > -1 && dot < item.file_name.length - 1) return item.file_name.slice(dot + 1).toUpperCase()
  if (item.type === 'url') return 'URL'
  return 'TXT'
}
const fileIconName = (item: KnowledgeItem): 'image' | 'volume-2' | 'file-spreadsheet' | 'file-code' | 'file-text' => {
  const ext = getExtension(item)
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'SVG'].includes(ext)) return 'image'
  if (['WAV', 'MP3', 'OGG', 'M4A', 'FLAC'].includes(ext)) return 'volume-2'
  if (['CSV', 'XLS', 'XLSX'].includes(ext)) return 'file-spreadsheet'
  if (['MD', 'JSON', 'JS', 'TS', 'PY'].includes(ext)) return 'file-code'
  return 'file-text'
}
const formatTime = (time?: string) => {
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
const sourceInfo = (item: KnowledgeItem): { icon: 'globe' | 'pen-line' | 'upload'; label: string } => {
  if (item.type === 'url' || item.source === 'crawler') return { icon: 'globe', label: '抓取' }
  if (item.type === 'manual' || item.source === 'online') return { icon: 'pen-line', label: '在线' }
  if (item.channel === 'api' || item.source === 'api') return { icon: 'upload', label: 'API同步' }
  return { icon: 'upload', label: '上传' }
}
const statusInfo = (item: KnowledgeItem) => {
  if (item.parse_status === 'failed') return { tone: 'failed', label: '失败', spinning: false }
  if (item.parse_status === 'pending' || item.parse_status === 'processing') return { tone: 'indexing', label: '索引中', spinning: true }
  if (item.parse_status === 'finalizing' || (item.parse_status === 'completed' && ['pending', 'processing'].includes(String(item.summary_status || '')))) {
    return { tone: 'optimizing', label: '优化中', spinning: true }
  }
  if (item.parse_status === 'cancelled') return { tone: 'failed', label: '已停止', spinning: false }
  if (item.parse_status === 'draft') return { tone: 'optimizing', label: '草稿', spinning: false }
  return { tone: 'completed', label: '已完成', spinning: false }
}

const openMenu = (item: KnowledgeItem) => {
  if (activeMenuItemId.value === item.id) {
    closeMenu()
    return
  }
  activeMenuItemId.value = item.id
  folderPickerItemId.value = null
  emit('probe-trace', item)
}
const closeMenu = () => {
  activeMenuItemId.value = null
  folderPickerItemId.value = null
  emit('reset-move-state')
}
const runAction = (action: 'reparse' | 'cancel-parse' | 'move' | 'delete' | 'view-trace' | 'batch-manage', item: KnowledgeItem) => {
  if (action === 'delete' && !window.confirm(`确定删除文档 "${item.file_name}" 吗？`)) return
  if (action === 'move') {
    emit('action', action, item)
    return
  }
  emit('action', action, item)
  closeMenu()
}
const pickFolder = (item: KnowledgeItem, path: string) => {
  emit('move-to-folder', item, path)
  closeMenu()
}
const toggleRow = (item: KnowledgeItem, event: MouseEvent) => {
  const target = event.currentTarget as HTMLInputElement
  emit('toggle-row', item.id, target.checked, event.shiftKey)
}
</script>

<template>
  <div class="reference-document-table-shell">
    <div class="reference-document-table-scroll">
      <table class="reference-document-table">
        <thead>
          <tr>
            <th class="reference-col-check">
              <input
                type="checkbox"
                :checked="allSelected"
                :disabled="!items.length"
                aria-label="全选"
                @change="emit('toggle-all', ($event.target as HTMLInputElement).checked)"
              />
            </th>
            <th>文件名</th>
            <th class="reference-col-tags">标签</th>
            <th class="reference-col-source">来源</th>
            <th class="reference-col-size">大小</th>
            <th class="reference-col-status">状态</th>
            <th class="reference-col-time">更新时间</th>
            <th class="reference-col-action">操作</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            :class="{ 'is-selected': selectedIds.has(item.id) }"
            @click="emit('open', item)"
          >
            <td class="reference-col-check" @click.stop>
              <input
                type="checkbox"
                :checked="selectedIds.has(item.id)"
                @click="toggleRow(item, $event as MouseEvent)"
              />
            </td>

            <td class="reference-file-cell">
              <div class="reference-file-cell__wrap">
                <div class="reference-file-cell__icon">
                  <ReferenceIcon :name="fileIconName(item)" :size="16" />
                </div>
                <div class="reference-file-cell__copy">
                  <h5 :title="item.file_name">{{ item.file_name }}</h5>
                  <p>{{ item.description || '无提取文本' }}</p>
                  <button
                    v-if="showFolderPath && item.folder_path"
                    type="button"
                    class="reference-list-folder-path"
                    :title="item.folder_path"
                    @click.stop="emit('open-folder', item.folder_path)"
                  >
                    <ReferenceIcon name="folder" :size="10" />
                    <span>{{ item.folder_path }}</span>
                  </button>
                </div>
              </div>
            </td>

            <td class="reference-col-tags" @click.stop>
              <div class="reference-list-tags">
                <span v-for="tag in item.tags || []" :key="tag.id" class="reference-list-tag">{{ tag.name }}</span>
                <button v-if="canEdit" type="button" class="reference-list-tag-add" @click="emit('tag-edit', item)">+ 标签</button>
              </div>
            </td>

            <td class="reference-col-source">
              <div class="reference-list-source">
                <ReferenceIcon :name="sourceInfo(item).icon" :size="12" />
                <span>{{ sourceInfo(item).label }}</span>
              </div>
            </td>

            <td class="reference-col-size reference-mono">
              {{ formatFileSize(Number(item.file_size || 0)) }}
            </td>

            <td class="reference-col-status">
              <span class="reference-list-status" :class="`reference-list-status--${statusInfo(item).tone}`">
                <ReferenceIcon v-if="statusInfo(item).spinning" name="loader-circle" :size="10" class="reference-spin" />
                <svg
                  v-else-if="statusInfo(item).tone === 'failed'"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <span>{{ statusInfo(item).label }}</span>
              </span>
            </td>

            <td class="reference-col-time reference-mono">{{ formatTime(item.updated_at) }}</td>

            <td class="reference-col-action" @click.stop>
              <div class="reference-list-menu-anchor">
                <button
                  v-if="canEdit"
                  type="button"
                  class="reference-list-more"
                  :aria-label="t('knowledgeBase.moreOptions')"
                  @click="openMenu(item)"
                >
                  <ReferenceIcon name="more-horizontal" :size="14" />
                </button>

                <template v-if="canEdit && activeMenuItemId === item.id">
                  <div class="reference-list-backdrop" @click="closeMenu" />

                  <div v-if="folderPickerItemId === item.id" class="reference-list-menu reference-list-submenu">
                    <button type="button" class="reference-list-menu-item reference-list-menu-back" @click="folderPickerItemId = null">
                      <ReferenceIcon name="chevron-left" :size="14" />
                      <span>{{ t('knowledgeBase.moveToFolder.action') }}</span>
                    </button>
                    <div class="reference-list-menu-divider" />
                    <button
                      v-for="row in folderRows"
                      :key="row.path || '__root__'"
                      type="button"
                      class="reference-list-menu-item"
                      :class="{ current: (item.folder_path || '') === row.path }"
                      :style="{ paddingLeft: `${12 + Math.min(row.depth, 5) * 10}px` }"
                      @click="pickFolder(item, row.path)"
                    >
                      <ReferenceIcon name="folder" :size="14" class="reference-list-menu-icon" />
                      <span class="reference-list-ellipsis">{{ row.name }}</span>
                    </button>
                  </div>

                  <div v-else-if="moveMenuMode === 'targets'" class="reference-list-menu reference-list-submenu">
                    <button type="button" class="reference-list-menu-item reference-list-menu-back" @click="emit('move-back')">
                      <ReferenceIcon name="chevron-left" :size="14" />
                      <span>{{ t('knowledgeBase.moveToKnowledgeBase') }}</span>
                    </button>
                    <div class="reference-list-menu-divider" />
                    <div v-if="moveTargetsLoading" class="reference-list-menu-state">加载中...</div>
                    <div v-else-if="!moveTargetKbs.length" class="reference-list-menu-state">{{ t('knowledgeBase.moveNoTargets') }}</div>
                    <template v-else>
                      <button
                        v-for="kb in moveTargetKbs"
                        :key="kb.id"
                        type="button"
                        class="reference-list-menu-item"
                        @click="emit('move-select-target', kb)"
                      >
                        <ReferenceIcon name="folder" :size="14" class="reference-list-menu-icon" />
                        <span class="reference-list-ellipsis">{{ kb.name }}</span>
                      </button>
                    </template>
                  </div>

                  <div v-else-if="moveMenuMode === 'confirm'" class="reference-list-menu reference-list-submenu reference-list-confirm">
                    <button type="button" class="reference-list-menu-item reference-list-menu-back" @click="emit('move-back')">
                      <ReferenceIcon name="chevron-left" :size="14" />
                      <span>{{ t('knowledgeBase.moveConfirmTitle') }}</span>
                    </button>
                    <div class="reference-list-menu-divider" />
                    <div class="reference-list-confirm__target">{{ moveSelectedTargetName }}</div>
                    <label class="reference-list-mode" :class="{ active: moveMode === 'reuse_vectors' }">
                      <input type="radio" name="reference-list-move-mode" :checked="moveMode === 'reuse_vectors'" @change="emit('update:moveMode', 'reuse_vectors')" />
                      <span>{{ t('knowledgeBase.moveModeReuseVectors') }}</span>
                    </label>
                    <label class="reference-list-mode" :class="{ active: moveMode === 'reparse' }">
                      <input type="radio" name="reference-list-move-mode" :checked="moveMode === 'reparse'" @change="emit('update:moveMode', 'reparse')" />
                      <span>{{ t('knowledgeBase.moveModeReparse') }}</span>
                    </label>
                    <div class="reference-list-confirm__actions">
                      <button type="button" class="reference-list-cancel" @click="emit('move-back')">{{ t('common.cancel') }}</button>
                      <button type="button" class="reference-list-submit" :disabled="moveSubmitting" @click="emit('move-confirm')">
                        {{ moveSubmitting ? '...' : t('knowledgeBase.moveConfirm') }}
                      </button>
                    </div>
                  </div>

                  <div v-else class="reference-list-menu">
                    <button v-if="isTraceVisible(item)" type="button" class="reference-list-menu-item" @click="runAction('view-trace', item)">
                      <ReferenceIcon name="activity" :size="14" class="reference-list-menu-icon" />
                      <span>查看 Trace</span>
                    </button>
                    <button type="button" class="reference-list-menu-item" @click="runAction('reparse', item)">
                      <ReferenceIcon name="rotate-cw" :size="14" class="reference-list-menu-icon" />
                      <span>{{ t('knowledgeBase.rebuildDocument') }}</span>
                    </button>
                    <button
                      v-if="isParseInFlight(item.parse_status)"
                      type="button"
                      class="reference-list-menu-item reference-list-menu-item--warning"
                      @click="runAction('cancel-parse', item)"
                    >
                      <ReferenceIcon name="stop-circle" :size="14" />
                      <span>停止解析</span>
                    </button>
                    <button v-if="canMutateKnowledge" type="button" class="reference-list-menu-item" @click="folderPickerItemId = item.id">
                      <ReferenceIcon name="folder" :size="14" class="reference-list-menu-icon" />
                      <span>{{ t('knowledgeBase.moveToFolder.action') }}</span>
                    </button>
                    <button v-if="canMutateKnowledge" type="button" class="reference-list-menu-item" @click="runAction('move', item)">
                      <ReferenceIcon name="arrow-right-left" :size="14" class="reference-list-menu-icon" />
                      <span>移动到...</span>
                    </button>
                    <button v-if="canMutateKnowledge" type="button" class="reference-list-menu-item" @click="runAction('batch-manage', item)">
                      <ReferenceIcon name="check-square" :size="14" class="reference-list-menu-icon" />
                      <span>{{ t('menu.batchManage') }}</span>
                    </button>
                    <div class="reference-list-menu-divider" />
                    <button type="button" class="reference-list-menu-item reference-list-menu-item--danger" @click="runAction('delete', item)">
                      <ReferenceIcon name="trash-2" :size="14" />
                      <span>{{ t('knowledgeBase.deleteDocument') }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.reference-document-table-shell {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(229 231 235 / 0.9);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.025);
}
.reference-document-table-scroll { flex: 1; min-height: 0; overflow: auto; }
.reference-document-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: #374151;
  font-size: 12px;
  text-align: left;
}
.reference-document-table thead tr {
  height: 42px;
  border-bottom: 1px solid #f3f4f6;
  background: rgb(249 250 251 / 0.7);
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
}
.reference-document-table th,
.reference-document-table td { padding: 12px 16px; box-sizing: border-box; }
.reference-document-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 120ms ease;
  cursor: pointer;
}
.reference-document-table tbody tr:hover { background: rgb(249 250 251 / 0.8); }
.reference-document-table tbody tr.is-selected { background: rgb(243 244 246 / 0.6); }
.reference-document-table input[type='checkbox'] { width: 13px; height: 13px; margin: 0; accent-color: #111827; cursor: pointer; }
.reference-col-check { width: 42px; }
.reference-col-tags { width: 132px; }
.reference-col-source { width: 96px; }
.reference-col-size { width: 88px; }
.reference-col-status { width: 96px; }
.reference-col-time { width: 128px; }
.reference-col-action { width: 64px; text-align: right; }
.reference-file-cell { max-width: 420px; }
.reference-file-cell__wrap { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.reference-file-cell__icon {
  width: 32px;
  height: 32px;
  margin-top: 2px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
  display: grid;
  place-items: center;
  flex: 0 0 32px;
}
.reference-file-cell__copy { min-width: 0; }
.reference-file-cell__copy h5 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
}
.reference-file-cell__copy p {
  max-width: 420px;
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #9ca3af;
  font-size: 11px;
  line-height: 16px;
}
.reference-list-folder-path {
  max-width: 100%;
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #9ca3af;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  cursor: pointer;
}
.reference-list-folder-path span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-list-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.reference-list-tag {
  padding: 2px 8px;
  border-radius: 6px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
}
.reference-list-tag-add {
  padding: 2px 6px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
  cursor: pointer;
}
.reference-list-tag-add:hover { border-color: #9ca3af; color: #111827; }
.reference-list-source { display: flex; align-items: center; gap: 4px; color: #6b7280; font-size: 11px; }
.reference-list-source :deep(.reference-icon) { color: #9ca3af; }
.reference-mono { color: #6b7280; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace; font-size: 11px; }
.reference-col-time.reference-mono { color: #9ca3af; }
.reference-list-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
  white-space: nowrap;
}
.reference-list-status--optimizing { color: #b45309; background: #fffbeb; border-color: rgb(253 230 138 / 0.8); }
.reference-list-status--indexing { color: #1d4ed8; background: #eff6ff; border-color: rgb(191 219 254 / 0.8); }
.reference-list-status--failed { color: #dc2626; background: #fef2f2; border-color: rgb(254 202 202 / 0.8); }
.reference-list-status--completed { color: #047857; background: #ecfdf5; border-color: rgb(167 243 208 / 0.8); }
.reference-spin { animation: reference-list-spin 1s linear infinite; }
@keyframes reference-list-spin { to { transform: rotate(360deg); } }
.reference-list-menu-anchor { position: relative; display: inline-block; }
.reference-list-more {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.reference-list-more:hover { background: #f3f4f6; color: #111827; }
.reference-list-backdrop { position: fixed; inset: 0; z-index: 20; }
.reference-list-menu {
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
  text-align: left;
}
.reference-list-submenu { width: 190px; max-height: 300px; overflow-y: auto; }
.reference-list-menu-item {
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
  text-align: left;
  cursor: pointer;
}
.reference-list-menu-item:hover { background: #f9fafb; }
.reference-list-menu-item.current { background: #f3f4f6; color: #111827; font-weight: 600; }
.reference-list-menu-icon { color: #6b7280; }
.reference-list-menu-item--warning { color: #b45309; }
.reference-list-menu-item--warning:hover { background: #fffbeb; }
.reference-list-menu-item--danger { color: #dc2626; }
.reference-list-menu-item--danger:hover { background: #fef2f2; }
.reference-list-menu-back { font-weight: 600; }
.reference-list-menu-divider { height: 1px; margin: 2px 0; background: #f3f4f6; }
.reference-list-menu-state { padding: 10px 12px; color: #9ca3af; font-size: 11px; }
.reference-list-ellipsis { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-list-confirm { padding-bottom: 8px; }
.reference-list-confirm__target { padding: 8px 12px 4px; color: #111827; font-size: 12px; font-weight: 700; }
.reference-list-mode { margin: 4px 8px; padding: 7px 8px; border: 1px solid #e5e7eb; border-radius: 9px; display: flex; align-items: center; gap: 7px; color: #4b5563; font-size: 11px; cursor: pointer; }
.reference-list-mode.active { border-color: #9ca3af; background: #f9fafb; color: #111827; }
.reference-list-mode input { margin: 0; accent-color: #111827; }
.reference-list-confirm__actions { display: flex; justify-content: flex-end; gap: 6px; padding: 8px 8px 0; }
.reference-list-cancel,
.reference-list-submit { height: 26px; padding: 0 9px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
.reference-list-cancel { border: 1px solid #e5e7eb; background: #fff; color: #4b5563; }
.reference-list-submit { border: 1px solid #111827; background: #111827; color: #fff; }
.reference-list-submit:disabled { opacity: .55; cursor: default; }

@media (max-width: 1180px) {
  .reference-col-tags { width: 110px; }
  .reference-col-source { width: 82px; }
  .reference-col-size { width: 76px; }
  .reference-col-time { width: 112px; }
}
</style>
