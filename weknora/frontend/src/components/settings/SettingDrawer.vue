<template>
  <teleport to="body">
    <div
      v-if="drawerVisible"
      class="reference-setting-drawer-backdrop"
      @mousedown.self="handleOverlayClose"
    >
      <aside
        ref="drawerElement"
        v-bind="drawerPassthroughAttrs"
        :class="drawerClass"
        :style="{ width: effectiveWidth }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <button
          v-if="resizable"
          type="button"
          class="reference-setting-drawer__resize"
          :class="{ active: drawerResizing }"
          aria-label="Resize drawer"
          @mousedown.prevent="onResizeStart"
        >
          <span />
        </button>

        <header class="reference-setting-drawer__header">
          <div v-if="$slots.headerIcon || icon" class="reference-setting-drawer__header-icon" aria-hidden="true">
            <slot name="headerIcon">
              <svg v-if="icon === 'chat'" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>
              <svg v-else-if="icon === 'chart-bubble'" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="m7.7 7 3.2 8"/><path d="m16.3 7-3.2 8"/><path d="M8 6h8"/></svg>
              <svg v-else-if="icon === 'filter-sort'" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M6 12h12"/><path d="M10 18h4"/></svg>
              <svg v-else-if="icon === 'image'" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-3 0l-6 6"/></svg>
              <svg v-else-if="icon === 'sound'" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
              <svg v-else viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.62.62 1.1 1.56 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>
            </slot>
          </div>

          <div class="reference-setting-drawer__header-copy">
            <h3>{{ title }}</h3>
            <p v-if="description || $slots.subtitle"><slot name="subtitle">{{ description }}</slot></p>
          </div>

          <button type="button" class="reference-setting-drawer__close" :aria-label="t('common.close')" @click="handleOverlayClose">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </header>

        <div class="reference-setting-drawer__body"><slot /></div>

        <footer v-if="!hideFooter" class="reference-setting-drawer__footer">
          <div class="reference-setting-drawer__footer-left"><slot name="footer-left" /></div>
          <div class="reference-setting-drawer__footer-right">
            <slot name="footer-right">
              <button type="button" class="reference-setting-drawer__secondary" @click="handleCancel">{{ cancelText || t('common.cancel') }}</button>
              <button type="button" class="reference-setting-drawer__primary" :disabled="confirmDisabled || confirmLoading" @click="handleConfirm">
                <svg v-if="confirmLoading" class="reference-setting-drawer__spinner" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>
                {{ confirmText || t('common.save') }}
              </button>
            </slot>
          </div>
        </footer>
      </aside>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, useAttrs, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
  description: '', icon: '', width: '560px', resizable: true, minWidth: 480, maxWidth: 1200,
  storageKey: '', confirmLoading: false, confirmDisabled: false, confirmText: '', cancelText: '', hideFooter: false
})
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'confirm'): void; (e: 'cancel'): void }>()
const { t } = useI18n()
const attrs = useAttrs()
const drawerPassthroughAttrs = computed(() => { const { class: _class, ...rest } = attrs; return rest })
const drawerVisible = computed({ get: () => props.visible, set: (val) => emit('update:visible', val) })
const drawerElement = ref<HTMLElement | null>(null)
const resolvedStorageKey = computed(() => props.storageKey || `setting-drawer:width:${props.title || 'default'}`)
const clampWidth = (n: number) => Math.max(props.minWidth, Math.min(props.maxWidth, Math.round(n)))
const parseWidthToPx = (width: string) => { const n = parseInt(width, 10); return Number.isFinite(n) ? n : 560 }
const loadStoredWidth = (): number | null => {
  if (typeof window === 'undefined') return null
  try { const raw = window.localStorage.getItem(resolvedStorageKey.value); if (!raw) return null; const n = Number(raw); return Number.isFinite(n) ? clampWidth(n) : null } catch { return null }
}
const userWidthPx = ref<number | null>(loadStoredWidth())
const effectiveWidth = computed(() => userWidthPx.value != null ? `${userWidthPx.value}px` : props.width)
const drawerWidthPx = computed(() => userWidthPx.value ?? parseWidthToPx(props.width))
const persistWidth = (width: number) => { const next = clampWidth(width); userWidthPx.value = next; if (typeof window === 'undefined') return; try { window.localStorage.setItem(resolvedStorageKey.value, String(next)) } catch { /* ignore */ } }
const drawerResizing = ref(false)
const drawerClass = computed(() => ['reference-setting-drawer', attrs.class, { 'reference-setting-drawer--resizing': drawerResizing.value }])
let resizeStartX = 0
let resizeStartWidth = 0
let previouslyFocused: HTMLElement | null = null
let previousBodyOverflow = ''

function onResizeStart(e: MouseEvent) { drawerResizing.value = true; resizeStartX = e.clientX; resizeStartWidth = drawerWidthPx.value; document.addEventListener('mousemove', onResizeMove); document.addEventListener('mouseup', onResizeEnd); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }
function onResizeMove(e: MouseEvent) { userWidthPx.value = clampWidth(resizeStartWidth + (resizeStartX - e.clientX)) }
function onResizeEnd() { document.removeEventListener('mousemove', onResizeMove); document.removeEventListener('mouseup', onResizeEnd); document.body.style.cursor = ''; document.body.style.userSelect = ''; drawerResizing.value = false; persistWidth(drawerWidthPx.value) }
function cleanupResize() { document.removeEventListener('mousemove', onResizeMove); document.removeEventListener('mouseup', onResizeEnd); document.body.style.cursor = ''; document.body.style.userSelect = ''; drawerResizing.value = false }
function onWindowResize() { if (userWidthPx.value != null) userWidthPx.value = clampWidth(userWidthPx.value) }
function blurActiveElementBeforeClose() { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() }
const handleOverlayClose = () => { blurActiveElementBeforeClose(); emit('update:visible', false) }
const handleConfirm = () => emit('confirm')
const handleCancel = () => { blurActiveElementBeforeClose(); emit('cancel'); emit('update:visible', false) }

