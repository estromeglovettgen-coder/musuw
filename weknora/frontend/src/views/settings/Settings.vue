<template>
  <Teleport to="body">
    <Transition name="visual-settings-fade">
      <div v-if="visible" class="visual-settings-overlay" :class="{ 'is-route': isSettingsRoute }">
        <section
          ref="settingsDialogRef"
          class="visual-settings-modal"
          :role="isSettingsRoute ? undefined : 'dialog'"
          :aria-modal="isSettingsRoute ? undefined : 'true'"
          aria-labelledby="visual-settings-title"
          tabindex="-1"
          @keydown.tab="handleDialogTab"
        >
          <aside class="visual-settings-sidebar">
            <button type="button" class="visual-settings-back" @click="handleClose">
              <t-icon name="chevron-left" aria-hidden="true" />
              <span>{{ $t('entitlement.backToProduct') }}</span>
            </button>

            <label class="visual-settings-search">
              <t-icon name="search" aria-hidden="true" />
              <span class="visual-settings-sr-only">{{ $t('general.searchSettings') }}</span>
              <input
                ref="settingsSearchInputRef"
                v-model="settingsSearchQuery"
                type="search"
                :placeholder="$t('general.searchSettings')"
                autocomplete="off"
              />
            </label>

            <h2 id="visual-settings-title" class="visual-settings-title">{{ $t('general.settings') }}</h2>
            <p class="visual-settings-nav__group">{{ $t('general.personalSettings') }}</p>
            <nav class="visual-settings-nav" :aria-label="$t('general.settings')">
              <button
                v-for="item in filteredNavItems"
                :key="item.key"
                type="button"
                class="visual-settings-nav__item"
                :class="{ 'is-active': currentSection === item.key }"
                :aria-current="currentSection === item.key ? 'page' : undefined"
                @click="handleNavClick(item)"
              >
                <span v-if="item.emoji" class="visual-settings-nav__emoji" aria-hidden="true">{{ item.emoji }}</span>
                <t-icon v-else :name="item.icon || 'setting'" />
                <span>{{ item.label }}</span>
              </button>
              <p v-if="filteredNavItems.length === 0" class="visual-settings-nav__empty">
                {{ $t('general.noMatchingSettings') }}
              </p>
            </nav>
          </aside>

          <main class="visual-settings-content" :aria-label="activeNavLabel">
            <div
              class="visual-settings-content__inner"
              :class="{
                'is-wide': currentSection === 'members',
                'is-full': SYSTEM_ADMIN_SECTIONS.has(currentSection) || isIntegrationSection(currentSection),
              }"
            >
              <section v-if="!canSeeSection(currentSection)" class="visual-settings-role-denied" aria-hidden="true">
                <t-icon name="lock-on" />
              </section>

              <template v-else>
                <GeneralSettings v-if="currentSection === 'general'" />
                <UsageBillingSettings v-else-if="currentSection === 'usage'" />
                <OllamaSettings v-else-if="currentSection === 'ollama'" />
                <WeKnoraCloudSettings v-else-if="currentSection === 'weknoracloud'" />
                <ModelSettings v-else-if="currentSection === 'models'" :initial-type="currentModelType" />
                <WebSearchSettings v-else-if="currentSection === 'websearch'" />
                <ChatHistorySettings v-else-if="currentSection === 'chathistory'" />
                <VectorStoreSettings v-else-if="currentSection === 'vectorstore'" />
                <ParserEngineSettings v-else-if="currentSection === 'parser'" />
                <StorageEngineSettings v-else-if="currentSection === 'storage'" />
                <SystemInfo v-else-if="currentSection === 'system'" />
                <SystemSettings v-else-if="currentSection === 'system-global'" />
                <RuntimeQueues v-else-if="currentSection === 'runtime-queues'" />
                <PlatformAPIKeys v-else-if="currentSection === 'platform-api-keys'" />
                <SystemAuditLog v-else-if="currentSection === 'system-audit-log'" />
                <UserProfile v-else-if="currentSection === 'userprofile'" />
                <TenantInfo v-else-if="currentSection === 'tenant'" />
                <TenantMembers v-else-if="currentSection === 'members'" />
                <IntegrationSettingsSection
                  v-else-if="isIntegrationSection(currentSection)"
                  :tab="integrationTabFromSection(currentSection)"
                />
                <McpSettings v-else-if="currentSection === 'mcp'" />
              </template>
            </div>
          </main>

        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import SystemInfo from './SystemInfo.vue'
