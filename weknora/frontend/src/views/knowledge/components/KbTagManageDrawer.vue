<template>
  <Teleport to="body">
    <template v-if="drawerVisible">
      <div class="reference-drawer-backdrop" @click="drawerVisible = false" />
      <aside class="reference-tag-drawer" role="dialog" aria-modal="true" :aria-label="$t('knowledgeBase.tagManageTitle')">
        <header class="reference-tag-drawer__header">
          <div class="reference-tag-drawer__heading">
            <span class="reference-tag-drawer__icon"><ReferenceIcon name="tag" :size="16" /></span>
            <div>
              <h3>{{ $t('knowledgeBase.tagManageTitle') }}</h3>
              <p>{{ $t('knowledgeBase.tagManageDescription') }}</p>
            </div>
          </div>
          <button type="button" class="reference-tag-drawer__close" aria-label="关闭" @click="drawerVisible = false">×</button>
        </header>

        <div class="reference-tag-drawer__content">
          <div class="reference-tag-drawer__section-title">{{ $t('knowledgeBase.tagManageListSection') }}</div>

          <div class="reference-tag-toolbar">
            <label class="reference-tag-toolbar__search">
              <ReferenceIcon name="search" :size="14" />
              <input v-model.trim="searchQuery" :placeholder="$t('knowledgeBase.tagSearchPlaceholder')" />
              <button v-if="searchQuery" type="button" aria-label="清空" @click="searchQuery = ''">×</button>
            </label>
            <button
              type="button"
              class="reference-tag-toolbar__create"
              :disabled="creatingTag"
              :title="$t('knowledgeBase.tagCreateAction')"
              :aria-label="$t('knowledgeBase.tagCreateAction')"
              @click="startCreateTag"
            >
              <ReferenceIcon name="plus" :size="15" />
            </button>
          </div>

          <div v-if="loading && !tags.length" class="reference-tag-skeleton-grid">
            <div v-for="n in 6" :key="n" class="reference-tag-skeleton" />
          </div>

          <div v-else-if="!tags.length && !creatingTag" class="reference-tag-drawer__empty">
            <ReferenceIcon name="tag" :size="24" />
            <span>{{ $t('knowledgeBase.tagEmptyResult') }}</span>
          </div>

          <ul v-else class="reference-tag-grid">
            <li v-if="creatingTag" class="reference-tag-tile editing">
              <span class="reference-tag-tile__badge"><ReferenceIcon name="tag" :size="14" /></span>
              <input
                ref="newTagInputRef"
                v-model="newTagName"
                maxlength="40"
                class="reference-tag-tile__input"
                :placeholder="$t('knowledgeBase.tagNamePlaceholder')"
                @keydown.enter.prevent="submitCreateTag"
                @keydown.esc.prevent="cancelCreateTag"
              />
              <div class="reference-tag-tile__actions visible">
                <button type="button" :disabled="creatingTagLoading" :title="$t('common.create')" @click="submitCreateTag">
                  <ReferenceIcon name="check-circle-2" :size="14" />
                </button>
                <button type="button" :title="$t('common.cancel')" @click="cancelCreateTag">×</button>
              </div>
            </li>

            <li
              v-for="tag in tags"
              :key="tag.id"
              class="reference-tag-tile"
              :class="{ editing: editingTagId === tag.id }"
            >
              <template v-if="editingTagId === tag.id">
                <span class="reference-tag-tile__badge"><ReferenceIcon name="tag" :size="14" /></span>
                <input
                  :ref="(el: any) => setEditingTagInputRef(el, tag.id)"
                  v-model="editingTagName"
                  maxlength="40"
                  class="reference-tag-tile__input"
                  :placeholder="$t('knowledgeBase.tagNamePlaceholder')"
                  @keydown.enter.prevent="submitEditTag"
                  @keydown.esc.prevent="cancelEditTag"
                />
                <div class="reference-tag-tile__actions visible">
                  <button type="button" :disabled="editingTagSubmitting" :title="$t('common.save')" @click="submitEditTag">
                    <ReferenceIcon name="check-circle-2" :size="14" />
                  </button>
                  <button type="button" :title="$t('common.cancel')" @click="cancelEditTag">×</button>
                </div>
              </template>

              <template v-else>
                <span class="reference-tag-tile__badge"><ReferenceIcon name="tag" :size="14" /></span>
                <span class="reference-tag-tile__text">
                  <strong :title="tag.name">{{ tag.name }}</strong>
                  <small>
                    {{
                      isFaq
                        ? $t('knowledgeBase.tagManageFaqCount', { count: tag.chunk_count || 0 })
                        : $t('knowledgeBase.tagManageDocCount', { count: tag.knowledge_count || 0 })
                    }}
                  </small>
                </span>
                <div class="reference-tag-tile__actions">
                  <button type="button" :title="$t('knowledgeBase.tagEditAction')" @click="startEditTag(tag)">
                    <ReferenceIcon name="edit-3" :size="13" />
                  </button>
                  <button type="button" class="danger" :title="$t('knowledgeBase.tagDeleteAction')" @click="deleteConfirmTagId = tag.id">
                    <ReferenceIcon name="trash-2" :size="13" />
                  </button>
                </div>

                <template v-if="deleteConfirmTagId === tag.id">
                  <div class="reference-tag-confirm-backdrop" @click="deleteConfirmTagId = null" />
                  <div class="reference-tag-confirm">
                    <p>{{ getDeleteConfirmContent(tag) }}</p>
                    <div>
                      <button type="button" @click="deleteConfirmTagId = null">{{ $t('common.cancel') }}</button>
                      <button type="button" class="danger" @click="deleteConfirmTagId = null; deleteTag(tag)">
                        {{ $t('common.delete') }}
                      </button>
                    </div>
                  </div>
                </template>
              </template>
            </li>
          </ul>

          <button v-if="hasMore && tags.length" type="button" class="reference-tag-load-more" :disabled="loadingMore" @click="loadTags(false)">
            {{ loadingMore ? '...' : $t('tenant.loadMore') }}
          </button>
        </div>
      </aside>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import {
  listKnowledgeTags,
  createKnowledgeBaseTag,
  updateKnowledgeBaseTag,
  deleteKnowledgeBaseTag,
} from '@/api/knowledge-base/index'

