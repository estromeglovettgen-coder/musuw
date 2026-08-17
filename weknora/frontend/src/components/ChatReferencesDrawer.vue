<template>
  <Teleport to="body" :disabled="!useOverlay">
    <Transition name="references-panel" @after-enter="handlePanelAfterEnter">
      <aside
        v-if="visible"
        class="chat-references-panel"
        :class="{ 'is-overlay': useOverlay, 'is-embedded': embeddedMode }"
        role="complementary"
        :aria-label="panelTitle"
      >
        <header class="chat-references-panel__header">
          <h3 class="chat-references-panel__title">
            {{ panelTitle }}
            <span v-if="totalCount" class="chat-references-panel__count">({{ totalCount }})</span>
          </h3>
          <button
            type="button"
            class="chat-references-panel__close"
            :aria-label="t('common.close')"
            @click="close"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div ref="listElement" class="chat-references-panel__body">
          <div v-if="sections.length === 0" class="chat-references-panel__empty">
            {{ t('chat.referencesDrawerEmpty') }}
          </div>

          <section
            v-for="section in sections"
            :key="section.id"
            class="chat-references-panel__section"
          >
            <h4 v-if="sections.length > 1" class="chat-references-panel__section-title">
              {{ sectionTitle(section.id) }}
            </h4>

            <article
              v-for="item in section.items"
              :key="item.key"
              :ref="(el) => setItemRef(item.key, el as HTMLElement | null)"
              class="reference-item"
              :class="{
                'reference-item--web': item.kind === 'web',
                'reference-item--document': item.kind === 'document',
                'reference-item--tool': item.kind === 'tool',
                'is-highlighted': item.key === activeHighlightKey,
              }"
            >
              <component
                :is="item.kind === 'web' ? 'a' : 'div'"
                class="reference-item__body"
                :class="{ 'is-expandable': item.kind === 'document' && hasMoreContent(item) }"
                :href="item.kind === 'web' ? item.url : undefined"
                :target="item.kind === 'web' ? '_blank' : undefined"
                :rel="item.kind === 'web' ? 'noopener noreferrer' : undefined"
                :role="item.kind === 'document' && hasMoreContent(item) ? 'button' : undefined"
                :tabindex="item.kind === 'document' && hasMoreContent(item) ? 0 : undefined"
                @mousedown="trackContentPointerDown"
                @click="item.kind === 'document' && hasMoreContent(item) ? toggleDocumentSnippet(item, $event) : undefined"
                @keydown.enter="item.kind === 'document' && hasMoreContent(item) ? toggleDocumentSnippet(item) : undefined"
                @keydown.space.prevent="item.kind === 'document' && hasMoreContent(item) ? toggleDocumentSnippet(item) : undefined"
              >
                <template v-if="item.kind === 'document'">
                  <div class="reference-item__document">
                    <svg class="reference-item__doc-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M8 13h8M8 17h8M8 9h2" />
                    </svg>
                    <div class="reference-item__document-main">
                      <div class="reference-item__title-row">
                        <h5 class="reference-item__title">{{ item.title }}</h5>
                        <a
                          v-if="item.knowledgeBaseId && !embeddedMode"
                          class="reference-item__open"
                          :href="getDocumentHref(item)"
                          target="_blank"
                          rel="noopener noreferrer"
                          :aria-label="t('chat.navigateToDocument')"
                          @click.stop
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          </svg>
                        </a>
                      </div>
                      <p v-if="item.snippet && !expandedKeys.has(item.key)" class="reference-item__snippet">
                        {{ formatReferenceSnippet(item.snippet) }}
                      </p>
                      <div v-if="expandedKeys.has(item.key)" class="reference-item__content">
                        {{ formatReferenceSnippet(item.content) }}
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div v-if="item.kind === 'web' && item.domain" class="reference-item__source">
                    <img
                      v-if="item.faviconUrl"
                      class="reference-item__source-mark"
                      :src="item.faviconUrl"
                      alt=""
                      loading="lazy"
                      @error="onFaviconError"
                    />
                    <span v-else class="reference-item__source-fallback" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
                    </span>
                    <span class="reference-item__domain">{{ item.domain }}</span>
                  </div>
                  <div v-else-if="item.kind === 'tool' && item.domain" class="reference-item__source">
                    <span class="reference-item__source-fallback" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0-1.4-1.4L10 8.2 8.6 6.8 11.9 3.5a1 1 0 0 0-1.4-1.4L7.2 5.4a2 2 0 0 0 0 2.8l1.4 1.4-6.3 6.3a2 2 0 1 0 2.8 2.8l6.3-6.3 1.4 1.4a2 2 0 0 0 2.8 0l3.3-3.3a1 1 0 0 0-1.4-1.4l-3.3 3.3-1.4-1.4 3.3-3.3a1 1 0 0 0-1.4-1.4Z"/></svg>
                    </span>
                    <span class="reference-item__domain">{{ item.domain }}</span>
                  </div>

                  <h5 v-if="shouldShowItemTitle(item)" class="reference-item__title">{{ item.title }}</h5>
                  <p v-if="item.kind !== 'tool' && item.snippet && !expandedKeys.has(item.key)" class="reference-item__snippet">
                    {{ formatReferenceSnippet(item.snippet) }}
                  </p>
                  <div v-if="item.kind === 'tool' && item.content" class="reference-item__content">
                    {{ formatReferenceSnippet(item.content) }}
                  </div>
                </template>
              </component>
            </article>
          </section>
        </div>
      </aside>
    </Transition>
  </Teleport>

  <Transition name="references-backdrop">
    <div
      v-if="visible && useOverlay"
      class="chat-references-panel__backdrop"
      @click="close"
    />
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useChatReferencesDrawer } from '@/composables/useChatReferencesDrawer'
import {
  buildReferenceSections,
  formatReferenceSnippet,
  resolveReferenceHighlightKey,
  type ReferenceListItem,
} from '@/utils/referenceSources'

