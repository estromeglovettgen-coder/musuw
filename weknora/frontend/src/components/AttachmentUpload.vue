<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';
import ReferenceIcon from '@/components/ReferenceIcon.vue';
import { MAX_FILE_SIZE_MB } from '@/utils';
import { getParserEngines } from '@/api/system';
import {
  deleteTemporaryAttachment,
  getTemporaryAttachment,
  uploadTemporaryAttachment,
  type TemporaryAttachmentStatus,
} from '@/api/chat/temporary-attachments';

const { t } = useI18n();

export interface AttachmentFile {
  file: File;
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  documentId?: string;
  status: TemporaryAttachmentStatus | 'local' | 'uploading';
  progress?: number;
  error?: string;
}

const props = defineProps<{
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  sessionId?: string;
  agentId?: string;
  agentSourceTenantId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:files', files: AttachmentFile[]): void;
  (e: 'remove', id: string): void;
}>();

const attachments = ref<AttachmentFile[]>([]);
const fileInputRef = ref<HTMLInputElement>();
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
let disposed = false;

const supportedTypes = ref([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.epub', '.mhtml',
  '.txt', '.md', '.csv', '.json', '.xml', '.html',
  '.markdown', '.yaml', '.yml', '.log',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
  '.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac',
]);

onMounted(async () => {
  try {
    const response = await getParserEngines();
    const discovered = (response.data || [])
      .filter(engine => engine.Available !== false)
      .flatMap(engine => engine.FileTypes || [])
      .filter(type => type && type.toLowerCase() !== 'url')
      .map(type => `.${type.replace(/^\./, '').toLowerCase()}`);
    supportedTypes.value = [...new Set([...supportedTypes.value, ...discovered])];
  } catch {
    // The static baseline remains available when engine discovery is offline.
  }
});

const maxFiles = computed(() => props.maxFiles || 5);
const maxSizeMB = computed(() => props.maxSize || MAX_FILE_SIZE_MB);
const maxSize = computed(() => maxSizeMB.value * 1024 * 1024);

const triggerFileSelect = () => {
  if (props.disabled) return;
  fileInputRef.value?.click();
};

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  await addFiles(Array.from(input.files));
  input.value = '';
};

const addFiles = async (files: File[]) => {
  if (props.disabled) return;

  for (const file of files) {
    if (attachments.value.length >= maxFiles.value) {
      MessagePlugin.warning(t('chat.attachmentTooMany', { max: maxFiles.value }));
      break;
    }

    if (file.size > maxSize.value) {
      MessagePlugin.warning(t('chat.attachmentTooLarge', { name: file.name, max: maxSizeMB.value }));
      continue;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedTypes.value.includes(ext)) {
      MessagePlugin.warning(t('chat.attachmentTypeNotSupported', { name: file.name }));
      continue;
    }

    const attachment: AttachmentFile = {
      file,
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type || ext,
      status: props.sessionId ? 'uploading' : 'local',
      progress: 0,
    };

    attachments.value.push(attachment);
    const reactiveAttachment = attachments.value[attachments.value.length - 1];
    emit('update:files', [...attachments.value]);
    if (props.sessionId) void uploadAttachment(reactiveAttachment);
  }
};

const emitFiles = () => emit('update:files', [...attachments.value]);

const uploadAttachment = async (attachment: AttachmentFile) => {
  if (!props.sessionId) return;
  try {
    const response = await uploadTemporaryAttachment(
      props.sessionId,
      attachment.file,
      props.agentId,
      props.agentSourceTenantId,
      'auto',
      (progress) => {
        attachment.progress = progress;
        emitFiles();
      },
    );
    attachment.documentId = response.data.id;
    if (disposed || !attachments.value.some(item => item.id === attachment.id)) {
      await deleteTemporaryAttachment(props.sessionId, response.data.id).catch(() => undefined);
      return;
    }
    attachment.status = response.data.status;
    attachment.progress = 100;
    emitFiles();
    if (attachment.status !== 'ready' && attachment.status !== 'failed') scheduleStatusPoll(attachment);
  } catch (error: any) {
    attachment.status = 'failed';
    attachment.error = error?.message || t('chat.attachmentUploadFailed');
    emitFiles();
  }
};

const scheduleStatusPoll = (attachment: AttachmentFile) => {
  clearPoll(attachment.id);
  pollTimers.set(attachment.id, setTimeout(() => void pollStatus(attachment), 800));
};

