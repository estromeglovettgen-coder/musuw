<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import DocumentPreview from '@/components/document-preview.vue'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { useChatAttachmentPreviewDrawer } from '@/composables/useChatAttachmentPreviewDrawer'

const drawer = useChatAttachmentPreviewDrawer()

const MAIN_DRAWER_WIDTH_KEY = 'weknora-chat-attachment-drawer-width'
const MAIN_DRAWER_DEFAULT_WIDTH = 654
const MAIN_DRAWER_MIN_WIDTH = 480

const mainDrawerWidth = ref(MAIN_DRAWER_DEFAULT_WIDTH)
const mainDrawerResizing = ref(false)

let mainResizeStartX = 0
let mainResizeStartWidth = 0

const visible = computed(() => drawer?.visible.value ?? false)
const target = computed(() => drawer?.target.value ?? null)

function mainDrawerMaxWidth() {
  return Math.min(1600, Math.max(MAIN_DRAWER_MIN_WIDTH, Math.floor(window.innerWidth * 0.95)))
}

function clampMainDrawerWidth(width: number) {
  return Math.max(MAIN_DRAWER_MIN_WIDTH, Math.min(mainDrawerMaxWidth(), width))
}

function loadMainDrawerWidth() {
  try {
    const raw = localStorage.getItem(MAIN_DRAWER_WIDTH_KEY)
    const parsed = raw ? parseInt(raw, 10) : NaN
    if (!Number.isNaN(parsed)) mainDrawerWidth.value = clampMainDrawerWidth(parsed)
  } catch {
    /* ignore */
  }
}

function onMainDrawerResizeStart(e: MouseEvent) {
  mainDrawerResizing.value = true
  mainResizeStartX = e.clientX
  mainResizeStartWidth = mainDrawerWidth.value
  document.addEventListener('mousemove', onMainDrawerResizeMove)
  document.addEventListener('mouseup', onMainDrawerResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMainDrawerResizeMove(e: MouseEvent) {
  const delta = mainResizeStartX - e.clientX
  mainDrawerWidth.value = clampMainDrawerWidth(mainResizeStartWidth + delta)
}

function onMainDrawerResizeEnd() {
  document.removeEventListener('mousemove', onMainDrawerResizeMove)
  document.removeEventListener('mouseup', onMainDrawerResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  mainDrawerResizing.value = false
  try {
    localStorage.setItem(MAIN_DRAWER_WIDTH_KEY, String(mainDrawerWidth.value))
  } catch {
    /* ignore */
  }
}

function cleanupMainDrawerResize() {
  document.removeEventListener('mousemove', onMainDrawerResizeMove)
  document.removeEventListener('mouseup', onMainDrawerResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  mainDrawerResizing.value = false
}

function onWindowResize() {
  mainDrawerWidth.value = clampMainDrawerWidth(mainDrawerWidth.value)
}

function close() {
  drawer?.close()
}

onMounted(() => {
  loadMainDrawerWidth()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  cleanupMainDrawerResize()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="attachment-panel-fade">
      <div v-if="visible" class="chat-attachment-preview-backdrop" @mousedown.self="close">
        <Transition name="attachment-panel-slide" appear>
          <aside
            v-if="visible"
            class="chat-attachment-preview-panel"
            :class="{ 'is-resizing': mainDrawerResizing }"
            :style="{ width: `${mainDrawerWidth}px` }"
            role="dialog"
            aria-modal="true"
            :aria-label="target?.fileName || ''"
          >
            <div
              class="chat-attachment-drawer-resize-handle"
              :class="{ active: mainDrawerResizing }"
              role="separator"
              aria-orientation="vertical"
              @mousedown.prevent="onMainDrawerResizeStart"
            >
              <span />
            </div>

            <header class="chat-attachment-drawer-header">
              <div class="chat-attachment-drawer-header-icon" aria-hidden="true">
                <ReferenceIcon name="file-text" :size="16" />
              </div>
              <div class="chat-attachment-drawer-header-title" :title="target?.fileName || ''">
                {{ target?.fileName || '' }}
              </div>
              <button type="button" class="chat-attachment-drawer-close" aria-label="Close" @click="close">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </header>

            <section v-if="target" class="chat-attachment-drawer-body">
              <DocumentPreview
                :session-id="target.sessionId"
                :attachment-id="target.attachmentId"
                :file-type="target.fileType"
                :file-name="target.fileName"
                :active="visible"
                fill-height
              />
            </section>
          </aside>
        </Transition>
      </div>
    </Transition>

    <div v-if="mainDrawerResizing" class="chat-attachment-drawer-resize-overlay" aria-hidden="true" />
  </Teleport>
</template>

<style scoped>
.chat-attachment-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
  background: rgb(0 0 0 / .16);
}

.chat-attachment-preview-panel {
  position: relative;
  height: 100%;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid rgb(229 231 235 / .85);
  background: #fff;
  box-shadow: -12px 0 32px rgb(0 0 0 / .08);
  color: #1f2937;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}

.chat-attachment-drawer-header {
  min-height: 58px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  box-sizing: border-box;
  background: #fdfdfd;
}

.chat-attachment-drawer-header-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #fff;
  color: #6b7280;
}

.chat-attachment-drawer-header-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
}

.chat-attachment-drawer-close {
  width: 26px;
  height: 26px;
  padding: 5px;
  border: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}
.chat-attachment-drawer-close:hover { background: #f3f4f6; color: #374151; }
.chat-attachment-drawer-close svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.chat-attachment-drawer-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
  overflow: hidden;
}

.chat-attachment-drawer-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  z-index: 3;
  width: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
}
.chat-attachment-drawer-resize-handle span {
  width: 2px;
  height: 48px;
  border-radius: 999px;
  background: #d1d5db;
  opacity: .55;
  transition: background-color 150ms ease, opacity 150ms ease;
}
.chat-attachment-drawer-resize-handle:hover span,
.chat-attachment-drawer-resize-handle.active span { background: #6b7280; opacity: 1; }

.chat-attachment-drawer-resize-overlay {
  position: fixed;
  inset: 0;
  z-index: 2002;
  cursor: col-resize;
}

.chat-attachment-preview-panel.is-resizing :deep(.document-preview),
.chat-attachment-preview-panel.is-resizing :deep(iframe),
.chat-attachment-preview-panel.is-resizing :deep(.pdf-iframe) {
  pointer-events: none;
  user-select: none;
}

.attachment-panel-fade-enter-active,
.attachment-panel-fade-leave-active { transition: opacity 180ms ease; }
.attachment-panel-fade-enter-from,
.attachment-panel-fade-leave-to { opacity: 0; }
.attachment-panel-slide-enter-active,
.attachment-panel-slide-leave-active { transition: transform 220ms cubic-bezier(.22,.61,.36,1); }
.attachment-panel-slide-enter-from,
.attachment-panel-slide-leave-to { transform: translateX(100%); }
</style>
