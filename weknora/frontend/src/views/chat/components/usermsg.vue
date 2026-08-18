<template>
  <article ref="containerRef" class="visual-user-message" :class="{ 'is-embedded': embeddedMode }">
    <div v-if="mentioned_items && mentioned_items.length > 0" class="visual-user-message__resources">
      <span
        v-for="item in mentioned_items"
        :key="item.id"
        class="visual-user-resource"
        :data-resource-type="item.type || 'file'"
      >
        <span class="visual-user-resource__icon" aria-hidden="true">
          <t-icon v-if="item.type === 'kb'" :name="item.kb_type === 'faq' ? 'chat-bubble-help' : 'folder'" />
          <t-icon v-else :name="mentionTagIcon(item)" />
        </span>
        <span class="visual-user-resource__name" :title="item.name">{{ item.name }}</span>
      </span>
    </div>

    <div v-if="hasImages" class="visual-user-message__images">
      <button
        v-for="(img, idx) in props.images"
        :key="idx"
        type="button"
        class="visual-user-image"
        @click="previewImage($event)"
      >
        <img :src="img.url" alt="" />
      </button>
    </div>

    <div v-if="hasAttachments" class="visual-user-message__attachments">
      <button
        v-for="(att, idx) in props.attachments"
        :key="idx"
        type="button"
        class="visual-user-attachment"
        :class="{ 'is-previewable': canPreviewAttachment(att) }"
        :disabled="!canPreviewAttachment(att)"
        @click="openAttachmentPreview(att)"
      >
        <span class="visual-user-attachment__icon" aria-hidden="true">
          <t-icon :name="getAttachmentIcon(att.file_name)" />
        </span>
        <span class="visual-user-attachment__copy">
          <strong :title="att.file_name">{{ att.file_name }}</strong>
          <small>
            <span>{{ getFileExt(att.file_name) }}</span>
            <span v-if="att.file_size" aria-hidden="true">·</span>
            <span v-if="att.file_size">{{ formatFileSize(att.file_size) }}</span>
          </small>
        </span>
        <t-icon v-if="canPreviewAttachment(att)" name="chevron-right" class="visual-user-attachment__arrow" />
      </button>
    </div>

    <div class="visual-user-message__bubble">{{ content }}</div>

    <picturePreview :reviewImg="reviewImg" :reviewUrl="reviewUrl" @closePreImg="closePreImg" />
  </article>
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { hydrateProtectedFileImages } from '@/utils/security';
import picturePreview from '@/components/picture-preview.vue';
import { useI18n } from 'vue-i18n';
import { useChatAttachmentPreviewDrawer } from '@/composables/useChatAttachmentPreviewDrawer';
import { isPreviewableAttachment, resolveAttachmentFileType } from '@/utils/attachmentPreview';

const { t } = useI18n();

const mentionTagIcon = (item) => {
    if (item.type === 'tag') return 'tag';
    if (item.type === 'mcp') return 'tools';
    if (item.type === 'skill') return 'bookmark';
    return 'file';
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
const channelLabelMap = {
    web: () => t('chat.channelWeb'),
    api: () => t('chat.channelApi'),
    im: () => t('chat.channelIm'),
};
const channelLabel = computed(() => {
    if (!props.channel) return '';
    const label = channelLabelMap[props.channel];
    return typeof label === 'function' ? label() : (label || props.channel);
});
const channelClass = computed(() => props.channel ? `channel-${props.channel}` : '');
void channelLabel;
void channelClass;

const containerRef = ref(null);
const hasImages = computed(() => props.images && props.images.length > 0);
const hasAttachments = computed(() => props.attachments && props.attachments.length > 0);

const getAttachmentIcon = (fileNameOrType) => {
    const ext = (fileNameOrType || '').split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return 'file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'file-word';
    if (['xls', 'xlsx'].includes(ext)) return 'file-excel';
    if (['ppt', 'pptx'].includes(ext)) return 'file-powerpoint';
    if (['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'].includes(ext)) return 'sound';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'].includes(ext)) return 'image';
    return 'file';
};

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

const hydrateImages = async () => {
    await nextTick();
    await hydrateProtectedFileImages(containerRef.value);
};
watch(() => props.images, hydrateImages);
onMounted(hydrateImages);

const reviewImg = ref(false);
const reviewUrl = ref('');
const previewImage = (event) => {
    const src = event.target?.src;
    if (src) {
        reviewUrl.value = src;
        reviewImg.value = true;
    }
};
const closePreImg = () => {
    reviewImg.value = false;
    reviewUrl.value = '';
};
</script>

<style scoped lang="less">
.visual-user-message { width: 100%; display: flex; flex-direction: column; align-items: flex-end; gap: 7px; color: #374151; }
.visual-user-message__resources { max-width: min(76%, 820px); display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
.visual-user-resource { max-width: 220px; min-height: 26px; padding: 4px 7px; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #6b7280; font-size: 10px; line-height: 16px; }
.visual-user-resource__icon { flex: 0 0 13px; width: 13px; height: 13px; display: inline-flex; align-items: center; justify-content: center; color: #9ca3af; }
.visual-user-resource__icon :deep(.t-icon) { font-size: 12px; }
.visual-user-resource__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-user-message__images { max-width: min(76%, 820px); display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.visual-user-image { width: 112px; height: 112px; padding: 0; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #f9fafb; cursor: pointer; }
.visual-user-image img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform 160ms ease; }
.visual-user-image:hover img { transform: scale(1.02); }
.visual-user-message__attachments { max-width: min(76%, 820px); display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.visual-user-attachment { flex: 0 0 220px; min-width: 0; min-height: 54px; padding: 7px 8px; border: 1px solid #e5e7eb; border-radius: 11px; display: flex; align-items: center; gap: 8px; background: #fff; color: #374151; font: inherit; text-align: left; }
.visual-user-attachment.is-previewable { cursor: pointer; }
.visual-user-attachment.is-previewable:hover { border-color: #d1d5db; background: #f9fafb; }
.visual-user-attachment:disabled { opacity: 1; cursor: default; }
.visual-user-attachment__icon { flex: 0 0 30px; width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f6; color: #6b7280; }
.visual-user-attachment__icon :deep(.t-icon) { font-size: 14px; }
.visual-user-attachment__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
.visual-user-attachment__copy strong { min-width: 0; overflow: hidden; color: #374151; font-size: 10px; line-height: 16px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.visual-user-attachment__copy small { display: flex; align-items: center; gap: 4px; color: #9ca3af; font-size: 9px; line-height: 13px; }
.visual-user-attachment__arrow { flex: 0 0 11px; font-size: 11px; color: #d1d5db; }
.visual-user-message__bubble { width: max-content; max-width: min(76%, 820px); padding: 9px 13px; box-sizing: border-box; border-radius: 14px 14px 4px 14px; background: #f3f4f6; color: #1f2937; font-size: 14px; line-height: 1.65; text-align: left; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
.visual-user-message.is-embedded .visual-user-message__bubble,.visual-user-message.is-embedded .visual-user-message__resources,.visual-user-message.is-embedded .visual-user-message__images,.visual-user-message.is-embedded .visual-user-message__attachments { max-width: 100%; }
@media (prefers-reduced-motion: reduce) { .visual-user-image img { transition: none !important; } }
</style>
