<template>
  <div class="bot_msg" :class="{ 'is-embedded': embeddedMode }">
    <div class="reference-answer-stack">
      <div v-if="!session.isAgentMode && mentionedItems?.length" class="reference-mentioned-items">
        <span v-for="item in mentionedItems" :key="item.id" class="reference-mentioned-tag" :class="mentionTagClass(item)">
          <ReferenceIcon :name="referenceMentionIcon(item)" :size="12" />
          <span>{{ item.name }}</span>
        </span>
      </div>

      <div v-if="session.isRagMode" class="rag-answer-stack">
        <RagPipelineProgress :session="session" :embedded-mode="embeddedMode" />
        <AgentStreamDisplay v-if="session.isAgentMode" :session="session" :session-id="sessionId"
          :user-query="userQuery" :rag-mode="true" :follow-up-loading="followUpLoading"
          @render-complete-change="emit('render-complete-change', $event)" />
      </div>
      <template v-else>
        <docInfo v-if="session.knowledge_references?.length" :session="session" />
        <AgentStreamDisplay v-if="session.isAgentMode" :session="session" :session-id="sessionId" :user-query="userQuery"
          :follow-up-loading="followUpLoading" @render-complete-change="emit('render-complete-change', $event)" />
      </template>

      <!-- Task 1 exclusion: keep the product's thinking/trace presentation intact. -->
      <deepThink v-if="session.showThink && !session.isAgentMode" :deepSession="session" />
    </div>

    <div v-if="!session.hideContent && !session.isAgentMode" ref="parentMd" class="reference-answer-body">
      <div v-if="hasActualContent" class="reference-answer-content">
        <div class="ai-markdown-template markdown-content" v-stable-html="renderedHTML" />
      </div>

      <div v-if="answerFullyRendered && (content || session.content)" class="reference-answer-toolbar">
        <button type="button" class="reference-answer-action" :title="$t('agent.copy')" @click.stop="handleCopyAnswer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
        <button type="button" class="reference-answer-action" :title="$t('agent.addToKnowledgeBase')" @click.stop="handleAddToKnowledge">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/></svg>
        </button>
        <span v-if="session.is_fallback" class="reference-answer-tooltip-wrap">
          <button type="button" class="reference-answer-action" :aria-label="$t('chat.fallbackHint')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </button>
          <span class="reference-answer-tooltip">{{ $t('chat.fallbackHint') }}</span>
        </span>
        <ChatRequestInfoButton v-if="showRequestInfo" :session="session" :session-id="sessionId" />
        <transition name="follow-up-toolbar-loading">
          <span v-if="followUpLoading" class="reference-answer-follow-up" role="status" aria-live="polite">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.66.66-1.22 1.18-1.75A6 6 0 1 0 7.73 12.25C8.25 12.78 8.73 13.34 8.91 14"/></svg>
            <span>{{ t('chat.followUpQuestionsLoading') }}</span>
          </span>
        </transition>
      </div>

      <div v-if="isImgLoading" class="reference-image-loading"><span class="reference-spinner" /><span>{{ $t('common.loading') }}</span></div>
    </div>

    <picturePreview :reviewImg="reviewImg" :reviewUrl="reviewUrl" @closePreImg="closePreImg" />
    <Teleport to="body">
      <ChatCitationFloat :float="citationFloat" :on-enter="cancelCitationClose" :on-leave="scheduleCitationClose" />
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, computed, ref, nextTick, onUpdated } from 'vue';
import 'katex/dist/katex.min.css';
import docInfo from './docInfo.vue';
import deepThink from './deepThink.vue';
import AgentStreamDisplay from './AgentStreamDisplay.vue';
import RagPipelineProgress from './RagPipelineProgress.vue';
import ChatRequestInfoButton from '@/components/ChatRequestInfoButton.vue';
import ChatCitationFloat from '@/components/ChatCitationFloat.vue';
import picturePreview from '@/components/picture-preview.vue';
import ReferenceIcon from '@/components/ReferenceIcon.vue';
import { sanitizeMarkdownHTML, safeMarkdownToHTML, createSafeImage, isValidImageURL, hydrateProtectedFileImages } from '@/utils/security';
import { useI18n } from 'vue-i18n';
import { MessagePlugin } from 'tdesign-vue-next';
import { useUIStore } from '@/stores/ui';
import { buildManualMarkdown, copyTextToClipboard, formatManualTitle } from '@/utils/chatMessageShared';
import { createChatMarkdownRenderer, renderChatMarkdown } from '@/utils/chatMarkdownRenderer';
import { createMermaidCodeRenderer, ensureMermaidInitialized, renderMermaidInContainer, enhanceMarkdownContainer } from '@/utils/mermaidShared';
import { refreshMarkdownEnhancements } from '@/utils/markdownEnhancements';
import { useChatCitationPopover } from '@/composables/useChatCitationPopover';
import { useTypewriter } from '@/composables/useTypewriter';
import { vStableHtml } from '@/directives/stableHtml';

