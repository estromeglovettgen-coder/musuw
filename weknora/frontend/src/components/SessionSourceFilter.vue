<template>
  <div class="session-source-filter" :class="{
    'session-source-filter--inline': inline,
    'session-source-filter--emphasized': emphasized,
  }">
    <button
      ref="triggerRef"
      type="button"
      class="session-source-filter__trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggleOpen"
    >
      <span class="session-source-filter__leading">
        <img
          v-if="currentOption?.logo"
          :src="currentOption.logo"
          :alt="currentOption.label"
          class="session-source-filter__logo"
        />
        <ReferenceIcon v-else :name="iconFor(currentOption)" :size="inline ? 12 : 14" class="session-source-filter__icon" />
        <span class="session-source-filter__label" :title="currentOption?.label">{{ currentOption?.label }}</span>
      </span>
      <ReferenceIcon
        name="chevron-down"
        :size="inline ? 10 : 12"
        class="session-source-filter__chevron"
        :class="{ 'session-source-filter__chevron--open': open }"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="session-source-filter__panel"
        role="listbox"
        :style="panelStyle"
        @click.stop
      >
        <button
          v-for="item in sources"
          :key="item.value"
          type="button"
          class="session-source-filter__option"
          :class="{ 'session-source-filter__option--active': item.value === current }"
          role="option"
          :aria-selected="item.value === current"
          @click="handleSelect(item.value)"
        >
          <span class="session-source-filter__option-leading">
            <img v-if="item.logo" :src="item.logo" :alt="item.label" class="session-source-filter__logo" />
            <ReferenceIcon v-else :name="iconFor(item)" :size="14" class="session-source-filter__icon" />
            <span class="session-source-filter__option-label" :title="item.label">{{ item.label }}</span>
          </span>
          <ReferenceIcon
            v-if="item.value === current"
            name="check-circle-2"
            :size="12"
            class="session-source-filter__check"
          />
          <span v-else class="session-source-filter__check-placeholder" aria-hidden="true" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { DEFAULT_SESSION_BUCKET_KEY } from './sessionSidebarSourceFilter'

interface SourceItem {
  value: string
  label: string
  logo?: string
}

type SourceIconName = 'message-square-plus' | 'globe' | 'file-code' | 'arrow-right-left'

const props = defineProps<{
  sources: SourceItem[]
  current: string
  inline?: boolean
  emphasized?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', value: string): void
}>()

const PANEL_GAP = 4
const VIEWPORT_MARGIN = 8

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const currentOption = computed(() =>
  props.sources.find((item) => item.value === props.current) ?? props.sources[0],
)

const iconFor = (item: SourceItem | undefined): SourceIconName => {
  if (!item || item.value === DEFAULT_SESSION_BUCKET_KEY) return 'message-square-plus'
  if (item.value === 'api') return 'globe'
  if (item.value.startsWith('embed:')) return 'file-code'
  return 'arrow-right-left'
}

const updatePanelPosition = (): void => {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  if (props.inline) {
    panelStyle.value = {
      top: `${rect.bottom + PANEL_GAP}px`,
      right: `${Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right)}px`,
      left: 'auto',
    }
    return
  }
  const panelWidth = Math.min(Math.max(rect.width, 108), window.innerWidth - VIEWPORT_MARGIN * 2)
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - panelWidth - VIEWPORT_MARGIN))
  panelStyle.value = {
    top: `${rect.bottom + PANEL_GAP}px`,
    left: `${left}px`,
    right: 'auto',
    minWidth: `${panelWidth}px`,
  }
}

const removeListeners = (): void => {
  document.removeEventListener('click', close)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', close, true)
}
const close = (): void => {
  open.value = false
  removeListeners()
}
const toggleOpen = (): void => {
  if (open.value) {
    close()
    return
  }
  updatePanelPosition()
  open.value = true
  nextTick(() => {
    document.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
  })
}
const handleSelect = (value: string): void => {
  close()
  if (value === props.current) return
  emit('select', value)
}
onBeforeUnmount(removeListeners)
</script>

<style scoped>
.session-source-filter {
  padding: 2px 0 6px;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.session-source-filter--inline { padding: 0; min-width: 0; max-width: 100%; }
.session-source-filter__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 4px 10px 4px 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}
.session-source-filter__trigger:hover,
.session-source-filter__trigger[aria-expanded='true'] { background: #f3f4f6; color: #374151; }
.session-source-filter--inline .session-source-filter__trigger {
  width: auto;
  max-width: 100%;
  min-height: 0;
  gap: 3px;
  padding: 0;
  border-radius: 0;
  color: #9ca3af;
  justify-content: flex-end;
}
.session-source-filter--inline .session-source-filter__trigger:hover,
.session-source-filter--inline .session-source-filter__trigger[aria-expanded='true'] { background: transparent; color: #6b7280; }
.session-source-filter__leading,
.session-source-filter__option-leading { display: inline-flex; align-items: center; gap: 5px; min-width: 0; flex: 1 1 auto; }
.session-source-filter__label,
.session-source-filter__option-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 600; line-height: 16px; }
.session-source-filter__logo { flex: 0 0 auto; width: 14px; height: 14px; object-fit: contain; opacity: .82; }
.session-source-filter--inline .session-source-filter__logo { width: 12px; height: 12px; opacity: .7; }
.session-source-filter__icon { flex: 0 0 auto; color: #9ca3af; }
.session-source-filter__chevron { flex: 0 0 auto; color: #9ca3af; transition: transform 180ms ease; }
.session-source-filter__chevron--open { transform: rotate(180deg); }
.session-source-filter__panel {
  position: fixed;
  z-index: 4900;
  width: max-content;
  min-width: 118px;
  max-width: min(220px, calc(100vw - 16px));
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 16px 30px rgb(0 0 0 / .10);
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.session-source-filter__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 4px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  white-space: nowrap;
}
.session-source-filter__option:hover { background: #f3f4f6; color: #111827; }
.session-source-filter__option--active { background: #f9fafb; color: #111827; }
.session-source-filter__option-label { font-size: 11px; font-weight: 500; }
.session-source-filter__check,
.session-source-filter__check-placeholder { flex: 0 0 12px; width: 12px; margin-left: 2px; color: #9ca3af; }
</style>
