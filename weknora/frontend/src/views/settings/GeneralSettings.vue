<template>
  <div class="general-settings-reference">
    <div v-if="entitlement" class="reference-plan-card">
      <div class="reference-plan-head">
        <div>
          <span class="reference-eyebrow">{{ $t('entitlement.currentPlan') }}</span>
          <h4>{{ planName }}</h4>
        </div>
        <span class="reference-plan-badge">{{ entitlement.plan_status || $t('entitlement.active') }}</span>
      </div>
      <div class="reference-plan-grid">
        <div><span>{{ $t('entitlement.storage') }}</span><strong>{{ formatBytes(entitlement.storage_used) }} / {{ formatBytes(entitlement.storage_bytes) }}</strong></div>
        <div><span>{{ $t('entitlement.monthlyCredits') }}</span><strong>{{ formatCredits(entitlement.openrouter_used_microusd) }} / {{ formatCredits(entitlement.monthly_openrouter_microusd) }}</strong></div>
        <div><span>{{ $t('entitlement.knowledgeBases') }}</span><strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong></div>
        <div><span>{{ $t('entitlement.documentsPerKb') }}</span><strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong></div>
      </div>
      <p class="reference-plan-note">
        {{ entitlement.video_upload ? $t('entitlement.videoPlanAllowed') : $t('entitlement.videoFreeBlocked') }}
        · {{ $t('entitlement.renewsMonthly', { month: entitlement.openrouter_usage_month }) }}
      </p>
      <p v-if="!billingConfigured" class="reference-billing-note">{{ $t('entitlement.billingUnavailable') }}</p>
    </div>
    <div v-else-if="entitlementLoading" class="reference-plan-card reference-plan-loading">{{ $t('common.loading') }}</div>

    <div class="reference-setting-list">
      <div class="reference-setting-row">
        <div class="reference-setting-copy">
          <h4>{{ $t('language.language') }}</h4>
          <p>{{ $t('language.languageDescription') }}</p>
        </div>
        <div ref="languageDropdownRef" class="reference-select-wrap">
          <button
            id="select-language-trigger"
            type="button"
            class="reference-select-trigger"
            @click="languageOpen = !languageOpen; themeOpen = false"
          >
            <span>{{ languageLabel }}</span>
            <svg :class="{ open: languageOpen }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div v-if="languageOpen" class="reference-select-menu">
            <button
              v-for="option in languageOptions"
              :key="option.value"
              type="button"
              :class="{ selected: localLanguage === option.value }"
              @click="selectLanguage(option.value)"
            >
              <span>{{ option.label }}</span>
              <svg v-if="localLanguage === option.value" viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="reference-setting-row">
        <div class="reference-setting-copy">
          <h4>{{ $t('theme.theme') }}</h4>
          <p>{{ $t('theme.themeDescription') }}</p>
        </div>
        <div ref="themeDropdownRef" class="reference-select-wrap">
          <button
            id="select-theme-trigger"
            type="button"
            class="reference-select-trigger"
            @click="themeOpen = !themeOpen; languageOpen = false"
          >
            <span>{{ themeLabel }}</span>
            <svg :class="{ open: themeOpen }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div v-if="themeOpen" class="reference-select-menu">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              :class="{ selected: localTheme === option.value }"
              @click="selectTheme(option.value)"
            >
              <span>{{ option.label }}</span>
              <svg v-if="localTheme === option.value" viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { normalizeLocale, persistLocalePreference } from '@/i18n/locale'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { getCurrentEntitlement, type ConsumerEntitlement } from '@/api/entitlement'

const { t, locale } = useI18n()
const { currentTheme, setTheme } = useTheme()
const localLanguage = ref(locale.value)
const localTheme = ref<ThemeMode>(currentTheme.value)
const entitlement = ref<ConsumerEntitlement | null>(null)
const entitlementLoading = ref(true)
const billingConfigured = ref(false)
const languageOpen = ref(false)
const themeOpen = ref(false)
const languageDropdownRef = ref<HTMLElement | null>(null)
const themeDropdownRef = ref<HTMLElement | null>(null)
const planName = computed(() => t(`entitlement.plans.${entitlement.value?.plan || 'free'}`))

const languageOptions = computed(() => [
  { value: 'zh-CN', label: t('language.zhCN') },
  { value: 'en-US', label: t('language.enUS') },
  { value: 'ru-RU', label: t('language.ruRU') },
  { value: 'ko-KR', label: t('language.koKR') },
])
const themeOptions = computed<Array<{ value: ThemeMode; label: string }>>(() => [
  { value: 'light', label: t('theme.light') },
  { value: 'dark', label: t('theme.dark') },
  { value: 'system', label: t('theme.system') },
])
const languageLabel = computed(() => languageOptions.value.find((item) => item.value === localLanguage.value)?.label || localLanguage.value)
const themeLabel = computed(() => themeOptions.value.find((item) => item.value === localTheme.value)?.label || localTheme.value)

watch(currentTheme, (value) => {
  localTheme.value = value
})

