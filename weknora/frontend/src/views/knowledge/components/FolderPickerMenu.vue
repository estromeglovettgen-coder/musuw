<template>
  <div class="reference-folder-picker">
    <button
      v-if="showBack"
      type="button"
      class="reference-folder-picker__header"
      @click.stop="emit('back')"
    >
      <ReferenceIcon name="chevron-left" :size="14" />
      <span>{{ t('knowledgeBase.moveToFolder.action') }}</span>
    </button>

    <div ref="listRef" class="reference-folder-picker__list">
      <template v-for="row in renderRows" :key="row.key">
        <div
          v-if="row.kind === 'folder'"
          :data-folder-path="row.path || undefined"
          class="reference-folder-picker__item"
          :class="{ current: effectiveCurrentPath === row.path }"
          :style="{ '--reference-folder-depth': row.depth }"
          :title="row.path || undefined"
          role="button"
          tabindex="0"
          @click.stop="choose(row.path)"
          @keydown.enter.stop="choose(row.path)"
          @keydown.space.prevent.stop="choose(row.path)"
        >
          <ReferenceIcon
            :name="row.isRoot ? 'folder-open' : 'folder'"
            :size="14"
            class="reference-folder-picker__icon"
          />
          <span class="reference-folder-picker__name">{{ row.label }}</span>
          <span class="reference-folder-picker__trailing">
            <button
              type="button"
              class="reference-folder-picker__add"
              :title="row.isRoot
                ? t('knowledgeBase.moveToFolder.newFolderAddRoot')
                : t('knowledgeBase.moveToFolder.newFolderAddUnder', { folder: row.label })"
              :aria-label="row.isRoot
                ? t('knowledgeBase.moveToFolder.newFolderAddRoot')
                : t('knowledgeBase.moveToFolder.newFolderAddUnder', { folder: row.label })"
              @click.stop="startCreatingUnder(row.path)"
            >
              <ReferenceIcon name="folder-plus" :size="13" />
            </button>
            <ReferenceIcon
              v-if="effectiveCurrentPath === row.path"
              name="check-circle-2"
              :size="13"
              class="reference-folder-picker__current"
            />
          </span>
        </div>

        <div
          v-else
          class="reference-folder-picker__item reference-folder-picker__item--create"
          :style="{ '--reference-folder-depth': row.depth }"
          @click.stop
        >
          <ReferenceIcon name="folder" :size="14" class="reference-folder-picker__icon" />
          <input
            ref="newFolderInputRef"
            v-model.trim="newFolderName"
            class="reference-folder-picker__input"
            :placeholder="t('knowledgeBase.moveToFolder.newFolderPlaceholder')"
            @keydown.enter.stop="commitNewFolder"
            @keydown.esc.stop="cancelCreating"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { folderOptionFromPath, joinFolderPath, normalizeFolderPath, sortFolderOptions } from '../folderTree'

export type FolderOption = { path: string; name: string; depth: number }

type FolderRow = {
  kind: 'folder'
  key: string
  path: string
  label: string
  depth: number
  isRoot?: boolean
}

type CreateRow = {
  kind: 'create'
  key: string
  parentPath: string
  depth: number
}

type RenderRow = FolderRow | CreateRow

const props = withDefaults(defineProps<{
  options: FolderOption[]
  currentPath?: string
  showBack?: boolean
  allowReselect?: boolean
}>(), {
  currentPath: '',
  showBack: false,
  allowReselect: false,
})

const emit = defineEmits<{
  back: []
  confirm: [folderPath: string]
  create: [folderPath: string]
}>()

const { t } = useI18n()
const creatingUnder = ref<string | null>(null)
const newFolderName = ref('')
const newFolderInputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const localCreatedPaths = ref<string[]>([])
const selectedPath = ref<string | null>(null)

const effectiveCurrentPath = computed(() =>
  selectedPath.value !== null ? selectedPath.value : (props.currentPath ?? ''),
)

const displayOptions = computed(() => {
  const byPath = new Map<string, FolderOption>()
  props.options.forEach((option) => byPath.set(option.path, option))
  localCreatedPaths.value.forEach((path) => {
    if (!byPath.has(path)) byPath.set(path, folderOptionFromPath(path))
  })
  return sortFolderOptions([...byPath.values()])
})

