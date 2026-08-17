<template>
  <span class="reference-wiki-folder-action">
    <button
      type="button"
      class="reference-wiki-folder-action__trigger"
      :class="{ open }"
      :title="t('knowledgeEditor.wikiBrowser.folderActions')"
      @click.stop="open = !open"
      @dragstart.prevent.stop
    >
      <ReferenceIcon name="more-horizontal" :size="14" />
    </button>

    <template v-if="open">
      <span class="reference-wiki-folder-action__backdrop" @click="close" />
      <div class="reference-wiki-folder-action__popup" @click.stop>
        <template v-if="mode === 'menu'">
          <button type="button" @click="enterMode('create')"><ReferenceIcon name="folder-plus" :size="14" /><span>{{ t('knowledgeEditor.wikiBrowser.newSubfolder') }}</span></button>
          <button type="button" @click="emitRename"><ReferenceIcon name="edit-3" :size="14" /><span>{{ t('knowledgeEditor.wikiBrowser.renameFolder') }}</span></button>
          <div class="reference-wiki-folder-action__divider" />
          <button type="button" class="danger" @click="enterMode('delete')"><ReferenceIcon name="trash-2" :size="14" /><span>{{ t('knowledgeEditor.wikiBrowser.deleteFolder') }}</span></button>
        </template>

        <template v-else-if="mode === 'create'">
          <strong>{{ t('knowledgeEditor.wikiBrowser.newSubfolder') }}</strong>
          <input ref="inputRef" v-model="nameInput" type="text" :placeholder="t('knowledgeEditor.wikiBrowser.folderNamePlaceholder')" @keydown.enter="submitName">
          <div class="reference-wiki-folder-action__actions">
            <button type="button" class="secondary" @click="close">{{ t('common.cancel') }}</button>
            <button type="button" class="primary" :disabled="!nameInput.trim()" @click="submitName">{{ t('common.confirm') }}</button>
          </div>
        </template>

        <template v-else>
          <strong>{{ t('knowledgeEditor.wikiBrowser.deleteFolder') }}</strong>
          <p>{{ deletable ? t('knowledgeEditor.wikiBrowser.deleteFolderConfirm', { name }) : t('knowledgeEditor.wikiBrowser.deleteFolderNotEmpty') }}</p>
          <div class="reference-wiki-folder-action__actions">
            <button type="button" class="secondary" @click="close">{{ deletable ? t('common.cancel') : t('common.confirm') }}</button>
            <button v-if="deletable" type="button" class="danger-solid" @click="submitDelete">{{ t('common.confirm') }}</button>
          </div>
        </template>
      </div>
    </template>
  </span>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'

const props = withDefaults(defineProps<{ name?: string; pageCount?: number; hasChildren?: boolean }>(), { name: '', pageCount: 0, hasChildren: false })
const emit = defineEmits<{ (e: 'create', name: string): void; (e: 'rename'): void; (e: 'delete'): void }>()
const { t } = useI18n()
const open = ref(false)
const mode = ref<'menu' | 'create' | 'delete'>('menu')
const nameInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const deletable = computed(() => props.pageCount === 0 && !props.hasChildren)
const close = () => { open.value = false; mode.value = 'menu'; nameInput.value = '' }
function enterMode(next: 'create' | 'delete') { mode.value = next; if (next === 'create') { nameInput.value = ''; nextTick(() => inputRef.value?.focus()) } }
function emitRename() { emit('rename'); close() }
function submitName() { const value = nameInput.value.trim(); if (!value) return; emit('create', value); close() }
function submitDelete() { emit('delete'); close() }
</script>

<style scoped>
.reference-wiki-folder-action{position:relative;display:inline-flex;flex:0 0 auto;font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif}.reference-wiki-folder-action__trigger{width:24px;height:24px;padding:0;border:0;border-radius:7px;background:transparent;color:#9ca3af;display:grid;place-items:center;opacity:0;cursor:pointer}.reference-wiki-folder-action:hover .reference-wiki-folder-action__trigger,.reference-wiki-folder-action__trigger.open{opacity:1}.reference-wiki-folder-action__trigger:hover{background:#f3f4f6;color:#374151}.reference-wiki-folder-action__backdrop{position:fixed;inset:0;z-index:130}.reference-wiki-folder-action__popup{position:absolute;top:calc(100% + 5px);right:0;z-index:140;width:190px;padding:6px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 20px 25px -5px rgb(0 0 0 / 10%),0 8px 10px -6px rgb(0 0 0 / 10%);color:#374151}.reference-wiki-folder-action__popup>button{width:100%;min-height:31px;padding:0 9px;border:0;border-radius:8px;background:transparent;color:#4b5563;display:flex;align-items:center;gap:8px;font:600 10px/14px inherit;text-align:left;cursor:pointer}.reference-wiki-folder-action__popup>button:hover{background:#f3f4f6;color:#111827}.reference-wiki-folder-action__popup>button.danger{color:#dc2626}.reference-wiki-folder-action__divider{height:1px;margin:5px 2px;background:#f3f4f6}.reference-wiki-folder-action__popup>strong{display:block;margin:3px 3px 8px;color:#111827;font-size:10px;line-height:14px}.reference-wiki-folder-action__popup>p{margin:0 3px 10px;color:#6b7280;font-size:9px;line-height:14px}.reference-wiki-folder-action__popup>input{width:100%;height:32px;box-sizing:border-box;padding:0 9px;border:1px solid #e5e7eb;border-radius:9px;outline:0;color:#111827;font:500 10px/1.4 inherit}.reference-wiki-folder-action__popup>input:focus{border-color:#9ca3af;box-shadow:0 0 0 3px rgb(17 24 39 / 5%)}.reference-wiki-folder-action__actions{display:flex;justify-content:flex-end;gap:6px;margin-top:10px}.reference-wiki-folder-action__actions button{height:29px;padding:0 10px;border-radius:8px;font:700 9px/13px inherit;cursor:pointer}.reference-wiki-folder-action__actions .secondary{border:1px solid #e5e7eb;background:#fff;color:#6b7280}.reference-wiki-folder-action__actions .primary{border:1px solid #111827;background:#111827;color:#fff}.reference-wiki-folder-action__actions .primary:disabled{opacity:.4;cursor:not-allowed}.reference-wiki-folder-action__actions .danger-solid{border:1px solid #dc2626;background:#dc2626;color:#fff}
</style>