const handleDocumentMouseDown = (event: MouseEvent) => {
  const target = event.target as Node
  if (!languageDropdownRef.value?.contains(target)) languageOpen.value = false
  if (!themeDropdownRef.value?.contains(target)) themeOpen.value = false
}

onMounted(() => {
  let savedLocale: string | null = null
  try {
    savedLocale = localStorage.getItem('locale')
  } catch {
    savedLocale = null
  }
  const normalized = normalizeLocale(savedLocale)
  localLanguage.value = normalized || locale.value
  if (normalized) locale.value = normalized

  document.addEventListener('mousedown', handleDocumentMouseDown)

  getCurrentEntitlement()
    .then((response) => {
      entitlement.value = response.data
      billingConfigured.value = response.billing.configured
    })
    .catch(() => {
      entitlement.value = null
    })
    .finally(() => {
      entitlementLoading.value = false
    })
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
})

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB'
  return `${(bytes / 1024 / 1024 / 1024).toFixed(bytes < 1024 ** 3 ? 2 : 1)} GB`
}

const formatCredits = (microusd: number) => `$${(Math.max(0, microusd) / 1_000_000).toFixed(2)}`
const formatLimit = (limit: number) => limit > 0 ? String(limit) : t('entitlement.unlimited')

const handleLanguageChange = () => {
  const persisted = persistLocalePreference(localLanguage.value)
  if (!persisted) {
    localLanguage.value = locale.value
    return
  }
  locale.value = persisted
  MessagePlugin.success(t('language.languageSaved'))
}

const handleThemeChange = (value: ThemeMode) => {
  if (!setTheme(value)) {
    localTheme.value = currentTheme.value
    return
  }
  MessagePlugin.success(t('common.success'))
}

const selectLanguage = (value: string) => {
  localLanguage.value = value
  languageOpen.value = false
  handleLanguageChange()
}
const selectTheme = (value: ThemeMode) => {
  localTheme.value = value
  themeOpen.value = false
  handleThemeChange(value)
}
</script>

<style scoped>
.general-settings-reference {
  width: 100%;
  color: #111827;
  font-family: Inter, "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-plan-card {
  margin-bottom: 24px;
  padding: 18px;
  border: 1px solid rgb(229 231 235 / 70%);
  border-radius: 16px;
  background: #fff;
}
.reference-plan-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.reference-eyebrow { color: #9ca3af; font-size: 10px; line-height: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.reference-plan-head h4 { margin: 3px 0 0; color: #111827; font-size: 16px; line-height: 22px; font-weight: 700; }
.reference-plan-badge { padding: 2px 7px; border-radius: 6px; background: #111827; color: #fff; font-size: 9px; line-height: 14px; font-weight: 800; text-transform: uppercase; }
.reference-plan-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.reference-plan-grid > div { display: flex; flex-direction: column; gap: 4px; padding: 10px 11px; border: 1px solid #f3f4f6; border-radius: 12px; background: rgb(249 250 251 / 70%); }
.reference-plan-grid span { color: #9ca3af; font-size: 10px; line-height: 14px; }
.reference-plan-grid strong { color: #374151; font-size: 11px; line-height: 16px; font-weight: 700; }
.reference-plan-note,.reference-billing-note { margin: 10px 0 0; color: #9ca3af; font-size: 10px; line-height: 15px; }
.reference-billing-note { color: #b45309; }
.reference-plan-loading { color: #9ca3af; font-size: 12px; }
.reference-setting-list { display: flex; flex-direction: column; }
.reference-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 0 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid #f3f4f6;
}
.reference-setting-row:last-child { margin-bottom: 0; }
.reference-setting-copy { min-width: 0; flex: 1; }
.reference-setting-copy h4 { margin: 0; color: #111827; font-size: 12px; line-height: 16px; font-weight: 700; }
.reference-setting-copy p { margin: 2px 0 0; color: #9ca3af; font-size: 12px; line-height: 16px; }
.reference-select-wrap { position: relative; width: 192px; flex: 0 0 192px; }
.reference-select-trigger {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
}
.reference-select-trigger:hover { border-color: #d1d5db; }
.reference-select-trigger svg { width: 14px; height: 14px; flex: 0 0 14px; fill: none; stroke: #9ca3af; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 150ms ease; }
.reference-select-trigger svg.open { transform: rotate(180deg); stroke: #4b5563; }
.reference-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: 100%;
  padding: 4px 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px rgb(0 0 0 / 10%);
}
.reference-select-menu button {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  border: 0;
  background: #fff;
  color: #374151;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.reference-select-menu button:hover { background: #f9fafb; }
.reference-select-menu button.selected { background: #f3f4f6; color: #111827; font-weight: 700; }
.reference-select-menu button svg { width: 14px; height: 14px; fill: none; stroke: #111827; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 640px) {
  .reference-plan-grid { grid-template-columns: 1fr; }
  .reference-setting-row { align-items: flex-start; flex-direction: column; gap: 12px; }
  .reference-select-wrap { width: 100%; flex-basis: auto; }
}
</style>
