<template>
  <main class="market-page"><div class="market-container">
    <MarketplaceHeader :title="t('creatorMarketplace.title')" />
    <RouterLink class="market-link market-back" to="/platform/marketplace"><t-icon name="chevron-left" />{{ t('creatorMarketplace.back') }}</RouterLink>
    <div v-if="loading" class="market-empty">{{ t('common.loading') }}</div>
    <div v-else-if="failed || !product" class="market-error" role="alert"><span>{{ t('creatorMarketplace.loadFailed') }}</span><t-button theme="default" @click="load">{{ t('creatorMarketplace.retry') }}</t-button></div>
    <div v-else class="market-detail">
      <section class="market-detail-main">
        <img v-if="product.cover_url" :src="product.cover_url" alt="" class="market-cover" referrerpolicy="no-referrer" />
        <div class="market-detail-copy">
          <div class="market-actions"><span v-if="product.featured" class="market-badge">{{ t('creatorMarketplace.featured') }}</span><span v-if="product.fixture" class="market-badge market-badge--test">{{ t('creatorMarketplace.testBadge') }}</span><span v-if="product.category" class="market-badge">{{ product.category }}</span></div>
          <h1>{{ product.title }}</h1>
          <p class="market-muted">{{ t('creatorMarketplace.updated', { date: formatMarketDate(product.updated_at, locale) }) }}</p>
          <h2>{{ t('creatorMarketplace.included') }}</h2><p class="market-description">{{ product.description }}</p>
          <template v-if="product.sample_questions?.length"><h2>{{ t('creatorMarketplace.examples') }}</h2><ul class="market-questions"><li v-for="question in product.sample_questions" :key="question">{{ question }}</li></ul></template>
        </div>
      </section>
      <aside class="market-purchase">
        <span class="market-badge">{{ t('creatorMarketplace.qaOnly') }}</span>
        <template v-if="isFreeMarketProduct(product)">
          <h2>{{ t('creatorMarketplace.free') }}</h2>
          <p class="market-note">{{ t('creatorMarketplace.freeAccessNote') }}</p>
          <t-button v-if="product.access?.can_chat" :loading="openingChat" @click="startChat">{{ t('creatorMarketplace.startChat') }}</t-button>
          <p v-else class="market-note">{{ t('creatorMarketplace.freeUnavailable') }}</p>
        </template>
        <template v-else-if="product.access?.can_chat">
          <h2>{{ t('creatorMarketplace.status.active') }}</h2>
          <p class="market-note">{{ accessDate }}</p>
          <t-button :loading="openingChat" @click="startChat">{{ t('creatorMarketplace.startChat') }}</t-button>
        </template>
        <template v-else-if="!product.checkout_available && product.access?.subscription_id && product.access.portal_available">
          <h2>{{ t(marketStatusKey(product.access.status)) }}</h2>
          <p class="market-note">{{ t('creatorMarketplace.existingSubscription') }}</p>
        </template>
        <template v-else>
          <div class="market-period" role="group" :aria-label="t('creatorMarketplace.period')"><button type="button" :aria-pressed="period === 'monthly'" @click="period = 'monthly'">{{ t('creatorMarketplace.monthly') }}</button><button type="button" :aria-pressed="period === 'yearly'" @click="period = 'yearly'">{{ t('creatorMarketplace.yearly') }}</button></div>
          <div class="market-price">{{ displayPrice }}<small>{{ t(period === 'yearly' ? 'creatorMarketplace.perYear' : 'creatorMarketplace.perMonth') }}</small></div>
          <p v-if="period === 'yearly'" class="market-note">{{ t('creatorMarketplace.annualSaving') }}</p>
          <t-button :disabled="!product.checkout_available || product.status !== 'published'" @click="showCheckout = true">{{ t('creatorMarketplace.subscribe') }}</t-button>
          <p v-if="product.status !== 'published'" class="market-note">{{ t('creatorMarketplace.unpublished') }}</p>
          <p v-else-if="!product.checkout_available" class="market-note">{{ t('creatorMarketplace.checkoutUnavailable') }}</p>
          <p class="market-note">{{ t('creatorMarketplace.renewalNote') }}</p>
          <p class="market-note">{{ t('creatorMarketplace.checkoutPriceNote') }}</p>
        </template>
        <hr class="market-divider" /><p class="market-note">{{ t('creatorMarketplace.scopeNote') }}</p><p class="market-note">{{ t(isFreeMarketProduct(product) ? 'creatorMarketplace.freeAllowanceNote' : 'creatorMarketplace.allowanceNote') }}</p>
      </aside>
    </div>
    <MarketplaceCheckout v-if="showCheckout && product" :product="product" :period="period" @close="closeCheckout" @activated="afterActivated" />
  </div></main>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getMarketplaceProduct, type MarketplaceProduct, type MarketplaceBillingPeriod } from '@/api/creator-marketplace'
import MarketplaceHeader from './MarketplaceHeader.vue'
import MarketplaceCheckout from './MarketplaceCheckout.vue'
import { formatMarketPrice, formatMarketDate, isFreeMarketProduct, marketStatusKey } from './marketplacePresentation'
import './marketplace.css'
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const product = ref<MarketplaceProduct | null>(null)
const loading = ref(true)
const failed = ref(false)
const period = ref<MarketplaceBillingPeriod>('monthly')
const showCheckout = ref(false)
const openingChat = ref(false)
let requestId = 0
const displayPrice = computed(() => product.value ? formatMarketPrice(period.value === 'yearly' ? product.value.yearly_amount : product.value.monthly_amount, product.value.currency, locale.value) : '')
const accessDate = computed(() => t(product.value?.access?.cancel_at_period_end ? 'creatorMarketplace.cancelScheduled' : 'creatorMarketplace.availableUntil', { date: formatMarketDate(product.value?.access?.paid_through, locale.value) }))
async function load() {
  const current = ++requestId
  loading.value = true; failed.value = false
  try { const value = await getMarketplaceProduct(String(route.params.productId)); if (current === requestId) product.value = value }
  catch { if (current === requestId) failed.value = true }
  finally { if (current === requestId) loading.value = false }
}
async function startChat() {
  if (!product.value || openingChat.value) return
  openingChat.value = true
  try { await router.push({ path: '/platform/creatChat', query: { marketplace_product: product.value.id } }) }
  finally { openingChat.value = false }
}
function closeCheckout() { showCheckout.value = false; void load() }
async function afterActivated() { showCheckout.value = false; await load(); if (product.value?.access?.can_chat) await startChat() }
watch(() => route.params.productId, () => { product.value = null; showCheckout.value = false; void load() }, { immediate: true })
</script>
<style scoped>.market-back { margin: 0 0 20px; }.market-period { margin-top: 20px; }.market-purchase h2 { margin: 20px 0 10px; font-size: 20px; }</style>
