<template>
  <section class="visual-general-settings">
    <header class="visual-general-settings__header">
      <h2>{{ $t('general.title') }}</h2>
      <p>{{ $t('general.description') }}</p>
    </header>

    <div v-if="entitlement" class="visual-plan-card">
      <div class="visual-plan-card__top">
        <div class="visual-plan-card__identity">
          <span>{{ $t('entitlement.currentPlan') }}</span>
          <strong>{{ planName }}</strong>
        </div>
        <span class="visual-plan-card__status">{{ entitlement.plan_status || $t('entitlement.active') }}</span>
      </div>

      <div class="visual-plan-card__metrics">
        <div class="visual-plan-metric">
          <span>{{ $t('entitlement.storage') }}</span>
          <strong>{{ formatBytes(entitlement.storage_used) }} / {{ formatBytes(entitlement.storage_bytes) }}</strong>
        </div>
        <div class="visual-plan-metric">
          <span>{{ $t('entitlement.monthlyCredits') }}</span>
          <strong>{{ formatCredits(entitlement.openrouter_used_microusd) }} / {{ formatCredits(entitlement.monthly_openrouter_microusd) }}</strong>
        </div>
        <div class="visual-plan-metric">
          <span>{{ $t('entitlement.knowledgeBases') }}</span>
          <strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong>
        </div>
        <div class="visual-plan-metric">
          <span>{{ $t('entitlement.documentsPerKb') }}</span>
          <strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong>
        </div>
      </div>

      <p class="visual-plan-card__note">
        {{ entitlement.video_upload ? $t('entitlement.videoPlanAllowed') : $t('entitlement.videoFreeBlocked') }}
        · {{ $t('entitlement.renewsMonthly', { month: entitlement.openrouter_usage_month }) }}
      </p>
      <p v-if="!billingConfigured" class="visual-plan-card__warning">{{ $t('entitlement.billingUnavailable') }}</p>
    </div>
    <div v-else-if="entitlementLoading" class="visual-plan-card visual-plan-card--loading">
      {{ $t('common.loading') }}
    </div>

    <div class="visual-setting-list">
      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-language-select">{{ $t('language.language') }}</label>
          <p>{{ $t('language.languageDescription') }}</p>
        </div>
        <div class="visual-setting-row__control">
          <t-select
            id="visual-language-select"
            v-model="localLanguage"
            :placeholder="$t('language.selectLanguage')"
            @change="handleLanguageChange"
          >
            <t-option value="zh-CN" :label="$t('language.zhCN')">{{ $t('language.zhCN') }}</t-option>
            <t-option value="en-US" :label="$t('language.enUS')">{{ $t('language.enUS') }}</t-option>
            <t-option value="ru-RU" :label="$t('language.ruRU')">{{ $t('language.ruRU') }}</t-option>
            <t-option value="ko-KR" :label="$t('language.koKR')">{{ $t('language.koKR') }}</t-option>
          </t-select>
        </div>
      </div>

      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-theme-select">{{ $t('theme.theme') }}</label>
          <p>{{ $t('theme.themeDescription') }}</p>
        </div>
        <div class="visual-setting-row__control">
          <t-select
            id="visual-theme-select"
            v-model="localTheme"
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
  </section>
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

<style scoped lang="less">
.visual-general-settings {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: #1f2937;
}

.visual-general-settings__header {
  margin: 0 0 24px;
  padding-right: 40px;
}

.visual-general-settings__header h2 {
  margin: 0 0 4px;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}

.visual-general-settings__header p {
  margin: 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.visual-plan-card {
  width: 100%;
  min-width: 0;
  margin: 0 0 24px;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.visual-plan-card--loading {
  color: #9ca3af;
  font-size: 12px;
}

.visual-plan-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.visual-plan-card__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.visual-plan-card__identity span,
.visual-plan-metric span {
  color: #9ca3af;
  font-size: 10px;
  line-height: 14px;
}

.visual-plan-card__identity strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
}

.visual-plan-card__status {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 10px;
  line-height: 16px;
  font-weight: 600;
  text-transform: capitalize;
}

.visual-plan-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.visual-plan-metric {
  min-width: 0;
  padding: 10px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #f9fafb;
}

.visual-plan-metric strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.visual-plan-card__note,
.visual-plan-card__warning {
  margin: 12px 0 0;
  color: #9ca3af;
  font-size: 10px;
  line-height: 16px;
}

.visual-plan-card__warning { color: #b45309; }

.visual-setting-list {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.visual-setting-row {
  width: 100%;
  min-width: 0;
  padding: 0 0 24px;
  margin: 0 0 24px;
  box-sizing: border-box;
  border-bottom: 1px solid #f3f4f6;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  align-items: center;
  gap: 24px;
}

.visual-setting-row:last-child {
  margin-bottom: 0;
  border-bottom: 0;
}

.visual-setting-row__copy {
  min-width: 0;
}

.visual-setting-row__copy label {
  display: block;
  margin: 0 0 2px;
  color: #111827;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
}

.visual-setting-row__copy p {
  margin: 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.visual-setting-row__control {
  width: 220px;
  min-width: 0;
  justify-self: end;
}

.visual-setting-row__control :deep(.t-select) {
  width: 100%;
}

.visual-setting-row__control :deep(.t-input) {
  min-height: 34px;
  border-color: #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #374151;
  font-size: 12px;
}

@media (max-width: 720px) {
  .visual-setting-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .visual-setting-row__control {
    width: min(280px, 100%);
    justify-self: start;
  }
}

@media (max-width: 520px) {
  .visual-plan-card__metrics { grid-template-columns: 1fr; }
  .visual-general-settings__header { padding-right: 28px; }
}
</style>