function getFocusableElements(): HTMLElement[] {
  if (!drawerElement.value) return []
  return Array.from(drawerElement.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter(el => !el.hasAttribute('aria-hidden') && el.getAttribute('aria-disabled') !== 'true')
}

function handleDrawerKeydown(event: KeyboardEvent) {
  if (!drawerVisible.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    handleOverlayClose()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = getFocusableElements()
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(drawerVisible, async (visible) => {
  if (typeof document === 'undefined') return
  if (visible) {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    getFocusableElements()[0]?.focus({ preventScroll: true })
  } else {
    document.body.style.overflow = previousBodyOverflow
    previouslyFocused?.focus({ preventScroll: true })
    previouslyFocused = null
  }
})

onMounted(() => {
  window.addEventListener('resize', onWindowResize, { passive: true })
  window.addEventListener('keydown', handleDrawerKeydown)
})
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', handleDrawerKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = previousBodyOverflow
  cleanupResize()
})
</script>

<style scoped>
.reference-setting-drawer-backdrop{position:fixed;inset:0;z-index:2500;display:flex;justify-content:flex-end;background:rgb(17 24 39 / 22%);backdrop-filter:blur(1px);font-family:"Inter Variable",Inter,"Noto Sans SC Variable","Noto Sans SC",ui-sans-serif,system-ui,sans-serif}
.reference-setting-drawer{position:relative;height:100%;max-width:100vw;display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#111827;border-left:1px solid #e5e7eb;box-shadow:-20px 0 45px rgb(0 0 0 / 10%);animation:reference-setting-drawer-in 180ms cubic-bezier(.2,.8,.2,1) both}
@keyframes reference-setting-drawer-in{from{transform:translateX(28px);opacity:.8}to{transform:none;opacity:1}}
.reference-setting-drawer--resizing{transition:none;animation:none}
.reference-setting-drawer__resize{position:absolute;top:0;bottom:0;left:0;z-index:3;width:12px;transform:translateX(-50%);padding:0;border:0;background:transparent;cursor:col-resize;display:flex;align-items:center;justify-content:center}
.reference-setting-drawer__resize span{width:2px;height:44px;border-radius:2px;background:#d1d5db;opacity:.55}.reference-setting-drawer__resize:hover span,.reference-setting-drawer__resize.active span{background:#6b7280;opacity:1}
.reference-setting-drawer__header{min-height:67px;flex:0 0 auto;display:flex;align-items:center;gap:11px;padding:13px 16px 13px 20px;border-bottom:1px solid #f3f4f6;box-sizing:border-box}
.reference-setting-drawer__header-icon{width:32px;height:32px;flex:0 0 32px;display:grid;place-items:center;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#4b5563}.reference-setting-drawer__header-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.reference-setting-drawer__header-copy{min-width:0;flex:1}.reference-setting-drawer__header-copy h3{margin:0;color:#111827;font-size:13px;line-height:18px;font-weight:700}.reference-setting-drawer__header-copy p{margin:2px 0 0;color:#9ca3af;font-size:10px;line-height:15px}
.reference-setting-drawer__close{width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;padding:0;border:0;border-radius:9px;background:transparent;color:#9ca3af;cursor:pointer}.reference-setting-drawer__close:hover{background:#f3f4f6;color:#374151}.reference-setting-drawer__close svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.reference-setting-drawer__body{min-height:0;flex:1;overflow:auto;padding:18px 20px 24px}.reference-setting-drawer__body :deep(.setting-drawer__section){padding:0 0 20px;margin:0 0 20px;border-bottom:1px solid #f3f4f6;display:flex;flex-direction:column;gap:14px}.reference-setting-drawer__body :deep(.setting-drawer__section:last-child){margin-bottom:0;padding-bottom:0;border-bottom:0}.reference-setting-drawer__body :deep(.setting-drawer__section-title){margin:0;color:#374151;font-size:10px;line-height:14px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.reference-setting-drawer__footer{min-height:62px;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-top:1px solid #f3f4f6;background:rgb(249 250 251 / 55%);box-sizing:border-box}.reference-setting-drawer__footer-left{min-width:0;flex:1;display:flex;align-items:center;gap:8px}.reference-setting-drawer__footer-right{display:flex;align-items:center;gap:8px}
.reference-setting-drawer__secondary,.reference-setting-drawer__primary{height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 13px;border-radius:10px;font-size:11px;line-height:15px;font-weight:700;cursor:pointer}.reference-setting-drawer__secondary{border:1px solid #e5e7eb;background:#fff;color:#4b5563}.reference-setting-drawer__secondary:hover{border-color:#d1d5db;color:#111827}.reference-setting-drawer__primary{border:1px solid #111827;background:#111827;color:#fff}.reference-setting-drawer__primary:hover:not(:disabled){background:#000}.reference-setting-drawer__primary:disabled{opacity:.45;cursor:not-allowed}.reference-setting-drawer__spinner{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;animation:reference-setting-spin .8s linear infinite}@keyframes reference-setting-spin{to{transform:rotate(360deg)}}
@media(max-width:560px){.reference-setting-drawer{width:100vw!important}.reference-setting-drawer__body{padding:16px}.reference-setting-drawer__footer{padding-inline:16px}}
</style>
