<template>
  <article class="visual-assistant-message" :class="{ 'is-embedded': embeddedMode }">
    <div class="visual-assistant-message__context">
      <div v-if="!session.isAgentMode && mentionedItems && mentionedItems.length > 0" class="visual-assistant-resources">
        <span v-for="item in mentionedItems" :key="item.id" class="visual-assistant-resource" :data-resource-type="item.type || 'file'">
          <span class="visual-assistant-resource__icon" aria-hidden="true"><t-icon v-if="item.type === 'kb'" :name="item.kb_type === 'faq' ? 'chat-bubble-help' : 'folder'" /><t-icon v-else :name="mentionTagIcon(item)" /></span>
          <span class="visual-assistant-resource__name" :title="item.name">{{ item.name }}</span>
        </span>
      </div>

      <div v-if="session.isRagMode" class="visual-assistant-pipeline">
        <RagPipelineProgress :session="session" :embedded-mode="embeddedMode" />
        <AgentStreamDisplay v-if="session.isAgentMode" :session="session" :session-id="sessionId" :user-query="userQuery" :rag-mode="true" :follow-up-loading="followUpLoading" @render-complete-change="emit('render-complete-change', $event)" />
      </div>
      <template v-else>
        <docInfo v-if="session.knowledge_references?.length" :session="session" />
        <AgentStreamDisplay v-if="session.isAgentMode" :session="session" :session-id="sessionId" :user-query="userQuery" :follow-up-loading="followUpLoading" @render-complete-change="emit('render-complete-change', $event)" />
      </template>
      <deepThink v-if="session.showThink && !session.isAgentMode" :deepSession="session" />
    </div>

    <section ref="parentMd" v-if="!session.hideContent && !session.isAgentMode" class="visual-assistant-answer">
      <div v-if="hasActualContent" class="visual-assistant-answer__content"><div class="visual-assistant-markdown" v-stable-html="renderedHTML" /></div>
      <div v-if="answerFullyRendered && (content || session.content)" class="visual-assistant-toolbar">
        <button type="button" class="visual-assistant-toolbar__button" :title="$t('agent.copy')" @click.stop="handleCopyAnswer"><t-icon name="copy" /></button>
        <button type="button" class="visual-assistant-toolbar__button" :title="$t('agent.addToKnowledgeBase')" @click.stop="handleAddToKnowledge"><t-icon name="bookmark-add" /></button>
        <t-tooltip v-if="session.is_fallback" :content="$t('chat.fallbackHint')" placement="top"><button type="button" class="visual-assistant-toolbar__button is-muted" :title="$t('chat.fallbackHint')"><t-icon name="info-circle" /></button></t-tooltip>
        <ChatRequestInfoButton v-if="showRequestInfo" :session="session" :session-id="sessionId" />
        <Transition name="visual-follow-up-loading"><span v-if="followUpLoading" class="visual-assistant-toolbar__loading" role="status" aria-live="polite"><t-icon name="lightbulb" /><span>{{ t('chat.followUpQuestionsLoading') }}</span></span></Transition>
      </div>
      <div v-if="isImgLoading" class="visual-assistant-image-loading"><t-loading size="small" /><span>{{ $t('common.loading') }}</span></div>
    </section>

    <picturePreview v-if="reviewImg && reviewUrl" :reviewImg="reviewImg" :reviewUrl="reviewUrl" @closePreImg="closePreImg" />
    <ChatCitationFloat :float="citationFloat" :on-enter="cancelCitationClose" :on-leave="scheduleCitationClose" />
  </article>
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
const mentionTagIcon = (item) => { if (item.type === 'tag') return 'tag'; if (item.type === 'mcp') return 'tools'; if (item.type === 'skill') return 'bookmark'; return 'file'; };
const emit = defineEmits(['scroll-bottom', 'render-complete-change'])
const { t } = useI18n()
const uiStore = useUIStore();
let parentMd = ref()
const { float: citationFloat, rebind: rebindCitations, cancelClose: cancelCitationClose, scheduleClose: scheduleCitationClose } = useChatCitationPopover(parentMd, { getKnowledgeReferences: () => props.session?.knowledge_references, sessionId: () => props.sessionId });
let reviewUrl = ref('')
let reviewImg = ref(false)
let isImgLoading = ref(false);
const props = defineProps({ content: { type: String, required: false }, session: { type: Object, required: false }, userQuery: { type: String, required: false, default: '' }, isFirstEnter: { type: Boolean, required: false }, embeddedMode: { type: Boolean, default: false }, sessionId: { type: String, default: '' }, followUpLoading: { type: Boolean, default: false } });
const showRequestInfo = computed(() => !!(props.session?.request_id || props.session?.id));
const preview = (url) => { nextTick(() => { reviewUrl.value = url; reviewImg.value = true }) }
const closePreImg = () => { reviewImg.value = false; reviewUrl.value = ''; }
const markdownRenderer = createChatMarkdownRenderer({ codeRenderer: createMermaidCodeRenderer('mermaid-botmsg'), imageRenderer: ({ href, title, text }) => createSafeImage(href, text || '', title || ''), invalidImageHtml: () => `<p>${t('error.invalidImageLink')}</p>`, isValidImageUrl: isValidImageURL });
const mentionedItems = computed(() => props.session?.mentioned_items || []);
const answerText = computed(() => { const text = props.content || props.session?.content || ''; return typeof text === 'string' ? text : ''; });
const { displayed: typedAnswer } = useTypewriter(() => answerText.value, () => Boolean(props.session?.is_completed));
const answerFullyRendered = computed(() => Boolean(props.session?.is_completed) && typedAnswer.value.length >= answerText.value.length);
watch(answerFullyRendered, (ready) => { if (!props.session?.isAgentMode) emit('render-complete-change', ready); }, { immediate: true });
const renderedHTML = computed(() => { const text = typedAnswer.value; if (!text || typeof text !== 'string') return ''; return renderChatMarkdown(text, { renderer: markdownRenderer, escapeMarkdown: safeMarkdownToHTML, sanitizeHtml: sanitizeMarkdownHTML, streaming: !props.session?.is_completed, knowledgeReferences: props.session?.knowledge_references }); });
const hasActualContent = computed(() => { const text = props.content || props.session?.content || ''; return text && text.trim().length > 0; });
const getActualContent = () => (props.content || props.session?.content || '').trim();
const handleCopyAnswer = async () => { const content = getActualContent(); if (!content) { MessagePlugin.warning(t('chat.emptyContentWarning')); return; } try { await copyTextToClipboard(content); MessagePlugin.success(t('chat.copySuccess')); } catch (err) { console.error('复制失败:', err); MessagePlugin.error(t('chat.copyFailed')); } };
const handleAddToKnowledge = () => { const content = getActualContent(); if (!content) { MessagePlugin.warning(t('chat.emptyContentWarning')); return; } const question = (props.userQuery || '').trim(); const manualContent = buildManualMarkdown(question, content); const manualTitle = formatManualTitle(question); uiStore.openManualEditor({ mode: 'create', title: manualTitle, content: manualContent, status: 'draft' }); MessagePlugin.info(t('chat.editorOpened')); };
const handleMarkdownImageClick = (e) => { const target = e.target; if (target && target.tagName === 'IMG') { const src = target.getAttribute('src'); if (src) { e.preventDefault(); e.stopPropagation(); preview(src); } } };
watch(renderedHTML, () => { nextTick(() => { rebindCitations(); }); });
onUpdated(() => { nextTick(async () => { await hydrateProtectedFileImages(parentMd.value); refreshMarkdownEnhancements(parentMd.value); if (props.session?.is_completed) await renderMermaidInContainer(parentMd.value); }); });
onMounted(async () => { nextTick(async () => { if (parentMd.value) parentMd.value.addEventListener('click', handleMarkdownImageClick, true); rebindCitations(); await hydrateProtectedFileImages(parentMd.value); await enhanceMarkdownContainer(parentMd.value); }); });
onBeforeUnmount(() => { if (parentMd.value) parentMd.value.removeEventListener('click', handleMarkdownImageClick, true); });
</script>