import TenantInfo from './TenantInfo.vue'
import UserProfile from './UserProfile.vue'
import GeneralSettings from './GeneralSettings.vue'
import UsageBillingSettings from './UsageBillingSettings.vue'
import ModelSettings from './ModelSettings.vue'
import OllamaSettings from './OllamaSettings.vue'
import McpSettings from './McpSettings.vue'
import WebSearchSettings from './WebSearchSettings.vue'
import ChatHistorySettings from './ChatHistorySettings.vue'
import VectorStoreSettings from './VectorStoreSettings.vue'
import ParserEngineSettings from './ParserEngineSettings.vue'
import StorageEngineSettings from './StorageBackendSettings.vue'
import WeKnoraCloudSettings from './WeKnoraCloudSettings.vue'
import TenantMembers from './TenantMembers.vue'
import SystemSettings from '@/views/system/SystemSettings.vue'
import RuntimeQueues from '@/views/system/RuntimeQueues.vue'
import PlatformAPIKeys from '@/views/system/PlatformAPIKeys.vue'
import SystemAuditLog from '@/views/system/SystemAuditLog.vue'
import IntegrationSettingsSection from '@/views/integrations/IntegrationSettingsSection.vue'
import {
  INTEGRATION_PREVIEW_ITEMS,
  INTEGRATION_TAB_MIN_ROLE,
  INTEGRATION_TABS,
  type IntegrationTab,
} from '@/config/integrations'
import {
  SETTINGS_SECTION_MIN_ROLE,
  SYSTEM_ADMIN_SETTINGS_SECTIONS,
} from '@/config/settingsAccess'
import { filterSettingsNavigation } from './settingsNavigation'

const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()
const authStore = useAuthStore()
const { t } = useI18n()

const currentSection = ref<string>('general')
const currentSubSection = ref<string>('')
const settingsSearchQuery = ref('')
const settingsDialogRef = ref<HTMLElement | null>(null)
const settingsSearchInputRef = ref<HTMLInputElement | null>(null)
let lastFocusedElement: HTMLElement | null = null

type NavItem = {
  key: string
  icon: string
  label: string
  emoji?: string
}

const SYSTEM_ADMIN_SECTIONS = SYSTEM_ADMIN_SETTINGS_SECTIONS
const INTEGRATION_SECTION_PREFIX = 'integration-'
const integrationSectionKey = (tab: IntegrationTab) => `${INTEGRATION_SECTION_PREFIX}${tab}`

const integrationTabFromSection = (section: string): IntegrationTab => {
  const raw = section.startsWith(INTEGRATION_SECTION_PREFIX)
    ? section.slice(INTEGRATION_SECTION_PREFIX.length)
    : section
  return INTEGRATION_TABS.includes(raw as IntegrationTab) ? raw as IntegrationTab : 'im'
}

const isIntegrationSection = (section: string) =>
  section.startsWith(INTEGRATION_SECTION_PREFIX) &&
  INTEGRATION_TABS.includes(integrationTabFromSection(section))

const normalizeSettingsSection = (section: string) => {
  // Consumer Lite exposes the personal settings and usage surfaces only.
  // Internal events/deep-links cannot reopen hidden management sections.
  if (authStore.isLiteMode && section !== 'usage' && section !== 'userprofile') return 'general'
  if (section === 'api') return integrationSectionKey('api')
  if (section === 'integrations') {
    return integrationSectionKey(integrationTabFromSection((route.query.tab as string) || 'im'))
  }
  return section
}

