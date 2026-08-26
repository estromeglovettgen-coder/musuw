<template>
  <section class="usage-billing">
    <header class="visual-settings-page-header usage-billing__page-header">
      <div class="visual-settings-page-header__copy">
        <h2 class="visual-settings-page-header__title">{{ $t('entitlement.usageTitle') }}</h2>
        <p class="visual-settings-page-header__description">{{ $t('entitlement.usageDescription') }}</p>
      </div>
    </header>

    <div v-if="entitlementLoading" class="usage-billing__loading">{{ $t('common.loading') }}</div>

    <template v-else-if="entitlement">
      <section class="usage-billing__section" aria-labelledby="usage-plan-title">
        <h3 id="usage-plan-title">{{ $t('entitlement.currentPlan') }}</h3>
        <div class="usage-billing__card">
          <div class="usage-billing__row usage-billing__row--split">
            <div class="usage-billing__copy">
              <strong class="usage-billing__plan-name">{{ planName }}</strong>
            </div>
            <button type="button" class="usage-billing__secondary" @click="openPlans">
              {{ entitlement.plan === 'free' ? $t('entitlement.upgradePlan') : $t('entitlement.viewPlans') }}
            </button>
          </div>
          <div v-if="entitlement.plan !== 'free' && portalAvailable" class="usage-billing__row usage-billing__row--split">
            <div class="usage-billing__copy">
              <strong class="usage-billing__quota-title">{{ $t('entitlement.manageBilling') }}</strong>
              <small>{{ $t('entitlement.manageDescription') }}</small>
            </div>
            <button type="button" class="usage-billing__secondary" :disabled="portalOpening" @click="handlePortal">
              {{ $t('entitlement.managePlan') }}
            </button>
          </div>
        </div>
      </section>

      <p v-if="entitlement.openrouter_credits_status === 'pending'" class="usage-billing__notice usage-billing__notice--action">
        <span>{{ $t('entitlement.billingRenewalPending') }}</span>
        <button type="button" class="usage-billing__secondary" @click="openPlans">{{ $t('entitlement.viewPlans') }}</button>
      </p>

      <section class="usage-billing__section usage-billing__section--allowance" :aria-label="$t('entitlement.usageLimits')">
        <h3>{{ $t('entitlement.usageLimits') }}</h3>
        <div class="usage-billing__card">
          <div class="usage-billing__row usage-billing__row--meter">
            <div class="usage-billing__copy">
              <strong class="usage-billing__quota-title">{{ $t('entitlement.monthlyAllowance') }}</strong>
            </div>
            <div class="usage-billing__meter-control">
              <div class="usage-billing__meter-meta">
                <small v-if="formattedResetAt">{{ $t('entitlement.resetsAt', { month: formattedResetAt }) }}</small>
                <small v-else />
                <strong v-if="creditsRemainingPercent !== null">{{ creditsRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
                <strong v-else class="is-muted">{{ entitlement.openrouter_credits_status === 'pending' ? $t('entitlement.billingPendingShort') : $t('entitlement.unavailable') }}</strong>
              </div>
              <div class="usage-billing__meter" role="progressbar" :aria-valuenow="creditsRemainingPercent ?? undefined" aria-valuemin="0" aria-valuemax="100">
                <span :style="{ width: `${creditsRemainingPercent ?? 0}%` }" />
              </div>
            </div>
        </div>
        </div>
      </section>

      <section v-if="storageRemainingPercent !== null" class="usage-billing__section usage-billing__section--storage" :aria-label="$t('entitlement.storage')">
        <h3>{{ $t('entitlement.storage') }}</h3>
        <div class="usage-billing__card">
          <div class="usage-billing__row usage-billing__row--meter">
            <div class="usage-billing__meter-control">
              <div class="usage-billing__meter-meta">
                <small class="usage-billing__storage-usage">{{ $t('entitlement.storageUsage', { used: formattedStorageUsed, total: formattedStorageTotal }) }}</small>
                <strong>{{ storageRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
              </div>
              <div class="usage-billing__meter" role="progressbar" :aria-valuenow="storageRemainingPercent" aria-valuemin="0" aria-valuemax="100">
                <span :style="{ width: `${Math.max(4, storageRemainingPercent)}%` }" />
              </div>
            </div>
        </div>
        </div>
      </section>

      <section v-if="!authStore.isLiteMode" class="usage-billing__section" :aria-label="$t('entitlement.planLimits')">
        <h3>{{ $t('entitlement.planLimits') }}</h3>
        <div class="usage-billing__card">
          <div class="usage-billing__row is-compact"><span>{{ $t('entitlement.knowledgeBases') }}</span><strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong></div>
          <div class="usage-billing__row is-compact"><span>{{ $t('entitlement.documentsPerKb') }}</span><strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong></div>
          <div class="usage-billing__row is-compact"><span>{{ $t('entitlement.videoAccess') }}</span><strong>{{ entitlement.video_upload ? $t('entitlement.included') : $t('entitlement.notIncluded') }}</strong></div>
        </div>
      </section>
    </template>

    <p v-else class="usage-billing__notice">{{ $t('entitlement.usageUnavailable') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  createPaddlePortalSession,
  getCurrentEntitlement,
  type ConsumerEntitlement,
  type PaddleBillingConfig,
} from '@/api/entitlement'
import { useAuthStore } from '@/stores/auth'

const { locale, t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const entitlement = ref<ConsumerEntitlement | null>(null)
const billing = ref<PaddleBillingConfig | null>(null)
const entitlementLoading = ref(true)
const portalOpening = ref(false)

const planName = computed(() => t(`entitlement.plans.${entitlement.value?.plan || 'free'}`))
const clampPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)))
const creditsRemainingPercent = computed<number | null>(() => {
  const data = entitlement.value
  if (!data || data.openrouter_credits_status === 'unavailable' || data.openrouter_credits_status === 'pending') return null
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
const formatStorageBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const gibibytes = value / 1024 ** 3
  if (gibibytes >= 1) return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(gibibytes)} GiB`
  const mebibytes = value / 1024 ** 2
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(mebibytes)} MiB`
}
const formattedStorageUsed = computed(() => formatStorageBytes(Number(entitlement.value?.storage_used || 0)))
const formattedStorageTotal = computed(() => formatStorageBytes(Number(entitlement.value?.storage_bytes || 0)))
const formattedResetAt = computed(() => {
  const raw = entitlement.value?.openrouter_resets_at
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
})
const portalAvailable = computed(() => billing.value?.portal_available === true)
const formatLimit = (limit: number) => limit > 0 ? String(limit) : t('entitlement.unlimited')

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

const openPlans = () => { void router.push('/plans') }

const handlePortal = async () => {
  if (!portalAvailable.value || portalOpening.value) return
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

onMounted(() => { void loadEntitlement() })
</script>

<style scoped lang="less">
.usage-billing { width: 100%; max-width: 640px; color: #111827; animation: usage-billing-fade 150ms ease-out; }
.usage-billing__page-header {
  margin: 0 0 8px;
  padding: 0 0 12px;
  border-bottom: 1px solid #f3f4f6;
}
.usage-billing__page-header .visual-settings-page-header__title {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.usage-billing__page-header .visual-settings-page-header__description {
  margin: 2px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 16px;
}
@keyframes usage-billing-fade { from { opacity: 0; } to { opacity: 1; } }
.usage-billing__loading,.usage-billing__notice { color: #9ca3af; font-size: 12px; line-height: 18px; }
.usage-billing__notice--action { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 14px 0 0; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fafafa; }
.usage-billing__section { margin-top: 20px; }
.usage-billing__section:first-child { margin-top: 0; }
.usage-billing__section > h3 { margin: 0 0 8px; color: #111827; font-size: 14px; line-height: 20px; font-weight: 700; }
.usage-billing__section--allowance,.usage-billing__section--storage { padding-top: 4px; }
.usage-billing__section--allowance > h3 { margin-bottom: 12px; }
.usage-billing__card { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; }
.usage-billing__row { padding: 16px; display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 10px; border-bottom: 1px solid #f3f4f6; }
.usage-billing__row:last-child { border-bottom: 0; }
.usage-billing__row--meter { padding: 14px; gap: 8px; }
.usage-billing__row--split { flex-direction: row; align-items: center; justify-content: space-between; gap: 22px; }
.usage-billing__copy { min-width: 0; display: grid; gap: 2px; }
.usage-billing__copy strong { color: #111827; }
.usage-billing__plan-name { font-size: 14px; line-height: 20px; font-weight: 500; }
.usage-billing__quota-title { font-size: 12px; line-height: 16px; font-weight: 600; }
.usage-billing__copy small { color: #9ca3af; font-size: 11px; line-height: 16px; }
.usage-billing__meter-control { width: 100%; min-width: 0; display: grid; gap: 6px; }
.usage-billing__meter-meta { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.usage-billing__meter-meta > small { min-width: 0; overflow: hidden; color: #9ca3af; font-size: 11px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.usage-billing__meter-meta > strong { flex: 0 0 auto; color: #111827; font-family: var(--app-font-family-mono); font-size: 12px; line-height: 16px; font-weight: 700; text-align: right; white-space: nowrap; }
.usage-billing__meter-meta > strong.is-muted { color: #9da1a8; }
.usage-billing__storage-usage { color: #6b7280 !important; }
.usage-billing__meter { width: 100%; height: 6px; overflow: hidden; border-radius: 999px; background: #f3f4f6; }
.usage-billing__meter span { display: block; height: 100%; border-radius: inherit; background: #111827; transition: width 180ms ease; }
.usage-billing__row.is-compact { min-height: 42px; padding-block: 8px; flex-direction: row; align-items: center; justify-content: space-between; color: #6b7280; font-size: 12px; }
.usage-billing__row.is-compact strong { color: #111827; font-weight: 600; }
.usage-billing__secondary { flex: 0 0 auto; padding: 6px 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; color: #374151; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); font: inherit; font-size: 12px; line-height: 16px; font-weight: 500; cursor: pointer; }
.usage-billing__secondary:hover { border-color: #d1d5db; background: #f9fafb; }
.usage-billing__secondary:disabled { opacity: .55; cursor: wait; }
@media (max-width: 640px) { .usage-billing__row--split { align-items: flex-start; flex-direction: column; gap: 10px; } }
@media (prefers-reduced-motion: reduce) { .usage-billing { animation: none; } .usage-billing__meter span { transition: none; } }
</style>
