<template>
  <aside class="visual-folder-tree" :class="{ 'is-collapsed': collapsed }">
    <template v-if="collapsed">
      <t-tooltip :content="t('knowledgeBase.folderTree.expand')" placement="right">
        <button
          type="button"
          class="visual-folder-tree__collapsed-trigger"
          :aria-label="t('knowledgeBase.folderTree.expand')"
          @click="emit('update:collapsed', false)"
        >
          <t-icon name="root-list" class="visual-folder-tree__collapsed-icon" />
          <span>{{ t('knowledgeBase.folderTree.title') }}</span>
        </button>
      </t-tooltip>
    </template>

    <template v-else>
      <header class="visual-folder-tree__header">
        <span class="visual-folder-tree__title">
          <t-icon name="folder" />
          {{ t('knowledgeBase.folderTree.title') }}
        </span>
        <t-tooltip :content="t('knowledgeBase.folderTree.collapse')" placement="top">
          <button
            type="button"
            class="visual-folder-tree__collapse"
            :aria-label="t('knowledgeBase.folderTree.collapse')"
            @click="emit('update:collapsed', true)"
          >
            <t-icon name="chevron-left-double" />
          </button>
        </t-tooltip>
      </header>

      <div class="visual-folder-tree__body">
        <template v-if="loading && !tree">
          <div v-for="n in 5" :key="'folder-skel-' + n" class="visual-folder-tree__skeleton">
            <t-skeleton animation="gradient" :row-col="[{ width: '100%', height: '16px' }]" />
          </div>
        </template>

        <template v-else>
          <div
            v-for="row in rows"
            :key="row.path || '__root__'"
            class="visual-folder-row"
            :class="{
              'is-active': selectedPath === row.path,
              'is-root': row.kind === 'root',
              'is-editable': canEdit && row.kind === 'folder',
              'is-menu-open': menuOpenPath === row.path,
            }"
            :style="{ '--visual-folder-depth': row.depth }"
            :title="row.kind === 'root' ? t('knowledgeBase.folderTree.rootRowTip') : row.path"
            role="button"
            tabindex="0"
            @click="emit('select', row.path)"
            @keydown.enter="emit('select', row.path)"
          >
            <span
              v-if="row.hasChildren"
              class="visual-folder-row__toggle"
              role="button"
              :aria-label="t(isExpanded(row.path)
                ? 'knowledgeBase.folderTree.collapseFolder'
                : 'knowledgeBase.folderTree.expandFolder')"
              @click.stop="toggle(row.path)"
            >
              <t-icon :name="isExpanded(row.path) ? 'chevron-down' : 'chevron-right'" />
            </span>
            <span v-else class="visual-folder-row__toggle-placeholder" aria-hidden="true" />

            <t-icon
              :name="row.kind === 'root' || (row.hasChildren && isExpanded(row.path)) ? 'folder-open' : 'folder'"
              class="visual-folder-row__icon"
            />

            <input
              v-if="isRenaming(row)"
              ref="renameInputRef"
              v-model="renameValue"
              class="visual-folder-row__rename"
              :placeholder="t('knowledgeBase.folderTree.renamePlaceholder')"
              @click.stop
              @keydown.enter="commitRename(row)"
              @keydown.esc="cancelRename"
              @blur="commitRename(row)"
            />

            <template v-else>
              <span class="visual-folder-row__label">
                {{ row.kind === 'root' ? t('knowledgeBase.folderTree.rootRow') : row.name }}
              </span>
              <span class="visual-folder-row__trailing">
                <span class="visual-folder-row__count">{{ row.totalCount }}</span>
                <t-popup
                  v-if="canEdit && row.kind === 'folder'"
                  :visible="menuOpenPath === row.path"
                  trigger="click"
                  placement="bottom-right"
                  destroy-on-close
                  overlay-class-name="card-more-popup"
                  @visible-change="(visible: boolean) => onFolderMenuVisible(row.path, visible)"
                >
                  <button
                    type="button"
                    class="visual-folder-row__more"
                    :class="{ 'is-open': menuOpenPath === row.path }"
                    :aria-label="t('knowledgeBase.moreOptions')"
                    @click.stop
                  >
                    <t-icon name="more" />
                  </button>
                  <template #content>
                    <div class="visual-folder-menu" @click.stop>
                      <button type="button" class="visual-folder-menu__item" @click="onFolderMenuRename(row)">
                        <t-icon name="edit" />
                        <span>{{ t('knowledgeBase.folderTree.rename') }}</span>
                      </button>
                    </div>
                  </template>
                </t-popup>
              </span>
            </template>
          </div>
        </template>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
  /** Selected folder path; the empty string is the knowledge base top level. */
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

// The root starts expanded so the uploaded structure is visible without a click.
const expanded = ref(new Set<string>([ROOT_FOLDER_PATH]))
// null, not '', because '' is the root's own path: a falsy sentinel would put
// the root row into rename mode permanently.
const renamingPath = ref<string | null>(null)
const menuOpenPath = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

const rows = computed(() => buildFolderRows(props.tree, expanded.value))

