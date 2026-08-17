<template>
  <Teleport to="body">
    <template v-if="visible">
      <div class="reference-modal-backdrop" @click.self="handleClose">
        <section class="reference-tag-dialog" role="dialog" aria-modal="true" :aria-label="$t('knowledgeBase.tagEditDialogHeading')">
          <header class="reference-tag-dialog__header">
            <div class="reference-tag-dialog__heading">
              <div class="reference-tag-dialog__title-row">
                <ReferenceIcon name="tag" :size="16" />
                <h3>{{ $t('knowledgeBase.tagEditDialogHeading') }}</h3>
              </div>
              <p :title="knowledgeName">{{ knowledgeName }}</p>
            </div>
            <button type="button" class="reference-tag-dialog__close" aria-label="关闭" @click="handleClose">×</button>
          </header>

          <div class="reference-tag-dialog__body">
            <section class="reference-tag-section">
              <div class="reference-tag-section__head">
                <h4>{{ $t('knowledgeBase.tagEditSelectedSection') }}</h4>
                <button v-if="selectedSet.size > 0" type="button" @click="clearAll">
                  {{ $t('knowledgeBase.tagClearAction') }}
                </button>
              </div>
              <div v-if="selectedTagsList.length" class="reference-tag-chips">
                <button
                  v-for="tag in selectedTagsList"
                  :key="tag.id"
                  type="button"
                  class="reference-tag-chip selected"
                  :title="tag.name"
                  @click="toggleTag(tag.id)"
                >
                  {{ tag.name }}
                </button>
              </div>
              <p v-else class="reference-tag-empty">{{ $t('knowledgeBase.tagEditNoSelected') }}</p>
            </section>

            <section class="reference-tag-section">
              <div class="reference-tag-section__head">
                <h4>{{ $t('knowledgeBase.tagEditAvailableSection') }}</h4>
                <button v-if="canManage" type="button" @click="handleOpenManage">
                  {{ $t('knowledgeBase.tagManageLink') }}
                </button>
              </div>

              <label class="reference-tag-search">
                <ReferenceIcon name="search" :size="14" />
                <input v-model="searchQuery" :placeholder="$t('knowledgeBase.tagEditSearch')" />
                <button v-if="searchQuery" type="button" aria-label="清空" @click="searchQuery = ''">×</button>
              </label>

              <div v-if="availableTagsList.length" class="reference-tag-chips reference-tag-chips--available">
                <button
                  v-for="tag in availableTagsList"
                  :key="tag.id"
                  type="button"
                  class="reference-tag-chip"
                  :title="tag.knowledge_count !== undefined ? `${tag.name} (${tag.knowledge_count})` : tag.name"
                  @click="toggleTag(tag.id)"
                >
                  {{ tag.name }}
                </button>
              </div>
              <div v-else class="reference-tag-empty reference-tag-empty--row">
                <span>{{ searchQuery.trim() ? $t('knowledgeBase.tagEmptyResult') : $t('knowledgeBase.noTags') }}</span>
                <button v-if="searchQuery.trim()" type="button" :disabled="creatingTag" @click="handleCreateTag">
                  {{ $t('knowledgeBase.tagCreateAction') }} “{{ searchQuery.trim() }}”
                </button>
              </div>

              <label class="reference-new-tag">
                <ReferenceIcon name="plus" :size="14" />
                <input
                  v-model="newTagName"
                  :placeholder="$t('knowledgeBase.tagNewPlaceholder')"
                  maxlength="40"
                  :disabled="creatingTag"
                  @keydown.enter.prevent="handleAddNewTag"
                />
              </label>
            </section>
          </div>

          <footer class="reference-tag-dialog__footer">
            <span>{{ $t('knowledgeBase.tagSelectedCount', { count: selectedSet.size }) }}</span>
            <div>
              <button type="button" class="reference-tag-dialog__cancel" @click="handleClose">
                {{ $t('common.cancel') }}
              </button>
              <button type="button" class="reference-tag-dialog__confirm" :disabled="saving" @click="handleConfirm">
                {{ saving ? '...' : $t('common.confirm') }}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import { createKnowledgeBaseTag } from '@/api/knowledge-base'
import ReferenceIcon from '@/components/ReferenceIcon.vue'

interface Tag {
  id: string
  name: string
  color?: string
  knowledge_count?: number
}

const props = defineProps<{
  visible: boolean
  knowledgeName: string
  kbId: string
  tagList: Tag[]
  selectedTags: Tag[]
  canManage?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', tagIds: string[]): void
  (e: 'tag-created'): void
  (e: 'open-manage'): void
}>()

const { t } = useI18n()
const searchQuery = ref('')
const selectedSet = ref<Set<string>>(new Set())
const creatingTag = ref(false)
const saving = ref(false)
const newTagName = ref('')

watch(
  () => props.visible,
  (val) => {
    if (val) {
      selectedSet.value = new Set(props.selectedTags.map((tag) => tag.id))
      searchQuery.value = ''
      newTagName.value = ''
    }
  },
)

const tagMap = computed(() => new Map(props.tagList.map((tag) => [tag.id, tag])))
const selectedTagsList = computed(() =>
  Array.from(selectedSet.value)
    .map((id) => tagMap.value.get(id))
    .filter((tag): tag is Tag => Boolean(tag)),
)
const availableTagsList = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return props.tagList.filter((tag) => {
    if (selectedSet.value.has(tag.id)) return false
    if (query && !(tag.name || '').toLowerCase().includes(query)) return false
    return true
  })
})

