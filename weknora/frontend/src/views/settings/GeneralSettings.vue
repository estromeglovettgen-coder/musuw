<template>
  <section class="visual-general-settings">
    <header class="visual-general-settings__header">
      <h2>{{ $t('general.title') }}</h2>
      <p>{{ $t('general.description') }}</p>
    </header>

    <section v-if="entitlement" class="plan-card visual-plan-card">
      <header class="visual-plan-card__header">
        <div>
          <span>{{ $t('entitlement.currentPlan') }}</span>
          <h3>{{ planName }}</h3>
        </div>
        <span class="visual-plan-card__status">{{ planStatusLabel }}</span>
      </header>
      <div class="visual-plan-card__metrics">
        <div><span>{{ $t('entitlement.storage') }}</span><strong>{{ formatBytes(entitlement.storage_used) }} / {{ formatBytes(entitlement.storage_bytes) }}</strong></div>
        <div :class="{ 'is-unavailable': !creditsAvailable }"><span>{{ $t('entitlement.monthlyCredits') }}</span><strong>{{ creditsDisplay }}</strong></div>
        <div><span>{{ $t('entitlement.knowledgeBases') }}</span><strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong></div>
        <div><span>{{ $t('entitlement.documentsPerKb') }}</span><strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong></div>
      </div>
      <p>
        {{ entitlement.video_upload ? $t('entitlement.videoPlanAllowed') : $t('entitlement.videoFreeBlocked') }}
        <template v-if="creditsAvailable"> · {{ $t('entitlement.renewsMonthly', { month: entitlement.openrouter_usage_month }) }}</template>
      </p>
      <p v-if="!billingConfigured" class="visual-plan-card__billing">{{ $t('entitlement.billingUnavailable') }}</p>
      <template v-else>
        <div v-if="checkoutAvailable" class="visual-plan-card__checkout">
          <div class="visual-plan-card__checkout-controls">
            <t-select v-model="checkoutPlan" :aria-label="$t('entitlement.choosePlan')">
              <t-option value="plus" :label="$t('entitlement.plans.plus')" />
              <t-option value="pro" :label="$t('entitlement.plans.pro')" />
              <t-option value="max" :label="$t('entitlement.plans.max')" />
            </t-select>
            <t-radio-group v-model="checkoutPeriod">
              <t-radio-button value="monthly">{{ $t('entitlement.monthly') }}</t-radio-button>
              <t-radio-button value="yearly">{{ $t('entitlement.yearly') }}</t-radio-button>
            </t-radio-group>
            <t-button theme="primary" :loading="checkoutOpening" :disabled="!selectedCheckoutOption" @click="handleCheckout">
              {{ $t('entitlement.continueToCheckout') }}
            </t-button>
          </div>
          <p>{{ $t('entitlement.checkoutSecureNote') }}</p>
        </div>
        <div v-if="portalAvailable" class="visual-plan-card__portal">
          <p class="visual-plan-card__managed">{{ $t('entitlement.billingManaged') }}</p>
          <t-button variant="outline" :loading="portalOpening" @click="handlePortal">
            {{ $t('entitlement.manageBilling') }}
          </t-button>
        </div>
        <p v-else-if="!checkoutAvailable" class="visual-plan-card__managed">{{ $t('entitlement.billingManaged') }}</p>
      </template>
    </section>
    <section v-else-if="entitlementLoading" class="plan-card visual-plan-card is-loading">{{ $t('common.loading') }}</section>

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

      <div v-if="!authStore.isLiteMode" class="visual-setting-row">
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

      <div v-if="!authStore.isLiteMode" class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-sans-font-select">{{ $t('font.uiFont') }}</label>
          <p>{{ $t('font.uiFontDescription') }}</p>
        </div>
        <div class="visual-setting-row__control is-stacked">
          <t-select
            id="visual-sans-font-select"
            v-model="localSansFont"
            :placeholder="$t('font.selectFont')"
            @change="handleSansFontChange"
          >
            <t-option
              v-for="opt in sansFontOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <span :style="{ fontFamily: opt.preview }">{{ opt.label }}</span>
            </t-option>
          </t-select>
          <span class="visual-font-preview" :style="{ fontFamily: currentSansStack }">{{ $t('font.sansPreview') }}</span>
        </div>
      </div>

      <div v-if="!authStore.isLiteMode" class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-mono-font-select">{{ $t('font.monoFont') }}</label>
          <p>{{ $t('font.monoFontDescription') }}</p>
        </div>
        <div class="visual-setting-row__control is-stacked">
          <t-select
            id="visual-mono-font-select"
            v-model="localMonoFont"
            :placeholder="$t('font.selectFont')"
            @change="handleMonoFontChange"
          >
            <t-option
              v-for="opt in monoFontOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <span :style="{ fontFamily: opt.preview }">{{ opt.label }}</span>
            </t-option>
          </t-select>
          <span class="visual-font-preview" :style="{ fontFamily: currentMonoStack }">{{ $t('font.monoPreview') }}</span>
        </div>
      </div>

      <div v-if="!authStore.isLiteMode" class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label>{{ $t('font.fontSize') }}</label>
          <p>{{ $t('font.fontSizeDescription') }}</p>
        </div>
        <div class="visual-setting-row__control">
          <t-radio-group v-model="localFontSize" @change="handleFontSizeChange">
            <t-radio-button value="small">{{ $t('font.size.small') }}</t-radio-button>
            <t-radio-button value="normal">{{ $t('font.size.normal') }}</t-radio-button>
            <t-radio-button value="large">{{ $t('font.size.large') }}</t-radio-button>
          </t-radio-group>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { normalizeLocale, persistLocalePreference } from '@/i18n/locale'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import {
  createPaddlePortalSession,
  getCurrentEntitlement,
  type BillingPeriod,
  type ConsumerEntitlement,
  type PaddleBillingConfig,
  type PaidConsumerPlan,
} from '@/api/entitlement'
import { openPaddleCheckout } from '@/utils/paddleCheckout'
import {
  useFont,
  SANS_STACKS,
  MONO_STACKS,
  visibleSansKeys,
  visibleMonoKeys,
  type FontKey,
  type MonoFontKey,
  type FontSizeKey,
} from '@/composables/useFont'

