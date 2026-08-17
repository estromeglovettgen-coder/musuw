<template>
  <div v-if="visible" class="kb-overlay" @click="close">
    <div class="kb-dropdown" @click.stop @wheel.stop :style="dropdownStyle">
      <div class="kb-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          :placeholder="$t('knowledgeBase.searchPlaceholder')"
          class="kb-search-input"
          @keydown.down.prevent="moveSelection(1)"
          @keydown.up.prevent="moveSelection(-1)"
          @keydown.enter.prevent="toggleSelection"
          @keydown.esc="close"
        />
      </div>

      <div class="kb-list" ref="kbList" @wheel.stop>
        <button
          v-for="(kb, index) in filteredKnowledgeBases"
          :key="kb.id"
          type="button"
          :class="['kb-item', { selected: isSelected(kb.id), highlighted: highlightedIndex === index }]"
          @click="toggleKb(kb.id)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="checkbox" :class="{ checked: isSelected(kb.id) }" aria-hidden="true">
            <svg v-if="isSelected(kb.id)" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>
          </span>
          <span class="kb-icon" :class="{ faq: kb.type === 'faq' }" aria-hidden="true">
            <svg v-if="kb.type === 'faq'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4"/><path d="M12 18h.01"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
          </span>
          <span class="kb-name" :title="kb.name">{{ kb.name }}</span>
          <span class="kb-docs">{{ kb.type === 'faq' ? (kb.chunk_count || 0) : (kb.knowledge_count || 0) }}</span>
        </button>

        <div v-if="filteredKnowledgeBases.length === 0" class="kb-empty">
          {{ searchQuery ? $t('knowledgeBase.noMatch') : $t('knowledgeBase.noKnowledge') }}
        </div>
      </div>

      <div class="kb-actions">
        <button type="button" @click="selectAll">{{ $t('common.selectAll') }}</button>
        <button type="button" @click="clearAll">{{ $t('common.clear') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { listKnowledgeBases } from '@/api/knowledge-base'
import { useI18n } from 'vue-i18n'
import { getRootZoom, rectToCssPx, cssViewportSize } from '@/utils/zoom'

interface KnowledgeBase {
  id: string
  name: string
  type?: 'document' | 'faq'
  knowledge_count?: number
  chunk_count?: number
  embedding_model_id?: string
  summary_model_id?: string
}

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  anchorEl?: any | null
  dropdownWidth?: number
  offsetY?: number
}>()

const emit = defineEmits(['close', 'update:visible'])
const settingsStore = useSettingsStore()
const searchQuery = ref('')
const highlightedIndex = ref(0)
const knowledgeBases = ref<KnowledgeBase[]>([])
const searchInput = ref<HTMLInputElement | null>(null)
const kbList = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
const dropdownWidth = props.dropdownWidth ?? 300
const offsetY = props.offsetY ?? 8

const filteredKnowledgeBases = computed(() => {
  const valid = knowledgeBases.value.filter(k => k.embedding_model_id && k.summary_model_id)
  if (!searchQuery.value) return valid
  const q = searchQuery.value.toLowerCase()
  return valid.filter(k => k.name.toLowerCase().includes(q))
})

const selectedKbIds = computed(() => settingsStore.settings.selectedKnowledgeBases || [])

const resolveAnchorEl = () => {
  const a = props.anchorEl
  if (!a) return null
  if (typeof a === 'object' && 'value' in a) return a.value ?? null
  if (typeof a === 'object' && '$el' in a) return a.$el ?? null
  return a
}

const isSelected = (id: string) => selectedKbIds.value.includes(id)
const toggleKb = (id: string) => {
  isSelected(id) ? settingsStore.removeKnowledgeBase(id) : settingsStore.addKnowledgeBase(id)
}

const toggleSelection = () => {
  const kb = filteredKnowledgeBases.value[highlightedIndex.value]
  if (kb) toggleKb(kb.id)
}

const moveSelection = (dir: number) => {
  const max = filteredKnowledgeBases.value.length
  if (max === 0) return
  highlightedIndex.value = Math.max(0, Math.min(max - 1, highlightedIndex.value + dir))
  nextTick(() => {
    const items = kbList.value?.querySelectorAll('.kb-item')
    items?.[highlightedIndex.value]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

const selectAll = () => settingsStore.selectKnowledgeBases(filteredKnowledgeBases.value.map(k => k.id))
const clearAll = () => settingsStore.clearKnowledgeBases()

const close = () => {
  emit('update:visible', false)
  emit('close')
}

const loadKnowledgeBases = async () => {
  try {
    const res: any = await listKnowledgeBases()
    if (res?.data && Array.isArray(res.data)) knowledgeBases.value = res.data
  } catch (e) {
    console.error(t('knowledgeBase.loadingFailed'), e)
  }
}

const updateDropdownPosition = () => {
  const anchor = resolveAnchorEl()
  const zoom = getRootZoom()
  const { width: vwFallback, height: vhFallback } = cssViewportSize(zoom)

  const applyFallback = () => {
    const topFallback = Math.max(80, vhFallback / 2 - 160)
    dropdownStyle.value = {
      position: 'fixed', width: `${dropdownWidth}px`, left: `${Math.round((vwFallback - dropdownWidth) / 2)}px`,
      top: `${Math.round(topFallback)}px`, transform: 'none', margin: '0', padding: '0',
    }
  }

  if (!anchor) { applyFallback(); return }

  let rawRect: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null = null
  try {
    if (typeof anchor.getBoundingClientRect === 'function') {
      const r = anchor.getBoundingClientRect()
      rawRect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    } else if (anchor.width !== undefined && anchor.left !== undefined) {
      rawRect = anchor as DOMRect
    }
  } catch (e) {
    console.error('[KnowledgeBaseSelector] Error getting bounding rect:', e)
  }

  if (!rawRect || rawRect.width === 0 || rawRect.height === 0) { applyFallback(); return }

  const rect = rectToCssPx(rawRect, zoom)
  const vw = vwFallback
  const vh = vhFallback
  let left = Math.floor(rect.left)
  left = Math.max(16, Math.min(Math.max(16, vw - dropdownWidth - 16), left))

  const preferredDropdownHeight = 280
  const minDropdownHeight = 200
  const spaceBelow = vh - rect.bottom
  const spaceAbove = rect.top
  let actualHeight: number
  let shouldOpenBelow: boolean

  if (spaceBelow >= minDropdownHeight + offsetY) {
    actualHeight = Math.min(preferredDropdownHeight, spaceBelow - offsetY - 16)
    shouldOpenBelow = true
  } else {
    const availableHeight = spaceAbove - offsetY - 20
    actualHeight = availableHeight >= preferredDropdownHeight ? preferredDropdownHeight : Math.max(minDropdownHeight, availableHeight)
    shouldOpenBelow = false
  }

  dropdownStyle.value = shouldOpenBelow
    ? { position: 'fixed', width: `${dropdownWidth}px`, left: `${left}px`, top: `${Math.floor(rect.bottom + offsetY)}px`, maxHeight: `${actualHeight}px`, transform: 'none', margin: '0', padding: '0' }
    : { position: 'fixed', width: `${dropdownWidth}px`, left: `${left}px`, bottom: `${vh - rect.top + offsetY}px`, maxHeight: `${actualHeight}px`, transform: 'none', margin: '0', padding: '0' }
}

let resizeHandler: (() => void) | null = null
let scrollHandler: (() => void) | null = null

watch(() => props.visible, async (v) => {
  if (v) {
    await loadKnowledgeBases()
    await nextTick()
    requestAnimationFrame(() => {
      updateDropdownPosition()
      requestAnimationFrame(() => {
        updateDropdownPosition()
        setTimeout(() => updateDropdownPosition(), 50)
      })
    })
    nextTick(() => searchInput.value?.focus())
    resizeHandler = () => updateDropdownPosition()
    scrollHandler = () => updateDropdownPosition()
    window.addEventListener('resize', resizeHandler, { passive: true })
    window.addEventListener('scroll', scrollHandler, { passive: true, capture: true })
  } else {
    searchQuery.value = ''
    highlightedIndex.value = 0
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null }
    if (scrollHandler) { window.removeEventListener('scroll', scrollHandler, { capture: true }); scrollHandler = null }
  }
})
</script>

<style scoped>
.kb-overlay, .kb-overlay *, .kb-overlay *::before, .kb-overlay *::after { box-sizing: border-box; }
.kb-overlay { position: fixed; inset: 0; z-index: 3000; background: transparent; font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif; }
.kb-dropdown { z-index: 3001; display: flex; flex-direction: column; min-height: 180px; overflow: hidden; border: 1px solid rgb(229 231 235 / .9); border-radius: 14px; background: #fff; box-shadow: 0 16px 32px -10px rgb(0 0 0 / .16), 0 4px 10px rgb(0 0 0 / .06); color: #1f2937; }
.kb-search { margin: 8px 8px 6px; height: 32px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb; color: #9ca3af; }
.kb-search svg, .kb-icon svg, .checkbox svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.kb-search svg { width: 14px; height: 14px; flex: 0 0 14px; }
.kb-search-input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #374151; font: inherit; font-size: 12px; }
.kb-search-input::placeholder { color: #9ca3af; }
.kb-list { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 6px 6px; }
.kb-item { width: 100%; min-height: 34px; padding: 5px 8px; border: 0; border-radius: 9px; display: flex; align-items: center; gap: 8px; background: transparent; color: #4b5563; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.kb-item:hover, .kb-item.highlighted { background: #f9fafb; color: #111827; }
.kb-item.selected { color: #111827; }
.checkbox { width: 15px; height: 15px; flex: 0 0 15px; display: grid; place-items: center; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; color: #fff; }
.checkbox.checked { border-color: #111827; background: #111827; }
.checkbox svg { width: 11px; height: 11px; stroke-width: 2.5; }
.kb-icon { width: 24px; height: 24px; flex: 0 0 24px; display: grid; place-items: center; border-radius: 7px; background: #f3f4f6; color: #6b7280; }
.kb-icon.faq { color: #7c3aed; background: #f5f3ff; }
.kb-icon svg { width: 14px; height: 14px; }
.kb-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.kb-docs { flex: 0 0 auto; color: #9ca3af; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace; font-size: 10px; }
.kb-empty { padding: 28px 12px; text-align: center; color: #9ca3af; font-size: 11px; }
.kb-actions { min-height: 42px; padding: 6px 8px; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
.kb-actions button { height: 28px; padding: 0 9px; border: 0; border-radius: 8px; background: transparent; color: #6b7280; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.kb-actions button:hover { background: #f3f4f6; color: #111827; }
</style>
