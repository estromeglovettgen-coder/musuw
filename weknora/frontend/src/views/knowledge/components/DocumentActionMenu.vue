<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'

interface KnowledgeItem {
  id: string
  file_name?: string
  title?: string
  type?: string
  parse_status?: string
}

const props = defineProps<{
  item: KnowledgeItem
  canMutateKnowledge: boolean
  traceVisible: boolean
  foldersAvailable?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'view-trace'): void
  (e: 'reparse'): void
  (e: 'cancel-parse'): void
  (e: 'move'): void
  (e: 'move-folder'): void
  (e: 'batch-manage'): void
  (e: 'delete'): void
}>()

useI18n()

const CANCELABLE_PARSE_STATUSES = new Set(['pending', 'processing', 'finalizing'])
const isParseInFlight = computed(() => CANCELABLE_PARSE_STATUSES.has(String(props.item.parse_status ?? '')))
const fileName = computed(() => props.item.file_name || props.item.title || props.item.id)
</script>

<template>
  <div v-if="item.type === 'manual'" class="doc-action-menu-item" @click.stop="emit('edit')">
    <ReferenceIcon name="edit-3" :size="14" class="icon" />
    <span>{{ $t('knowledgeBase.editDocument') }}</span>
  </div>

  <div v-if="traceVisible" class="doc-action-menu-item" @click.stop="emit('view-trace')">
    <ReferenceIcon name="activity" :size="14" class="icon" />
    <span>{{ $t('knowledgeStages.viewTrace') }}</span>
  </div>

  <div v-if="isParseInFlight" class="doc-action-menu-item" @click.stop="emit('reparse')">
    <ReferenceIcon name="rotate-cw" :size="14" class="icon" />
    <span>{{ $t('knowledgeBase.rebuildDocument') }}</span>
  </div>

  <t-popconfirm
    v-else
    theme="warning"
    :content="$t('knowledgeBase.rebuildConfirm', { fileName })"
    :confirm-btn="{ content: $t('common.confirm'), theme: 'primary' }"
    :cancel-btn="{ content: $t('common.cancel') }"
    placement="left"
    @confirm="emit('reparse')"
  >
    <div class="doc-action-menu-item" @click.stop>
      <ReferenceIcon name="rotate-cw" :size="14" class="icon" />
      <span>{{ $t('knowledgeBase.rebuildDocument') }}</span>
    </div>
  </t-popconfirm>

  <t-popconfirm
    v-if="isParseInFlight"
    theme="warning"
    :content="$t('knowledgeBase.cancelParseConfirmBody', { title: fileName })"
    :confirm-btn="{ content: $t('knowledgeBase.cancelParse'), theme: 'danger' }"
    :cancel-btn="{ content: $t('common.cancel') }"
    placement="left"
    @confirm="emit('cancel-parse')"
  >
    <div class="doc-action-menu-item doc-action-menu-item--warning" @click.stop>
      <ReferenceIcon name="stop-circle" :size="14" class="icon" />
      <span>{{ $t('knowledgeBase.cancelParse') }}</span>
    </div>
  </t-popconfirm>

  <div v-if="canMutateKnowledge" class="doc-action-menu-item" @click.stop="emit('move-folder')">
    <ReferenceIcon name="folder" :size="14" class="icon" />
    <span>{{ $t('knowledgeBase.moveToFolder.action') }}</span>
  </div>

  <div v-if="canMutateKnowledge" class="doc-action-menu-item" @click.stop="emit('move')">
    <ReferenceIcon name="arrow-right-left" :size="14" class="icon" />
    <span>{{ $t('knowledgeBase.moveDocument') }}</span>
  </div>

  <div v-if="canMutateKnowledge" class="doc-action-menu-item" @click.stop="emit('batch-manage')">
    <ReferenceIcon name="check-square" :size="14" class="icon" />
    <span>{{ $t('menu.batchManage') }}</span>
  </div>

  <div class="doc-action-menu-divider" />

  <t-popconfirm
    theme="warning"
    :content="$t('knowledgeBase.confirmDeleteDocument', { fileName })"
    :confirm-btn="{ content: $t('knowledgeBase.confirmDelete'), theme: 'danger' }"
    :cancel-btn="{ content: $t('common.cancel') }"
    placement="left"
    @confirm="emit('delete')"
  >
    <div class="doc-action-menu-item doc-action-menu-item--danger" @click.stop>
      <ReferenceIcon name="trash-2" :size="14" class="icon" />
      <span>{{ $t('knowledgeBase.deleteDocument') }}</span>
    </div>
  </t-popconfirm>
</template>

<style scoped>
.doc-action-menu-item {
  width: 100%;
  min-height: 30px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 0;
  color: #374151;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 120ms ease;
}
.doc-action-menu-item:hover { background: #f9fafb; }
.doc-action-menu-item .icon { color: #6b7280; }
.doc-action-menu-item--warning { color: #b45309; }
.doc-action-menu-item--warning .icon { color: #d97706; }
.doc-action-menu-item--warning:hover { background: #fffbeb; }
.doc-action-menu-item--danger { color: #dc2626; }
.doc-action-menu-item--danger .icon { color: #dc2626; }
.doc-action-menu-item--danger:hover { background: #fef2f2; }
.doc-action-menu-divider {
  height: 1px;
  margin: 2px 0;
  background: #f3f4f6;
}
</style>