const { t, locale } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const { currentTheme, setTheme } = useTheme()
const {
  currentSans,
  currentMono,
  currentSize,
  setSansFont,
  setMonoFont,
  setFontSize,
} = useFont()

const localLanguage = ref(locale.value)
const localTheme = ref<ThemeMode>(currentTheme.value)
const localSansFont = ref<FontKey>(currentSans.value)
const localMonoFont = ref<MonoFontKey>(currentMono.value)
const localFontSize = ref<FontSizeKey>(currentSize.value)
const entitlement = ref<ConsumerEntitlement | null>(null)
const entitlementLoading = ref(true)
const billing = ref<PaddleBillingConfig | null>(null)
const checkoutPlan = ref<PaidConsumerPlan>('plus')
const checkoutPeriod = ref<BillingPeriod>('monthly')
const checkoutOpening = ref(false)
const portalOpening = ref(false)
const planName = computed(() => t(`entitlement.plans.${entitlement.value?.plan || 'free'}`))
const planStatusLabel = computed(() => (
  entitlement.value?.plan === 'free'
    ? t('entitlement.active')
    : entitlement.value?.plan_status || t('entitlement.active')
))
const creditsAvailable = computed(() => entitlement.value?.openrouter_credits_status === 'available')
const billingConfigured = computed(() => billing.value?.configured === true)
const portalAvailable = computed(() => billing.value?.portal_available === true)
const checkoutAvailable = computed(() => (
  entitlement.value?.plan === 'free' &&
  Boolean(billing.value?.client_token && billing.value?.tenant_id && billing.value?.prices)
))
const selectedCheckoutOption = computed(() => billing.value?.prices?.[checkoutPlan.value]?.[checkoutPeriod.value])

