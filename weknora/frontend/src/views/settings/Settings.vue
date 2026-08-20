<template>
  <Teleport to="body">
    <Transition name="visual-settings-fade">
      <div v-if="visible" class="visual-settings-overlay">
        <section
          class="visual-settings-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('general.settings')"
        >
          <aside class="visual-settings-sidebar">
            <h2 class="visual-settings-title">{{ $t('general.settings') }}</h2>
            <nav class="visual-settings-nav" :aria-label="$t('general.settings')">
              <button
                v-for="item in navItems"
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
            </nav>
          </aside>

          <main class="visual-settings-content">
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

          <button type="button" class="visual-settings-close" :aria-label="$t('general.close')" @click="handleClose">
            <t-icon name="close" />
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()
const authStore = useAuthStore()
const { t } = useI18n()

const currentSection = ref<string>('general')
const currentSubSection = ref<string>('')

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
  if (authStore.isLiteMode && section !== 'usage') return 'general'
  if (section === 'api') return integrationSectionKey('api')
  if (section === 'integrations') {
    return integrationSectionKey(integrationTabFromSection((route.query.tab as string) || 'im'))
  }
  return section
}

const canSeeSection = (key: string): boolean => {
  if (authStore.isLiteMode) return key === 'general' || key === 'usage'
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
  padding: 16px;
  background: rgb(0 0 0 / 45%);
  backdrop-filter: blur(4px);
  user-select: none;
}

.visual-settings-modal {
  position: relative;
  width: min(896px, 100%);
  height: 520px;
  max-height: calc(100dvh - 32px);
  min-width: 0;
  display: flex;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgb(229 231 235 / 90%);
  border-radius: 24px;
  background: #fff;
  color: #1f2937;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
  text-align: left;
}

.visual-settings-sidebar {
  flex: 0 0 224px;
  width: 224px;
  min-width: 0;
  box-sizing: border-box;
  padding: 24px 12px 16px 24px;
  border-right: 1px solid #f3f4f6;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.visual-settings-title {
  flex: 0 0 auto;
  margin: 0 12px 18px 0;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}

.visual-settings-nav {
  min-height: 0;
  flex: 1 1 auto;
  padding-right: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  scrollbar-width: thin;
}

.visual-settings-nav__item {
  width: 100%;
  min-height: 34px;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.visual-settings-nav__item :deep(.t-icon), .visual-settings-nav__emoji {
  flex: 0 0 15px;
  width: 15px;
  height: 15px;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.visual-settings-nav__item > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-settings-nav__item:hover { background: #f9fafb; color: #111827; }
.visual-settings-nav__item.is-active { background: #f3f4f6; color: #111827; font-weight: 700; }

.visual-settings-content {
  min-width: 0;
  flex: 1 1 auto;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 32px;
  background: #fff;
  user-select: text;
}
.visual-settings-content__inner { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }
.visual-settings-content__inner.is-wide,
.visual-settings-content__inner.is-full { width: 100%; max-width: none; }

.visual-settings-close {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 2;
  width: 28px;
  height: 28px;
  padding: 6px;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.visual-settings-close:hover { background: #f3f4f6; color: #374151; }
.visual-settings-close :deep(.t-icon) { font-size: 16px; }

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
  .visual-settings-modal { max-height: calc(100dvh - 24px); }
  .visual-settings-sidebar { flex-basis: 184px; width: 184px; padding: 20px 8px 14px 12px; }
  .visual-settings-content { padding: 28px 24px; }
  .visual-settings-close { top: 18px; right: 18px; }
}
@media (max-width: 560px) {
  .visual-settings-overlay { align-items: stretch; padding: 0; }
  .visual-settings-modal { width: 100%; height: 100%; max-height: none; flex-direction: column; border: 0; border-radius: 0; }
  .visual-settings-sidebar { width: 100%; flex: 0 0 auto; max-height: 180px; padding: 14px 12px; border-right: 0; border-bottom: 1px solid #f3f4f6; }
  .visual-settings-title { margin-bottom: 8px; }
  .visual-settings-nav { flex-direction: row; overflow-x: auto; overflow-y: hidden; gap: 4px; padding-right: 36px; }
  .visual-settings-nav__item { flex: 0 0 auto; width: auto; }
  .visual-settings-content { padding: 24px 16px 32px; }
  .visual-settings-close { top: 12px; right: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .visual-settings-fade-enter-active,.visual-settings-fade-leave-active,.visual-settings-nav__item,.visual-settings-close { transition: none !important; }
}
</style>
