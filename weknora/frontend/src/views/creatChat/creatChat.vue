<template>
  <div class="dialogue-wrap">
    <div class="dialogue-answers">
      <div class="dialogue-title" style="--wails-draggable: drag">
        <span style="--wails-draggable: drag">{{ $t('createChat.title') }}</span>
      </div>

      <div ref="sqContainerRef" class="suggested-questions-container">
        <div v-if="sqLoading && suggestedQuestions.length === 0" class="suggested-questions-inner">
          <div class="suggested-questions-title">
            <t-skeleton animation="gradient" :row-col="[{ width: '120px', height: '14px' }]" />
          </div>
          <div class="suggested-questions-grid">
            <div v-for="n in 6" :key="'sq-skel-' + n" class="suggested-question-card sq-card-skeleton">
              <t-skeleton animation="gradient" :row-col="[{ width: '100%', height: '14px', type: 'rect' }]" />
            </div>
          </div>
        </div>

        <transition
          v-else
          appear
          name="sq-slide-fade"
          mode="out-in"
          @before-leave="onBeforeLeave"
          @after-leave="onAfterLeave"
          @enter="onEnter"
          @after-enter="onQuestionsEntered"
        >
          <div v-if="suggestedQuestions.length > 0" :key="sqRenderKey" class="suggested-questions-inner">
            <div class="suggested-questions-title-row">
              <p class="suggested-questions-caption">
                <span class="suggested-questions-title">{{ $t('chat.suggestedQuestions') }}</span>
                <button
                  type="button"
                  class="suggested-questions-refresh"
                  :disabled="sqLoading"
                  :title="$t('chat.refreshSuggestedQuestions')"
                  :aria-label="$t('chat.refreshSuggestedQuestions')"
                  @click="fetchSuggestedQuestions"
                >
                  <ReferenceIcon :name="sqLoading ? 'loader-circle' : 'rotate-cw'" :size="14" :class="{ 'sq-refresh-spin': sqLoading }" />
                </button>
              </p>
            </div>
            <div class="suggested-questions-grid">
              <div
                v-for="(item, index) in suggestedQuestions"
                :key="item.question"
                class="suggested-question-card"
                :class="{ 'sq-card-visible': sqCardsRevealed }"
                :style="{ transitionDelay: sqCardsRevealed ? `${index * 50}ms` : '0ms' }"
                @click="handleSuggestedQuestionClick(item.question)"
              >
                <span class="suggested-question-text">{{ item.question }}</span>
                <span v-if="item.source === 'faq'" class="suggested-question-badge faq">FAQ</span>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <InputField ref="inputFieldRef" @send-msg="sendMsg" />
    </div>
  </div>

  <KnowledgeBaseEditorModal
    :visible="uiStore.showKBEditorModal"
    :mode="uiStore.kbEditorMode"
    :kb-id="uiStore.currentKBId || undefined"
    :initial-type="uiStore.kbEditorType"
    @update:visible="(val) => val ? null : uiStore.closeKBEditor()"
    @success="handleKBEditorSuccess"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import InputField from '@/components/Input-field.vue';
import ReferenceIcon from '@/components/ReferenceIcon.vue';
import { createSessions } from '@/api/chat/index';
import { getSuggestedQuestions } from '@/api/agent/index';
import type { SuggestedQuestion } from '@/api/agent/index';
import { useMenuStore } from '@/stores/menu';
import { useSettingsStore } from '@/stores/settings';
import { useUIStore } from '@/stores/ui';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';
import KnowledgeBaseEditorModal from '@/views/knowledge/KnowledgeBaseEditorModal.vue';
import { useKnowledgeBaseCreationNavigation } from '@/hooks/useKnowledgeBaseCreationNavigation';

const router = useRouter();
const usemenuStore = useMenuStore();
const settingsStore = useSettingsStore();
const uiStore = useUIStore();
const { t } = useI18n();
const { navigateToKnowledgeBaseList } = useKnowledgeBaseCreationNavigation();

