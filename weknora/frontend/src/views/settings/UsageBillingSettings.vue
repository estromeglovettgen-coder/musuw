<template>
  <section class="usage-billing">
    <header class="usage-billing__header">
      <h2>{{ $t('entitlement.usageTitle') }}</h2>
      <p>{{ $t('entitlement.usageDescription') }}</p>
    </header>

    <div v-if="entitlementLoading" class="usage-billing__loading">{{ $t('common.loading') }}</div>

    <template v-else-if="entitlement">
      <section class="usage-billing__account" aria-labelledby="usage-account-title">
        <div class="usage-billing__identity">
          <span id="usage-account-title">{{ $t('entitlement.account') }}</span>
          <strong v-if="accountName">{{ accountName }}</strong>
          <small v-if="accountEmail">{{ accountEmail }}</small>
        </div>
        <div class="usage-billing__account-actions">
          <div class="usage-billing__plan-badge">
            <span>{{ $t('entitlement.currentPlan') }}</span>
            <strong>{{ planName }}</strong>
          </div>
          <button v-if="entitlement.plan !== 'free' && portalAvailable" type="button" class="usage-billing__text-button" :disabled="portalOpening" @click="handlePortal">
            {{ $t('entitlement.manageBilling') }}
          </button>
        </div>
      </section>

      <section class="usage-billing__meters" :aria-label="$t('entitlement.usageTitle')">
        <article class="usage-billing__meter-card">
          <div class="usage-billing__meter-heading">
            <span>{{ $t('entitlement.monthlyAllowance') }}</span>
            <strong v-if="creditsRemainingPercent !== null">{{ creditsRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
            <strong v-else class="is-muted">{{ $t('entitlement.unavailable') }}</strong>
          </div>
          <div class="usage-billing__meter" role="progressbar" :aria-valuenow="creditsRemainingPercent ?? undefined" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${creditsRemainingPercent ?? 0}%` }" />
          </div>
          <small v-if="formattedResetAt">{{ $t('entitlement.resetsAt', { month: formattedResetAt }) }}</small>
        </article>

        <article v-if="storageRemainingPercent !== null" class="usage-billing__meter-card">
          <div class="usage-billing__meter-heading">
            <span>{{ $t('entitlement.storageRemaining') }}</span>
            <strong>{{ storageRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
          </div>
          <div class="usage-billing__meter" role="progressbar" :aria-valuenow="storageRemainingPercent" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${storageRemainingPercent}%` }" />
          </div>
        </article>
      </section>

      <section class="usage-billing__limits">
        <div><span>{{ $t('entitlement.knowledgeBases') }}</span><strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong></div>
        <div><span>{{ $t('entitlement.documentsPerKb') }}</span><strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong></div>
        <div><span>{{ $t('entitlement.videoAccess') }}</span><strong>{{ entitlement.video_upload ? $t('entitlement.included') : $t('entitlement.notIncluded') }}</strong></div>
      </section>

      <section class="usage-billing__pricing" aria-labelledby="pricing-title">
        <div class="usage-billing__pricing-heading">
          <h2 id="pricing-title">{{ $t('entitlement.pricingTitle') }}</h2>
          <p>{{ $t('entitlement.pricingDescription') }}</p>
          <div class="usage-billing__period" role="group" :aria-label="$t('entitlement.choosePeriod')">
            <button type="button" :class="{ 'is-active': checkoutPeriod === 'monthly' }" :aria-pressed="checkoutPeriod === 'monthly'" @click="checkoutPeriod = 'monthly'">{{ $t('entitlement.monthly') }}</button>
            <button type="button" :class="{ 'is-active': checkoutPeriod === 'yearly' }" :aria-pressed="checkoutPeriod === 'yearly'" @click="checkoutPeriod = 'yearly'">{{ $t('entitlement.yearly') }}</button>
          </div>
        </div>

        <div class="usage-billing__plan-grid">
          <article v-for="card in planCards" :key="card.plan" class="usage-billing__plan-card" :class="{ 'is-current': entitlement.plan === card.plan }">
            <div class="usage-billing__plan-title">
              <h3>{{ $t(`entitlement.plans.${card.plan}`) }}</h3>
              <span v-if="card.plan === 'pro'">{{ $t('entitlement.recommended') }}</span>
            </div>
            <p class="usage-billing__plan-description">{{ $t(card.descriptionKey) }}</p>
            <div class="usage-billing__price">
              <strong>{{ planPrice(card.plan) }}</strong>
              <span v-if="card.plan !== 'free'">{{ checkoutPeriod === 'monthly' ? $t('entitlement.perMonth') : $t('entitlement.perYear') }}</span>
            </div>
            <button type="button" class="usage-billing__plan-action" :class="{ 'is-primary': planActionKind(card.plan) === 'checkout' || planActionKind(card.plan) === 'upgrade' }" :disabled="planActionDisabled(card.plan)" @click="handlePlanAction(card.plan)">
              {{ planActionLabel(card.plan) }}
            </button>
            <div class="usage-billing__plan-divider" />
            <strong class="usage-billing__includes">{{ $t('entitlement.includes') }}</strong>
            <ul>
              <li v-for="feature in planFeatures(card.plan)" :key="feature"><t-icon name="check" /> <span>{{ feature }}</span></li>
            </ul>
          </article>
        </div>
        <p v-if="!billingConfigured" class="usage-billing__notice">{{ $t('entitlement.billingNotConfigured') }}</p>
        <p v-else class="usage-billing__secure-note">{{ $t('entitlement.checkoutSecureNote') }}</p>
      </section>
    </template>

    <p v-else class="usage-billing__notice">{{ $t('entitlement.usageUnavailable') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
  type ConsumerPlan,
  type PaddleBillingConfig,
  type PaidConsumerPlan,
} from '@/api/entitlement'
import { openPaddleCheckout, previewPaddlePrices } from '@/utils/paddleCheckout'

const { locale, t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const entitlement = ref<ConsumerEntitlement | null>(null)
const billing = ref<PaddleBillingConfig | null>(null)
const entitlementLoading = ref(true)
const checkoutPeriod = ref<BillingPeriod>('monthly')
const checkoutOpening = ref<PaidConsumerPlan | null>(null)
const portalOpening = ref(false)
const upgradeOpening = ref<PaidConsumerPlan | null>(null)
const localizedPrices = ref<Record<string, string>>({})
const pricePreviewLoading = ref(false)
const paidPlans: PaidConsumerPlan[] = ['plus', 'pro', 'max']
const planRank: Record<ConsumerPlan, number> = { free: 0, plus: 1, pro: 2, max: 3 }
const planCards: Array<{ plan: ConsumerPlan; descriptionKey: string }> = [
  { plan: 'free', descriptionKey: 'entitlement.planDescriptions.free' },
  { plan: 'plus', descriptionKey: 'entitlement.planDescriptions.plus' },
  { plan: 'pro', descriptionKey: 'entitlement.planDescriptions.pro' },
  { plan: 'max', descriptionKey: 'entitlement.planDescriptions.max' },
]

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
const formattedResetAt = computed(() => {
  const raw = entitlement.value?.openrouter_resets_at
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
})
const billingConfigured = computed(() => billing.value?.configured === true)
const portalAvailable = computed(() => billing.value?.configured === true && billing.value?.portal_available === true)
const subscriptionUpgradeAvailable = computed(() => billingConfigured.value && portalAvailable.value && entitlement.value?.plan_status === 'active')

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

const loadLocalizedPrices = async () => {
  const config = billing.value
  if (!config?.configured || !config.environment || !config.client_token) return
  const options = paidPlans.map((plan) => config.catalog?.[plan]?.[checkoutPeriod.value]).filter((option): option is { price_id: string } => Boolean(option?.price_id))
  if (!options.length) return
  pricePreviewLoading.value = true
  try {
    const previews = await previewPaddlePrices({ environment: config.environment, clientToken: config.client_token, priceIds: options.map((option) => option.price_id) })
    const next = { ...localizedPrices.value }
    for (const preview of previews) next[preview.priceId] = preview.formattedUnitTotal
    localizedPrices.value = next
  } catch {
    // Checkout remains available even if a read-only localized preview fails.
  } finally {
    pricePreviewLoading.value = false
  }
}

onMounted(async () => {
  const requestedPeriod = route.query.period
  if (requestedPeriod === 'monthly' || requestedPeriod === 'yearly') checkoutPeriod.value = requestedPeriod
  await loadEntitlement()
  await loadLocalizedPrices()
})

watch(checkoutPeriod, () => { void loadLocalizedPrices() })

const formatLimit = (limit: number) => limit > 0 ? String(limit) : t('entitlement.unlimited')
const planPrice = (plan: ConsumerPlan) => {
  if (plan === 'free') return t('entitlement.freePrice')
  const priceId = billing.value?.catalog?.[plan]?.[checkoutPeriod.value]?.price_id
  if (priceId && localizedPrices.value[priceId]) return localizedPrices.value[priceId]
  return pricePreviewLoading.value ? '…' : t('entitlement.unavailable')
}
const planFeatures = (plan: ConsumerPlan) => {
  const storage = { free: 5, plus: 20, pro: 40, max: 80 }[plan]
  const allowance = t(`entitlement.allowanceLevels.${plan}`)
  const features = [
    t('entitlement.featureStorage', { amount: storage }),
    t('entitlement.featureAllowance', { level: allowance }),
  ]
  if (plan === 'free') {
    features.push(t('entitlement.featureFreeKnowledge'), t('entitlement.featureBudgetModel'))
  } else {
    features.push(t('entitlement.featureUnlimitedKnowledge'), t('entitlement.featureAllModels'), t('entitlement.featureVideo'))
  }
  return features
}
const selectedCheckoutOption = (plan: PaidConsumerPlan) => billing.value?.prices?.[plan]?.[checkoutPeriod.value]
const canOpenCheckout = (plan: PaidConsumerPlan) => {
  const config = billing.value
  const option = selectedCheckoutOption(plan)
  return Boolean(entitlement.value?.plan === 'free' && config?.configured && config.environment && config.client_token && config.tenant_id && option?.price_id && option.checkout_binding)
}
const planActionKind = (plan: ConsumerPlan): 'current' | 'checkout' | 'upgrade' | 'included' | 'unavailable' => {
  const current = entitlement.value?.plan || 'free'
  if (plan === current) return 'current'
  if (planRank[plan] < planRank[current] || plan === 'free') return 'included'
  if (current === 'free') return canOpenCheckout(plan as PaidConsumerPlan) ? 'checkout' : 'unavailable'
  return subscriptionUpgradeAvailable.value ? 'upgrade' : 'unavailable'
}
const planActionDisabled = (plan: ConsumerPlan) => {
  const kind = planActionKind(plan)
  return kind === 'current' || kind === 'included' || kind === 'unavailable' || checkoutOpening.value !== null || upgradeOpening.value !== null
}
const planActionLabel = (plan: ConsumerPlan) => {
  const kind = planActionKind(plan)
  if (kind === 'current') return t('entitlement.currentPlanAction')
  if (kind === 'included') return t('entitlement.includedInCurrent')
  if (kind === 'checkout') return t('entitlement.choosePlanAction', { plan: t(`entitlement.plans.${plan}`) })
  if (kind === 'upgrade') return t('entitlement.upgradeTo', { plan: t(`entitlement.plans.${plan}`) })
  return t('entitlement.checkoutUnavailable')
}
const handlePlanAction = (plan: ConsumerPlan) => {
  const kind = planActionKind(plan)
  if (kind === 'checkout') void handleCheckout(plan as PaidConsumerPlan)
  if (kind === 'upgrade') void handleSubscriptionUpgrade(plan as PaidConsumerPlan)
}

const handleCheckout = async (plan: PaidConsumerPlan) => {
  const config = billing.value
  const option = selectedCheckoutOption(plan)
  if (!canOpenCheckout(plan) || !config?.environment || !config.client_token || !config.tenant_id || !option) {
    MessagePlugin.error(t('entitlement.checkoutUnavailable'))
    return
  }
  checkoutOpening.value = plan
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
    checkoutOpening.value = null
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
      onCancel: () => { upgradeOpening.value = null; dialog.destroy() },
      onClose: () => { upgradeOpening.value = null; dialog.destroy() },
    })
  } catch {
    upgradeOpening.value = null
    MessagePlugin.error(t('entitlement.upgradeFailed'))
  }
}
</script>

