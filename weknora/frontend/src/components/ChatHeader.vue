<template>
  <header class="chat-header" :class="{ 'is-editing': titleEditing, 'is-docked': hasReferencesPanel }">
    <form
      v-if="titleEditing"
      class="chat-header__edit"
      @submit.prevent="submitTitleEdit"
      @click.stop
    >
      <input
        ref="titleInputRef"
        v-model="titleDraft"
        class="chat-header__edit-input"
        :maxlength="SESSION_TITLE_MAX_LENGTH"
        :disabled="busyAction === 'rename'"
        :placeholder="t('chatHeader.renamePlaceholder')"
        @keydown.esc.prevent="cancelTitleEdit"
        @blur="submitTitleEdit"
      />
    </form>

    <h1
      v-else
      class="chat-header__title"
      :title="displayTitle"
      @dblclick="startTitleEdit"
    >
      <ReferenceIcon v-if="session?.is_pinned" name="pin" :size="12" class="chat-header__pin" />
      <span class="chat-header__title-text">{{ displayTitle }}</span>
    </h1>

    <div v-if="!titleEditing" class="chat-header__menu-anchor">
      <button
        type="button"
        class="chat-header__menu-btn"
        :class="{ 'is-loading': Boolean(busyAction) }"
        :disabled="!session || Boolean(busyAction)"
        :aria-label="t('chatHeader.moreActions')"
        @click.stop="menuVisible = !menuVisible"
      >
        <ReferenceIcon v-if="busyAction" name="loader-circle" :size="14" class="chat-header__menu-loading" />
        <ReferenceIcon v-else name="more-horizontal" :size="16" />
      </button>

      <template v-if="menuVisible">
        <div class="chat-header__menu-backdrop" @click="menuVisible = false; menuMode = 'menu'" />
        <div class="chat-header-menu" @click.stop>
          <template v-if="menuMode === 'menu'">
            <button type="button" class="chat-header-menu__item" @click="onMenuAction(session?.is_pinned ? 'unpin' : 'pin')">
              <ReferenceIcon :name="session?.is_pinned ? 'pin-off' : 'pin'" :size="14" class="chat-header-menu__icon" />
              <span>{{ session?.is_pinned ? t('menu.unpin') : t('menu.pin') }}</span>
            </button>
            <button type="button" class="chat-header-menu__item" @click="onMenuAction('rename')">
              <ReferenceIcon name="edit-2" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('menu.renameSession') }}</span>
            </button>

            <div class="chat-header-menu__divider" />

            <button type="button" class="chat-header-menu__item" @click="onMenuAction('copyId')">
              <ReferenceIcon name="file-code" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('chatHeader.copySessionId') }}</span>
            </button>
            <button type="button" class="chat-header-menu__item" @click="onMenuAction('copyLink')">
              <ReferenceIcon name="globe" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('chatHeader.copyLink') }}</span>
            </button>
            <button type="button" class="chat-header-menu__item" @click="onMenuAction('copyMarkdown')">
              <ReferenceIcon name="file-text" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('chatHeader.copyMarkdown') }}</span>
            </button>
            <button type="button" class="chat-header-menu__item" @click="onMenuAction('openNewWindow')">
              <ReferenceIcon name="arrow-right-left" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('chatHeader.openNewWindow') }}</span>
            </button>

            <div class="chat-header-menu__divider" />

            <button type="button" class="chat-header-menu__item" @click="enterConfirmMode('clear')">
              <ReferenceIcon name="eraser" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('menu.clearMessages') }}</span>
            </button>
            <button type="button" class="chat-header-menu__item is-danger" @click="enterConfirmMode('delete')">
              <ReferenceIcon name="trash-2" :size="14" class="chat-header-menu__icon" />
              <span>{{ t('chatHeader.deleteSession') }}</span>
            </button>
          </template>

          <div v-else class="chat-header-confirm">
            <div class="chat-header-confirm__title">
              {{ menuMode === 'clear' ? t('chatHeader.clearConfirmTitle') : t('chatHeader.deleteConfirmTitle') }}
            </div>
            <div class="chat-header-confirm__body">
              {{ menuMode === 'clear' ? t('chatHeader.clearConfirmBody') : t('chatHeader.deleteConfirmBody') }}
            </div>
            <div class="chat-header-confirm__footer">
              <button type="button" class="chat-header-confirm__btn" :disabled="Boolean(busyAction)" @click="backToMenu">
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                class="chat-header-confirm__btn is-danger"
                :disabled="Boolean(busyAction)"
                @click="menuMode === 'clear' ? submitClearMessages() : submitDeleteSession()"
              >
                {{ menuMode === 'clear' ? t('common.clear') : t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { getMessageList } from '@/api/chat'
import {
  clearSession,
  removeSession,
  renameSession,
  setSessionPinned,
} from './sessionMutations'
import { normalizeSessionTitleDraft, SESSION_TITLE_MAX_LENGTH } from './sessionTitleEdit'
import { buildSessionMarkdown, collectAllSessionMessages } from '@/utils/sessionMarkdown'

interface ChatHeaderSession {
  id: string
  title?: string
  description?: string
  tenant_id?: number | string
  is_pinned?: boolean
}

type MenuMode = 'menu' | 'clear' | 'delete'

const props = defineProps<{
  session: ChatHeaderSession | null
  hasReferencesPanel?: boolean
}>()

const { t } = useI18n()
const busyAction = ref('')
const menuVisible = ref(false)
const menuMode = ref<MenuMode>('menu')
const titleEditing = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const displayTitle = computed(() => props.session?.title?.trim() || t('menu.newSession'))

function enterConfirmMode(mode: 'clear' | 'delete'): void {
  menuMode.value = mode
}

function backToMenu(): void {
  if (busyAction.value) return
  menuMode.value = 'menu'
}

function onMenuAction(value: string): void {
  if (value === 'rename') {
    menuVisible.value = false
    startTitleEdit()
    return
  }
  menuVisible.value = false
  handleMenuClick({ value })
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Some browsers expose Clipboard API outside a permitted context.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('clipboard unavailable')
}

function currentSessionLink(): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  return url.toString()
}

function startTitleEdit(): void {
  if (!props.session || busyAction.value) return
  menuVisible.value = false
  titleDraft.value = props.session.title || ''
  titleEditing.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function cancelTitleEdit(): void {
  titleEditing.value = false
  titleDraft.value = ''
}

async function submitTitleEdit(): Promise<void> {
  if (!titleEditing.value || busyAction.value) return
  const session = props.session
  if (!session) {
    cancelTitleEdit()
    return
  }

  const title = normalizeSessionTitleDraft(titleDraft.value)
  const currentTitle = normalizeSessionTitleDraft(session.title || '')
  titleEditing.value = false
  titleDraft.value = ''
  if (!title || title === currentTitle) return

  busyAction.value = 'rename'
  try {
    await renameSession(session.id, title, session.description || '')
    MessagePlugin.success(t('menu.renameSessionSuccess'))
  } catch {
    MessagePlugin.error(t('menu.renameSessionFailed'))
  } finally {
    busyAction.value = ''
  }
}

async function togglePin(pinned: boolean): Promise<void> {
  const session = props.session
  if (!session || busyAction.value) return
  busyAction.value = 'pin'
  try {
    await setSessionPinned(session.id, pinned)
    MessagePlugin.success(t(pinned ? 'chatHeader.pinSuccess' : 'chatHeader.unpinSuccess'))
  } catch {
    MessagePlugin.error(t(pinned ? 'menu.pinFailed' : 'menu.unpinFailed'))
  } finally {
    busyAction.value = ''
  }
}

async function copySessionId(): Promise<void> {
  if (!props.session) return
  try {
    await copyText(props.session.id)
    MessagePlugin.success(t('chatHeader.sessionIdCopied'))
  } catch {
    MessagePlugin.error(t('chatHeader.copyFailed'))
  }
}

async function copyLink(): Promise<void> {
  try {
    await copyText(currentSessionLink())
    MessagePlugin.success(t('chatHeader.linkCopied'))
  } catch {
    MessagePlugin.error(t('chatHeader.copyFailed'))
  }
}

async function copyMarkdown(): Promise<void> {
  const session = props.session
  if (!session || busyAction.value) return
  busyAction.value = 'markdown'
  try {
    const messages = await collectAllSessionMessages(async (beforeTime, limit) => {
      const response: any = await getMessageList({
        session_id: session.id,
        created_at: beforeTime,
        limit,
      })
      if (!response?.success || !Array.isArray(response.data)) {
        throw new Error(response?.message || 'failed to load session messages')
      }
      return response.data
    })
    const markdown = buildSessionMarkdown({
      sessionId: session.id,
      title: session.title || t('menu.newSession'),
      messages,
      labels: {
        sessionId: t('chatHeader.markdown.sessionId'),
        exportedAt: t('chatHeader.markdown.exportedAt'),
        user: t('chatHeader.markdown.user'),
        assistant: t('chatHeader.markdown.assistant'),
        attachments: t('chatHeader.markdown.attachments'),
        references: t('chatHeader.markdown.references'),
      },
    })
    await copyText(markdown)
    MessagePlugin.success(t('chatHeader.markdownCopied'))
  } catch {
    MessagePlugin.error(t('chatHeader.markdownCopyFailed'))
  } finally {
    busyAction.value = ''
  }
}

async function submitClearMessages(): Promise<void> {
  const session = props.session
  if (!session || busyAction.value) return
  busyAction.value = 'clear'
  try {
    await clearSession(session.id)
    menuVisible.value = false
    menuMode.value = 'menu'
    MessagePlugin.success(t('menu.clearMessagesSuccess'))
  } catch {
    MessagePlugin.error(t('menu.clearMessagesFailed'))
  } finally {
    busyAction.value = ''
  }
}

async function submitDeleteSession(): Promise<void> {
  const session = props.session
  if (!session || busyAction.value) return
  busyAction.value = 'delete'
  try {
    await removeSession(session.id)
    menuVisible.value = false
    menuMode.value = 'menu'
    MessagePlugin.success(t('chatHeader.deleteSuccess'))
  } catch {
    MessagePlugin.error(t('chat.deleteSessionFailed'))
  } finally {
    busyAction.value = ''
  }
}

function handleMenuClick(data: { value: string }): void {
  switch (data.value) {
    case 'pin': void togglePin(true); break
    case 'unpin': void togglePin(false); break
    case 'copyId': void copySessionId(); break
    case 'copyLink': void copyLink(); break
    case 'copyMarkdown': void copyMarkdown(); break
    case 'openNewWindow': window.open(currentSessionLink(), '_blank', 'noopener,noreferrer'); break
  }
}
</script>

<style scoped>
.chat-header {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: min(320px, calc(100% - 24px));
  min-width: 0;
  padding: 2px 2px 2px 8px;
  border-radius: 10px;
  box-sizing: border-box;
  background: rgb(255 255 255 / .88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #4b5563;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}

.chat-header.is-editing { max-width: min(360px, calc(100% - 24px)); padding: 2px; }

.chat-header__edit { flex: 1 1 auto; min-width: 0; width: 240px; max-width: 100%; }
.chat-header__edit-input {
  width: 100%;
  height: 28px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 12px;
  box-shadow: 0 0 0 2px rgb(229 231 235 / .7);
}
.chat-header__edit-input:disabled { opacity: .7; }

.chat-header__title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin: 0;
  padding: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: -.01em;
}
.chat-header__title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-header__pin { flex: 0 0 auto; color: #9ca3af; }

.chat-header__menu-anchor { position: relative; flex: 0 0 auto; }
.chat-header__menu-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.chat-header__menu-btn:hover:not(:disabled) { background: #f3f4f6; color: #374151; }
.chat-header__menu-btn:disabled { cursor: not-allowed; opacity: .45; }
.chat-header__menu-loading { animation: chat-header-spin .8s linear infinite; }

.chat-header__menu-backdrop { position: fixed; inset: 0; z-index: 998; }
.chat-header-menu {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  z-index: 999;
  min-width: 180px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 25px rgb(0 0 0 / .10);
  color: #1f2937;
}
.chat-header-menu__item {
  width: 100%;
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #374151;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  text-align: left;
  cursor: pointer;
}
.chat-header-menu__item:hover { background: #f9fafb; color: #111827; }
.chat-header-menu__item.is-danger { color: #dc2626; }
.chat-header-menu__item.is-danger:hover { background: #fef2f2; }
.chat-header-menu__icon { flex: 0 0 auto; color: #6b7280; }
.chat-header-menu__item.is-danger .chat-header-menu__icon { color: #dc2626; }
.chat-header-menu__divider { height: 1px; margin: 5px 6px; background: #f3f4f6; }

.chat-header-confirm { width: 236px; display: flex; flex-direction: column; gap: 10px; padding: 6px; }
.chat-header-confirm__title { color: #111827; font-size: 13px; line-height: 18px; font-weight: 700; }
.chat-header-confirm__body { color: #6b7280; font-size: 12px; line-height: 18px; word-break: break-word; }
.chat-header-confirm__footer { display: flex; justify-content: flex-end; gap: 8px; }
.chat-header-confirm__btn {
  min-width: 60px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.chat-header-confirm__btn:hover:not(:disabled) { background: #f9fafb; }
.chat-header-confirm__btn.is-danger { border-color: #dc2626; background: #dc2626; color: #fff; }
.chat-header-confirm__btn.is-danger:hover:not(:disabled) { background: #b91c1c; }
.chat-header-confirm__btn:disabled { opacity: .55; cursor: not-allowed; }

@keyframes chat-header-spin { to { transform: rotate(360deg); } }

@media (min-width: 960px) {
  .chat-header.is-docked {
    position: relative;
    top: auto;
    left: auto;
    align-self: stretch;
    flex-shrink: 0;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 10px 12px;
    border-radius: 0;
    border-bottom: 1px solid #f3f4f6;
    background: #fff;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .chat-header.is-docked.is-editing { max-width: none; padding: 8px 12px; }
}
</style>