const pollStatus = async (attachment: AttachmentFile) => {
  if (!props.sessionId || !attachment.documentId || !attachments.value.some(item => item.id === attachment.id)) return;
  try {
    const response = await getTemporaryAttachment(props.sessionId, attachment.documentId);
    attachment.status = response.data.status;
    attachment.error = response.data.error_message;
    emitFiles();
    if (attachment.status !== 'ready' && attachment.status !== 'failed') scheduleStatusPoll(attachment);
  } catch (error: any) {
    attachment.status = 'failed';
    attachment.error = error?.message || t('chat.attachmentParseFailed');
    emitFiles();
  }
};

const clearPoll = (id: string) => {
  const timer = pollTimers.get(id);
  if (timer) clearTimeout(timer);
  pollTimers.delete(id);
};

const removeAttachment = (id: string) => {
  const index = attachments.value.findIndex(a => a.id === id);
  if (index !== -1) {
    const attachment = attachments.value[index];
    clearPoll(id);
    attachments.value.splice(index, 1);
    emitFiles();
    emit('remove', id);
    if (props.sessionId && attachment.documentId) {
      void deleteTemporaryAttachment(props.sessionId, attachment.documentId).catch(() => undefined);
    }
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileExt = (fileName: string): string =>
  fileName.split('.').pop()?.toUpperCase() || 'FILE';

const statusLabel = (attachment: AttachmentFile): string => {
  if (attachment.status === 'uploading') return t('chat.attachmentUploading', { progress: attachment.progress || 0 });
  if (attachment.status === 'uploaded' || attachment.status === 'processing') return t('chat.attachmentParsing');
  if (attachment.status === 'ready') return t('chat.attachmentReady');
  if (attachment.status === 'failed') return attachment.error || t('chat.attachmentParseFailed');
  return '';
};

onUnmounted(() => {
  disposed = true;
  pollTimers.forEach(timer => clearTimeout(timer));
  pollTimers.clear();
});

defineExpose({
  attachments,
  triggerFileSelect,
  addFiles,
  clear: () => {
    pollTimers.forEach(timer => clearTimeout(timer));
    pollTimers.clear();
    attachments.value = [];
    emit('update:files', []);
  },
});
</script>

<template>
  <div class="attachment-upload">
    <input
      ref="fileInputRef"
      type="file"
      :accept="supportedTypes.join(',')"
      multiple
      hidden
      @change="handleFileSelect"
    />

    <div v-if="attachments.length > 0" class="attachment-preview-bar">
      <article
        v-for="attachment in attachments"
        :key="attachment.id"
        class="attachment-preview-item"
      >
        <div class="attachment-preview-icon" aria-hidden="true">
          <ReferenceIcon name="file-text" :size="16" />
        </div>
        <div class="attachment-preview-info">
          <div class="attachment-preview-name" :title="attachment.name">{{ attachment.name }}</div>
          <div class="attachment-preview-meta">
            <span>{{ getFileExt(attachment.name) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatFileSize(attachment.size) }}</span>
          </div>
          <div
            v-if="attachment.status !== 'local'"
            class="attachment-preview-status"
            :class="`is-${attachment.status}`"
          >
            <ReferenceIcon
              v-if="attachment.status === 'uploading' || attachment.status === 'uploaded' || attachment.status === 'processing'"
              name="loader-circle"
              :size="11"
              class="attachment-status-spinner"
            />
            <span>{{ statusLabel(attachment) }}</span>
          </div>
        </div>
        <button
          type="button"
          class="attachment-preview-remove"
          :aria-label="$t('common.remove')"
          @click="removeAttachment(attachment.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </article>
    </div>

    <slot name="trigger" :trigger="triggerFileSelect" :count="attachments.length" />
  </div>
</template>

<style scoped>
.attachment-upload { width: 100%; }

.attachment-preview-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px 4px;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}

.attachment-preview-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: min(224px, 100%);
  min-width: 0;
  box-sizing: border-box;
  padding: 9px 30px 9px 10px;
  border: 1px solid rgb(229 231 235 / .9);
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  box-shadow: 0 1px 2px rgb(0 0 0 / .03);
}

.attachment-preview-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
}

.attachment-preview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 1px;
}

.attachment-preview-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.attachment-preview-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
  font-family: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 9px;
  line-height: 14px;
}

.attachment-preview-status {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: #9ca3af;
  font-size: 10px;
  line-height: 14px;
}
.attachment-preview-status span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attachment-preview-status.is-ready { color: #059669; }
.attachment-preview-status.is-failed { color: #dc2626; }
.attachment-status-spinner { flex: 0 0 auto; animation: attachment-spin .8s linear infinite; }

.attachment-preview-remove {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 18px;
  height: 18px;
  padding: 3px;
  border: 0;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}
.attachment-preview-remove:hover { background: #f3f4f6; color: #374151; }
.attachment-preview-remove svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

@keyframes attachment-spin { to { transform: rotate(360deg); } }
</style>