ensureMermaidInitialized();

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

const emit = defineEmits(['scroll-bottom', 'render-complete-change'])
const { t } = useI18n()
const uiStore = useUIStore();
let parentMd = ref()
const { float: citationFloat, rebind: rebindCitations, cancelClose: cancelCitationClose, scheduleClose: scheduleCitationClose } = useChatCitationPopover(parentMd, {
  getKnowledgeReferences: () => props.session?.knowledge_references,
  sessionId: () => props.sessionId,
});
let reviewUrl = ref('')
let reviewImg = ref(false)
let isImgLoading = ref(false);
const props = defineProps({
  content: { type: String, required: false },
  session: { type: Object, required: false },
  userQuery: { type: String, required: false, default: '' },
  isFirstEnter: { type: Boolean, required: false },
  embeddedMode: { type: Boolean, default: false },
  sessionId: { type: String, default: '' },
  followUpLoading: { type: Boolean, default: false }
});

const showRequestInfo = computed(() => !!(props.session?.request_id || props.session?.id));
const preview = (url) => { nextTick(() => { reviewUrl.value = url; reviewImg.value = true }) }
const closePreImg = () => { reviewImg.value = false; reviewUrl.value = ''; }
const markdownRenderer = createChatMarkdownRenderer({
  codeRenderer: createMermaidCodeRenderer('mermaid-botmsg'),
  imageRenderer: ({ href, title, text }) => createSafeImage(href, text || '', title || ''),
  invalidImageHtml: () => `<p>${t('error.invalidImageLink')}</p>`,
  isValidImageUrl: isValidImageURL,
});
const mentionedItems = computed(() => props.session?.mentioned_items || []);
const answerText = computed(() => {
  const text = props.content || props.session?.content || '';
  return typeof text === 'string' ? text : '';
});
const { displayed: typedAnswer } = useTypewriter(() => answerText.value, () => Boolean(props.session?.is_completed));
const answerFullyRendered = computed(() => Boolean(props.session?.is_completed) && typedAnswer.value.length >= answerText.value.length);
watch(answerFullyRendered, (ready) => { if (!props.session?.isAgentMode) emit('render-complete-change', ready); }, { immediate: true });
const renderedHTML = computed(() => {
  const text = typedAnswer.value;
  if (!text || typeof text !== 'string') return '';
  return renderChatMarkdown(text, {
    renderer: markdownRenderer,
    escapeMarkdown: safeMarkdownToHTML,
    sanitizeHtml: sanitizeMarkdownHTML,
    streaming: !props.session?.is_completed,
    knowledgeReferences: props.session?.knowledge_references,
  });
});
const hasActualContent = computed(() => {
  const text = props.content || props.session?.content || '';
  return text && text.trim().length > 0;
});
const getActualContent = () => (props.content || props.session?.content || '').trim();
const handleCopyAnswer = async () => {
  const content = getActualContent();
  if (!content) { MessagePlugin.warning(t('chat.emptyContentWarning')); return; }
  try { await copyTextToClipboard(content); MessagePlugin.success(t('chat.copySuccess')); }
  catch (err) { console.error('复制失败:', err); MessagePlugin.error(t('chat.copyFailed')); }
};
const handleAddToKnowledge = () => {
  const content = getActualContent();
  if (!content) { MessagePlugin.warning(t('chat.emptyContentWarning')); return; }
  const question = (props.userQuery || '').trim();
  uiStore.openManualEditor({ mode: 'create', title: formatManualTitle(question), content: buildManualMarkdown(question, content), status: 'draft' });
  MessagePlugin.info(t('chat.editorOpened'));
};
const handleMarkdownImageClick = (e) => {
  const target = e.target;
  if (target && target.tagName === 'IMG') {
    const src = target.getAttribute('src');
    if (src) { e.preventDefault(); e.stopPropagation(); preview(src); }
  }
};
watch(renderedHTML, () => { nextTick(() => rebindCitations()); });
onUpdated(() => {
  nextTick(async () => {
    await hydrateProtectedFileImages(parentMd.value);
    refreshMarkdownEnhancements(parentMd.value);
    if (props.session?.is_completed) await renderMermaidInContainer(parentMd.value);
  });
});
onMounted(async () => {
  nextTick(async () => {
    if (parentMd.value) parentMd.value.addEventListener('click', handleMarkdownImageClick, true);
    rebindCitations();
    await hydrateProtectedFileImages(parentMd.value);
    await enhanceMarkdownContainer(parentMd.value);
  });
});
onBeforeUnmount(() => { if (parentMd.value) parentMd.value.removeEventListener('click', handleMarkdownImageClick, true); });
</script>