type TagRow = {
  id: string
  seq_id: number
  name: string
  knowledge_count?: number
  chunk_count?: number
}

const TAG_PAGE_SIZE = 50
const props = defineProps<{
  visible: boolean
  kbId: string
  isFaq?: boolean
}>()
const emit = defineEmits<{
  'update:visible': [boolean]
  changed: [payload?: { deletedTagId?: string }]
}>()
const { t } = useI18n()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})
const tags = ref<TagRow[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(1)
const hasMore = ref(false)
const total = ref(0)
const searchQuery = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const creatingTag = ref(false)
const creatingTagLoading = ref(false)
const newTagName = ref('')
const newTagInputRef = ref<HTMLInputElement | null>(null)
const editingTagId = ref<string | null>(null)
const editingTagName = ref('')
const editingTagSubmitting = ref(false)
const editingTagInputRefs = new Map<string, HTMLInputElement | null>()
const deleteConfirmTagId = ref<string | null>(null)

const setEditingTagInputRef = (el: HTMLInputElement | null, tagId: string) => {
  if (el) editingTagInputRefs.set(tagId, el)
  else editingTagInputRefs.delete(tagId)
}

const getDeleteConfirmContent = (tag: { name: string }) =>
  t(props.isFaq ? 'knowledgeBase.tagDeleteDesc' : 'knowledgeBase.tagDeleteDescDoc', { name: tag.name })

const resetLocalState = () => {
  cancelCreateTag()
  cancelEditTag()
  deleteConfirmTagId.value = null
  searchQuery.value = ''
}

const loadTags = async (reset = false) => {
  if (!props.kbId) {
    tags.value = []
    total.value = 0
    hasMore.value = false
    page.value = 1
    return
  }
  if (reset) {
    page.value = 1
    tags.value = []
    total.value = 0
    hasMore.value = false
  } else if (loading.value || loadingMore.value) return

  const currentPage = page.value || 1
  loading.value = currentPage === 1
  loadingMore.value = currentPage > 1
  try {
    const res: any = await listKnowledgeTags(props.kbId, {
      page: currentPage,
      page_size: TAG_PAGE_SIZE,
      keyword: searchQuery.value || undefined,
    })
    const pageData = (res?.data || {}) as { data?: TagRow[]; total?: number }
    const pageTags = (pageData.data || []).map((tag) => ({ ...tag, id: String(tag.id) }))
    tags.value = currentPage === 1 ? pageTags : [...tags.value, ...pageTags]
    total.value = pageData.total || tags.value.length
    hasMore.value = tags.value.length < total.value
    if (hasMore.value) page.value = currentPage + 1
  } catch (error) {
    console.error('Failed to load tags', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const startCreateTag = () => {
  if (!props.kbId || creatingTag.value) return
  cancelEditTag()
  creatingTag.value = true
  nextTick(() => {
    newTagInputRef.value?.focus()
    newTagInputRef.value?.select()
  })
}
const cancelCreateTag = () => {
  creatingTag.value = false
  newTagName.value = ''
}
const submitCreateTag = async () => {
  if (!props.kbId) return
  const name = newTagName.value.trim()
  if (!name) {
    MessagePlugin.warning(t('knowledgeBase.tagNameRequired'))
    return
  }
  creatingTagLoading.value = true
  try {
    await createKnowledgeBaseTag(props.kbId, { name })
    MessagePlugin.success(t('knowledgeBase.tagCreateSuccess'))
    cancelCreateTag()
    await loadTags(true)
    emit('changed')
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('common.operationFailed'))
  } finally {
    creatingTagLoading.value = false
  }
}

const startEditTag = (tag: TagRow) => {
  cancelCreateTag()
  editingTagId.value = tag.id
  editingTagName.value = tag.name
  nextTick(() => {
    editingTagInputRefs.get(tag.id)?.focus()
    editingTagInputRefs.get(tag.id)?.select()
  })
}
const cancelEditTag = () => {
  editingTagId.value = null
  editingTagName.value = ''
}
const submitEditTag = async () => {
  if (!props.kbId || !editingTagId.value) return
  const name = editingTagName.value.trim()
  if (!name) {
    MessagePlugin.warning(t('knowledgeBase.tagNameRequired'))
    return
  }
  const current = tags.value.find((tag) => tag.id === editingTagId.value)
  if (current && name === current.name) {
    cancelEditTag()
    return
  }
  editingTagSubmitting.value = true
  try {
    await updateKnowledgeBaseTag(props.kbId, editingTagId.value, { name })
    MessagePlugin.success(t('knowledgeBase.tagEditSuccess'))
    cancelEditTag()
    await loadTags(true)
    emit('changed')
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('common.operationFailed'))
  } finally {
    editingTagSubmitting.value = false
  }
}

const deleteTag = async (tag: TagRow) => {
  if (!props.kbId) return
  cancelCreateTag()
  cancelEditTag()
  try {
    await deleteKnowledgeBaseTag(props.kbId, tag.seq_id, { force: true })
    MessagePlugin.success(t('knowledgeBase.tagDeleteSuccess'))
    await loadTags(true)
    emit('changed', { deletedTagId: tag.id })
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      emit('changed', { deletedTagId: tag.id })
    })()
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('common.operationFailed'))
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open && props.kbId) void loadTags(true)
    else if (!open) resetLocalState()
  },
)
watch(searchQuery, (newVal, oldVal) => {
  if (newVal === oldVal || !props.visible || !props.kbId) return
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { void loadTags(true) }, 300)
})
</script>