<style scoped lang="less">
@import '../../../components/css/chat-markdown.less';
@import '../../../components/css/chat-citations.less';
.visual-assistant-message { width: 100%; min-width: 0; margin-right: auto; color: #111827; font-size: 14.5px; text-align: left; }
.visual-assistant-message.is-embedded { width: 100%; }
.visual-assistant-message.is-embedded :deep(.agent-stream-display) { width: 100%; }
.visual-assistant-message__context { display: flex; flex-direction: column; gap: 12px; }
.visual-assistant-resources { display: flex; flex-wrap: wrap; gap: 8px; }
.visual-assistant-resource { max-width: 240px; min-height: 28px; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; background: #fff; color: #4b5563; font-size: 12px; line-height: 18px; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.visual-assistant-resource__icon { flex: 0 0 14px; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; color: #9ca3af; }
.visual-assistant-resource__icon :deep(.t-icon) { font-size: 14px; }
.visual-assistant-resource__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-assistant-pipeline { display: flex; flex-direction: column; gap: 0; }
.visual-assistant-answer { min-width: 0; }
.visual-assistant-answer__content { padding: 0 8px 0 0; }
.visual-assistant-markdown { min-width: 0; .chat-markdown-typography(); .chat-citation-pills(); }
.visual-assistant-markdown :deep(img) { max-width: 80%; max-height: 300px; width: auto; height: auto; margin: 10px 0; border: 1px solid #e5e7eb; border-radius: 12px; display: block; object-fit: contain; cursor: pointer; }
.visual-assistant-toolbar { min-height: 28px; margin-top: 6px; padding-top: 6px; display: flex; align-items: center; gap: 6px; color: #9ca3af; opacity: 0; transition: opacity 150ms ease; user-select: none; }
.visual-assistant-message:hover .visual-assistant-toolbar,.visual-assistant-toolbar:focus-within { opacity: 1; }
.visual-assistant-toolbar__button { width: 24px; height: 24px; padding: 4px; border: 0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #9ca3af; cursor: pointer; }
.visual-assistant-toolbar__button:hover { background: #f3f4f6; color: #374151; }
.visual-assistant-toolbar__button.is-muted { color: #9ca3af; }
.visual-assistant-toolbar__button :deep(.t-icon) { font-size: 16px; }
.visual-assistant-toolbar__loading { min-width: 0; margin-left: 4px; padding: 4px 8px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #f9fafb; color: #9ca3af; font-size: 10px; line-height: 14px; }
.visual-assistant-toolbar__loading :deep(.t-icon) { font-size: 12px; }
.visual-assistant-image-loading { width: 230px; height: 230px; margin-top: 8px; border: 1px solid #e5e7eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 7px; background: #f9fafb; color: #9ca3af; font-size: 11px; }
.visual-follow-up-loading-enter-active,.visual-follow-up-loading-leave-active { transition: opacity 140ms ease,transform 140ms ease; }
.visual-follow-up-loading-enter-from,.visual-follow-up-loading-leave-to { opacity: 0; transform: translateY(2px); }
@media (max-width: 767px) { .visual-assistant-message { font-size: 14px; } }
@media (prefers-reduced-motion: reduce) { .visual-assistant-toolbar,.visual-follow-up-loading-enter-active,.visual-follow-up-loading-leave-active { transition: none !important; } }
</style>