const canSeeSection = (key: string): boolean => {
  if (authStore.isLiteMode) return key === 'general' || key === 'usage' || key === 'userprofile'
  if (isIntegrationSection(key)) {
    const min = INTEGRATION_TAB_MIN_ROLE[integrationTabFromSection(key)]
    if (!min) return true
    if (authStore.canAccessAllTenants) return true
    return authStore.hasRole(min)
  }
  if (SYSTEM_ADMIN_SECTIONS.has(key)) return authStore.isSystemAdmin
  const min = SETTINGS_SECTION_MIN_ROLE[key] ?? 'viewer'
  if (authStore.canAccessAllTenants) return true
  return authStore.hasRole(min)
}

const navItems = computed<NavItem[]>(() => {
  if (authStore.isLiteMode) {
    return [
      { key: 'general', icon: 'setting', label: t('general.title') },
      { key: 'usage', icon: 'chart-line', label: t('entitlement.usageTitle') },
      { key: 'userprofile', icon: 'user', label: t('userProfile.title') },
    ]
  }

  const integrationItems: NavItem[] = INTEGRATION_PREVIEW_ITEMS.map((item) => ({
    key: integrationSectionKey(item.key),
    icon: item.icon.type === 'icon' ? item.icon.name : 'integration',
    emoji: item.icon.type === 'emoji' ? item.icon.value : undefined,
    label: t(`integrations.tabs.${item.key}`),
  }))

  // Behavior authority: keep the complete WeKnora v0.7.2 settings capability
  // set. Visual authority: render it as one clean SettingsModal.tsx nav stack,
  // without inventing extra group headings that do not exist in @视觉文件.
  const all: NavItem[] = [
    { key: 'general', icon: 'setting', label: t('general.title') },
    { key: 'usage', icon: 'chart-line', label: t('entitlement.usageTitle') },
    { key: 'userprofile', icon: 'user', label: t('userProfile.title') },
    { key: 'tenant', icon: 'user-circle', label: t('settings.tenantInfo') },
    { key: 'members', icon: 'usergroup', label: t('tenantMember.title') },
    { key: 'chathistory', icon: 'chat', label: t('chatHistorySettings.title') },
    { key: 'models', icon: 'cpu', label: t('settings.modelManagement') },
    { key: 'ollama', icon: 'server', label: 'Ollama' },
    { key: 'weknoracloud', icon: 'cloud', label: 'Musuw Cloud' },
    ...integrationItems,
    { key: 'vectorstore', icon: 'data-base', label: t('settings.vectorStoreEngine') },
    { key: 'parser', icon: 'file-search', label: t('settings.parserEngine') },
    { key: 'storage', icon: 'cloud', label: t('settings.storageEngine') },
    { key: 'websearch', icon: 'search', label: t('settings.webSearchConfig') },
    { key: 'mcp', icon: 'tools', label: t('settings.mcpService') },
    { key: 'system-global', icon: 'server', label: t('settings.system') },
    { key: 'runtime-queues', icon: 'queue', label: t('settings.taskQueue') },
    { key: 'platform-api-keys', icon: 'secured', label: t('platformApiKeys.title') },
    { key: 'system-audit-log', icon: 'history', label: t('system.globalSettings.audit.tabLabel') },
    { key: 'system', icon: 'info-circle', label: t('settings.versionInfo') },
  ]

  if (!authStore.currentTenantRole && !authStore.canAccessAllTenants) return []
  return all.filter((item) => canSeeSection(item.key))
})

const filteredNavItems = computed(() => filterSettingsNavigation(navItems.value, settingsSearchQuery.value))
const activeNavLabel = computed(() => navItems.value.find((item) => item.key === currentSection.value)?.label || t('general.settings'))