const suggestedQuestions = ref<SuggestedQuestion[]>([]);
const sqLoading = ref(true);
const sqCardsRevealed = ref(false);
const sqRenderKey = ref(0);
const sqContainerRef = ref<HTMLElement | null>(null);
let suggestedQuestionsFetchId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const onBeforeLeave = () => {
  const c = sqContainerRef.value;
  if (!c) return;
  c.style.height = c.offsetHeight + 'px';
  c.style.overflow = 'hidden';
};

const onAfterLeave = () => {
  const c = sqContainerRef.value;
  if (!c) return;
  if (suggestedQuestions.value.length === 0) {
    requestAnimationFrame(() => { c.style.height = '0px'; });
    c.addEventListener('transitionend', () => {
      c.style.height = '';
      c.style.overflow = '';
    }, { once: true });
  }
};

const onEnter = () => {
  const c = sqContainerRef.value;
  if (!c) return;
  const startHeight = c.offsetHeight;
  c.style.height = 'auto';
  c.style.overflow = 'hidden';
  const targetHeight = c.offsetHeight;
  c.style.height = startHeight + 'px';
  requestAnimationFrame(() => { c.style.height = targetHeight + 'px'; });
};

const onQuestionsEntered = () => {
  const c = sqContainerRef.value;
  if (c) {
    c.style.height = '';
    c.style.overflow = '';
  }
  nextTick(() => { sqCardsRevealed.value = true; });
};

const fetchSuggestedQuestions = async () => {
  const fetchId = ++suggestedQuestionsFetchId;
  sqLoading.value = true;
  try {
    const agentId = settingsStore.selectedAgentId;
    if (!agentId) return;
    const res = await getSuggestedQuestions(agentId, settingsStore.getSuggestedQuestionsParams());
    if (fetchId === suggestedQuestionsFetchId) {
      sqCardsRevealed.value = false;
      sqRenderKey.value++;
      suggestedQuestions.value = res?.data?.questions || [];
    }
  } catch (err) {
    console.warn('[SuggestedQuestions] Failed to fetch:', err);
    if (fetchId === suggestedQuestionsFetchId) suggestedQuestions.value = [];
  } finally {
    if (fetchId === suggestedQuestionsFetchId) sqLoading.value = false;
  }
};

const debouncedFetch = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { fetchSuggestedQuestions(); }, 300);
};

watch(
  () => ({
    agentId: settingsStore.selectedAgentId,
    kbs: settingsStore.settings.selectedKnowledgeBases,
    files: settingsStore.settings.selectedFiles,
    tags: settingsStore.settings.selectedTags,
    mcps: settingsStore.settings.selectedMCPServices,
    skills: settingsStore.settings.selectedSkills,
  }),
  debouncedFetch,
  { deep: true },
);

onMounted(() => { fetchSuggestedQuestions(); });

const inputFieldRef = ref();
const handleSuggestedQuestionClick = (question: string) => inputFieldRef.value?.triggerSend(question);

const sendMsg = (
  value: string,
  modelId: string,
  mentionedItems: any[],
  imageFiles: any[] = [],
  attachmentFiles: any[] = [],
  thinking: boolean = true,
) => {
  createNewSession(value, modelId, mentionedItems, imageFiles, attachmentFiles, thinking);
};

async function createNewSession(
  value: string,
  modelId: string,
  mentionedItems: any[] = [],
  imageFiles: any[] = [],
  attachmentFiles: any[] = [],
  thinking: boolean = true,
) {
  const selectedKbs = settingsStore.settings.selectedKnowledgeBases || [];
  const selectedFiles = settingsStore.settings.selectedFiles || [];
  const sessionData: any = {};
  sessionData.agent_config = {
    enabled: true,
    max_iterations: settingsStore.agentConfig.maxIterations,
    temperature: settingsStore.agentConfig.temperature,
    knowledge_bases: selectedKbs,
    knowledge_ids: selectedFiles,
    allowed_tools: settingsStore.agentConfig.allowedTools,
  };

  try {
    const res = await createSessions(sessionData);
    if (res.data && res.data.id) {
      await navigateToSession(res.data.id, value, modelId, mentionedItems, imageFiles, attachmentFiles, thinking);
    } else {
      console.error('[createChat] Failed to create session');
      MessagePlugin.error(t('createChat.messages.createFailed'));
    }
  } catch (error) {
    console.error('[createChat] Create session error:', error);
    MessagePlugin.error(t('createChat.messages.createError'));
  }
}

