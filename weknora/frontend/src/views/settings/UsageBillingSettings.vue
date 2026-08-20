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
        <div class="usage-billing__plan-badge">
          <span>{{ $t('entitlement.currentPlan') }}</span>
          <strong>{{ planName }}</strong>
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

      <footer class="usage-billing__actions">
        <button type="button" class="usage-billing__primary" @click="openPlans">
          {{ entitlement.plan === 'free' ? $t('entitlement.upgradePlan') : $t('entitlement.viewPlans') }}
        </button>
        <button v-if="entitlement.plan !== 'free' && portalAvailable" type="button" class="usage-billing__secondary" :disabled="portalOpening" @click="handlePortal">
          {{ $t('entitlement.manageBilling') }}
        </button>
      </footer>
    </template>

    <p v-else class="usage-billing__notice">{{ $t('entitlement.usageUnavailable') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import {
  createPaddlePortalSession,
  getCurrentEntitlement,
  type ConsumerEntitlement,
  type PaddleBillingConfig,
} from '@/api/entitlement'

const { locale, t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const entitlement = ref<ConsumerEntitlement | null>(null)
const billing = ref<PaddleBillingConfig | null>(null)
const entitlementLoading = ref(true)
const portalOpening = ref(false)

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
.usage-billing { width: 100%; max-width: 620px; color: #202123; }
.usage-billing__header { margin-bottom: 22px; }
.usage-billing__header h2 { margin: 0; font-size: 22px; line-height: 30px; font-weight: 650; letter-spacing: -.02em; }
.usage-billing__header p { margin: 5px 0 0; color: #6f737a; font-size: 13px; line-height: 20px; }
.usage-billing__loading,.usage-billing__notice { color: #7a7f87; font-size: 12px; line-height: 18px; }
.usage-billing__account,.usage-billing__meter-card,.usage-billing__limits { border: 1px solid #e5e5e5; border-radius: 14px; background: #fff; }
.usage-billing__account { padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.usage-billing__identity { min-width: 0; display: grid; gap: 2px; }
.usage-billing__identity > span,.usage-billing__plan-badge span { color: #8a8f98; font-size: 10px; font-weight: 600; }
.usage-billing__identity strong { font-size: 14px; }
.usage-billing__identity small { color: #7a7f87; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usage-billing__plan-badge { display: grid; gap: 2px; text-align: right; }
.usage-billing__plan-badge strong { font-size: 13px; }
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
.usage-billing__actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
.usage-billing__actions button { min-height: 36px; padding: 0 15px; border-radius: 9px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.usage-billing__primary { border: 1px solid #111827; background: #111827; color: #fff; }
.usage-billing__secondary { border: 1px solid #dedede; background: #fff; color: #202123; }
.usage-billing__actions button:disabled { opacity: .55; cursor: wait; }
@media (max-width: 640px) { .usage-billing__meters { grid-template-columns: 1fr; } .usage-billing__account { align-items: flex-start; } }
@media (prefers-reduced-motion: reduce) { .usage-billing__meter span { transition: none; } }
</style>