const isSettingsRoute = computed(() => route.path === '/platform/settings')
const visible = computed(() => route.path === '/platform/settings' || uiStore.showSettingsModal)
const currentModelType = computed(() => {
  if (currentSection.value !== 'models') return null
  if (currentSubSection.value) return currentSubSection.value
  if (route.path === '/platform/settings' && typeof route.query.tab === 'string') return route.query.tab
  return uiStore.settingsInitialSubSection || null
})

const handleNavClick = (item: NavItem) => {
  currentSection.value = item.key
  currentSubSection.value = ''

  // Preserve WeKnora's route contract: only integration/system compatibility
  // URLs own a stable query encoding. Ordinary Settings tabs remain internal.
  if (route.path === '/platform/settings' && isIntegrationSection(item.key)) {
    void router.replace({
      path: '/platform/settings',
      query: { ...route.query, section: 'integrations', tab: integrationTabFromSection(item.key) },
    })
  } else if (route.path === '/platform/settings' && SYSTEM_ADMIN_SECTIONS.has(item.key)) {
    const query = { ...route.query }
    delete query.tab
    void router.replace({ path: '/platform/settings', query: { ...query, section: item.key } })
  }
}

const handleClose = () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  uiStore.closeSettings()
  if (route.path === '/platform/settings') {
    const section = route.query.section
    if (section === 'system-global' || section === 'runtime-queues' || section === 'platform-api-keys' || section === 'system-audit-log') {
      void router.push('/platform/knowledge-bases')
    } else {
      router.back()
    }
  }
}

const handleDialogTab = (event: KeyboardEvent) => {
  if (isSettingsRoute.value) return
  const dialog = settingsDialogRef.value
  if (!dialog) return
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true')
  if (focusable.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(visible, (isVisible, wasVisible) => {
  if (isVisible && !wasVisible && !isSettingsRoute.value) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => settingsSearchInputRef.value?.focus())
  } else if (!isVisible && wasVisible) {
    void nextTick(() => {
      lastFocusedElement?.focus()
      lastFocusedElement = null
    })
  }
})

watch(() => uiStore.settingsInitialSection, (section) => {
  if (!section || !visible.value) return
  currentSection.value = normalizeSettingsSection(section)
  currentSubSection.value = authStore.isLiteMode ? '' : (uiStore.settingsInitialSubSection || '')
}, { immediate: true })

watch(
  () => [visible.value, route.query.section, route.query.tab],
  ([isVisible, section, tab]) => {
    if (!isVisible || typeof section !== 'string') return
    currentSection.value = normalizeSettingsSection(section)
    currentSubSection.value = authStore.isLiteMode ? '' : (typeof tab === 'string' ? tab : '')
  },
  { immediate: true },
)

watch(navItems, (items) => {
  if (!items.some((item) => item.key === currentSection.value)) {
    currentSection.value = items[0]?.key || 'general'
    currentSubSection.value = ''
  }
})

const handleSettingsNav = (event: Event) => {
  const detail = event instanceof CustomEvent ? event.detail : null
  if (!detail?.section) return
  currentSection.value = normalizeSettingsSection(String(detail.section))
  currentSubSection.value = authStore.isLiteMode ? '' : (detail.subsection ? String(detail.subsection) : '')
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && visible.value) handleClose()
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
  window.addEventListener('settings-nav', handleSettingsNav)
})

watch(currentSection, () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('settings-nav', handleSettingsNav)
})
</script>

<style scoped lang="less">
.visual-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 24px;
  background: rgb(16 18 20 / 36%);
  backdrop-filter: blur(8px);
  user-select: none;
}
.visual-settings-overlay.is-route {
  padding: 0;
  background: #fdfdfd;
  backdrop-filter: none;
}