watch(currentTheme, (value) => { localTheme.value = value })
watch(currentSans, (value) => { localSansFont.value = value })
watch(currentMono, (value) => { localMonoFont.value = value })
watch(currentSize, (value) => { localFontSize.value = value })

const sansFontOptions = computed<{ value: FontKey; label: string; preview: string }[]>(() =>
  visibleSansKeys().map((key) => ({
    value: key,
    label: t(`font.sans.${key}`),
    preview: SANS_STACKS[key],
  })),
)

const monoFontOptions = computed<{ value: MonoFontKey; label: string; preview: string }[]>(() =>
  visibleMonoKeys().map((key) => ({
    value: key,
    label: t(`font.mono.${key}`),
    preview: MONO_STACKS[key],
  })),
)

const currentSansStack = computed(() => SANS_STACKS[localSansFont.value] ?? SANS_STACKS.system)
const currentMonoStack = computed(() => MONO_STACKS[localMonoFont.value] ?? MONO_STACKS.system)

const loadEntitlement = async () => {
  try {
    const response = await getCurrentEntitlement()
    entitlement.value = response.data
    billing.value = response.billing
  } catch {
    entitlement.value = null
    billing.value = null
  } finally {
    entitlementLoading.value = false
  }
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

  const requestedPlan = route.query.plan
  const requestedPeriod = route.query.period
  if (requestedPlan === 'plus' || requestedPlan === 'pro' || requestedPlan === 'max') checkoutPlan.value = requestedPlan
  if (requestedPeriod === 'monthly' || requestedPeriod === 'yearly') checkoutPeriod.value = requestedPeriod
  void loadEntitlement()
})

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB'
  return `${(bytes / 1024 / 1024 / 1024).toFixed(bytes < 1024 ** 3 ? 2 : 1)} GB`
}

const formatCredits = (microusd: number) => `$${(Math.max(0, microusd) / 1_000_000).toFixed(2)}`
const creditsDisplay = computed(() => {
  if (!entitlement.value) return '—'
  if (!creditsAvailable.value) return formatCredits(entitlement.value.monthly_openrouter_microusd)
  return `${formatCredits(entitlement.value.openrouter_used_microusd)} / ${formatCredits(entitlement.value.monthly_openrouter_microusd)}`
})
const formatLimit = (limit: number) => limit > 0 ? String(limit) : t('entitlement.unlimited')

const handleCheckout = async () => {
  const config = billing.value
  const option = selectedCheckoutOption.value
  if (!config?.environment || !config.client_token || !config.tenant_id || !option) {
    MessagePlugin.error(t('entitlement.checkoutFailed'))
    return
  }
  checkoutOpening.value = true
  try {
    await openPaddleCheckout({
      environment: config.environment,
      clientToken: config.client_token,
      priceId: option.price_id,
      tenantId: config.tenant_id,
      checkoutBinding: option.checkout_binding,
      email: authStore.user?.email,
      onCompleted: () => {
        MessagePlugin.success(t('entitlement.checkoutCompleted'))
        window.setTimeout(() => { void loadEntitlement() }, 1200)
        window.setTimeout(() => { void loadEntitlement() }, 3500)
      },
    })
  } catch {
    MessagePlugin.error(t('entitlement.checkoutFailed'))
  } finally {
    checkoutOpening.value = false
  }
}

const handlePortal = async () => {
  portalOpening.value = true
  try {
    const response = await createPaddlePortalSession()
    window.location.assign(response.authorization_url)
  } catch {
    MessagePlugin.error(t('entitlement.portalFailed'))
  } finally {
    portalOpening.value = false
  }
}

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

const handleSansFontChange = (value: FontKey) => {
  if (!setSansFont(value)) {
    localSansFont.value = currentSans.value
    return
  }
  MessagePlugin.success(t('common.success'))
}

const handleMonoFontChange = (value: MonoFontKey) => {
  if (!setMonoFont(value)) {
    localMonoFont.value = currentMono.value
    return
  }
  MessagePlugin.success(t('common.success'))
}

