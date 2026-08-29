<template>
  <VisualSettingsShell
    :visible="visible"
    :dialog-label="$t('general.settings')"
    :content-label="activeNavLabel"
    :route-mode="isSettingsRoute"
    :content-wide="currentSection === 'members'"
    :content-full="SYSTEM_ADMIN_SECTIONS.has(currentSection) || isIntegrationSection(currentSection)"
    @close="handleClose"
  >
    <template #nav>
      <button
        v-for="item in filteredNavItems"
        :key="item.key"
        type="button"
        class="visual-settings-nav__item"
        :class="{ 'is-active': currentSection === item.key }"
        :aria-current="currentSection === item.key ? 'page' : undefined"
        @click="handleNavClick(item)"
      >
        <span>{{ item.label }}</span>
      </button>
      <p v-if="filteredNavItems.length === 0" class="visual-settings-nav__empty">
        {{ $t('general.noMatchingSettings') }}
      </p>
    </template>

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
  </VisualSettingsShell>
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
import { filterSettingsNavigation } from './settingsNavigation'
import VisualSettingsShell from './components/VisualSettingsShell.vue'

const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()
const authStore = useAuthStore()
const { t } = useI18n()

const currentSection = ref<string>('general')
const currentSubSection = ref<string>('')
const settingsSearchQuery = ref('')

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
  // Consumer Lite exposes personal settings, usage, consumer model choices,
  // and the native MCP settings surface for tenant admins.
  // Internal events/deep-links cannot reopen hidden management sections.
  if (authStore.isLiteMode && section !== 'usage' && section !== 'userprofile' && section !== 'models' && section !== 'mcp') return 'general'
  if (section === 'api') return integrationSectionKey('api')
  if (section === 'integrations') {
    return integrationSectionKey(integrationTabFromSection((route.query.tab as string) || 'im'))
  }
  return section
}

const canSeeSection = (key: string): boolean => {
  if (authStore.isLiteMode) {
    if (key === 'mcp') return authStore.canAccessAllTenants || authStore.hasRole('admin')
    return key === 'general' || key === 'usage' || key === 'userprofile' || key === 'models'
  }
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
      { key: 'userprofile', icon: 'user', label: t('userProfile.title') },
      { key: 'models', icon: 'cpu', label: t('modelSettings.sceneModels.navTitle') },
      ...(authStore.canAccessAllTenants || authStore.hasRole('admin')
        ? [{ key: 'mcp', icon: 'tools', label: t('settings.mcpService') }]
        : []),
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
      void router.replace('/platform/knowledge-bases')
    } else {
      const previousPath = router.options.history.state.back
      const previousRoutePath = typeof previousPath === 'string' ? previousPath.split(/[?#]/, 1)[0] : ''
      if (previousRoutePath.startsWith('/platform/') && previousRoutePath !== '/platform/settings') {
        router.back()
      } else {
        void router.replace('/platform/knowledge-bases')
      }
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

onMounted(() => {
  window.addEventListener('settings-nav', handleSettingsNav)
})

watch(currentSection, () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
})

onUnmounted(() => {
  window.removeEventListener('settings-nav', handleSettingsNav)
})
</script>
