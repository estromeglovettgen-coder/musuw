<template>
  <section class="visual-usage-settings">
    <header class="visual-usage-settings__header">
      <h2>{{ $t('entitlement.usageTitle') }}</h2>
      <p>{{ $t('entitlement.usageDescription') }}</p>
    </header>

    <div v-if="entitlementLoading" class="visual-usage-settings__loading">{{ $t('common.loading') }}</div>

    <template v-else-if="entitlement">
      <section class="visual-usage-settings__account" aria-labelledby="usage-account-title">
        <div>
          <span class="visual-usage-settings__eyebrow" id="usage-account-title">{{ $t('entitlement.account') }}</span>
          <strong v-if="accountName">{{ accountName }}</strong>
          <span v-if="accountEmail">{{ accountEmail }}</span>
        </div>
        <div class="visual-usage-settings__plan-badge">
          <span>{{ $t('entitlement.currentPlan') }}</span>
          <strong>{{ planName }}</strong>
        </div>
      </section>

      <section class="visual-usage-settings__meters" :aria-label="$t('entitlement.usageTitle')">
        <article class="visual-usage-settings__meter-card">
          <div class="visual-usage-settings__meter-heading">
            <span>{{ $t('entitlement.monthlyAllowance') }}</span>
            <strong v-if="creditsRemainingPercent !== null">{{ creditsRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
            <strong v-else class="is-muted">{{ $t('entitlement.unavailable') }}</strong>
          </div>
          <div class="visual-usage-settings__meter" role="progressbar" :aria-valuenow="creditsRemainingPercent ?? undefined" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${creditsRemainingPercent ?? 0}%` }" />
          </div>
          <small v-if="creditsRemainingPercent !== null && entitlement.openrouter_usage_month">{{ $t('entitlement.resetsAt', { month: entitlement.openrouter_usage_month }) }}</small>
        </article>

        <article v-if="storageRemainingPercent !== null" class="visual-usage-settings__meter-card">
          <div class="visual-usage-settings__meter-heading">
            <span>{{ $t('entitlement.storageRemaining') }}</span>
            <strong>{{ storageRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
          </div>
          <div class="visual-usage-settings__meter" role="progressbar" :aria-valuenow="storageRemainingPercent" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${storageRemainingPercent}%` }" />
          </div>
        </article>
      </section>

      <section class="visual-usage-settings__limits">
        <div><span>{{ $t('entitlement.knowledgeBases') }}</span><strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong></div>
        <div><span>{{ $t('entitlement.documentsPerKb') }}</span><strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong></div>
        <div><span>{{ $t('entitlement.videoAccess') }}</span><strong>{{ entitlement.video_upload ? $t('entitlement.included') : $t('entitlement.notIncluded') }}</strong></div>
      </section>

      <section v-if="entitlement.plan === 'free'" class="visual-usage-settings__upgrade">
        <div class="visual-usage-settings__section-heading">
          <div><h3>{{ $t('entitlement.upgradePlan') }}</h3><p>{{ $t('entitlement.upgradeDescription') }}</p></div>
        </div>
        <div class="visual-usage-settings__plan-options" role="radiogroup" :aria-label="$t('entitlement.choosePlan')">
          <button v-for="plan in paidPlans" :key="plan" type="button" class="visual-usage-settings__plan-option" :class="{ 'is-selected': checkoutPlan === plan }" role="radio" :aria-checked="checkoutPlan === plan" @click="checkoutPlan = plan">
            <span>{{ $t(`entitlement.plans.${plan}`) }}</span>
            <t-icon v-if="checkoutPlan === plan" name="check" />
          </button>
        </div>
        <div class="visual-usage-settings__period-options" role="radiogroup" :aria-label="$t('entitlement.choosePeriod')">
          <button type="button" :class="{ 'is-selected': checkoutPeriod === 'monthly' }" role="radio" :aria-checked="checkoutPeriod === 'monthly'" @click="checkoutPeriod = 'monthly'">{{ $t('entitlement.monthly') }}</button>
          <button type="button" :class="{ 'is-selected': checkoutPeriod === 'yearly' }" role="radio" :aria-checked="checkoutPeriod === 'yearly'" @click="checkoutPeriod = 'yearly'">{{ $t('entitlement.yearly') }}</button>
        </div>
        <p v-if="!billingConfigured" class="visual-usage-settings__notice">{{ $t('entitlement.billingNotConfigured') }}</p>
        <p v-else-if="!checkoutAvailable || !selectedCheckoutOption" class="visual-usage-settings__notice">{{ $t('entitlement.checkoutUnavailable') }}</p>
        <t-button v-else theme="primary" :loading="checkoutOpening" @click="handleCheckout">{{ $t('entitlement.continueToCheckout') }}</t-button>
      </section>

      <section v-else-if="upgradePlans.length" class="visual-usage-settings__upgrade">
        <div class="visual-usage-settings__section-heading">
          <div><h3>{{ $t('entitlement.upgradePlan') }}</h3><p>{{ $t('entitlement.upgradePaidDescription') }}</p></div>
        </div>
        <div class="visual-usage-settings__upgrade-actions">
          <t-button v-for="plan in upgradePlans" :key="plan" variant="outline" :disabled="!subscriptionUpgradeAvailable" :loading="upgradeOpening === plan" @click="handleSubscriptionUpgrade(plan)">
            {{ $t('entitlement.upgradeTo', { plan: $t(`entitlement.plans.${plan}`) }) }}
          </t-button>
        </div>
        <p v-if="!subscriptionUpgradeAvailable" class="visual-usage-settings__notice">{{ $t('entitlement.billingNotConfigured') }}</p>
      </section>

      <section v-if="entitlement.plan !== 'free'" class="visual-usage-settings__manage">
        <div><h3>{{ $t('entitlement.managePlan') }}</h3><p>{{ $t('entitlement.manageDescription') }}</p></div>
        <p v-if="!portalAvailable" class="visual-usage-settings__notice">{{ $t('entitlement.billingNotConfigured') }}</p>
        <t-button v-else variant="outline" :loading="portalOpening" @click="handlePortal">{{ $t('entitlement.manageBilling') }}</t-button>
      </section>
    </template>

    <p v-else class="visual-usage-settings__notice">{{ $t('entitlement.usageUnavailable') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import {
  createPaddlePortalSession,
  getCurrentEntitlement,
  previewPaddleSubscriptionUpgrade,
  upgradePaddleSubscription,
  type BillingPeriod,
  type ConsumerEntitlement,
  type PaddleBillingConfig,
  type PaidConsumerPlan,
} from '@/api/entitlement'
import { openPaddleCheckout } from '@/utils/paddleCheckout'

const { locale, t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const entitlement = ref<ConsumerEntitlement | null>(null)
const billing = ref<PaddleBillingConfig | null>(null)
const entitlementLoading = ref(true)
const checkoutPlan = ref<PaidConsumerPlan>('plus')
const checkoutPeriod = ref<BillingPeriod>('monthly')
const checkoutOpening = ref(false)
const portalOpening = ref(false)
const upgradeOpening = ref<PaidConsumerPlan | null>(null)
const paidPlans: PaidConsumerPlan[] = ['plus', 'pro', 'max']
const planRank: Record<PaidConsumerPlan, number> = { plus: 1, pro: 2, max: 3 }

const accountName = computed(() => authStore.user?.username || '')
const accountEmail = computed(() => authStore.user?.email || '')
const planName = computed(() => t(`entitlement.plans.${entitlement.value?.plan || 'free'}`))
const clampPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)))
const creditsRemainingPercent = computed<number | null>(() => {
  const data = entitlement.value
  if (!data || data.openrouter_credits_status === 'unavailable') return null
  if (data.openrouter_credits_status === 'unprovisioned') return 100
  const total = Number(data.monthly_openrouter_microusd)
  const remaining = Number(data.openrouter_remaining_microusd)
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(remaining)) return null
  return clampPercent((remaining / total) * 100)
})
const storageRemainingPercent = computed<number | null>(() => {
  const data = entitlement.value
  if (!data) return null
  const total = Number(data.storage_bytes)
  const used = Number(data.storage_used)
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used)) return null
  return clampPercent(((total - used) / total) * 100)
})
const billingConfigured = computed(() => billing.value?.configured === true)
const portalAvailable = computed(() => billing.value?.configured === true && billing.value?.portal_available === true)
const upgradePlans = computed(() => {
  const current = entitlement.value?.plan
  if (current !== 'plus' && current !== 'pro' && current !== 'max') return []
  return paidPlans.filter((plan) => planRank[plan] > planRank[current])
})
const subscriptionUpgradeAvailable = computed(() =>
  billingConfigured.value && portalAvailable.value && entitlement.value?.plan_status === 'active',
)
const checkoutAvailable = computed(() => {
  const config = billing.value
  const hasPriceOptions = Object.values(config?.prices ?? {}).some((periods) =>
    Object.values(periods ?? {}).some((option) => Boolean(option?.price_id && option.checkout_binding)),
  )
  return Boolean(
    entitlement.value?.plan === 'free' &&
    config?.configured &&
    config.environment &&
    config.client_token &&
    config.tenant_id &&
    hasPriceOptions,
  )
})
const selectedCheckoutOption = computed(() => billing.value?.prices?.[checkoutPlan.value]?.[checkoutPeriod.value])

