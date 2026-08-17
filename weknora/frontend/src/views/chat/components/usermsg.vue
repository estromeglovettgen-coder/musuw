<template>
  <div ref="containerRef" class="reference-user-message" :class="{ 'is-embedded': embeddedMode }">
    <div v-if="mentioned_items?.length" class="reference-user-message__mentions">
      <span v-for="item in mentioned_items" :key="item.id" class="reference-user-message__mention" :class="mentionTagClass(item)">
        <ReferenceIcon :name="referenceMentionIcon(item)" :size="12" />
        <span>{{ item.name }}</span>
      </span>
    </div>

    <div v-if="hasImages" class="reference-user-message__images">
      <img v-for="(img, idx) in props.images" :key="idx" :src="img.url" class="reference-user-message__image" @click="previewImage($event)" />
    </div>

    <div v-if="hasAttachments" class="reference-user-message__attachments">
      <button
        v-for="(att, idx) in props.attachments"
        :key="idx"
        type="button"
        class="reference-user-message__attachment"
        :class="{ previewable: canPreviewAttachment(att) }"
        :disabled="!canPreviewAttachment(att)"
        @click="openAttachmentPreview(att)"
      >
        <span class="reference-user-message__attachment-icon"><ReferenceIcon :name="attachmentIcon(att.file_name)" :size="15" /></span>
        <span class="reference-user-message__attachment-copy">
          <strong>{{ att.file_name }}</strong>
          <small>{{ getFileExt(att.file_name) }}<template v-if="att.file_size"> · {{ formatFileSize(att.file_size) }}</template></small>
        </span>
      </button>
    </div>

    <div class="user_msg">{{ content }}</div>
    <picturePreview :reviewImg="reviewImg" :reviewUrl="reviewUrl" @closePreImg="closePreImg" />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { hydrateProtectedFileImages } from '@/utils/security';
import picturePreview from '@/components/picture-preview.vue';
import ReferenceIcon from '@/components/ReferenceIcon.vue';
import { useChatAttachmentPreviewDrawer } from '@/composables/useChatAttachmentPreviewDrawer';
import { isPreviewableAttachment, resolveAttachmentFileType } from '@/utils/attachmentPreview';

const mentionTagClass = (item) => {
  if (item.type === 'kb') return item.kb_type === 'faq' ? 'faq-tag' : 'kb-tag';
  return `${item.type || 'file'}-tag`;
};
const referenceMentionIcon = (item) => {
  if (item.type === 'kb') return item.kb_type === 'faq' ? 'message-square-plus' : 'folder';
  if (item.type === 'tag') return 'tag';
  if (item.type === 'mcp') return 'settings';
  if (item.type === 'skill') return 'pin';
  return 'file-text';
};
const attachmentIcon = (fileName) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'file-spreadsheet';
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'go'].includes(ext)) return 'file-code';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'].includes(ext)) return 'volume-2';
  return 'file-text';
};

const props = defineProps({
  content: { type: String, required: false },
  mentioned_items: { type: Array, required: false, default: () => [] },
  images: { type: Array, required: false, default: () => [] },
  attachments: { type: Array, required: false, default: () => [] },
  channel: { type: String, required: false, default: '' },
  embeddedMode: { type: Boolean, default: false },
  sessionId: { type: String, default: '' }
});
const attachmentPreviewDrawer = useChatAttachmentPreviewDrawer();
const containerRef = ref(null);
const hasImages = computed(() => props.images && props.images.length > 0);
const hasAttachments = computed(() => props.attachments && props.attachments.length > 0);
const getFileExt = (fileName) => (fileName || '').split('.').pop()?.toUpperCase() || 'FILE';
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
const canPreviewAttachment = (attachment) => Boolean(props.sessionId) && isPreviewableAttachment(attachment);
const openAttachmentPreview = (attachment) => {
  if (!canPreviewAttachment(attachment) || !attachmentPreviewDrawer) return;
  attachmentPreviewDrawer.open({
    sessionId: props.sessionId,
    attachmentId: attachment.id,
    fileName: attachment.file_name,
    fileType: resolveAttachmentFileType(attachment.file_name, attachment.file_type),
  });
};
const hydrateImages = async () => { await nextTick(); await hydrateProtectedFileImages(containerRef.value); };
watch(() => props.images, hydrateImages);
onMounted(hydrateImages);
const reviewImg = ref(false);
const reviewUrl = ref('');
const previewImage = (event) => {
  const src = event.target?.src;
  if (src) { reviewUrl.value = src; reviewImg.value = true; }
};
const closePreImg = () => { reviewImg.value = false; reviewUrl.value = ''; };
</script>

<style scoped>
.reference-user-message{width:100%;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif}.reference-user-message__mentions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.reference-user-message__mention{max-width:220px;height:25px;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#6b7280;font-size:10px;font-weight:600}.reference-user-message__mention>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reference-user-message__mention.kb-tag{background:#f9fafb}.reference-user-message__mention.faq-tag{background:#f3f4f6;color:#4b5563}
.user_msg{width:max-content;max-width:min(76%,820px);margin-left:auto;padding:10px 18px;box-sizing:border-box;border-radius:18px;background:#f4f4f4;color:#111827;font-size:14px;line-height:1.625;text-align:left;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap;user-select:text;transition:background-color 150ms ease}.user_msg:hover{background:#eaeaea}@media(min-width:768px){.user_msg{font-size:14.5px}}.reference-user-message.is-embedded .user_msg{max-width:100%}
.reference-user-message__images,.reference-user-message__attachments{max-width:100%;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.reference-user-message__image{width:120px;height:120px;object-fit:cover;border:1px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;transition:opacity 150ms ease}.reference-user-message__image:hover{opacity:.85}
.reference-user-message__attachment{max-width:260px;min-width:170px;height:48px;display:flex;align-items:center;gap:9px;padding:6px 9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#4b5563;text-align:left;font-family:inherit}.reference-user-message__attachment.previewable{cursor:pointer;transition:border-color 150ms ease,box-shadow 150ms ease}.reference-user-message__attachment.previewable:hover{border-color:#d1d5db;box-shadow:0 1px 2px rgb(0 0 0 / 5%)}.reference-user-message__attachment:disabled{opacity:1;cursor:default}.reference-user-message__attachment-icon{width:27px;height:27px;flex:0 0 27px;display:grid;place-items:center;border-radius:7px;background:#f3f4f6;color:#6b7280}.reference-user-message__attachment-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.reference-user-message__attachment-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#374151;font-size:10px;line-height:14px;font-weight:700}.reference-user-message__attachment-copy small{color:#9ca3af;font:600 8px/11px "JetBrains Mono",ui-monospace,monospace;white-space:nowrap}
</style>