const navigateToSession = async (
  sessionId: string,
  value: string,
  modelId: string,
  mentionedItems: any[],
  imageFiles: any[] = [],
  attachmentFiles: any[] = [],
  thinking: boolean = true,
) => {
  const now = new Date().toISOString();
  const obj = {
    title: t('createChat.newSessionTitle'),
    path: `chat/${sessionId}`,
    id: sessionId,
    isMore: false,
    isNoTitle: true,
    created_at: now,
    updated_at: now,
  };
  usemenuStore.updataMenuChildren(obj);
  usemenuStore.changeIsFirstSession(true);
  usemenuStore.changeFirstQuery(value, mentionedItems, modelId, imageFiles, attachmentFiles, thinking);
  router.push(`/platform/chat/${sessionId}`);
};

const handleKBEditorSuccess = (kbId: string) => navigateToKnowledgeBaseList(kbId);
</script>

<style lang="less" scoped>
@import '../../components/css/suggested-questions.less';

.dialogue-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  background: #fff;
  padding: 24px 16px;
  box-sizing: border-box;
}

.dialogue-answers {
  margin-inline: auto;
  display: flex;
  min-height: 100%;
  max-width: 768px;
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  padding-block: 40px;
  box-sizing: border-box;
  user-select: none;

  :deep(.answers-input) {
    position: static;
    width: 100%;
    max-width: 768px;
    transform: none;
  }
}

.dialogue-title {
  margin: 0;
  padding: 0;
  border: 0;
  color: #111827;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
  letter-spacing: -.025em;
  text-align: left;
}

.suggested-questions-container {
  width: 100%;
  max-width: 768px;
  margin: 0;
  padding: 0;
  transition: height 160ms @suggested-ease;
}

.suggested-questions-inner { animation: skeletonFadeIn 160ms ease-out; }
.suggested-questions-refresh { display: inline-grid; place-items: center; }
.sq-refresh-spin { animation: reference-spin 800ms linear infinite; }

.sq-slide-fade-enter-active { transition: opacity 160ms @suggested-ease, transform 160ms @suggested-ease; }
.sq-slide-fade-leave-active { transition: opacity 150ms cubic-bezier(.4, 0, 1, 1), transform 150ms cubic-bezier(.4, 0, 1, 1); }
.sq-slide-fade-enter-from { opacity: 0; transform: translateY(10px); }
.sq-slide-fade-leave-to { opacity: 0; transform: translateY(-4px); }

.suggested-question-card {
  opacity: 0;
  transform: translateY(8px) scale(.97);
  transition: opacity 160ms @suggested-ease, transform 160ms @suggested-ease, background 160ms @suggested-ease, border-color 160ms @suggested-ease, box-shadow 160ms @suggested-ease;
}
.suggested-question-card.sq-card-skeleton { opacity: 1; transform: none; }
.suggested-question-card.sq-card-visible { opacity: 1; transform: translateY(0) scale(1); }
.suggested-question-card:not(.sq-card-skeleton):active { transform: scale(.98); }

@keyframes skeletonFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes reference-spin { to { transform: rotate(360deg); } }

@media (min-width: 768px) {
  .dialogue-wrap { padding-inline: 32px; }
  .dialogue-answers { padding-block: 64px; }
  .dialogue-title {
    text-align: center;
    font-size: 30px;
    line-height: 36px;
  }
}

@media (min-width: 1024px) {
  .dialogue-title { font-size: 32px; }
}

@media (max-width: 600px) {
  .dialogue-wrap { padding: 24px 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .suggested-question-card,
  .sq-slide-fade-enter-active,
  .sq-slide-fade-leave-active { transition-duration: .01ms !important; }
}
</style>