const loadEntitlement = async () => {
  entitlementLoading.value = true
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
  const requestedPlan = route.query.plan
  const requestedPeriod = route.query.period
  if (requestedPlan === 'plus' || requestedPlan === 'pro' || requestedPlan === 'max') checkoutPlan.value = requestedPlan
  if (requestedPeriod === 'monthly' || requestedPeriod === 'yearly') checkoutPeriod.value = requestedPeriod
  void loadEntitlement()
})

const formatLimit = (limit: number) => limit > 0 ? String(limit) : t('entitlement.unlimited')

const formatMinorCurrency = (amount: string, currencyCode: string) => {
  try {
    const formatter = new Intl.NumberFormat(locale.value, { style: 'currency', currency: currencyCode })
    const minorAmount = Number(amount)
    if (!Number.isSafeInteger(minorAmount)) return `${amount} ${currencyCode}`
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2
    return formatter.format(minorAmount / (10 ** fractionDigits))
  } catch {
    return `${amount} ${currencyCode}`
  }
}

const handleCheckout = async () => {
  const config = billing.value
  const option = selectedCheckoutOption.value
  if (!checkoutAvailable.value || !config?.environment || !config.client_token || !config.tenant_id || !option) {
    MessagePlugin.error(t('entitlement.checkoutUnavailable'))
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
      locale: locale.value,
      onCompleted: () => {
        MessagePlugin.success(t('entitlement.checkoutCompleted'))
        window.setTimeout(() => { void loadEntitlement() }, 1200)
        window.setTimeout(() => { void loadEntitlement() }, 3500)
      },
    })
  } catch {
    MessagePlugin.error(t('entitlement.checkoutUnavailable'))
  } finally {
    checkoutOpening.value = false
  }
}

