<template>
  <div class="general-settings">
    <div class="section-header">
      <h2>{{ $t('general.title') }}</h2>
      <p class="section-description">{{ $t('general.description') }}</p>
    </div>

    <div v-if="entitlement" class="plan-card">
      <div class="plan-card__header">
        <div>
          <span class="plan-card__eyebrow">{{ $t('entitlement.currentPlan') }}</span>
          <h3>{{ planName }}</h3>
        </div>
        <span class="plan-card__status">{{ entitlement.plan_status || $t('entitlement.active') }}</span>
      </div>
      <div class="plan-metrics">
        <div class="plan-metric">
          <span>{{ $t('entitlement.storage') }}</span>
          <strong>{{ formatBytes(entitlement.storage_used) }} / {{ formatBytes(entitlement.storage_bytes) }}</strong>
        </div>
        <div class="plan-metric">
          <span>{{ $t('entitlement.monthlyCredits') }}</span>
          <strong>{{ formatCredits(entitlement.openrouter_used_microusd) }} / {{ formatCredits(entitlement.monthly_openrouter_microusd) }}</strong>
        </div>
        <div class="plan-metric">
          <span>{{ $t('entitlement.knowledgeBases') }}</span>
          <strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong>
        </div>
        <div class="plan-metric">
          <span>{{ $t('entitlement.documentsPerKb') }}</span>
          <strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong>
        </div>
      </div>
      <p class="plan-note">
        {{ entitlement.video_upload ? $t('entitlement.videoPlanAllowed') : $t('entitlement.videoFreeBlocked') }}
        · {{ $t('entitlement.renewsMonthly', { month: entitlement.openrouter_usage_month }) }}
      </p>
      <p v-if="!billingConfigured" class="billing-note">{{ $t('entitlement.billingUnavailable') }}</p>
    </div>
    <div v-else-if="entitlementLoading" class="plan-card plan-card--loading">{{ $t('common.loading') }}</div>

    <div class="settings-group">
      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">{{ $t('language.language') }}</label>
          <p class="setting-description">{{ $t('language.languageDescription') }}</p>
        </div>
        <div class="setting-control">
          <t-select
            v-model="localLanguage"
            :placeholder="$t('language.selectLanguage')"
            style="width: 192px"
            @change="handleLanguageChange"
          >
            <t-option value="zh-CN" :label="$t('language.zhCN')">{{ $t('language.zhCN') }}</t-option>
            <t-option value="en-US" :label="$t('language.enUS')">{{ $t('language.enUS') }}</t-option>
            <t-option value="ru-RU" :label="$t('language.ruRU')">{{ $t('language.ruRU') }}</t-option>
            <t-option value="ko-KR" :label="$t('language.koKR')">{{ $t('language.koKR') }}</t-option>
          </t-select>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label">{{ $t('theme.theme') }}</label>
          <p class="setting-description">{{ $t('theme.themeDescription') }}</p>
        </div>
        <div class="setting-control">
          <t-select
            v-model="localTheme"
            style="width: 192px"
            :placeholder="$t('theme.selectTheme')"
            @change="handleThemeChange"
          >
            <t-option value="light" :label="$t('theme.light')">{{ $t('theme.light') }}</t-option>
            <t-option value="dark" :label="$t('theme.dark')">{{ $t('theme.dark') }}</t-option>
            <t-option value="system" :label="$t('theme.system')">{{ $t('theme.system') }}</t-option>
          </t-select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
const planName = computed(() => t(`entitlement.plans.${entitlement.value?.plan || 'free'}`))

watch(currentTheme, (value) => {
  localTheme.value = value
})

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
</script>

<style scoped>
.general-settings {
  width: 100%;
  font-family: var(--app-font-family, "Inter Variable", Inter, "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif);
}
.section-header { margin-bottom: 24px; }
.section-header h2 { margin: 0; color: #111827; font-size: 16px; line-height: 24px; font-weight: 700; }
.section-description { margin: 3px 0 0; color: #9ca3af; font-size: 12px; line-height: 16px; }
.settings-group { display: flex; flex-direction: column; }
.setting-info { min-width: 0; flex: 1; }
.setting-control { flex: 0 0 auto; display: flex; align-items: center; }
.plan-card {
  margin-bottom: 24px;
  padding: 18px;
  border: 1px solid rgb(229 231 235 / 70%);
  border-radius: 16px;
  background: #fff;
}
.plan-card--loading { color: #9ca3af; font-size: 12px; }
.plan-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.plan-card__eyebrow { color: #9ca3af; font-size: 10px; line-height: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.plan-card__header h3 { margin: 3px 0 0; color: #111827; font-size: 16px; line-height: 22px; font-weight: 700; }
.plan-card__status { padding: 2px 7px; border-radius: 6px; background: #111827; color: #fff; font-size: 9px; line-height: 14px; font-weight: 800; text-transform: uppercase; }
.plan-metrics { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.plan-metric { display: flex; flex-direction: column; gap: 4px; padding: 10px 11px; border: 1px solid #f3f4f6; border-radius: 12px; background: rgb(249 250 251 / 70%); }
.plan-metric span { color: #9ca3af; font-size: 10px; line-height: 14px; }
.plan-metric strong { color: #374151; font-size: 11px; line-height: 16px; font-weight: 700; }
.plan-note,.billing-note { margin: 10px 0 0; color: #9ca3af; font-size: 10px; line-height: 15px; }
.billing-note { color: #b45309; }
@media (max-width: 640px) {
  .plan-metrics { grid-template-columns: 1fr; }
  .setting-row { align-items: flex-start !important; flex-direction: column; }
  .setting-control,.setting-control :deep(.t-select) { width: 100% !important; }
}
</style>