<style scoped lang="less">
.usage-billing { width: 100%; max-width: 1180px; color: #202123; }
.usage-billing__header { margin-bottom: 24px; }
.usage-billing__header h2 { margin: 0; font-size: 22px; line-height: 30px; font-weight: 650; letter-spacing: -.02em; }
.usage-billing__header p,.usage-billing__pricing-heading p { margin: 5px 0 0; color: #6f737a; font-size: 13px; line-height: 20px; }
.usage-billing__loading,.usage-billing__notice,.usage-billing__secure-note { color: #7a7f87; font-size: 12px; line-height: 18px; }
.usage-billing__account,.usage-billing__meter-card,.usage-billing__limits { border: 1px solid #e5e5e5; border-radius: 14px; background: #fff; }
.usage-billing__account { padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.usage-billing__identity { min-width: 0; display: grid; gap: 2px; }
.usage-billing__identity > span { color: #8a8f98; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.usage-billing__identity strong { font-size: 14px; }
.usage-billing__identity small { color: #7a7f87; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usage-billing__account-actions { display: flex; align-items: center; gap: 14px; }
.usage-billing__plan-badge { display: grid; gap: 1px; text-align: right; }
.usage-billing__plan-badge span { color: #8a8f98; font-size: 10px; }
.usage-billing__plan-badge strong { font-size: 13px; }
.usage-billing__text-button { border: 0; padding: 0; background: transparent; color: #202123; cursor: pointer; font: inherit; font-size: 12px; text-decoration: underline; text-underline-offset: 3px; }
.usage-billing__meters { margin-top: 12px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.usage-billing__meter-card { padding: 15px 16px; }
.usage-billing__meter-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12px; }
.usage-billing__meter-heading span { color: #555b64; }
.usage-billing__meter-heading strong { font-size: 12px; font-weight: 600; white-space: nowrap; }
.usage-billing__meter-heading .is-muted { color: #9da1a8; }
.usage-billing__meter { height: 7px; margin: 12px 0 8px; overflow: hidden; border-radius: 999px; background: #ececec; }
.usage-billing__meter span { display: block; height: 100%; border-radius: inherit; background: #202123; transition: width 180ms ease; }
.usage-billing__meter-card small { color: #969ba3; font-size: 10px; }
.usage-billing__limits { margin-top: 12px; padding: 3px 16px; }
.usage-billing__limits > div { min-height: 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
.usage-billing__limits > div:last-child { border-bottom: 0; }
.usage-billing__limits span { color: #686e77; }
.usage-billing__limits strong { font-weight: 600; }
.usage-billing__pricing { margin-top: 54px; }
.usage-billing__pricing-heading { display: grid; justify-items: center; text-align: center; }
.usage-billing__pricing-heading h2 { margin: 0; font-size: 32px; line-height: 40px; font-weight: 500; letter-spacing: -.035em; }
.usage-billing__period { margin-top: 22px; display: inline-flex; padding: 3px; border: 1px solid #dedede; border-radius: 999px; background: #f7f7f7; }
.usage-billing__period button { min-width: 92px; height: 34px; border: 0; border-radius: 999px; background: transparent; color: #666b73; cursor: pointer; font: inherit; font-size: 12px; }
.usage-billing__period button.is-active { background: #fff; color: #202123; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
.usage-billing__plan-grid { margin-top: 30px; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 16px; }
.usage-billing__plan-card { min-height: 510px; display: flex; flex-direction: column; border: 1px solid #dedede; border-radius: 8px; padding: 22px 18px; background: #fff; }
.usage-billing__plan-card.is-current { border-color: #9a9a9a; box-shadow: inset 0 0 0 1px #9a9a9a; }
.usage-billing__plan-title { min-height: 31px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.usage-billing__plan-title h3 { margin: 0; font-size: 26px; line-height: 31px; font-weight: 500; letter-spacing: -.03em; }
.usage-billing__plan-title span { border-radius: 999px; padding: 4px 7px; background: #ececec; font-size: 9px; font-weight: 650; white-space: nowrap; }
.usage-billing__plan-description { min-height: 42px; margin: 12px 0 0; color: #6f737a; font-size: 12px; line-height: 18px; }
.usage-billing__price { min-height: 58px; margin-top: 24px; display: flex; align-items: flex-end; gap: 6px; }
.usage-billing__price strong { font-size: 34px; line-height: 42px; font-weight: 500; letter-spacing: -.04em; }
.usage-billing__price span { padding-bottom: 7px; color: #777c84; font-size: 11px; }
.usage-billing__plan-action { width: 100%; min-height: 42px; margin-top: 22px; border: 1px solid #b9b9b9; border-radius: 999px; background: #fff; color: #202123; cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; }
.usage-billing__plan-action.is-primary { border-color: #202123; background: #202123; color: #fff; }
.usage-billing__plan-action:disabled { cursor: default; opacity: .52; }
.usage-billing__plan-divider { height: 1px; margin: 25px 0 20px; background: #e8e8e8; }
.usage-billing__includes { font-size: 12px; }
.usage-billing__plan-card ul { display: grid; gap: 13px; margin: 16px 0 0; padding: 0; list-style: none; }
.usage-billing__plan-card li { display: flex; align-items: flex-start; gap: 8px; color: #41464d; font-size: 11px; line-height: 17px; }
.usage-billing__plan-card li :deep(.t-icon) { flex: 0 0 auto; margin-top: 2px; font-size: 13px; }
.usage-billing__pricing > .usage-billing__notice,.usage-billing__secure-note { margin: 16px auto 0; text-align: center; }
@media (max-width: 1040px) { .usage-billing__plan-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 640px) { .usage-billing__meters,.usage-billing__plan-grid { grid-template-columns: 1fr; } .usage-billing__account { align-items: flex-start; flex-direction: column; } .usage-billing__account-actions { width: 100%; justify-content: space-between; } .usage-billing__plan-badge { text-align: left; } .usage-billing__pricing-heading h2 { font-size: 27px; } }
@media (prefers-reduced-motion: reduce) { .usage-billing__meter span { transition: none; } }
</style>