const props = defineProps<{
  embeddedMode?: boolean
  overlayBreakpoint?: number
}>()

const { t } = useI18n()
const router = useRouter()
const drawer = useChatReferencesDrawer()

const listElement = ref<HTMLElement | null>(null)
const itemElements = new Map<string, HTMLElement>()
const expandedKeys = reactive(new Set<string>())
const pointerDownSelectionText = ref('')
const panelEntered = ref(false)

const visible = computed(() => drawer?.visible.value ?? false)
const references = computed(() => drawer?.references.value ?? [])
const highlight = computed(() => drawer?.highlight.value ?? null)

const useOverlay = computed(() => {
  if (props.embeddedMode) return true
  if (typeof window === 'undefined') return false
  return window.innerWidth < (props.overlayBreakpoint ?? 960)
})

const sections = computed(() => buildReferenceSections(references.value))
const totalCount = computed(() => sections.value.reduce((sum, section) => sum + section.items.length, 0))
const activeHighlightKey = computed(() => resolveReferenceHighlightKey(references.value, highlight.value))

const panelTitle = computed(() => {
  const webCount = sections.value.find((section) => section.id === 'web')?.items.length ?? 0
  const docCount = sections.value.find((section) => section.id === 'documents')?.items.length ?? 0
  const toolCount = sections.value.find((section) => section.id === 'tools')?.items.length ?? 0
  if (toolCount > 0 && webCount === 0 && docCount === 0) return t('chat.referencesDrawerTitleTools')
  if ([webCount, docCount, toolCount].filter((count) => count > 0).length > 1) return t('chat.referencesDrawerTitleMixed')
  if (webCount > 0) return t('chat.referencesDrawerTitleWeb')
  if (docCount > 0) return t('chat.referencesDrawerTitleDocs')
  return t('chat.referencesDrawerTitle')
})

function sectionTitle(id: 'web' | 'documents' | 'tools') {
  if (id === 'web') return t('chat.referencesDrawerWebSection')
  if (id === 'tools') return t('chat.referencesDrawerToolsSection')
  return t('chat.referencesDrawerDocsSection')
}

function close() {
  drawer?.close()
}

function setItemRef(key: string, el: HTMLElement | null) {
  if (!el) {
    itemElements.delete(key)
    return
  }
  itemElements.set(key, el)
}

function onFaviconError(event: Event) {
  const img = event.target as HTMLImageElement | null
  if (img) img.style.display = 'none'
}

function hasMoreContent(item: ReferenceListItem) {
  const content = String(item.content || '').trim()
  const snippet = String(item.snippet || '').replace(/…$/, '').trim()
  if (!content) return false
  if (!snippet) return true
  return content.length > snippet.length && !content.startsWith(snippet)
    ? true
    : content.length > snippet.length + 8
}

function getSelectedText() {
  if (typeof window === 'undefined') return ''
  return window.getSelection()?.toString().trim() || ''
}

function trackContentPointerDown() {
  pointerDownSelectionText.value = getSelectedText()
}

function shouldIgnoreContentToggle(event?: MouseEvent) {
  if (!event) return false
  const selectedText = getSelectedText()
  if (selectedText || pointerDownSelectionText.value) {
    pointerDownSelectionText.value = ''
    return true
  }
  pointerDownSelectionText.value = ''
  return false
}

function toggleDocumentSnippet(item: ReferenceListItem, event?: MouseEvent) {
  if (shouldIgnoreContentToggle(event)) return
  if (expandedKeys.has(item.key)) {
    expandedKeys.delete(item.key)
    return
  }
  expandedKeys.add(item.key)
}