const isExpanded = (path: string) => expanded.value.has(path)

// The root has no name of its own to edit, and excluding it here means no
// sentinel value can ever put it into rename mode.
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
  await nextTick()
  const input = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
  input?.focus()
  input?.select()
}

const onFolderMenuVisible = (path: string, visible: boolean) => {
  menuOpenPath.value = visible ? path : null
}

const onFolderMenuRename = async (row: FolderRow) => {
  menuOpenPath.value = null
  await startRename(row)
}

const cancelRename = () => {
  renamingPath.value = null
  renameValue.value = ''
}

const commitRename = (row: FolderRow) => {
  if (!isRenaming(row)) return
  const name = renameValue.value.trim()
  cancelRename()
  // Only the last segment is edited here; the folder keeps its place in the tree.
  if (!name || name === row.name) return
  const parent = row.path.slice(0, Math.max(0, row.path.length - row.name.length - 1))
  emit('rename', { from: row.path, to: joinFolderPath(parent, name) })
}

// Keep the selected folder reachable: expand the root and every folder above
// the active path, both on first load and when the selection changes from
// elsewhere (e.g. opening a folder from the document list).
watch(
  () => [props.selectedPath, props.tree] as const,
  () => {
    const next = new Set(expanded.value)
    folderAncestorPaths(props.selectedPath).forEach((path) => next.add(path))
    expanded.value = next
  },
  { immediate: true },
)

// First load also opens the top-level folders, so a two-level upload is visible
// in full without any expanding.
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

<style scoped lang="less">
.visual-folder-tree {
  flex: 0 0 224px;
  width: 224px;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  font-size: 12px;
  line-height: 18px;
}

.visual-folder-tree.is-collapsed {
  flex-basis: 48px;
  width: 48px;
  align-items: stretch;
}

.visual-folder-tree__collapsed-trigger {
  width: 100%;
  min-height: 72px;
  padding: 12px 6px;
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-size: 11px;
  line-height: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.visual-folder-tree__collapsed-trigger:hover {
  background: #f9fafb;
  color: #111827;
}

.visual-folder-tree__collapsed-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.visual-folder-tree__header {
  flex: 0 0 auto;
  min-height: 48px;
  padding: 12px 14px;
  box-sizing: border-box;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: rgb(249 250 251 / 50%);
}

.visual-folder-tree__title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1f2937;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
}

.visual-folder-tree__title :deep(.t-icon) {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  font-size: 14px;
  color: #6b7280;
}

.visual-folder-tree__collapse {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.visual-folder-tree__collapse:hover {
  background: #e5e7eb;
  color: #111827;
}

.visual-folder-tree__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.visual-folder-tree__skeleton {
  padding: 6px 10px;
}

.visual-folder-row {
  --visual-folder-indent: 12px;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding: 6px 10px 6px calc(10px + var(--visual-folder-depth, 0) * var(--visual-folder-indent));
  box-sizing: border-box;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease, color 150ms ease;
}

.visual-folder-row:hover {
  background: #f3f4f6;
  color: #111827;
}

.visual-folder-row.is-active.is-root {
  background: #111827;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

.visual-folder-row.is-active:not(.is-root) {
  background: #e5e7eb;
  color: #111827;
  font-weight: 700;
}

.visual-folder-row__toggle,
.visual-folder-row__toggle-placeholder {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  opacity: .68;
}

.visual-folder-row__toggle {
  cursor: pointer;
}

.visual-folder-row__toggle:hover {
  background: rgb(0 0 0 / 6%);
  opacity: 1;
}

.visual-folder-row__toggle :deep(.t-icon),
.visual-folder-row__icon {
  font-size: 14px;
}

.visual-folder-row__icon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: currentColor;
  opacity: .82;
}

.visual-folder-row__label {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-folder-row__trailing {
  flex: 0 0 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.visual-folder-row__count {
  font-family: var(--app-font-family-mono);
  color: #9ca3af;
  font-size: 10px;
  line-height: 14px;
}

.visual-folder-row.is-active.is-root .visual-folder-row__count {
  color: rgb(255 255 255 / 65%);
}

.visual-folder-row__more {
  width: 20px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #9ca3af;
  opacity: 0;
  cursor: pointer;
}

.visual-folder-row:hover .visual-folder-row__more,
.visual-folder-row__more.is-open {
  opacity: 1;
}

.visual-folder-row__more:hover {
  background: #fff;
  color: #374151;
}

.visual-folder-row__rename {
  min-width: 0;
  flex: 1 1 auto;
  height: 24px;
  padding: 2px 6px;
  box-sizing: border-box;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  outline: 0;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 12px;
}

.visual-folder-menu {
  min-width: 132px;
  padding: 4px;
}

.visual-folder-menu__item {
  width: 100%;
  min-height: 32px;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #374151;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.visual-folder-menu__item:hover {
  background: #f3f4f6;
}

@media (max-width: 900px) {
  .visual-folder-tree:not(.is-collapsed) {
    flex-basis: 200px;
    width: 200px;
  }
}
</style>
