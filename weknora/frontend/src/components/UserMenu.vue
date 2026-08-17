<template>
  <div ref="menuRef" class="reference-user-menu" :class="{ collapsed: uiStore.sidebarCollapsed }">
    <button type="button" class="reference-user-trigger" data-guide="user-menu" @click="toggleMenu">
      <span class="reference-user-avatar">
        <img v-if="userAvatar" :src="userAvatar" :alt="$t('common.avatar')" />
        <span v-else>{{ userInitial }}</span>
      </span>
      <template v-if="!uiStore.sidebarCollapsed">
        <span class="reference-user-copy">
          <strong>{{ userName }}</strong>
          <small>{{ userEmail }}</small>
        </span>
        <ReferenceIcon :name="menuVisible ? 'chevron-up' : 'chevron-down'" :size="14" class="reference-user-chevron" />
      </template>
    </button>

    <Transition name="reference-user-popover">
      <div v-if="menuVisible" class="reference-user-popover" @click.stop>
        <button type="button" @click="handleSettings">
          <ReferenceIcon name="settings" :size="15" />
          <span>{{ $t('general.settings') }}</span>
        </button>
        <div class="reference-user-popover__divider" />
        <button type="button" class="danger" @click="handleLogout">
          <ReferenceIcon name="log-out" :size="15" />
          <span>{{ $t('auth.logout') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { logout as logoutApi } from '@/api/auth'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { handoffToExternalAuth } from '@/utils/nativeAuthHandoff'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()
const menuRef = ref<HTMLElement>()
const menuVisible = ref(false)

const userName = computed(() => authStore.user?.username || authStore.user?.email || t('common.defaultUser'))
const userEmail = computed(() => authStore.user?.email || '')
const userAvatar = computed(() => authStore.user?.avatar || '')
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const toggleMenu = () => { menuVisible.value = !menuVisible.value }
const handleSettings = () => {
  menuVisible.value = false
  uiStore.openSettings('general')
  void router.push({ path: '/platform/settings', query: { section: 'general' } })
}
const handleLogout = async () => {
  menuVisible.value = false
  try { await logoutApi() }
  catch (error) { console.error('Logout API failed:', error) }
  authStore.logout()
  MessagePlugin.success(t('auth.logout'))
  handoffToExternalAuth('logout')
}
const handleClickOutside = (event: MouseEvent) => {
  if (!menuRef.value?.contains(event.target as Node)) menuVisible.value = false
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.reference-user-menu {
  position: relative;
  width: 100%;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-user-trigger {
  width: 100%;
  min-height: 42px;
  padding: 5px 6px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 150ms ease;
}
.reference-user-trigger:hover { background: #f3f4f6; }
.reference-user-menu.collapsed .reference-user-trigger { justify-content: center; padding: 5px 0; }
.reference-user-avatar {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  overflow: hidden;
  border-radius: 999px;
  background: #000;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
}
.reference-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.reference-user-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.reference-user-copy strong,
.reference-user-copy small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-user-copy strong { color: #111827; font-size: 11px; line-height: 15px; font-weight: 700; }
.reference-user-copy small { color: #9ca3af; font-size: 9px; line-height: 13px; font-weight: 400; }
.reference-user-chevron { flex: 0 0 auto; color: #9ca3af; }
.reference-user-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 1000;
  width: 190px;
  padding: 6px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / .10), 0 8px 10px -6px rgb(0 0 0 / .10);
}
.reference-user-menu.collapsed .reference-user-popover { left: calc(100% + 8px); right: auto; bottom: 0; }
.reference-user-popover button {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  font-family: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
}
.reference-user-popover button:hover { background: #f3f4f6; color: #111827; }
.reference-user-popover button.danger { color: #dc2626; }
.reference-user-popover button.danger:hover { background: #fef2f2; color: #b91c1c; }
.reference-user-popover__divider { height: 1px; margin: 4px 5px; background: #f3f4f6; }
.reference-user-popover-enter-active,
.reference-user-popover-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.reference-user-popover-enter-from,
.reference-user-popover-leave-to { opacity: 0; transform: translateY(4px); }
</style>