const handlePortal = async () => {
  if (!portalAvailable.value) return
  portalOpening.value = true
  try {
    const response = await createPaddlePortalSession()
    if (!response.authorization_url) throw new Error('Missing portal URL')
    window.location.assign(response.authorization_url)
  } catch {
    MessagePlugin.error(t('entitlement.portalUnavailable'))
  } finally {
    portalOpening.value = false
  }
}

const handleSubscriptionUpgrade = async (plan: PaidConsumerPlan) => {
  if (!subscriptionUpgradeAvailable.value || upgradeOpening.value) return
  upgradeOpening.value = plan
  try {
    const preview = await previewPaddleSubscriptionUpgrade(plan)
    const amount = formatMinorCurrency(preview.amount, preview.currency_code)
    const dialog = DialogPlugin.confirm({
      header: t('entitlement.upgradeConfirmTitle', { plan: t(`entitlement.plans.${plan}`) }),
      body: t('entitlement.upgradeConfirmBody', { plan: t(`entitlement.plans.${plan}`), amount }),
      confirmBtn: t('entitlement.upgradeConfirm'),
      cancelBtn: t('common.cancel'),
      onConfirm: async () => {
        try {
          await upgradePaddleSubscription(plan)
          MessagePlugin.success(t('entitlement.upgradePending'))
          window.setTimeout(() => { void loadEntitlement() }, 1200)
          window.setTimeout(() => { void loadEntitlement() }, 3500)
        } catch {
          MessagePlugin.error(t('entitlement.upgradeFailed'))
        } finally {
          upgradeOpening.value = null
          dialog.destroy()
        }
      },
      onCancel: () => {
        upgradeOpening.value = null
        dialog.destroy()
      },
      onClose: () => {
        upgradeOpening.value = null
        dialog.destroy()
      },
    })
  } catch {
    upgradeOpening.value = null
    MessagePlugin.error(t('entitlement.upgradeFailed'))
  }
}
</script>

