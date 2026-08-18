<template>
  <div
    class="visual-session-row"
    :class="{
      'is-active': !batchMode && activePath === item.path,
      'is-selected': batchMode && selectedIds.includes(item.id),
      'is-batch': batchMode,
    }"
    @mouseenter="emit('hover-in')"
    @mouseleave="emit('hover-out')"
    @click="batchMode ? emit('toggle-select') : emit('navigate')"
  >
    <t-checkbox
      v-if="batchMode"
      class="visual-session-row__checkbox"
      :checked="selectedIds.includes(item.id)"
      @click.stop
      @change="emit('toggle-select')"
    />

    <form
      v-if="titleEditing"
      class="visual-session-row__edit"
      @submit.prevent="submitTitleEdit"
      @click.stop
    >
      <input
        ref="titleInputRef"
        v-model="titleDraft"
        class="visual-session-row__edit-input"
        :maxlength="SESSION_TITLE_MAX_LENGTH"
        @keydown.esc.prevent="cancelTitleEdit"
        @blur="submitTitleEdit"
      />
    </form>

    <div v-else class="visual-session-row__title" :title="item.title">
      <t-icon v-if="item.is_pinned" name="pin" class="visual-session-row__pin" />
      <span>{{ item.title }}</span>
    </div>

    <div v-if="!batchMode" class="visual-session-row__menu" @click.stop>
      <t-popup
        v-model:visible="menuOpen"
        :overlay-class-name="menuOverlayClass"
        trigger="click"
        destroy-on-close
        placement="bottom-right"
        @visible-change="onMenuVisibleChange"
      >
        <button
          type="button"
          class="visual-session-row__more"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click.stop
        >
          <t-icon name="ellipsis" />
        </button>

        <template #content>
          <div class="visual-session-menu" @click.stop>
            <template v-if="menuMode === 'menu'">
              <template v-for="(option, index) in menuOptions" :key="option.value">
                <div
                  v-if="shouldShowDividerBefore(option.value, index)"
                  class="visual-session-menu__divider"
                />
                <button
                  type="button"
                  class="visual-session-menu__item"
                  :class="{ 'is-danger': option.theme === 'error' }"
                  @click="handleMenuClick(option)"
                >
                  <component
                    :is="option.prefixIcon"
                    v-if="option.prefixIcon"
                    class="visual-session-menu__icon"
                  />
                  <span>{{ option.content }}</span>
                </button>
              </template>
            </template>

            <div v-else class="visual-session-confirm">
              <h4>
                {{ menuMode === 'clear' ? t('chatHeader.clearConfirmTitle') : t('chatHeader.deleteConfirmTitle') }}
              </h4>
              <p>
                {{ menuMode === 'clear' ? t('chatHeader.clearConfirmBody') : t('chatHeader.deleteConfirmBody') }}
              </p>
              <div class="visual-session-confirm__actions">
                <button type="button" class="visual-session-confirm__button" @click="backToMenu">
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  class="visual-session-confirm__button is-danger"
                  @click="confirmDangerAction"
                >
                  {{ menuMode === 'clear' ? t('common.clear') : t('common.delete') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </t-popup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeSessionTitleDraft, SESSION_TITLE_MAX_LENGTH } from './sessionTitleEdit'

interface SessionMenuOption {
  content: string
  value: string
  theme?: 'default' | 'success' | 'warning' | 'error' | 'primary'
  prefixIcon?: any
}

type MenuMode = 'menu' | 'clear' | 'delete'

const props = defineProps<{
  item: { id: string; path: string; title: string; is_pinned?: boolean }
  batchMode: boolean
  activePath: string
  selectedIds: string[]
  menuOptions: SessionMenuOption[]
  /** 渠道文件夹下的会话（样式与聊天区会话共用文案列对齐） */
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

const menuOverlayClass = computed(() => (
  menuMode.value === 'menu'
    ? 'visual-session-menu-popup'
    : 'visual-session-menu-popup is-confirm'
))

const onMenuVisibleChange = (visible: boolean): void => {
  if (!visible) menuMode.value = 'menu'
}

const backToMenu = (): void => {
  menuMode.value = 'menu'
}

const shouldShowDividerBefore = (value: string, index: number): boolean => {
  if (index === 0) return false
  return value === 'clearMessages' || value === 'delete'
}

const startTitleEdit = (): void => {
  menuOpen.value = false
  menuMode.value = 'menu'
  titleDraft.value = props.item.title || ''
  titleEditing.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

const cancelTitleEdit = (): void => {
  titleEditing.value = false
  titleDraft.value = ''
}

const submitTitleEdit = (): void => {
  // Enter 会先触发 form submit，随后 input blur 再进一次；必须同步退出编辑态防重入。
  if (!titleEditing.value) return
  const nextTitle = normalizeSessionTitleDraft(titleDraft.value)
  const currentTitle = normalizeSessionTitleDraft(props.item.title || '')
  titleEditing.value = false
  titleDraft.value = ''
  if (!nextTitle || nextTitle === currentTitle) return
  emit('rename-submit', { title: nextTitle })
}

const handleMenuClick = (option: SessionMenuOption): void => {
  if (option.value === 'rename') {
    startTitleEdit()
    return
  }
  if (option.value === 'clearMessages') {
    menuMode.value = 'clear'
    return
  }
  if (option.value === 'delete') {
    menuMode.value = 'delete'
    return
  }
  menuOpen.value = false
  menuMode.value = 'menu'
  emit('menu-click', { value: option.value })
}

const confirmDangerAction = (): void => {
  const value = menuMode.value === 'clear' ? 'clearMessages' : 'delete'
  menuOpen.value = false
  menuMode.value = 'menu'
  emit('menu-click', { value })
}
</script>

<style scoped lang="less">
.visual-session-row {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding: 6px 10px;
  box-sizing: border-box;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.visual-session-row:hover {
  background: rgb(243 244 246 / 80%);
  color: #111827;
}

.visual-session-row.is-active,
.visual-session-row.is-selected {
  background: rgb(229 231 235 / 80%);
  color: #111827;
  font-weight: 500;
}

.visual-session-row__checkbox {
  flex: 0 0 auto;
}

.visual-session-row__title {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 5px;
}

.visual-session-row__title > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-session-row__pin {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
  font-size: 12px;
  color: #9ca3af;
}

.visual-session-row__edit {
  min-width: 0;
  flex: 1 1 auto;
}

.visual-session-row__edit-input {
  width: 100%;
  height: 26px;
  padding: 0 7px;
  box-sizing: border-box;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  outline: 0;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 12px;
  line-height: 24px;
  box-shadow: 0 0 0 2px rgb(156 163 175 / 12%);
}

.visual-session-row__menu {
  flex: 0 0 auto;
  position: relative;
}

.visual-session-row__more {
  width: 24px;
  height: 24px;
  margin: -2px -4px -2px 0;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #9ca3af;
  opacity: 0;
  cursor: pointer;
  transition: opacity 120ms ease, background-color 150ms ease, color 150ms ease;
}

.visual-session-row:hover .visual-session-row__more,
.visual-session-row__more[aria-expanded='true'] {
  opacity: 1;
}

.visual-session-row__more:hover {
  background: #fff;
  color: #374151;
}

.visual-session-row__more :deep(.t-icon) {
  font-size: 14px;
}
</style>

<style lang="less">
.visual-session-menu-popup {
  z-index: 3000 !important;
}

.visual-session-menu-popup .t-popup__content {
  min-width: 160px !important;
  width: max-content !important;
  margin-top: 2px !important;
  padding: 0 !important;
  overflow: hidden;
  border: 1px solid #e5e7eb !important;
  border-radius: 10px !important;
  background: #fff !important;
  box-shadow: 0 12px 30px rgb(0 0 0 / 12%) !important;
}

.visual-session-menu-popup.is-confirm .t-popup__content {
  width: 260px !important;
  min-width: 260px !important;
}

.visual-session-menu {
  min-width: 158px;
  padding: 5px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.visual-session-menu__item {
  width: 100%;
  min-height: 32px;
  padding: 6px 9px;
  box-sizing: border-box;
  border: 0;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.visual-session-menu__item:hover {
  background: #f3f4f6;
  color: #111827;
}

.visual-session-menu__item.is-danger {
  color: #b91c1c;
}

.visual-session-menu__item.is-danger:hover {
  background: #fef2f2;
}

.visual-session-menu__icon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: #6b7280;
}

.visual-session-menu__item.is-danger .visual-session-menu__icon {
  color: #b91c1c;
}

.visual-session-menu__divider {
  height: 1px;
  margin: 3px 6px;
  background: #f3f4f6;
}

.visual-session-confirm {
  width: 258px;
  padding: 14px;
  box-sizing: border-box;
}

.visual-session-confirm h4 {
  margin: 0 0 5px;
  color: #111827;
  font-size: 13px;
  line-height: 19px;
  font-weight: 700;
}

.visual-session-confirm p {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.visual-session-confirm__actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.visual-session-confirm__button {
  min-height: 30px;
  padding: 5px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  cursor: pointer;
}

.visual-session-confirm__button:hover {
  background: #f9fafb;
}

.visual-session-confirm__button.is-danger {
  border-color: #b91c1c;
  background: #b91c1c;
  color: #fff;
}

.visual-session-confirm__button.is-danger:hover {
  background: #991b1b;
}
</style>
