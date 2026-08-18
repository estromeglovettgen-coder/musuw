<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="settings-overlay">
        <div class="settings-modal">
          <button class="close-btn" type="button" @click="handleClose" :aria-label="$t('general.close')">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>

          <div class="settings-container">
            <aside class="settings-sidebar">
              <div class="sidebar-header">
                <h2 class="sidebar-title">{{ $t('general.settings') }}</h2>
              </div>
              <nav class="settings-nav">
                <button
                  id="tab-btn-general"
                  type="button"
                  class="nav-item"
                  :class="{ active: currentSection === 'general' }"
                  :aria-current="currentSection === 'general' ? 'page' : undefined"
                  @click="selectSection('general')"
                >
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
                  </svg>
                  <span class="nav-label">{{ $t('general.title') }}</span>
                </button>
                <button
                  id="tab-btn-models"
                  type="button"
                  class="nav-item"
                  :class="{ active: currentSection === 'models' }"
                  :aria-current="currentSection === 'models' ? 'page' : undefined"
                  @click="selectSection('models')"
                >
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect width="16" height="16" x="4" y="4" rx="2" stroke="currentColor" stroke-width="2" />
                    <rect width="6" height="6" x="9" y="9" rx="1" stroke="currentColor" stroke-width="2" />
                    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  <span class="nav-label">{{ $t('settings.modelManagement') }}</span>
                </button>
              </nav>
            </aside>

            <section class="settings-content">
              <div class="content-wrapper">
                <div v-if="currentSection === 'general'" class="section">
                  <GeneralSettings />
                </div>
                <div v-else class="section">
                  <ModelSettings :initial-type="currentModelType" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import GeneralSettings from './GeneralSettings.vue'
import ModelSettings from './ModelSettings.vue'

const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()

type SettingsSection = 'general' | 'models'

const normalizeSettingsSection = (section?: string | null): SettingsSection =>
  section === 'models' ? 'models' : 'general'

const modalSection = ref<SettingsSection>('general')
const modalSubSection = ref<string | null>(null)

const visible = computed(() => route.path === '/platform/settings' || uiStore.showSettingsModal)
const currentSection = computed<SettingsSection>(() =>
  route.path === '/platform/settings'
    ? normalizeSettingsSection(typeof route.query.section === 'string' ? route.query.section : null)
    : modalSection.value,
)
const currentModelType = computed(() => {
  if (route.path === '/platform/settings') {
    return typeof route.query.tab === 'string' ? route.query.tab : null
  }
  return modalSubSection.value
})

const syncSettingsSection = (event?: Event) => {
  const detail = event instanceof CustomEvent ? event.detail : null
  const requestedSection = detail?.section
    ?? (route.path === '/platform/settings' ? route.query.section : uiStore.settingsInitialSection)
  const requestedSubSection = detail?.subsection
    ?? (route.path === '/platform/settings' ? route.query.tab : uiStore.settingsInitialSubSection)
  const section = normalizeSettingsSection(
    typeof requestedSection === 'string' ? requestedSection : null,
  )
  modalSection.value = section
  modalSubSection.value = typeof requestedSubSection === 'string' ? requestedSubSection : null

  if (route.path === '/platform/settings') {
    const nextQuery: Record<string, string> = { section }
    if (section === 'models' && modalSubSection.value) {
      nextQuery.tab = modalSubSection.value
    }
    if (route.query.section !== nextQuery.section || route.query.tab !== nextQuery.tab) {
      void router.replace({ path: '/platform/settings', query: nextQuery })
    }
  }
}

const selectSection = (section: SettingsSection) => {
  modalSection.value = section
  modalSubSection.value = null
  if (route.path === '/platform/settings') {
    void router.replace({ path: '/platform/settings', query: { section } })
  }
}

const handleClose = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  uiStore.closeSettings()
  if (route.path === '/platform/settings') {
    router.back()
  }
}

watch(
  () => [visible.value, route.query.section, route.query.tab],
  ([isVisible]) => {
    if (isVisible) syncSettingsSection()
  },
  { immediate: true },
)

watch(
  () => [uiStore.settingsInitialSection, uiStore.settingsInitialSubSection],
  () => {
    if (visible.value) syncSettingsSection()
  },
)

const handleSettingsNav = (event: Event) => syncSettingsSection(event)
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && visible.value) handleClose()
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
  window.addEventListener('settings-nav', handleSettingsNav)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('settings-nav', handleSettingsNav)
})
</script>

<style scoped>
.settings-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.nav-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
.nav-label { min-width: 0; }
.modal-enter-active,
.modal-leave-active { transition: opacity 150ms ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
</style>
