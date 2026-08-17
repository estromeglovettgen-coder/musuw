<template>
  <div
    :class="[
      'submenu_item',
      !batchMode && activePath === item.path ? 'submenu_item_active' : '',
      batchMode && selectedIds.includes(item.id) ? 'submenu_item_selected' : '',
      batchMode ? 'submenu_item_batch' : '',
    ]"
    @mouseenter="emit('hover-in')"
    @mouseleave="emit('hover-out')"
    @click="batchMode ? emit('toggle-select') : emit('navigate')"
  >
    <label v-if="batchMode" class="reference-session-checkbox" @click.stop>
      <input
        type="checkbox"
        :checked="selectedIds.includes(item.id)"
        @change="emit('toggle-select')"
      />
      <span aria-hidden="true">
        <ReferenceIcon v-if="selectedIds.includes(item.id)" name="check-square" :size="13" />
      </span>
    </label>

    <form v-if="titleEditing" class="session-title-edit" @submit.prevent="submitTitleEdit" @click.stop>
      <input
        ref="titleInputRef"
        v-model="titleDraft"
        class="session-title-edit__input"
        :maxlength="SESSION_TITLE_MAX_LENGTH"
        @keydown.esc.prevent="cancelTitleEdit"
        @blur="submitTitleEdit"
      />
    </form>

    <span v-else class="submenu_title" :class="batchMode ? 'submenu_title--batch' : ''" :title="item.title">
      <ReferenceIcon v-if="item.is_pinned" name="pin" :size="11" class="submenu_pin_icon reference-session-pin" />
      <span class="submenu_title-text">{{ item.title }}</span>
    </span>

    <div v-if="!batchMode" class="session-row-menu-wrap" @click.stop>
      <button
        ref="menuButtonRef"
        type="button"
        class="reference-session-more"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click.stop="toggleMenu"
      >
        <ReferenceIcon name="more-horizontal" :size="14" />
      </button>

      <Teleport to="body">
        <template v-if="menuOpen">
          <div class="reference-session-backdrop" @click="closeMenu" />
          <div
            ref="menuPanelRef"
            class="reference-session-menu"
            :class="{ confirm: menuMode !== 'menu' }"
            :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
            @click.stop
          >
            <template v-if="menuMode === 'menu'">
              <template v-for="(option, index) in menuOptions" :key="option.value">
                <div v-if="shouldShowDividerBefore(option.value, index)" class="reference-session-menu__divider" />
                <button
                  type="button"
                  class="reference-session-menu__item"
                  :class="{ danger: option.theme === 'error' }"
                  @click="handleMenuClick(option)"
                >
                  <ReferenceIcon :name="optionIcon(option.value)" :size="14" class="reference-session-menu__icon" />
                  <span>{{ option.content }}</span>
                </button>
              </template>
            </template>

            <div v-else class="reference-session-confirm">
              <strong>
                {{ menuMode === 'clear' ? t('chatHeader.clearConfirmTitle') : t('chatHeader.deleteConfirmTitle') }}
              </strong>
              <p>
                {{ menuMode === 'clear' ? t('chatHeader.clearConfirmBody') : t('chatHeader.deleteConfirmBody') }}
              </p>
              <div>
                <button type="button" @click="backToMenu">{{ t('common.cancel') }}</button>
                <button type="button" class="danger" @click="confirmDangerAction">
                  {{ menuMode === 'clear' ? t('common.clear') : t('common.delete') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { normalizeSessionTitleDraft, SESSION_TITLE_MAX_LENGTH } from './sessionTitleEdit'

interface SessionMenuOption {
  content: string
  value: string
  theme?: 'default' | 'success' | 'warning' | 'error' | 'primary'
  prefixIcon?: any
}

type MenuMode = 'menu' | 'clear' | 'delete'
type SessionIconName = 'pin' | 'pin-off' | 'edit-3' | 'eraser' | 'check-square' | 'trash-2' | 'more-horizontal'

defineProps<{
  item: { id: string; path: string; title: string; is_pinned?: boolean }
  batchMode: boolean
  activePath: string
  selectedIds: string[]
  menuOptions: SessionMenuOption[]
  nested?: boolean
}>()

const emit = defineEmits<{
  (e: 'navigate'): void
  (e: 'toggle-select'): void
  (e: 'menu-click', data: { value: string }): void
  (e: 'rename-submit', data: { title: string }): void
  (e: 'hover-in'): void
  (e: 'hover-out'): void
}>()

const { t } = useI18n()
const menuOpen = ref(false)
const menuMode = ref<MenuMode>('menu')
const titleEditing = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)
const menuButtonRef = ref<HTMLButtonElement | null>(null)
const menuPanelRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ x: 0, y: 0 })

const optionIcon = (value: string): SessionIconName => {
  if (value === 'pin') return 'pin'
  if (value === 'unpin') return 'pin-off'
  if (value === 'rename') return 'edit-3'
  if (value === 'clearMessages') return 'eraser'
  if (value === 'batchManage') return 'check-square'
  if (value === 'delete') return 'trash-2'
  return 'more-horizontal'
}

