<template>
  <section class="usage-billing">
    <header class="usage-billing__header">
      <h2>{{ $t('entitlement.usageTitle') }}</h2>
      <p>{{ $t('entitlement.usageDescription') }}</p>
    </header>

    <div v-if="entitlementLoading" class="usage-billing__loading">{{ $t('common.loading') }}</div>

    <template v-else-if="entitlement">
      <section class="usage-billing__group" aria-labelledby="usage-plan-title">
        <h3 id="usage-plan-title">{{ $t('entitlement.currentPlan') }}</h3>
        <div class="usage-billing__row">
          <div class="usage-billing__copy">
            <strong>{{ planName }}</strong>
            <small>{{ $t(`entitlement.planDescriptions.${entitlement.plan}`) }}</small>
          </div>
          <button type="button" class="usage-billing__primary" @click="openPlans">
            {{ entitlement.plan === 'free' ? $t('entitlement.upgradePlan') : $t('entitlement.viewPlans') }}
          </button>
        </div>
        <div v-if="entitlement.plan !== 'free' && portalAvailable" class="usage-billing__row">
          <div class="usage-billing__copy">
            <strong>{{ $t('entitlement.manageBilling') }}</strong>
            <small>{{ $t('entitlement.manageDescription') }}</small>
          </div>
          <button type="button" class="usage-billing__secondary" :disabled="portalOpening" @click="handlePortal">
            {{ $t('entitlement.managePlan') }}
          </button>
        </div>
      </section>

      <section class="usage-billing__group" :aria-label="$t('entitlement.usageLimits')">
        <h3>{{ $t('entitlement.usageLimits') }}</h3>
        <div class="usage-billing__row">
          <div class="usage-billing__copy">
            <strong>{{ $t('entitlement.monthlyAllowance') }}</strong>
            <small v-if="formattedResetAt">{{ $t('entitlement.resetsAt', { month: formattedResetAt }) }}</small>
          </div>
          <div class="usage-billing__meter-control">
            <div class="usage-billing__meter" role="progressbar" :aria-valuenow="creditsRemainingPercent ?? undefined" aria-valuemin="0" aria-valuemax="100">
              <span :style="{ width: `${creditsRemainingPercent ?? 0}%` }" />
            </div>
            <strong v-if="creditsRemainingPercent !== null">{{ creditsRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
            <strong v-else class="is-muted">{{ $t('entitlement.unavailable') }}</strong>
          </div>
        </div>

        <div v-if="storageRemainingPercent !== null" class="usage-billing__row">
          <div class="usage-billing__copy">
            <strong>{{ $t('entitlement.storage') }}</strong>
            <small>{{ $t('entitlement.storageRemaining') }}</small>
          </div>
          <div class="usage-billing__meter-control">
            <div class="usage-billing__meter" role="progressbar" :aria-valuenow="storageRemainingPercent" aria-valuemin="0" aria-valuemax="100">
              <span :style="{ width: `${storageRemainingPercent}%` }" />
            </div>
            <strong>{{ storageRemainingPercent }}% {{ $t('entitlement.remaining') }}</strong>
          </div>
        </div>
      </section>

      <section class="usage-billing__group" :aria-label="$t('entitlement.planLimits')">
        <h3>{{ $t('entitlement.planLimits') }}</h3>
        <div class="usage-billing__row is-compact"><span>{{ $t('entitlement.knowledgeBases') }}</span><strong>{{ formatLimit(entitlement.max_knowledge_bases) }}</strong></div>
        <div class="usage-billing__row is-compact"><span>{{ $t('entitlement.documentsPerKb') }}</span><strong>{{ formatLimit(entitlement.max_documents_per_kb) }}</strong></div>
        <div class="usage-billing__row is-compact"><span>{{ $t('entitlement.videoAccess') }}</span><strong>{{ entitlement.video_upload ? $t('entitlement.included') : $t('entitlement.notIncluded') }}</strong></div>
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

const { locale, t } = useI18n()
const router = useRouter()
const entitlement = ref<ConsumerEntitlement | null>(null)
const billing = ref<PaddleBillingConfig | null>(null)
const entitlementLoading = ref(true)
const portalOpening = ref(false)

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
.usage-billing { width: 100%; max-width: 640px; color: #202123; }
.usage-billing__header { margin-bottom: 22px; }
.usage-billing__header h2 { margin: 0; font-size: 22px; line-height: 30px; font-weight: 650; letter-spacing: -.02em; }
.usage-billing__header p { margin: 5px 0 0; color: #6f737a; font-size: 13px; line-height: 20px; }
.usage-billing__loading,.usage-billing__notice { color: #7a7f87; font-size: 12px; line-height: 18px; }
.usage-billing__group { margin-top: 18px; overflow: hidden; border: 1px solid #e5e5e5; border-radius: 14px; background: #fff; }
.usage-billing__group h3 { margin: 0; padding: 13px 16px 11px; border-bottom: 1px solid #eeeeee; font-size: 12px; line-height: 18px; font-weight: 650; }
.usage-billing__row { min-height: 58px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 22px; border-bottom: 1px solid #f0f0f0; }
.usage-billing__row:last-child { border-bottom: 0; }
.usage-billing__copy { min-width: 0; display: grid; gap: 2px; }
.usage-billing__copy strong { color: #202123; font-size: 13px; line-height: 18px; font-weight: 600; }
.usage-billing__copy small { color: #858a92; font-size: 11px; line-height: 16px; }
.usage-billing__meter-control { min-width: 206px; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.usage-billing__meter-control > strong { min-width: 84px; color: #555b64; font-size: 11px; line-height: 16px; font-weight: 500; text-align: right; white-space: nowrap; }
.usage-billing__meter-control > strong.is-muted { color: #9da1a8; }
.usage-billing__meter { width: 96px; height: 6px; overflow: hidden; border-radius: 999px; background: #ececec; }
.usage-billing__meter span { display: block; height: 100%; border-radius: inherit; background: #202123; transition: width 180ms ease; }
.usage-billing__row.is-compact { min-height: 42px; padding-block: 8px; color: #686e77; font-size: 12px; }
.usage-billing__row.is-compact strong { color: #202123; font-weight: 600; }
.usage-billing__primary,.usage-billing__secondary { flex: 0 0 auto; min-height: 34px; padding: 0 14px; border-radius: 9px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.usage-billing__primary { border: 1px solid #111827; background: #111827; color: #fff; }
.usage-billing__secondary { border: 1px solid #dedede; background: #fff; color: #202123; }
.usage-billing__primary:disabled,.usage-billing__secondary:disabled { opacity: .55; cursor: wait; }
@media (max-width: 640px) { .usage-billing__row { align-items: flex-start; flex-direction: column; gap: 10px; } .usage-billing__meter-control { width: 100%; min-width: 0; justify-content: flex-start; } }
@media (prefers-reduced-motion: reduce) { .usage-billing__meter span { transition: none; } }
</style>