function getDocumentHref(item: ReferenceListItem) {
  if (!item.knowledgeBaseId) return ''
  const query: Record<string, string> = {}
  if (item.knowledgeId) query.knowledge_id = item.knowledgeId
  return router.resolve({ path: `/platform/knowledge-bases/${item.knowledgeBaseId}`, query }).href
}

function shouldShowItemTitle(item: ReferenceListItem) {
  if (item.kind !== 'web') return true
  const title = item.title?.trim()
  const domain = item.domain?.trim()
  return Boolean(title && title !== domain)
}

async function scrollToHighlight() {
  if (!panelEntered.value) return
  const key = activeHighlightKey.value
  if (!key) return
  await nextTick()
  const el = itemElements.get(key)
  const container = listElement.value
  if (!el || !container) return

  const itemRect = el.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  let nextTop: number | null = null
  if (itemRect.top < containerRect.top) {
    nextTop = container.scrollTop + itemRect.top - containerRect.top - 8
  } else if (itemRect.bottom > containerRect.bottom) {
    nextTop = container.scrollTop + itemRect.bottom - containerRect.bottom + 8
  }
  if (nextTop !== null) container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
}

function handlePanelAfterEnter() {
  panelEntered.value = true
  void scrollToHighlight()
}

watch(activeHighlightKey, () => void scrollToHighlight())
watch(highlight, () => void scrollToHighlight())
watch(visible, (open) => {
  if (!open) {
    panelEntered.value = false
    expandedKeys.clear()
  }
})
</script>

<style scoped>
.chat-references-panel__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgb(0 0 0 / .22);
}

.chat-references-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1201;
  width: min(384px, 100vw);
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgb(229 231 235 / .8);
  background: #fff;
  color: #1f2937;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
  user-select: none;
}

.chat-references-panel.is-overlay {
  box-shadow: -12px 0 32px rgb(0 0 0 / .10);
}

.chat-references-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #fdfdfd;
}

.chat-references-panel__title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: #111827;
}

.chat-references-panel__count {
  font-weight: 400;
  color: #9ca3af;
}

.chat-references-panel__close {
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.chat-references-panel__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.chat-references-panel__close svg,
.reference-item svg,
.reference-item__source-fallback svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chat-references-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  text-align: left;
}

.chat-references-panel__empty {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  font-size: 12px;
  line-height: 16px;
  color: #9ca3af;
}

.chat-references-panel__section + .chat-references-panel__section { margin-top: 16px; }
.chat-references-panel__section-title {
  margin: 0 0 8px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
  color: #9ca3af;
}

.reference-item {
  position: relative;
  margin-bottom: 8px;
  border: 1px solid rgb(229 231 235 / .8);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}

.reference-item:hover {
  border-color: #d1d5db;
  box-shadow: 0 1px 2px rgb(0 0 0 / .05);
}

.reference-item.is-highlighted {
  border-color: #3b82f6;
  background: rgb(239 246 255 / .4);
  box-shadow: 0 0 0 1px #3b82f6;
}

.reference-item__body {
  display: block;
  padding: 12px;
  color: inherit;
  text-decoration: none;
}
.reference-item__body.is-expandable { cursor: pointer; }
.reference-item__document { display: flex; align-items: flex-start; gap: 10px; }
.reference-item__document-main { flex: 1; min-width: 0; }

.reference-item__title-row {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.reference-item__doc-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  color: #374151;
}

.reference-item__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  color: #111827;
}

.reference-item__open {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  color: #9ca3af;
  transition: color 150ms ease;
}
.reference-item__open:hover { color: #374151; }

.reference-item__snippet {
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  font-size: 11px;
  line-height: 1.625;
  color: #6b7280;
}

.reference-item__content {
  margin-top: 6px;
  max-height: 360px;
  overflow-y: auto;
  white-space: pre-wrap;
  user-select: text;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 14px;
  font-size: 12px;
  line-height: 1.625;
  color: #1f2937;
  word-break: break-word;
}

.reference-item__source {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.reference-item__source-mark,
.reference-item__source-fallback {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border-radius: 999px;
  color: #9ca3af;
}
.reference-item__source-mark { object-fit: cover; }
.reference-item__domain {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 15px;
  font-weight: 500;
  color: #6b7280;
}
.reference-item--web .reference-item__title,
.reference-item--tool .reference-item__title { margin-bottom: 6px; }

.references-panel-enter-active,
.references-panel-leave-active { transition: transform 180ms ease, opacity 180ms ease; }
.references-panel-enter-from,
.references-panel-leave-to { transform: translateX(100%); opacity: .6; }
.references-backdrop-enter-active,
.references-backdrop-leave-active { transition: opacity 180ms ease; }
.references-backdrop-enter-from,
.references-backdrop-leave-to { opacity: 0; }
</style>
