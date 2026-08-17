<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        id="settings-modal-backdrop"
        class="settings-reference-backdrop"
        @mousedown.self="handleClose"
      >
        <div id="settings-modal-dialog" class="settings-reference-dialog">
          <aside class="settings-reference-nav">
            <h2>{{ $t('general.settings') }}</h2>
            <nav>
              <button
                id="tab-btn-general"
                type="button"
                :class="{ active: currentSection === 'general' }"
                :aria-current="currentSection === 'general' ? 'page' : undefined"
                @click="selectSection('general')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{{ $t('general.title') }}</span>
              </button>

              <button
                id="tab-btn-models"
                type="button"
                :class="{ active: currentSection === 'models' }"
                :aria-current="currentSection === 'models' ? 'page' : undefined"
                @click="selectSection('models')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="16" height="16" x="4" y="4" rx="2" />
                  <rect width="6" height="6" x="9" y="9" rx="1" />
                  <path d="M9 1v3" /><path d="M15 1v3" /><path d="M9 20v3" /><path d="M15 20v3" />
                  <path d="M20 9h3" /><path d="M20 14h3" /><path d="M1 9h3" /><path d="M1 14h3" />
                </svg>
                <span>{{ $t('settings.modelManagement') }}</span>
              </button>
            </nav>
          </aside>

          <section class="settings-reference-content">
            <button
              id="btn-close-settings"
              type="button"
              class="settings-reference-close"
              :aria-label="$t('general.close')"
              :title="$t('general.close')"
              @click="handleClose"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>

            <div class="settings-reference-heading">
              <h3>
                {{ currentSection === 'general' ? $t('general.title') : $t('settings.modelManagement') }}
              </h3>
              <p>
                {{ currentSection === 'general'
                  ? $t('settings.generalDescription')
                  : $t('settings.modelManagementDescription') }}
              </p>
            </div>

            <div class="settings-reference-body">
              <GeneralSettings v-if="currentSection === 'general'" />
              <ModelSettings v-else :initial-type="currentModelType" />
            </div>
          </section>
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
.settings-reference-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(0 0 0 / 45%);
  backdrop-filter: blur(4px);
  user-select: none;
  font-family: Inter, "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.settings-reference-dialog {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 896px;
  height: 520px;
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  border: 1px solid rgb(229 231 235 / 90%);
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
  color: #111827;
  text-align: left;
}
.settings-reference-nav {
  width: 224px;
  flex: 0 0 224px;
  padding: 24px;
  border-right: 1px solid #f3f4f6;
  background: #fff;
}
.settings-reference-nav h2 {
  margin: 0 0 24px;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.settings-reference-nav nav { display: flex; flex-direction: column; gap: 4px; }
.settings-reference-nav button {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}
.settings-reference-nav button:hover { background: #f9fafb; }
.settings-reference-nav button.active { background: #f3f4f6; color: #111827; font-weight: 700; }
.settings-reference-nav button svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.settings-reference-content {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  padding: 32px;
  background: #fff;
}
.settings-reference-close {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}
.settings-reference-close:hover { color: #374151; background: #f3f4f6; }
.settings-reference-close svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
.settings-reference-heading { margin-bottom: 32px; padding-right: 40px; }
.settings-reference-heading h3 { margin: 0; color: #111827; font-size: 16px; line-height: 24px; font-weight: 700; }
.settings-reference-heading p { margin: 4px 0 0; color: #9ca3af; font-size: 12px; line-height: 16px; }
.settings-reference-body { min-width: 0; flex: 1; }
.settings-reference-body :deep(.section-title),
.settings-reference-body :deep(.settings-title),
.settings-reference-body :deep(h1:first-child),
.settings-reference-body :deep(h2:first-child) { display: none !important; }
.modal-enter-active,.modal-leave-active { transition: opacity 150ms ease; }
.modal-enter-from,.modal-leave-to { opacity: 0; }
@media (max-width: 640px) {
  .settings-reference-backdrop { padding: 0; }
  .settings-reference-dialog { height: 100%; max-height: none; border: 0; border-radius: 0; flex-direction: column; }
  .settings-reference-nav { width: 100%; flex-basis: auto; padding: 16px; border-right: 0; border-bottom: 1px solid #f3f4f6; }
  .settings-reference-nav h2 { margin-bottom: 10px; }
  .settings-reference-nav nav { flex-direction: row; }
  .settings-reference-nav button { width: auto; }
  .settings-reference-content { padding: 24px 16px; }
}
</style>
