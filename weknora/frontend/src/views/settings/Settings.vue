<template>
  <Teleport to="body">
    <Transition name="visual-settings-fade">
      <div v-if="visible" class="visual-settings-overlay">
        <section class="visual-settings-modal" role="dialog" aria-modal="true" :aria-label="$t('general.settings')">
          <aside class="visual-settings-sidebar">
            <h2 class="visual-settings-title">{{ $t('general.settings') }}</h2>
            <nav class="visual-settings-nav" :aria-label="$t('general.settings')">
              <button
                type="button"
                class="visual-settings-nav__item"
                :class="{ 'is-active': currentSection === 'general' }"
                :aria-current="currentSection === 'general' ? 'page' : undefined"
                @click="selectSection('general')"
              >
                <t-icon name="setting" />
                <span>{{ $t('general.title') }}</span>
              </button>
              <button
                type="button"
                class="visual-settings-nav__item"
                :class="{ 'is-active': currentSection === 'models' }"
                :aria-current="currentSection === 'models' ? 'page' : undefined"
                @click="selectSection('models')"
              >
                <t-icon name="cpu" />
                <span>{{ $t('settings.modelManagement') }}</span>
              </button>
            </nav>
          </aside>

          <main class="visual-settings-content">
            <div class="visual-settings-content__inner">
              <GeneralSettings v-if="currentSection === 'general'" />
              <ModelSettings v-else :initial-type="currentModelType" />
            </div>
          </main>

          <button
            type="button"
            class="visual-settings-close"
            :aria-label="$t('general.close')"
            @click="handleClose"
          >
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
  padding: 24px;
  border-right: 1px solid #f3f4f6;
  background: #fff;
}

.visual-settings-title {
  margin: 0 0 24px;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}

.visual-settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.visual-settings-nav__item {
  width: 100%;
  min-height: 40px;
  padding: 10px 14px;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.visual-settings-nav__item :deep(.t-icon) {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.visual-settings-nav__item:hover {
  background: #f9fafb;
  color: #111827;
}

.visual-settings-nav__item.is-active {
  background: #f3f4f6;
  color: #111827;
  font-weight: 700;
}

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

.visual-settings-content__inner {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

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

.visual-settings-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.visual-settings-close :deep(.t-icon) {
  font-size: 16px;
}

.visual-settings-fade-enter-active,
.visual-settings-fade-leave-active {
  transition: opacity 160ms ease;
}

.visual-settings-fade-enter-from,
.visual-settings-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .visual-settings-overlay { padding: 12px; }
  .visual-settings-modal { max-height: calc(100dvh - 24px); }
  .visual-settings-sidebar { flex-basis: 184px; width: 184px; padding: 20px 12px; }
  .visual-settings-content { padding: 28px 24px; }
  .visual-settings-close { top: 18px; right: 18px; }
}

@media (max-width: 560px) {
  .visual-settings-overlay { align-items: stretch; padding: 0; }
  .visual-settings-modal {
    width: 100%;
    height: 100%;
    max-height: none;
    flex-direction: column;
    border: 0;
    border-radius: 0;
  }
  .visual-settings-sidebar {
    width: 100%;
    flex: 0 0 auto;
    padding: 16px;
    border-right: 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .visual-settings-title { margin-bottom: 12px; }
  .visual-settings-nav { flex-direction: row; padding-right: 36px; }
  .visual-settings-nav__item { width: auto; flex: 1 1 0; }
  .visual-settings-content { padding: 24px 16px 32px; }
  .visual-settings-close { top: 14px; right: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .visual-settings-fade-enter-active,
  .visual-settings-fade-leave-active,
  .visual-settings-nav__item,
  .visual-settings-close {
    transition: none !important;
  }
}
</style>
