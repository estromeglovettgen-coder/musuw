<template>
  <Teleport to="body">
    <div
      v-if="float.visible"
      class="chat-citation-float"
      :style="{ top: `${float.top}px`, left: `${float.left}px` }"
      @mouseenter="onEnter?.()"
      @mouseleave="onLeave?.()"
    >
      <template v-if="float.type === 'web'">
        <div class="chat-citation-float__source">
          <span class="chat-citation-float__source-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
          </span>
          <div class="chat-citation-float__title">{{ float.title || float.url }}</div>
        </div>
        <a
          v-if="float.url"
          class="chat-citation-float__link"
          :href="float.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{{ float.url }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
        </a>
      </template>

      <template v-else>
        <div class="chat-citation-float__source">
          <span class="chat-citation-float__source-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>
          </span>
          <div class="chat-citation-float__title">{{ float.title }}</div>
        </div>
        <div v-if="float.loading" class="chat-citation-float__muted">{{ loadingText }}</div>
        <div v-else-if="float.error" class="chat-citation-float__error">{{ float.error }}</div>
        <div v-else class="chat-citation-float__body">{{ float.content }}</div>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CitationFloatState } from '@/composables/useChatCitationPopover'

defineProps<{
  float: CitationFloatState
  onEnter?: () => void
  onLeave?: () => void
}>()

const { t } = useI18n()
const loadingText = t('common.loading')
</script>

<style scoped>
.chat-citation-float {
  position: fixed;
  z-index: 1600;
  width: min(320px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid rgb(229 231 235 / .9);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 25px rgb(0 0 0 / .10);
  color: #1f2937;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
  text-align: left;
}

.chat-citation-float__source {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chat-citation-float__source-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: #6b7280;
}

.chat-citation-float svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chat-citation-float__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
}

.chat-citation-float__link {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #6b7280;
  font-size: 11px;
  line-height: 16px;
  text-decoration: none;
}
.chat-citation-float__link span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-citation-float__link svg { width: 12px; height: 12px; flex: 0 0 12px; }
.chat-citation-float__link:hover { color: #111827; }

.chat-citation-float__body,
.chat-citation-float__muted,
.chat-citation-float__error {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.625;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-citation-float__body { max-height: 180px; overflow-y: auto; color: #6b7280; user-select: text; }
.chat-citation-float__muted { color: #9ca3af; }
.chat-citation-float__error { color: #dc2626; }
</style>