const positionMenu = async () => {
  await nextTick()
  const trigger = menuButtonRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const panelWidth = menuMode.value === 'menu' ? 176 : 260
  const estimatedHeight = menuMode.value === 'menu' ? Math.max(44, menuOptions.length * 34 + 12) : 142
  let x = rect.right - panelWidth
  let y = rect.bottom + 4
  if (x < 8) x = 8
  if (x + panelWidth > window.innerWidth - 8) x = window.innerWidth - panelWidth - 8
  if (y + estimatedHeight > window.innerHeight - 8) y = Math.max(8, rect.top - estimatedHeight - 4)
  menuPosition.value = { x, y }
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
  menuMode.value = 'menu'
  if (menuOpen.value) void positionMenu()
}
const closeMenu = () => {
  menuOpen.value = false
  menuMode.value = 'menu'
}
const backToMenu = () => {
  menuMode.value = 'menu'
  void positionMenu()
}
const shouldShowDividerBefore = (value: string, index: number): boolean =>
  index > 0 && (value === 'clearMessages' || value === 'delete')

const startTitleEdit = () => {
  closeMenu()
  titleDraft.value = props.item.title || ''
  titleEditing.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

const props = defineProps<{
  item: { id: string; path: string; title: string; is_pinned?: boolean }
  batchMode: boolean
  activePath: string
  selectedIds: string[]
  menuOptions: SessionMenuOption[]
  nested?: boolean
}>()

const cancelTitleEdit = () => {
  titleEditing.value = false
  titleDraft.value = ''
}
const submitTitleEdit = () => {
  if (!titleEditing.value) return
  const nextTitle = normalizeSessionTitleDraft(titleDraft.value)
  const currentTitle = normalizeSessionTitleDraft(props.item.title || '')
  titleEditing.value = false
  titleDraft.value = ''
  if (!nextTitle || nextTitle === currentTitle) return
  emit('rename-submit', { title: nextTitle })
}
const handleMenuClick = (option: SessionMenuOption) => {
  if (option.value === 'rename') return startTitleEdit()
  if (option.value === 'clearMessages') {
    menuMode.value = 'clear'
    void positionMenu()
    return
  }
  if (option.value === 'delete') {
    menuMode.value = 'delete'
    void positionMenu()
    return
  }
  closeMenu()
  emit('menu-click', { value: option.value })
}
const confirmDangerAction = () => {
  const value = menuMode.value === 'clear' ? 'clearMessages' : 'delete'
  closeMenu()
  emit('menu-click', { value })
}
</script>

<style scoped>
.submenu_item { position: relative; }
.reference-session-checkbox { position: relative; width: 16px; height: 16px; flex: 0 0 16px; display: grid; place-items: center; cursor: pointer; }
.reference-session-checkbox input { position: absolute; inset: 0; width: 16px; height: 16px; margin: 0; opacity: 0; cursor: pointer; }
.reference-session-checkbox > span { width: 14px; height: 14px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; color: #111827; display: grid; place-items: center; }
.reference-session-checkbox input:checked + span { border-color: #111827; }
.session-title-edit { flex: 1 1 auto; min-width: 0; }
.session-title-edit__input { width: 100%; height: 26px; padding: 0 7px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #111827; font-family: "Inter", "Noto Sans SC", sans-serif; font-size: 11px; outline: none; box-shadow: 0 0 0 2px rgb(17 24 39 / .04); }
.reference-session-pin { flex: 0 0 auto; color: #9ca3af; }
.session-row-menu-wrap { position: relative; flex: 0 0 auto; }
.reference-session-more { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #9ca3af; display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease; }
.submenu_item:hover .reference-session-more,
.reference-session-more[aria-expanded='true'] { opacity: 1; }
.reference-session-more:hover { background: #e5e7eb; color: #374151; }
</style>

<style>
.reference-session-backdrop { position: fixed; inset: 0; z-index: 4890; }
.reference-session-menu { position: fixed; z-index: 4900; width: 176px; padding: 5px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; box-shadow: 0 16px 30px rgb(0 0 0 / .12); font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif; }
.reference-session-menu.confirm { width: 260px; padding: 12px; }
.reference-session-menu__item { width: 100%; min-height: 31px; padding: 0 9px; border: 0; border-radius: 7px; background: transparent; color: #374151; display: flex; align-items: center; gap: 8px; text-align: left; font-family: inherit; font-size: 11px; line-height: 16px; font-weight: 500; cursor: pointer; }
.reference-session-menu__item:hover { background: #f3f4f6; color: #111827; }
.reference-session-menu__item.danger { color: #dc2626; }
.reference-session-menu__item.danger:hover { background: #fef2f2; color: #b91c1c; }
.reference-session-menu__icon { flex: 0 0 auto; color: #6b7280; }
.reference-session-menu__item.danger .reference-session-menu__icon { color: currentColor; }
.reference-session-menu__divider { height: 1px; margin: 4px 6px; background: #f3f4f6; }
.reference-session-confirm strong { display: block; margin: 0; color: #111827; font-size: 12px; line-height: 17px; font-weight: 700; }
.reference-session-confirm p { margin: 5px 0 0; color: #6b7280; font-size: 11px; line-height: 17px; }
.reference-session-confirm > div { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
.reference-session-confirm button { height: 28px; padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 7px; background: #fff; color: #4b5563; font-family: inherit; font-size: 10px; font-weight: 600; cursor: pointer; }
.reference-session-confirm button:hover { background: #f3f4f6; }
.reference-session-confirm button.danger { border-color: #dc2626; background: #dc2626; color: #fff; }
</style>