function toggleTag(tagId: string) {
  const next = new Set(selectedSet.value)
  if (next.has(tagId)) next.delete(tagId)
  else next.add(tagId)
  selectedSet.value = next
}
function clearAll() { selectedSet.value = new Set() }

async function handleCreateTag() {
  const name = searchQuery.value.trim()
  if (!name) return
  creatingTag.value = true
  try {
    const res: any = await createKnowledgeBaseTag(props.kbId, { name })
    const newTag = res?.data || res
    const next = new Set(selectedSet.value)
    next.add(newTag.id)
    selectedSet.value = next
    searchQuery.value = ''
    emit('tag-created')
    MessagePlugin.success(t('knowledgeBase.tagCreateSuccess'))
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('common.operationFailed'))
  } finally {
    creatingTag.value = false
  }
}

async function handleAddNewTag() {
  const name = newTagName.value.trim()
  if (!name) return
  const exists = props.tagList.find((tag) => tag.name === name)
  if (exists) {
    const next = new Set(selectedSet.value)
    next.add(exists.id)
    selectedSet.value = next
    newTagName.value = ''
    return
  }
  creatingTag.value = true
  try {
    const res: any = await createKnowledgeBaseTag(props.kbId, { name })
    const newTag = res?.data || res
    const next = new Set(selectedSet.value)
    next.add(newTag.id)
    selectedSet.value = next
    newTagName.value = ''
    emit('tag-created')
    MessagePlugin.success(t('knowledgeBase.tagCreateSuccess'))
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('common.operationFailed'))
  } finally {
    creatingTag.value = false
  }
}

async function handleConfirm() {
  saving.value = true
  try {
    emit('confirm', Array.from(selectedSet.value))
    emit('update:visible', false)
  } finally {
    saving.value = false
  }
}
function handleClose() { emit('update:visible', false) }
function handleOpenManage() {
  emit('update:visible', false)
  emit('open-manage')
}
</script>

<style scoped>
.reference-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4600;
  display: grid;
  place-items: center;
  padding: 20px;
  box-sizing: border-box;
  background: rgb(17 24 39 / .28);
  backdrop-filter: blur(1px);
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-tag-dialog {
  width: min(420px, calc(100vw - 32px));
  max-height: min(680px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 64px rgb(0 0 0 / .18);
}
.reference-tag-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid #f3f4f6;
}
.reference-tag-dialog__heading { min-width: 0; }
.reference-tag-dialog__title-row { display: flex; align-items: center; gap: 8px; color: #111827; }
.reference-tag-dialog__title-row h3 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 700; }
.reference-tag-dialog__heading p {
  margin: 4px 0 0 24px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #9ca3af;
  font-size: 11px;
  line-height: 16px;
}
.reference-tag-dialog__close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  font-size: 20px;
  line-height: 24px;
  cursor: pointer;
}
.reference-tag-dialog__close:hover { background: #f3f4f6; color: #374151; }
.reference-tag-dialog__body { min-height: 0; overflow: auto; padding: 4px 18px; }
.reference-tag-section { padding: 14px 0; border-bottom: 1px solid #f3f4f6; }
.reference-tag-section:last-child { border-bottom: 0; }
.reference-tag-section__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.reference-tag-section__head h4 { margin: 0; color: #374151; font-size: 11px; line-height: 16px; font-weight: 700; }
.reference-tag-section__head button,
.reference-tag-empty--row button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #9ca3af;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}
.reference-tag-section__head button:hover,
.reference-tag-empty--row button:hover { color: #111827; }
.reference-tag-chips { display: flex; flex-wrap: wrap; gap: 6px; max-height: 116px; overflow: auto; }
.reference-tag-chips--available { max-height: 150px; }
.reference-tag-chip {
  max-width: 100%;
  height: 26px;
  padding: 0 9px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: inherit;
  font-size: 10px;
  line-height: 24px;
  font-weight: 600;
  cursor: pointer;
}
.reference-tag-chip:hover { background: #f9fafb; color: #111827; }
.reference-tag-chip.selected { border-color: #111827; background: #111827; color: #fff; }
.reference-tag-search,
.reference-new-tag {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #9ca3af;
}
.reference-tag-search { margin-bottom: 10px; }
.reference-new-tag { margin-top: 10px; }
.reference-tag-search input,
.reference-new-tag input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #111827;
  font-family: inherit;
  font-size: 11px;
}
.reference-tag-search input::placeholder,
.reference-new-tag input::placeholder { color: #9ca3af; }
.reference-tag-search > button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}
.reference-tag-search > button:hover { background: #f3f4f6; color: #374151; }
.reference-tag-empty { margin: 0; min-height: 26px; color: #9ca3af; font-size: 10px; line-height: 18px; }
.reference-tag-empty--row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.reference-tag-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid #f3f4f6;
  color: #9ca3af;
  font-size: 10px;
}
.reference-tag-dialog__footer > div { display: flex; gap: 7px; }
.reference-tag-dialog__footer button {
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.reference-tag-dialog__cancel { border: 1px solid #e5e7eb; background: #fff; color: #4b5563; }
.reference-tag-dialog__confirm { border: 1px solid #111827; background: #111827; color: #fff; }
.reference-tag-dialog__confirm:disabled { opacity: .5; cursor: default; }
</style>