const handleFontSizeChange = (value: FontSizeKey) => {
  if (!setFontSize(value)) {
    localFontSize.value = currentSize.value
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
  margin: 0 0 32px;
  padding-right: 40px;
}
.visual-general-settings__header h2 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.visual-general-settings__header p {
  margin: 4px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.visual-plan-card {
  margin: 0 0 24px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  color: #6b7280;
  font-size: 12px;
}
.visual-plan-card.is-loading { min-height: 80px; display: flex; align-items: center; justify-content: center; }
.visual-plan-card__header { margin-bottom: 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.visual-plan-card__header span,
.visual-plan-card__metrics span { color: #9ca3af; font-size: 11px; }
.visual-plan-card__header h3 { margin: 2px 0 0; color: #111827; font-size: 22px; line-height: 28px; }
.visual-plan-card__status { padding: 4px 9px; border-radius: 999px; background: #ecfdf5; color: #047857 !important; text-transform: capitalize; }
.visual-plan-card__metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.visual-plan-card__metrics > div { min-width: 0; padding: 11px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; background: #f9fafb; }
.visual-plan-card__metrics strong { overflow-wrap: anywhere; color: #374151; font-size: 13px; }
.visual-plan-card__metrics .is-unavailable strong { color: #9ca3af; }
.visual-plan-card > p { margin: 12px 0 0; line-height: 18px; }
.visual-plan-card__billing { color: #b45309; }
.visual-plan-card__managed { color: #047857; }
.visual-plan-card__portal { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.visual-plan-card__portal p { margin: 0; }
.visual-plan-card__checkout { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f3f4f6; }
.visual-plan-card__checkout-controls { display: grid; grid-template-columns: minmax(110px, 1fr) auto auto; align-items: center; gap: 8px; }
.visual-plan-card__checkout-controls :deep(.t-select) { width: 100%; }
.visual-plan-card__checkout > p { margin: 8px 0 0; color: #9ca3af; font-size: 11px; line-height: 16px; }

.visual-setting-list {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.visual-setting-row {
  width: 100%;
  min-width: 0;
  margin: 0 0 24px;
  padding: 0 0 24px;
  box-sizing: border-box;
  border-bottom: 1px solid #f3f4f6;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 192px;
  align-items: center;
  gap: 24px;
}
.visual-setting-row:last-child { margin-bottom: 0; border-bottom: 0; }

.visual-setting-row__copy { min-width: 0; }
.visual-setting-row__copy label {
  display: block;
  margin: 0;
  color: #111827;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
}
.visual-setting-row__copy p {
  margin: 2px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.visual-setting-row__control {
  width: 192px;
  min-width: 0;
  justify-self: end;
}
.visual-setting-row__control.is-stacked { display: flex; flex-direction: column; gap: 6px; }
.visual-setting-row__control.is-switch { display: flex; justify-content: flex-end; }
.visual-setting-row__control :deep(.t-select) { width: 100%; }
.visual-setting-row__control :deep(.t-input) {
  min-height: 34px;
  border-color: #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 2%);
}
.visual-setting-row__control :deep(.t-input:hover) { border-color: #d1d5db; }
.visual-setting-row__control :deep(.t-radio-group) { width: 100%; display: flex; }
.visual-setting-row__control :deep(.t-radio-button) {
  min-width: 0;
  flex: 1 1 0;
  height: 32px;
  padding: 0 8px;
  border-color: #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 10px;
}
.visual-setting-row__control :deep(.t-radio-button.t-is-checked) {
  border-color: #111827;
  background: #111827;
  color: #fff;
}
.visual-setting-row__control :deep(.t-switch.t-is-checked) { background: #111827; }

.visual-font-preview {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: #9ca3af;
  font-size: 9px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .visual-plan-card__metrics { grid-template-columns: minmax(0, 1fr); }
  .visual-plan-card__checkout-controls { grid-template-columns: minmax(0, 1fr); }
  .visual-setting-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .visual-setting-row__control { width: min(280px, 100%); justify-self: start; }
}
@media (max-width: 520px) {
  .visual-general-settings__header { padding-right: 28px; }
}
</style>