<style scoped>
.reference-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4500;
  background: rgb(17 24 39 / .18);
}
.reference-tag-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 4510;
  width: min(480px, calc(100vw - 24px));
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -12px 0 40px rgb(0 0 0 / .10);
  color: #111827;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-tag-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}
.reference-tag-drawer__heading { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.reference-tag-drawer__icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: #f3f4f6;
  color: #4b5563;
  flex: 0 0 auto;
}
.reference-tag-drawer__heading h3 { margin: 1px 0 0; font-size: 14px; line-height: 20px; font-weight: 700; }
.reference-tag-drawer__heading p { margin: 3px 0 0; color: #9ca3af; font-size: 11px; line-height: 16px; }
.reference-tag-drawer__close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  font-size: 20px;
  cursor: pointer;
}
.reference-tag-drawer__close:hover { background: #f3f4f6; color: #374151; }
.reference-tag-drawer__content { flex: 1; min-height: 0; overflow: auto; padding: 18px 20px 24px; }
.reference-tag-drawer__section-title { margin-bottom: 10px; color: #374151; font-size: 11px; line-height: 16px; font-weight: 700; }
.reference-tag-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.reference-tag-toolbar__search {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #9ca3af;
}
.reference-tag-toolbar__search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #111827;
  background: transparent;
  font: inherit;
  font-size: 11px;
}
.reference-tag-toolbar__search button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}
.reference-tag-toolbar__create {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #4b5563;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.reference-tag-toolbar__create:hover:not(:disabled) { background: #f3f4f6; color: #111827; }
.reference-tag-toolbar__create:disabled { opacity: .45; }
.reference-tag-skeleton-grid,
.reference-tag-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.reference-tag-skeleton { height: 50px; border-radius: 10px; background: linear-gradient(90deg,#f3f4f6,#fafafa,#f3f4f6); background-size: 200% 100%; animation: reference-tag-pulse 1.2s linear infinite; }
.reference-tag-drawer__empty { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #9ca3af; font-size: 11px; }
.reference-tag-tile {
  position: relative;
  min-width: 0;
  min-height: 50px;
  padding: 7px 7px 7px 9px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  background: #fff;
}
.reference-tag-tile:hover:not(.editing) { border-color: #d1d5db; background: #fafafa; }
.reference-tag-tile.editing { border-color: #d1d5db; background: #f9fafb; }
.reference-tag-tile__badge { width: 26px; height: 26px; border-radius: 8px; background: #f3f4f6; color: #6b7280; display: grid; place-items: center; flex: 0 0 auto; }
.reference-tag-tile__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.reference-tag-tile__text strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #374151; font-size: 11px; line-height: 15px; font-weight: 600; }
.reference-tag-tile__text small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9ca3af; font-size: 9px; line-height: 13px; }
.reference-tag-tile__input { flex: 1; min-width: 0; height: 26px; padding: 0 7px; border: 1px solid #d1d5db; border-radius: 7px; outline: 0; background: #fff; color: #111827; font: inherit; font-size: 11px; }
.reference-tag-tile__actions { display: flex; align-items: center; gap: 2px; opacity: 0; }
.reference-tag-tile:hover .reference-tag-tile__actions,
.reference-tag-tile:focus-within .reference-tag-tile__actions,
.reference-tag-tile__actions.visible { opacity: 1; }
.reference-tag-tile__actions button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #9ca3af;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.reference-tag-tile__actions button:hover { background: #f3f4f6; color: #111827; }
.reference-tag-tile__actions button.danger:hover { background: #fef2f2; color: #dc2626; }
.reference-tag-confirm-backdrop { position: fixed; inset: 0; z-index: 30; }
.reference-tag-confirm {
  position: absolute;
  right: 6px;
  top: 42px;
  z-index: 40;
  width: 240px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 14px 30px rgb(0 0 0 / .12);
}
.reference-tag-confirm p { margin: 0; color: #4b5563; font-size: 10px; line-height: 16px; }
.reference-tag-confirm > div { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
.reference-tag-confirm button,
.reference-tag-load-more {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}
.reference-tag-confirm button.danger { border-color: #dc2626; background: #dc2626; color: #fff; }
.reference-tag-load-more { display: block; margin: 12px auto 0; border: 0; color: #9ca3af; }
.reference-tag-load-more:hover { color: #111827; background: #f3f4f6; }
@media (max-width: 520px) { .reference-tag-grid, .reference-tag-skeleton-grid { grid-template-columns: 1fr; } }
@keyframes reference-tag-pulse { to { background-position: -200% 0; } }
</style>
