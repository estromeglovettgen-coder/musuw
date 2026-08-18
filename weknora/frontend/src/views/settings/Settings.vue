<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="settings-overlay">
        <div class="settings-modal">
          <button class="close-btn" @click="handleClose" :aria-label="$t('general.close')">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>

          <div class="settings-container">
            <div class="settings-sidebar">
              <div class="sidebar-header">
                <h2 class="sidebar-title">{{ $t('general.settings') }}</h2>
              </div>
              <div class="settings-nav">
                <button
                  type="button"
                  class="nav-item"
                  :class="{ active: currentSection === 'general' }"
                  :aria-current="currentSection === 'general' ? 'page' : undefined"
                  @click="selectSection('general')"
                >
                  <t-icon name="setting" class="nav-icon" />
                  <span class="nav-label">{{ $t('general.title') }}</span>
                </button>
                <button
                  type="button"
                  class="nav-item"
                  :class="{ active: currentSection === 'models' }"
                  :aria-current="currentSection === 'models' ? 'page' : undefined"
                  @click="selectSection('models')"
                >
                  <t-icon name="chat" class="nav-icon" />
                  <span class="nav-label">{{ $t('settings.modelManagement') }}</span>
                </button>
              </div>
            </div>

            <div class="settings-content">
              <div class="content-wrapper">
                <div v-if="currentSection === 'general'" class="section">
                  <GeneralSettings />
                </div>
                <div v-else class="section">
                  <ModelSettings :initial-type="currentModelType" />
                </div>
              </div>
            </div>
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

<style lang="less" scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(23, 23, 23, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.settings-modal {
  position: relative;
  width: 100%;
  max-width: 896px;
  height: 520px;
  max-height: calc(100dvh - 48px);
  background: var(--td-bg-color-container);
  border-radius: 12px;
  border: 1px solid var(--td-component-stroke);
  box-shadow: var(--musuw-shadow-raised, 0 12px 32px rgba(38, 38, 38, 0.06));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  isolation: isolate;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  &:hover {
    background: var(--td-bg-color-container-hover);
    color: var(--td-text-color-primary);
  }

  &:focus-visible {
    border-color: var(--td-brand-color);
    outline: 2px solid var(--td-brand-color);
    outline-offset: 2px;
  }
}

.settings-container {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.settings-sidebar {
  width: 224px;
  background-color: var(--td-bg-color-settings-modal);
  border-right: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}

.sidebar-header {
  padding: 28px 24px 16px;
  border-bottom: 0;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0;
}

.settings-nav {
  padding: 8px 24px 16px;
}

.nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--td-text-color-secondary);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background-color: var(--td-bg-color-container-hover);
    color: var(--td-text-color-primary);
  }

  &.active {
    color: var(--td-brand-color);
    background-color: var(--td-brand-color-light);
  }

  & + & {
    margin-top: 4px;
  }
}

.nav-icon {
  margin-right: 9px;
  font-size: 16px;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  background-color: var(--td-bg-color-container);
}

.content-wrapper {
  width: 100%;
  max-width: 760px;
  padding: 40px 48px 48px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .settings-overlay {
    padding: 12px;
  }

  .settings-modal {
    max-height: calc(100dvh - 24px);
  }

  .settings-sidebar {
    width: 184px;
  }

  .sidebar-header {
    padding: 16px 12px 12px;
  }

  .settings-nav {
    padding: 12px 8px;
  }

  .content-wrapper {
    padding: 32px 24px 40px;
  }

  /* Keep the shared shell usable on tablets without rewriting each settings
     provider's row markup. */
  .settings-content :deep(.setting-row) {
    flex-direction: column;
    gap: 16px;
  }

  .settings-content :deep(.setting-info) {
    max-width: none;
    padding-right: 0;
  }

  .settings-content :deep(.setting-control) {
    min-width: 0;
    width: 100%;
    justify-content: flex-start;
  }

  .settings-content :deep(.setting-control .t-select) {
    width: 100% !important;
    max-width: 280px;
  }
}

@media (max-width: 560px) {
  .settings-overlay {
    align-items: stretch;
    padding: 0;
  }

  .settings-modal {
    border-radius: 0;
    border-width: 0;
    height: 100%;
    max-height: none;
  }

  .settings-container {
    flex-direction: column;
  }

  .settings-sidebar {
    width: auto;
    border-right: 0;
    border-bottom: 1px solid var(--td-component-stroke);
  }

  .sidebar-header {
    padding-bottom: 8px;
    border-bottom: 0;
  }

  .settings-nav {
    padding: 0 16px 12px;
  }

  .sidebar-title {
    font-size: 15px;
  }

  .content-wrapper {
    padding: 32px 16px 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-overlay,
  .settings-modal,
  .modal-enter-active,
  .modal-leave-active,
  .close-btn {
    transition: none;
  }
}
</style>