.visual-settings-modal {
  position: relative;
  width: min(1240px, 100%);
  height: min(780px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
  min-width: 0;
  display: flex;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgb(229 231 235 / 90%);
  border-radius: 18px;
  background: #fdfdfd;
  color: #242424;
  box-shadow: 0 24px 72px rgb(16 18 20 / 22%);
  text-align: left;
}
.visual-settings-overlay.is-route .visual-settings-modal {
  width: 100%;
  height: 100dvh;
  max-height: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.visual-settings-sidebar {
  flex: 0 0 280px;
  width: 280px;
  min-width: 0;
  box-sizing: border-box;
  padding: 26px 16px 18px;
  border-right: 1px solid #e4e4e2;
  background: #f2f2f0;
  display: flex;
  flex-direction: column;
}

.visual-settings-back {
  width: fit-content;
  min-height: 34px;
  margin: 0 0 18px;
  padding: 6px 8px 6px 4px;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #747474;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.visual-settings-back:hover { background: #e8e8e6; color: #292929; }
.visual-settings-back:focus-visible { outline: 2px solid #8bbcff; outline-offset: 2px; }
.visual-settings-back :deep(.t-icon) { width: 16px; height: 16px; font-size: 16px; }

.visual-settings-search {
  width: 100%;
  height: 38px;
  margin: 0 0 22px;
  padding: 0 11px;
  box-sizing: border-box;
  border: 1px solid #ddddda;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: #fbfbfa;
  color: #858585;
}
.visual-settings-search:focus-within { border-color: #9cb9dd; box-shadow: 0 0 0 3px rgb(77 139 202 / 13%); }
.visual-settings-search :deep(.t-icon) { flex: 0 0 16px; width: 16px; height: 16px; font-size: 16px; }
.visual-settings-search input {
  min-width: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #2b2b2b;
  font: inherit;
  font-size: 13px;
}
.visual-settings-search input::placeholder { color: #8a8a8a; opacity: 1; }
.visual-settings-search input::-webkit-search-cancel-button { opacity: .55; }

.visual-settings-sr-only,
.visual-settings-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.visual-settings-nav__group {
  margin: 0 10px 7px;
  color: #8c8c8c;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}

.visual-settings-nav {
  min-height: 0;
  flex: 1 1 auto;
  padding-right: 2px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scrollbar-width: thin;
}

.visual-settings-nav__item {
  width: 100%;
  min-height: 40px;
  padding: 9px 10px;
  border: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #4d4d4d;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.visual-settings-nav__item :deep(.t-icon), .visual-settings-nav__emoji {
  flex: 0 0 17px;
  width: 17px;
  height: 17px;
  font-size: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.visual-settings-nav__item > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-settings-nav__item:hover { background: #e9e9e7; color: #202020; }
.visual-settings-nav__item.is-active { background: #dededc; color: #202020; font-weight: 600; }
.visual-settings-nav__item:focus-visible { outline: 2px solid #8bbcff; outline-offset: -2px; }
.visual-settings-nav__empty { margin: 12px 10px; color: #8b8b8b; font-size: 12px; line-height: 18px; }

.visual-settings-content {
  min-width: 0;
  flex: 1 1 auto;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 58px clamp(38px, 5vw, 76px) 64px;
  background: #fdfdfd;
  user-select: text;
}
.visual-settings-content__inner { width: 100%; min-width: 0; max-width: 820px; margin: 0 auto; box-sizing: border-box; }
.visual-settings-content__inner.is-wide,
.visual-settings-content__inner.is-full { width: 100%; max-width: none; }

.visual-settings-content :deep(.visual-general-settings__header),
.visual-settings-content :deep(.usage-billing__header),
.visual-settings-content :deep(.section-header) { margin: 0 0 34px !important; padding: 0 !important; }
.visual-settings-content :deep(.visual-general-settings__header h2),
.visual-settings-content :deep(.usage-billing__header h2),
.visual-settings-content :deep(.section-header h2) {
  margin: 0 0 7px !important;
  color: #242424 !important;
  font-size: 28px !important;
  line-height: 36px !important;
  font-weight: 600 !important;
  letter-spacing: -.02em !important;
}
.visual-settings-content :deep(.visual-general-settings__header p),
.visual-settings-content :deep(.usage-billing__header p),
.visual-settings-content :deep(.section-description) {
  margin: 0 !important;
  color: #777 !important;
  font-size: 13px !important;
  line-height: 20px !important;
}
.visual-settings-content :deep(.visual-setting-list),
.visual-settings-content :deep(.usage-billing__group),
.visual-settings-content :deep(.settings-group) {
  border-color: #e5e5e3 !important;
  border-radius: 12px !important;
  background: #fdfdfd !important;
  box-shadow: none !important;
}
.visual-settings-content :deep(.visual-setting-row),
.visual-settings-content :deep(.usage-billing__row),
.visual-settings-content :deep(.setting-row) {
  min-height: 64px !important;
  padding: 13px 16px !important;
  border-bottom-color: #ececea !important;
}

.visual-settings-role-denied {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
}
.visual-settings-role-denied > :deep(.t-icon) { font-size: 32px; }

.visual-settings-fade-enter-active,.visual-settings-fade-leave-active { transition: opacity 160ms ease; }
.visual-settings-fade-enter-from,.visual-settings-fade-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .visual-settings-overlay { padding: 12px; }
  .visual-settings-overlay.is-route { padding: 0; }
  .visual-settings-modal { max-height: calc(100dvh - 24px); }
  .visual-settings-overlay.is-route .visual-settings-modal { max-height: none; }
  .visual-settings-sidebar { flex-basis: 220px; width: 220px; padding: 22px 12px 14px; }
  .visual-settings-content { padding: 46px 30px 48px; }
}
@media (max-width: 560px) {
  .visual-settings-overlay { align-items: stretch; padding: 0; }
  .visual-settings-modal { width: 100%; height: 100%; max-height: none; flex-direction: column; border: 0; border-radius: 0; }
  .visual-settings-sidebar { width: 100%; flex: 0 0 auto; max-height: 194px; padding: 12px; border-right: 0; border-bottom: 1px solid #e4e4e2; }
  .visual-settings-back { margin-bottom: 8px; }
  .visual-settings-search { height: 36px; margin-bottom: 9px; }
  .visual-settings-nav__group { display: none; }
  .visual-settings-nav { flex-direction: row; overflow-x: auto; overflow-y: hidden; gap: 4px; padding-right: 0; }
  .visual-settings-nav__item { flex: 0 0 auto; width: auto; }
  .visual-settings-nav__empty { margin: 8px 4px; }
  .visual-settings-content { padding: 30px 16px 38px; }
  .visual-settings-content :deep(.visual-general-settings__header h2),
  .visual-settings-content :deep(.usage-billing__header h2),
  .visual-settings-content :deep(.section-header h2) { font-size: 24px !important; line-height: 32px !important; }
}
@media (prefers-color-scheme: dark) {
  :root:not([theme-mode="light"]) .visual-settings-overlay.is-route,
  :root:not([theme-mode="light"]) .visual-settings-modal,
  :root:not([theme-mode="light"]) .visual-settings-content { background: #202124; color: #ececec; }
  :root:not([theme-mode="light"]) .visual-settings-sidebar { border-color: #38393c; background: #292a2d; }
  :root:not([theme-mode="light"]) .visual-settings-back,
  :root:not([theme-mode="light"]) .visual-settings-nav__group,
  :root:not([theme-mode="light"]) .visual-settings-nav__empty { color: #a9aaad; }
  :root:not([theme-mode="light"]) .visual-settings-back:hover,
  :root:not([theme-mode="light"]) .visual-settings-nav__item:hover { background: #343539; color: #f2f2f2; }
  :root:not([theme-mode="light"]) .visual-settings-nav__item { color: #d0d1d3; }
  :root:not([theme-mode="light"]) .visual-settings-nav__item.is-active { background: #3b3c40; color: #f5f5f5; }
  :root:not([theme-mode="light"]) .visual-settings-search { border-color: #44464a; background: #242528; color: #a9aaad; }
  :root:not([theme-mode="light"]) .visual-settings-search input { color: #f1f1f1; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.visual-setting-list),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.usage-billing__group),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.settings-group) { border-color: #3c3d40 !important; background: #202124 !important; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.visual-setting-row),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.usage-billing__row),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.setting-row),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.usage-billing__group h3) { border-bottom-color: #343539 !important; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(h2),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(h3),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(label),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(strong),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.info-value) { color: #f1f1f1 !important; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(p),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(small),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.desc) { color: #a9aaad !important; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.visual-general-settings .t-input),
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.usage-billing__secondary) { border-color: #44464a !important; background: #292a2d !important; color: #f1f1f1 !important; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.usage-billing__meter) { background: #3c4043 !important; }
  :root:not([theme-mode="light"]) .visual-settings-content :deep(.usage-billing__meter span) { background: #e8eaed !important; }
}
:root[theme-mode="dark"] .visual-settings-overlay.is-route,
:root[theme-mode="dark"] .visual-settings-modal,
:root[theme-mode="dark"] .visual-settings-content { background: #202124; color: #ececec; }
:root[theme-mode="dark"] .visual-settings-sidebar { border-color: #38393c; background: #292a2d; }
:root[theme-mode="dark"] .visual-settings-back,
:root[theme-mode="dark"] .visual-settings-nav__group,
:root[theme-mode="dark"] .visual-settings-nav__empty { color: #a9aaad; }
:root[theme-mode="dark"] .visual-settings-back:hover,
:root[theme-mode="dark"] .visual-settings-nav__item:hover { background: #343539; color: #f2f2f2; }
:root[theme-mode="dark"] .visual-settings-nav__item { color: #d0d1d3; }
:root[theme-mode="dark"] .visual-settings-nav__item.is-active { background: #3b3c40; color: #f5f5f5; }
:root[theme-mode="dark"] .visual-settings-search { border-color: #44464a; background: #242528; color: #a9aaad; }
:root[theme-mode="dark"] .visual-settings-search input { color: #f1f1f1; }
:root[theme-mode="dark"] .visual-settings-content :deep(.visual-setting-list),
:root[theme-mode="dark"] .visual-settings-content :deep(.usage-billing__group),
:root[theme-mode="dark"] .visual-settings-content :deep(.settings-group) { border-color: #3c3d40 !important; background: #202124 !important; }
:root[theme-mode="dark"] .visual-settings-content :deep(.visual-setting-row),
:root[theme-mode="dark"] .visual-settings-content :deep(.usage-billing__row),
:root[theme-mode="dark"] .visual-settings-content :deep(.setting-row),
:root[theme-mode="dark"] .visual-settings-content :deep(.usage-billing__group h3) { border-bottom-color: #343539 !important; }
:root[theme-mode="dark"] .visual-settings-content :deep(h2),
:root[theme-mode="dark"] .visual-settings-content :deep(h3),
:root[theme-mode="dark"] .visual-settings-content :deep(label),
:root[theme-mode="dark"] .visual-settings-content :deep(strong),
:root[theme-mode="dark"] .visual-settings-content :deep(.info-value) { color: #f1f1f1 !important; }
:root[theme-mode="dark"] .visual-settings-content :deep(p),
:root[theme-mode="dark"] .visual-settings-content :deep(small),
:root[theme-mode="dark"] .visual-settings-content :deep(.desc) { color: #a9aaad !important; }
:root[theme-mode="dark"] .visual-settings-content :deep(.visual-general-settings .t-input),
:root[theme-mode="dark"] .visual-settings-content :deep(.usage-billing__secondary) { border-color: #44464a !important; background: #292a2d !important; color: #f1f1f1 !important; }
:root[theme-mode="dark"] .visual-settings-content :deep(.usage-billing__meter) { background: #3c4043 !important; }
:root[theme-mode="dark"] .visual-settings-content :deep(.usage-billing__meter span) { background: #e8eaed !important; }
@media (prefers-reduced-motion: reduce) {
  .visual-settings-fade-enter-active,.visual-settings-fade-leave-active,.visual-settings-nav__item,.visual-settings-back { transition: none !important; }
}
</style>