<style lang="less" scoped>
@import '../../../components/css/chat-markdown.less';
@import '../../../components/css/chat-citations.less';
.bot_msg{margin-right:auto;max-width:100%;box-sizing:border-box;color:#111827;font-family:"Inter Variable",Inter,"Noto Sans SC Variable","Noto Sans SC",ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.625}.bot_msg.is-embedded{width:100%}.bot_msg.is-embedded :deep(.agent-stream-display){width:100%}.reference-answer-stack{display:flex;flex-direction:column;gap:8px}.rag-answer-stack{display:flex;flex-direction:column;gap:0}.reference-answer-body{padding-right:8px}.reference-answer-content{padding:2px 0}.markdown-content{.chat-markdown-typography();.chat-citation-pills();font-size:14.5px;line-height:1.625;color:#111827;user-select:text}
.reference-mentioned-items{display:flex;flex-wrap:wrap;gap:6px}.reference-mentioned-tag{max-width:220px;height:25px;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#6b7280;font-size:10px;font-weight:600}.reference-mentioned-tag>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reference-mentioned-tag.kb-tag{background:#f9fafb}.reference-mentioned-tag.faq-tag{background:#f3f4f6;color:#4b5563}
.reference-answer-toolbar{min-height:28px;margin-top:8px;display:flex;align-items:center;gap:5px;color:#9ca3af;user-select:none}.reference-answer-action{width:27px;height:27px;padding:0;border:0;border-radius:8px;background:transparent;color:#9ca3af;display:grid;place-items:center;cursor:pointer}.reference-answer-action:hover{background:#f3f4f6;color:#374151}.reference-answer-action svg,.reference-answer-follow-up svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.reference-answer-tooltip-wrap{position:relative;display:inline-flex}.reference-answer-tooltip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:4;display:none;width:max-content;max-width:240px;padding:5px 7px;border-radius:7px;background:#111827;color:#fff;font-size:9px;line-height:13px;box-shadow:0 4px 10px rgb(0 0 0 / 12%)}.reference-answer-tooltip-wrap:hover .reference-answer-tooltip{display:block}.reference-answer-follow-up{display:inline-flex;align-items:center;gap:5px;margin-left:2px;color:#9ca3af;font-size:9px;font-weight:600}.reference-answer-follow-up svg{animation:reference-pulse 1.4s ease-in-out infinite}@keyframes reference-pulse{50%{opacity:.35}}
.reference-image-loading{width:230px;height:230px;margin:8px 0 0 16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;color:#9ca3af;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;font-size:10px}.reference-spinner{width:15px;height:15px;border:2px solid #e5e7eb;border-top-color:#6b7280;border-radius:50%;animation:reference-spin .8s linear infinite}@keyframes reference-spin{to{transform:rotate(360deg)}}
.ai-markdown-img{max-width:80%;max-height:300px;width:auto;height:auto;border-radius:8px;display:block;cursor:pointer;object-fit:contain;margin:8px 0 8px 16px;border:.5px solid #e5e7eb;transition:transform .2s ease}.ai-markdown-img:hover{transform:scale(1.02)}
</style>