<style scoped lang="less">
.visual-usage-settings { width: 100%; max-width: 680px; color: #1f2937; }
.visual-usage-settings__header { margin-bottom: 20px; }
.visual-usage-settings__header h2 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 700; }
.visual-usage-settings__header p,.visual-usage-settings__section-heading p,.visual-usage-settings__manage p { margin: 4px 0 0; color: #8b919b; font-size: 12px; line-height: 18px; }
.visual-usage-settings__loading,.visual-usage-settings__notice { color: #8b919b; font-size: 12px; line-height: 18px; }
.visual-usage-settings__account,.visual-usage-settings__meter-card,.visual-usage-settings__limits,.visual-usage-settings__upgrade,.visual-usage-settings__manage { border: 1px solid #eceef1; border-radius: 16px; background: #fff; }
.visual-usage-settings__account { padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.visual-usage-settings__account > div:first-child { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.visual-usage-settings__account strong { font-size: 14px; line-height: 20px; }
.visual-usage-settings__account span:not(.visual-usage-settings__eyebrow) { color: #8b919b; font-size: 11px; line-height: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-usage-settings__eyebrow { color: #8b919b; font-size: 10px; line-height: 14px; font-weight: 600; }
.visual-usage-settings__plan-badge { flex: 0 0 auto; padding: 7px 10px; border-radius: 10px; background: #f4f5f7; display: flex; flex-direction: column; gap: 1px; text-align: right; }
.visual-usage-settings__plan-badge span { color: #8b919b; font-size: 10px; line-height: 14px; }
.visual-usage-settings__plan-badge strong { font-size: 12px; line-height: 16px; }
.visual-usage-settings__meters { margin-top: 12px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.visual-usage-settings__meter-card { min-width: 0; padding: 14px; }
.visual-usage-settings__meter-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 12px; line-height: 18px; }
.visual-usage-settings__meter-heading span { min-width: 0; color: #4b5563; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-usage-settings__meter-heading strong { flex: 0 0 auto; color: #111827; font-size: 12px; font-weight: 600; white-space: nowrap; }
.visual-usage-settings__meter-heading strong.is-muted { color: #9ca3af; }
.visual-usage-settings__meter { height: 7px; margin: 12px 0 8px; overflow: hidden; border-radius: 999px; background: #eef0f2; }
.visual-usage-settings__meter span { display: block; height: 100%; border-radius: inherit; background: #111827; transition: width 180ms ease; }
.visual-usage-settings__meter-card small { color: #9ca3af; font-size: 10px; line-height: 14px; }
.visual-usage-settings__limits { margin-top: 12px; padding: 4px 14px; }
.visual-usage-settings__limits > div { min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid #f1f2f4; font-size: 12px; }
.visual-usage-settings__limits > div:last-child { border-bottom: 0; }
.visual-usage-settings__limits span { color: #6b7280; }
.visual-usage-settings__limits strong { color: #1f2937; font-weight: 600; text-align: right; }
.visual-usage-settings__upgrade,.visual-usage-settings__manage { margin-top: 12px; padding: 16px; }
.visual-usage-settings__section-heading h3,.visual-usage-settings__manage h3 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 650; }
.visual-usage-settings__plan-options { margin-top: 14px; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
.visual-usage-settings__plan-option,.visual-usage-settings__period-options button { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; color: #4b5563; font: inherit; cursor: pointer; transition: background-color 120ms ease,border-color 120ms ease,color 120ms ease; }
.visual-usage-settings__plan-option { min-height: 40px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; }
.visual-usage-settings__plan-option:hover,.visual-usage-settings__period-options button:hover { border-color: #cfd3d8; background: #f8f9fa; }
.visual-usage-settings__plan-option.is-selected,.visual-usage-settings__period-options button.is-selected { border-color: #111827; background: #f3f4f6; color: #111827; }
.visual-usage-settings__plan-option :deep(.t-icon) { font-size: 14px; }
.visual-usage-settings__period-options { margin: 10px 0 14px; display: inline-flex; gap: 4px; padding: 3px; border-radius: 10px; background: #f4f5f7; }
.visual-usage-settings__period-options button { min-height: 28px; padding: 4px 10px; border-color: transparent; background: transparent; font-size: 11px; }
.visual-usage-settings__upgrade > .visual-usage-settings__notice { margin: 0 0 12px; }
.visual-usage-settings__upgrade-actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.visual-usage-settings__upgrade-actions + .visual-usage-settings__notice { margin: 10px 0 0; }
.visual-usage-settings__manage { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.visual-usage-settings__manage > div { min-width: 0; }
.visual-usage-settings__manage > .visual-usage-settings__notice { margin: 0; }
@media (max-width: 620px) { .visual-usage-settings__meters { grid-template-columns: 1fr; } .visual-usage-settings__account,.visual-usage-settings__manage { align-items: flex-start; flex-direction: column; } .visual-usage-settings__plan-badge { text-align: left; } }
@media (prefers-reduced-motion: reduce) { .visual-usage-settings__meter span,.visual-usage-settings__plan-option,.visual-usage-settings__period-options button { transition: none; } }
</style>