const renderRows = computed<RenderRow[]>(() => {
  const rows: RenderRow[] = [{
    kind: 'folder',
    key: 'root',
    path: '',
    label: t('knowledgeBase.folderTree.rootRow'),
    depth: 0,
    isRoot: true,
  }]

  if (creatingUnder.value === '') {
    rows.push({ kind: 'create', key: 'create-root', parentPath: '', depth: childCreateDepth('') })
  }

  displayOptions.value.forEach((option) => {
    rows.push({
      kind: 'folder',
      key: option.path,
      path: option.path,
      label: option.name,
      depth: option.depth,
    })
    if (creatingUnder.value === option.path) {
      rows.push({
        kind: 'create',
        key: `create-${option.path}`,
        parentPath: option.path,
        depth: childCreateDepth(option.path),
      })
    }
  })

  return rows
})

watch(creatingUnder, async (value) => {
  if (value === null) return
  await nextTick()
  newFolderInputRef.value?.focus()
})

watch(
  () => props.options,
  (options) => {
    const existing = new Set(options.map((option) => option.path))
    localCreatedPaths.value = localCreatedPaths.value.filter((path) => !existing.has(path))
  },
  { deep: true },
)

watch(() => props.currentPath, () => { selectedPath.value = null })

function childCreateDepth(parentPath: string): number {
  return parentPath.split('/').filter(Boolean).length
}

const choose = (path: string) => {
  if (path === effectiveCurrentPath.value && !props.allowReselect) return
  selectedPath.value = path
  emit('confirm', path)
}

const startCreatingUnder = (parentPath: string) => {
  if (creatingUnder.value === parentPath) {
    cancelCreating()
    return
  }
  creatingUnder.value = parentPath
  newFolderName.value = ''
}

const cancelCreating = () => {
  creatingUnder.value = null
  newFolderName.value = ''
}

const scrollToFolder = async (path: string) => {
  await nextTick()
  const row = listRef.value?.querySelector(`[data-folder-path="${CSS.escape(path)}"]`)
  row?.scrollIntoView({ block: 'nearest' })
}

const commitNewFolder = async () => {
  if (creatingUnder.value === null) return
  const name = normalizeFolderPath(newFolderName.value)
  if (!name) return
  const path = joinFolderPath(creatingUnder.value, name)
  if (displayOptions.value.some((option) => option.path === path)) {
    MessagePlugin.warning(t('knowledgeBase.moveToFolder.duplicate'))
    return
  }

  if (!localCreatedPaths.value.includes(path)) {
    localCreatedPaths.value = [...localCreatedPaths.value, path]
  }
  creatingUnder.value = null
  newFolderName.value = ''
  emit('create', path)
  await scrollToFolder(path)
}
</script>

<style scoped>
.reference-folder-picker {
  --reference-folder-indent: 10px;
  min-width: 220px;
  max-width: 288px;
  padding: 6px;
  box-sizing: border-box;
  background: #fff;
  color: #374151;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-folder-picker__header {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  margin: 0 0 4px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  background: transparent;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.reference-folder-picker__header:hover { color: #111827; }
.reference-folder-picker__list {
  max-height: 268px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
.reference-folder-picker__item {
  width: 100%;
  height: 30px;
  box-sizing: border-box;
  padding: 0 6px 0 calc(8px + var(--reference-folder-depth, 0) * var(--reference-folder-indent));
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 7px;
  text-align: left;
  font-family: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
}
.reference-folder-picker__item:hover:not(.current),
.reference-folder-picker__item:focus-visible { background: #f3f4f6; color: #111827; outline: 0; }
.reference-folder-picker__item.current { color: #9ca3af; cursor: default; }
.reference-folder-picker__item--create { cursor: default; }
.reference-folder-picker__icon { flex: 0 0 auto; color: #6b7280; }
.reference-folder-picker__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reference-folder-picker__trailing {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 3px;
}
.reference-folder-picker__add {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  display: inline-grid;
  place-items: center;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
}
.reference-folder-picker__item:hover .reference-folder-picker__add,
.reference-folder-picker__add:focus-visible { opacity: 1; pointer-events: auto; }
.reference-folder-picker__add:hover { background: #e5e7eb; color: #111827; }
.reference-folder-picker__current { color: #9ca3af; }
.reference-folder-picker__input {
  flex: 1;
  min-width: 0;
  height: 24px;
  box-sizing: border-box;
  padding: 0 7px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #fff;
  color: #111827;
  font-family: inherit;
  font-size: 11px;
  outline: none;
}
.reference-folder-picker__input:focus { border-color: #9ca3af; box-shadow: 0 0 0 2px rgb(17 24 39 / .04); }
</style>
