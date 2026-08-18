<template>
  <teleport to="body">
    <div
      v-if="drawerVisible && resizable"
      class="setting-drawer-resize-handle"
      :class="{ 'setting-drawer-resize-handle--active': drawerResizing }"
      :style="{ right: `${drawerWidthPx}px`, '--setting-drawer-travel': `${drawerWidthPx}px` }"
      role="separator"
      aria-orientation="vertical"
      @mousedown.prevent="onResizeStart"
    >
      <div class="setting-drawer-resize-line" />
    </div>
  </teleport>

  <t-drawer
    v-model:visible="drawerVisible"
    v-bind="drawerPassthroughAttrs"
    :size="effectiveWidth"
    :z-index="2500"
    placement="right"
    attach="body"
    destroy-on-close
    :footer="!hideFooter"
    :class="drawerClass"
    @before-close="blurActiveElementBeforeClose"
  >
    <template #header>
      <div class="setting-drawer__header">
        <div v-if="$slots.headerIcon || icon" class="setting-drawer__header-icon">
          <slot name="headerIcon">
            <t-icon v-if="icon" :name="icon" />
          </slot>
        </div>
        <div class="setting-drawer__header-text">
          <div class="setting-drawer__title">{{ title }}</div>
          <div v-if="description || $slots.subtitle" class="setting-drawer__subtitle">
            <slot name="subtitle">{{ description }}</slot>
          </div>
        </div>
      </div>
    </template>

    <div class="setting-drawer__body">
      <slot />
    </div>

    <template v-if="!hideFooter" #footer>
      <div class="setting-drawer__footer">
        <div class="setting-drawer__footer-left">
          <slot name="footer-left" />
        </div>
        <div class="setting-drawer__footer-right">
          <slot name="footer-right">
            <t-button theme="default" variant="outline" @click="handleCancel">
              {{ cancelText || t('common.cancel') }}
            </t-button>
            <t-button
              theme="primary"
              :loading="confirmLoading"
              :disabled="confirmDisabled"
              @click="handleConfirm"
            >
              {{ confirmText || t('common.save') }}
            </t-button>
          </slot>
        </div>
      </div>
    </template>
  </t-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  visible: boolean
  title: string
  description?: string
  icon?: string
  width?: string
  resizable?: boolean
  minWidth?: number
  maxWidth?: number
  storageKey?: string
  confirmLoading?: boolean
  confirmDisabled?: boolean
  confirmText?: string
  cancelText?: string
  hideFooter?: boolean
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<Props>(), {
  description: '',
  icon: '',
  width: '560px',
  resizable: true,
  minWidth: 480,
  maxWidth: 1200,
  storageKey: '',
  confirmLoading: false,
  confirmDisabled: false,
  confirmText: '',
  cancelText: '',
  hideFooter: false,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const attrs = useAttrs()

const drawerPassthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const resolvedStorageKey = computed(
  () => props.storageKey || `setting-drawer:width:${props.title || 'default'}`,
)

const clampWidth = (n: number) =>
  Math.max(props.minWidth, Math.min(props.maxWidth, Math.round(n)))

const parseWidthToPx = (width: string) => {
  const n = parseInt(width, 10)
  return Number.isFinite(n) ? n : 560
}

const loadStoredWidth = (): number | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(resolvedStorageKey.value)
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return clampWidth(n)
  } catch {
    return null
  }
}

const userWidthPx = ref<number | null>(loadStoredWidth())
const effectiveWidth = computed(() =>
  userWidthPx.value != null ? `${userWidthPx.value}px` : props.width,
)
const drawerWidthPx = computed(() =>
  userWidthPx.value ?? parseWidthToPx(props.width),
)

const persistWidth = (width: number) => {
  const next = clampWidth(width)
  userWidthPx.value = next
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(resolvedStorageKey.value, String(next))
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

const drawerResizing = ref(false)
const drawerClass = computed(() => [
  'setting-drawer',
  attrs.class,
  { 'setting-drawer--resizing': drawerResizing.value },
])

let resizeStartX = 0
let resizeStartWidth = 0

function onResizeStart(e: MouseEvent) {
  drawerResizing.value = true
  resizeStartX = e.clientX
  resizeStartWidth = drawerWidthPx.value
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  const delta = resizeStartX - e.clientX
  userWidthPx.value = clampWidth(resizeStartWidth + delta)
}

function onResizeEnd() {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  drawerResizing.value = false
  persistWidth(drawerWidthPx.value)
}

function cleanupResize() {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  drawerResizing.value = false
}

function onWindowResize() {
  if (userWidthPx.value != null) {
    userWidthPx.value = clampWidth(userWidthPx.value)
  }
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  cleanupResize()
})

function blurActiveElementBeforeClose() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

const handleConfirm = () => emit('confirm')
const handleCancel = () => {
  blurActiveElementBeforeClose()
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.setting-drawer__header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.setting-drawer__header-icon {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
}
.setting-drawer__header-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.setting-drawer__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
}
.setting-drawer__subtitle { color: #9ca3af; font-size: 10px; line-height: 15px; }
.setting-drawer__body { display: flex; flex-direction: column; gap: 8px; }
.setting-drawer__footer { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.setting-drawer__footer-left { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.setting-drawer__footer-right { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
</style>

<style>
.setting-drawer { max-width: 100vw; font-family: var(--app-font-family); }
.setting-drawer-resize-handle {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px;
  z-index: 2501;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  animation: setting-drawer-resize-handle-in .28s cubic-bezier(.38,0,.24,1) both;
}
@keyframes setting-drawer-resize-handle-in {
  from { transform: translateX(var(--setting-drawer-travel)); }
  to { transform: translateX(0); }
}
.setting-drawer-resize-line {
  width: 2px;
  height: 48px;
  border-radius: 1px;
  background: #d1d5db;
  opacity: .55;
}
.setting-drawer-resize-handle:hover .setting-drawer-resize-line,
.setting-drawer-resize-handle--active .setting-drawer-resize-line {
  opacity: 1;
  background: #6b7280;
}
.t-drawer.setting-drawer--resizing .t-drawer__content { transition: none !important; }
</style>
