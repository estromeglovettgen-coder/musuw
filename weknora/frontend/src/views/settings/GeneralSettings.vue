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
        <div class="plan-metric" :class="{ 'plan-metric--unavailable': !creditsAvailable }">
          <span>{{ $t('entitlement.monthlyCredits') }}</span>
          <strong>{{ creditsDisplay }}</strong>
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
        <template v-if="creditsAvailable">
          · {{ $t('entitlement.renewsMonthly', { month: entitlement.openrouter_usage_month }) }}
        </template>
      </p>
      <p v-if="!billingConfigured" class="billing-note">{{ $t('entitlement.billingUnavailable') }}</p>
    </div>
    <div v-else-if="entitlementLoading" class="plan-card plan-card--loading">{{ $t('common.loading') }}</div>

    <div class="settings-group">
      <div class="setting-row">
        <div class="setting-info">
          <label>{{ $t('language.language') }}</label>
          <p class="desc">{{ $t('language.languageDescription') }}</p>
        </div>
        <div class="setting-control">
          <t-select
            v-model="localLanguage"
            :placeholder="$t('language.selectLanguage')"
            style="width: 280px"
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
          <label>{{ $t('theme.theme') }}</label>
          <p class="desc">{{ $t('theme.themeDescription') }}</p>
        </div>
        <div class="setting-control">
          <t-select
            v-model="localTheme"
            style="width: 280px"
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
const creditsAvailable = computed(() => entitlement.value?.openrouter_credits_status === 'available')

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
const creditsDisplay = computed(() => {
  if (!entitlement.value || !creditsAvailable.value) return '—'
  return `${formatCredits(entitlement.value.openrouter_used_microusd)} / ${formatCredits(entitlement.value.monthly_openrouter_microusd)}`
})
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

<style lang="less" scoped>
.general-settings {
  width: 100%;
}

.section-header {
  margin-bottom: 32px;

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin: 0 0 8px;
  }

  .section-description {
    font-size: 14px;
    color: var(--td-text-color-secondary);
    margin: 0;
    line-height: 1.5;
  }
}

.settings-group {
  display: flex;
  flex-direction: column;
}

.plan-card {
  margin-bottom: 24px;
  padding: 20px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 16px;
  background: var(--td-bg-color-container);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.plan-card--loading {
  color: var(--td-text-color-secondary);
}

.plan-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;

  h3 {
    margin: 3px 0 0;
    font-size: 24px;
    color: var(--td-text-color-primary);
  }
}

.plan-card__eyebrow,
.plan-metric span {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.plan-card__status {
  padding: 5px 10px;
  border-radius: 999px;
  color: #176b4d;
  background: #e8f7f0;
  font-size: 12px;
  text-transform: capitalize;
}

.plan-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.plan-metric {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border-radius: 12px;
  background: var(--td-bg-color-secondarycontainer);

  strong {
    color: var(--td-text-color-primary);
    font-size: 14px;
  }
}

.plan-metric--unavailable strong {
  color: var(--td-text-color-placeholder);
}

.plan-note,
.billing-note {
  margin: 14px 0 0;
  color: var(--td-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.billing-note {
  color: var(--td-warning-color);
}

@media (max-width: 640px) {
  .plan-metrics {
    grid-template-columns: 1fr;
  }
}

.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid var(--td-component-stroke);

  &:last-child {
    border-bottom: none;
  }
}

.setting-info {
  flex: 1;
  max-width: 65%;
  padding-right: 24px;

  label {
    font-size: 15px;
    font-weight: 500;
    color: var(--td-text-color-primary);
    display: block;
    margin-bottom: 4px;
  }

  .desc {
    font-size: 13px;
    color: var(--td-text-color-secondary);
    margin: 0;
    line-height: 1.5;
  }
}

.setting-control {
  flex-shrink: 0;
  min-width: 280px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
