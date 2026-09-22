<template>
  <main class="market-page"><div class="market-container">
    <MarketplaceHeader :title="t('creatorMarketplace.title')" :description="t('creatorMarketplace.subtitle')" />
    <div class="market-toolbar"><t-input v-model="query" clearable :placeholder="t('creatorMarketplace.search')" :aria-label="t('creatorMarketplace.search')"><template #prefix-icon><t-icon name="search" /></template></t-input></div>
    <div v-if="loading" class="market-empty" role="status">{{ t('common.loading') }}</div>
    <div v-else-if="failed" class="market-error" role="alert"><span>{{ t('creatorMarketplace.loadFailed') }}</span><t-button theme="default" @click="load">{{ t('creatorMarketplace.retry') }}</t-button></div>
    <template v-else>
      <section v-if="hero" class="market-featured">
        <img v-if="hero.cover_url" class="market-cover" :src="hero.cover_url" alt="" referrerpolicy="no-referrer" />
        <div v-else class="market-cover market-cover--empty"><t-icon name="book-open" /></div>
        <div class="market-featured-copy">
          <span class="market-badge">{{ t('creatorMarketplace.featured') }}</span>
          <h2>{{ hero.title }}</h2><p>{{ hero.description }}</p>

          <div class="market-actions"><strong class="market-price">{{ price(hero) }}<small>{{ t('creatorMarketplace.perMonth') }}</small></strong><t-button theme="primary" @click="open(hero.id)">{{ t('creatorMarketplace.viewDetails') }}</t-button></div>
        </div>
      </section>
      <section v-for="group in groups" :key="group.id" class="market-section">
        <div class="market-section-heading"><h2>{{ t(group.id === 'test' ? 'creatorMarketplace.testing' : 'creatorMarketplace.browse') }}</h2></div>
        <p v-if="group.id === 'test'" class="market-note">{{ t('creatorMarketplace.testingNote') }}</p>
        <div class="market-grid">
          <article v-for="product in group.products" :key="product.id" class="market-card">
            <img v-if="product.cover_url" class="market-cover" :src="product.cover_url" alt="" loading="lazy" referrerpolicy="no-referrer" />
            <div v-else class="market-cover market-cover--empty"><t-icon name="book-open" /></div>
            <div class="market-card-body">
              <div class="market-actions"><span v-if="product.fixture" class="market-badge market-badge--test">{{ t('creatorMarketplace.testBadge') }}</span><span v-if="product.access?.can_chat" class="market-badge market-badge--active">{{ t('creatorMarketplace.status.active') }}</span><span v-if="product.category" class="market-badge">{{ product.category }}</span></div>
              <h3><RouterLink :to="`/platform/marketplace/${product.id}`">{{ product.title }}</RouterLink></h3>

              <p class="market-card-description">{{ product.description }}</p>
              <div class="market-card-footer"><strong class="market-price">{{ price(product) }}<small>{{ t('creatorMarketplace.perMonth') }}</small></strong><t-button size="small" theme="default" @click="open(product.id)">{{ t('creatorMarketplace.viewDetails') }}</t-button></div>
            </div>
          </article>
        </div>
      </section>
      <p v-if="!filtered.length" class="market-empty">{{ t('creatorMarketplace.empty') }}</p>
    </template>
  </div></main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { listMarketplaceProducts, type MarketplaceProduct } from '@/api/creator-marketplace'
import MarketplaceHeader from './MarketplaceHeader.vue'
import { formatMarketPrice, sortMarketProducts } from './marketplacePresentation'
import './marketplace.css'
const { t, locale } = useI18n()
const router = useRouter()
const products = ref<MarketplaceProduct[]>([])
const query = ref('')
const loading = ref(true)
const failed = ref(false)
const filtered = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  return sortMarketProducts(products.value).filter(p => !q || `${p.title} ${p.description} ${p.category}`.toLocaleLowerCase().includes(q))
})
const hero = computed(() => filtered.value.find(p => p.featured && !p.fixture))
const groups = computed(() => [
  { id: 'regular', products: filtered.value.filter(p => !p.fixture && p.id !== hero.value?.id) },
  { id: 'test', products: filtered.value.filter(p => p.fixture) },
].filter(g => g.products.length))
const price = (p: MarketplaceProduct) => formatMarketPrice(p.monthly_amount, p.currency, locale.value)
const open = (id: string) => router.push(`/platform/marketplace/${encodeURIComponent(id)}`)
async function load() {
  loading.value = true; failed.value = false
  try { const result = await listMarketplaceProducts(); products.value = result.data || [] }
  catch { failed.value = true }
  finally { loading.value = false }
}
onMounted(load)
</script>
