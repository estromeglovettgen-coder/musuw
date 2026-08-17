<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import type { KnowledgeFolderTree } from '@/api/knowledge-base/index'
import {
  buildFolderRows,
  folderAncestorPaths,
  joinFolderPath,
  ROOT_FOLDER_PATH,
  type FolderRow,
} from '../folderTree'

const props = withDefaults(defineProps<{
  tree: KnowledgeFolderTree | null
  selectedPath: string
  loading?: boolean
  collapsed?: boolean
  canEdit?: boolean
}>(), {
  loading: false,
  collapsed: false,
  canEdit: false,
})

const emit = defineEmits<{
  select: [path: string]
  'update:collapsed': [collapsed: boolean]
  rename: [payload: { from: string; to: string }]
}>()

const { t } = useI18n()
const expanded = ref(new Set<string>([ROOT_FOLDER_PATH]))
const renamingPath = ref<string | null>(null)
const menuOpenPath = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

const rows = computed(() => buildFolderRows(props.tree, expanded.value))
const isExpanded = (path: string) => expanded.value.has(path)
const isRenaming = (row: FolderRow) => row.kind === 'folder' && renamingPath.value === row.path

const toggle = (path: string) => {
  const next = new Set(expanded.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expanded.value = next
}

const startRename = async (row: FolderRow) => {
  renamingPath.value = row.path
  renameValue.value = row.name
  menuOpenPath.value = null
  await nextTick()
  const input = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
  input?.focus()
  input?.select()
}

const cancelRename = () => {
  renamingPath.value = null
  renameValue.value = ''
}

const commitRename = (row: FolderRow) => {
  if (!isRenaming(row)) return
  const name = renameValue.value.trim()
  cancelRename()
  if (!name || name === row.name) return
  const parent = row.path.slice(0, Math.max(0, row.path.length - row.name.length - 1))
  emit('rename', { from: row.path, to: joinFolderPath(parent, name) })
}

const openMenu = (row: FolderRow) => {
  menuOpenPath.value = menuOpenPath.value === row.path ? null : row.path
}

watch(
  () => [props.selectedPath, props.tree] as const,
  () => {
    const next = new Set(expanded.value)
    folderAncestorPaths(props.selectedPath).forEach((path) => next.add(path))
    expanded.value = next
  },
  { immediate: true },
)

watch(
  () => props.tree,
  (tree) => {
    if (!tree?.folders?.length || expanded.value.size > 1) return
    const next = new Set(expanded.value)
    tree.folders.forEach((folder) => next.add(folder.path))
    expanded.value = next
  },
  { immediate: true },
)
</script>

<template>
  <aside class="kb-folder-tree" :class="{ 'is-collapsed': collapsed }">
    <template v-if="!collapsed">
      <div class="kb-folder-tree__header">
        <span class="kb-folder-tree__title">
          <ReferenceIcon name="folder" :size="14" class="kb-folder-tree__title-icon" />
          <span>{{ t('knowledgeBase.folderTree.title') }}</span>
        </span>
        <button
          type="button"
          class="kb-folder-tree__header-button"
          :title="t('knowledgeBase.folderTree.collapse')"
          :aria-label="t('knowledgeBase.folderTree.collapse')"
          @click="emit('update:collapsed', true)"
        >
          <ReferenceIcon name="panel-left-close" :size="14" />
        </button>
      </div>

      <div class="kb-folder-tree__body">
        <template v-if="loading && !tree">
          <div v-for="n in 5" :key="n" class="kb-folder-tree__skeleton">
            <span class="kb-folder-tree__skeleton-icon" />
            <span class="kb-folder-tree__skeleton-line" />
          </div>
        </template>

        <template v-else>
          <div
            v-for="row in rows"
            :key="row.path || '__root__'"
            class="kb-folder-row"
            :class="{
              active: selectedPath === row.path,
              'is-root': row.kind === 'root',
              'is-folder': row.kind === 'folder',
              'is-editable': canEdit && row.kind === 'folder',
            }"
            :style="{ '--kb-folder-depth': row.depth }"
            :title="row.kind === 'root' ? t('knowledgeBase.folderTree.rootRowTip') : row.path"
            role="button"
            tabindex="0"
            @click="emit('select', row.path)"
            @keydown.enter="emit('select', row.path)"
          >
            <span
              v-if="row.hasChildren"
              class="kb-folder-row__toggle"
              role="button"
              :aria-label="t(isExpanded(row.path) ? 'knowledgeBase.folderTree.collapseFolder' : 'knowledgeBase.folderTree.expandFolder')"
              @click.stop="toggle(row.path)"
            >
              <ReferenceIcon :name="isExpanded(row.path) ? 'chevron-down' : 'chevron-right'" :size="12" />
            </span>
            <span v-else class="kb-folder-row__toggle-placeholder" aria-hidden="true" />

            <ReferenceIcon
              :name="row.kind === 'root' || (row.hasChildren && isExpanded(row.path)) ? 'folder-open' : 'folder'"
              :size="row.kind === 'root' ? 14 : 12"
              class="kb-folder-row__icon"
            />

            <input
              v-if="isRenaming(row)"
              ref="renameInputRef"
              v-model="renameValue"
              class="kb-folder-row__rename"
              :placeholder="t('knowledgeBase.folderTree.renamePlaceholder')"
              @click.stop
              @keydown.enter="commitRename(row)"
              @keydown.esc="cancelRename"
              @blur="commitRename(row)"
            />

            <template v-else>
              <span class="kb-folder-row__label">
                {{ row.kind === 'root' ? t('knowledgeBase.folderTree.rootRow') : row.name }}
              </span>
              <span class="kb-folder-row__count">{{ row.totalCount }}</span>

              <div v-if="canEdit && row.kind === 'folder'" class="kb-folder-row__menu-anchor">
                <button
                  type="button"
                  class="kb-folder-row__more"
                  :aria-label="t('knowledgeBase.moreOptions')"
                  @click.stop="openMenu(row)"
                >
                  <ReferenceIcon name="more-horizontal" :size="12" />
                </button>

                <template v-if="menuOpenPath === row.path">
                  <div class="kb-folder-row__backdrop" @click.stop="menuOpenPath = null" />
                  <div class="kb-folder-row__menu" @click.stop>
                    <button type="button" @click="startRename(row)">
                      <ReferenceIcon name="edit-2" :size="12" class="kb-folder-row__menu-icon" />
                      <span>{{ t('knowledgeBase.folderTree.rename') }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>
      </div>
    </template>

    <button
      v-else
      type="button"
      class="kb-folder-tree__expand"
      :title="t('knowledgeBase.folderTree.expand')"
      :aria-label="t('knowledgeBase.folderTree.expand')"
      @click="emit('update:collapsed', false)"
    >
      <ReferenceIcon name="panel-left-open" :size="16" />
      <span>{{ t('knowledgeBase.folderTree.title') }}</span>
    </button>
  </aside>
</template>

<style scoped>
.kb-folder-tree {
  width: 224px;
  min-width: 224px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid rgb(229 231 235 / 0.9);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.025);
  box-sizing: border-box;
  color: #374151;
  font-size: 12px;
}
.kb-folder-tree.is-collapsed {
  width: auto;
  min-width: 0;
  padding: 12px 6px;
}
.kb-folder-tree.ref-directory .kb-folder-tree__header,
.kb-folder-tree .kb-folder-tree__header {
  min-height: 40px !important;
  height: 40px !important;
  padding: 0 14px !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f3f4f6 !important;
  background: rgb(249 250 251 / 0.5) !important;
  box-sizing: border-box;
}
.kb-folder-tree__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #1f2937;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
}
.kb-folder-tree__title-icon { color: #6b7280; }
.kb-folder-tree__header-button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.kb-folder-tree__header-button:hover { background: rgb(229 231 235 / 0.7); color: #111827; }
.kb-folder-tree.ref-directory .kb-folder-tree__body,
.kb-folder-tree .kb-folder-tree__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px !important;
  box-sizing: border-box;
}
.kb-folder-tree__skeleton {
  height: 28px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.kb-folder-tree__skeleton-icon,
.kb-folder-tree__skeleton-line {
  display: block;
  border-radius: 5px;
  background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6);
  background-size: 200% 100%;
  animation: reference-folder-skeleton 1.2s linear infinite;
}
.kb-folder-tree__skeleton-icon { width: 12px; height: 12px; }
.kb-folder-tree__skeleton-line { width: 70%; height: 9px; }
@keyframes reference-folder-skeleton { to { background-position: -200% 0; } }

.kb-folder-tree .kb-folder-tree__body .kb-folder-row {
  --kb-folder-indent: 10px;
  position: relative;
  width: 100%;
  min-height: 28px !important;
  height: 28px;
  box-sizing: border-box;
  padding: 0 6px 0 calc(6px + var(--kb-folder-depth, 0) * var(--kb-folder-indent));
  border-radius: 8px !important;
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent !important;
  color: #4b5563 !important;
  font-size: 12px !important;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.kb-folder-tree .kb-folder-tree__body .kb-folder-row:hover { background: #f3f4f6 !important; color: #111827 !important; }
.kb-folder-tree .kb-folder-tree__body .kb-folder-row.is-root.active {
  background: #111827 !important;
  color: #fff !important;
  font-weight: 700;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}
.kb-folder-tree .kb-folder-tree__body .kb-folder-row.is-folder.active {
  background: #e5e7eb !important;
  color: #030712 !important;
  font-weight: 700;
  box-shadow: none !important;
}
.kb-folder-row__toggle,
.kb-folder-row__toggle-placeholder {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  display: grid;
  place-items: center;
  color: #9ca3af;
}
.kb-folder-row__toggle { cursor: pointer; }
.kb-folder-row__icon { flex: 0 0 auto; color: #9ca3af !important; }
.kb-folder-row.is-root.active .kb-folder-row__icon,
.kb-folder-row.is-root.active .kb-folder-row__toggle { color: #fff !important; }
.kb-folder-row.is-folder.active .kb-folder-row__icon { color: #111827 !important; }
.kb-folder-row__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-folder-row__count {
  flex: 0 0 auto;
  color: #9ca3af !important;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  line-height: 14px;
}
.kb-folder-row.is-root.active .kb-folder-row__count {
  padding: 0 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.2);
  color: #fff !important;
}
.kb-folder-row__menu-anchor { position: relative; flex: 0 0 auto; }
.kb-folder-row__more {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  display: grid;
  place-items: center;
  opacity: 0;
  cursor: pointer;
}
.kb-folder-row:hover .kb-folder-row__more,
.kb-folder-row__more:focus { opacity: 1; }
.kb-folder-row__more:hover { background: #e5e7eb; color: #374151; }
.kb-folder-row__backdrop { position: fixed; inset: 0; z-index: 30; }
.kb-folder-row__menu {
  position: absolute;
  right: 0;
  top: 22px;
  z-index: 40;
  width: 128px;
  padding: 4px 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10);
}
.kb-folder-row__menu button {
  width: 100%;
  height: 28px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.kb-folder-row__menu button:hover { background: #f9fafb; }
.kb-folder-row__menu-icon { color: #9ca3af; }
.kb-folder-row__rename {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.kb-folder-tree__expand {
  padding: 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.kb-folder-tree__expand:hover { background: #f3f4f6; }
</style>
