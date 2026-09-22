<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { listMarketplaceLibrary, type MarketplaceLibraryEntry } from '@/api/creator-marketplace'
import WikiBrowser from '@/views/knowledge/wiki/WikiBrowser.vue'
import './marketplace.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const entry = ref<MarketplaceLibraryEntry | null>(null)
const loading = ref(true)
const failure = ref<'denied' | 'temporary' | ''>('')
const view = ref<'browser' | 'graph'>('browser')
const openingChat = ref(false)
const scopeKey = computed(() => `${route.params.productId}:${route.params.kbId}:${auth.user?.id}:${auth.currentTenantId}:${auth.selectedTenantId}`)
let sequence = 0
function readFailed(error: unknown, key: string) {
  if (key !== scopeKey.value) return
  const status = (error as any)?.status
  failure.value = status === 403 ? 'denied' : 'temporary'
}
async function load() {
  const run = ++sequence
  const key = scopeKey.value
  entry.value = null
  failure.value = ''
  loading.value = true
  view.value = 'browser'
  try {
    const rows = await listMarketplaceLibrary()
    if (run !== sequence || key !== scopeKey.value) return
    entry.value = rows.find(row => row.product_id === route.params.productId && row.knowledge_base_id === route.params.kbId) || null
    if (!entry.value?.can_read) failure.value = 'denied'
  } catch (error) {
    if (run === sequence) readFailed(error, key)
  } finally {
    if (run === sequence) loading.value = false
  }
}
// A keyed mount isolates all Wiki caches and in-flight results when switching products.
const viewer = computed(() => {
  if (!entry.value || failure.value || loading.value) return null
  const key = scopeKey.value
  const run = sequence
  return { entry: entry.value, key: `${key}:${run}`, onError: (error: unknown) => {
    if (run === sequence) readFailed(error, key)
  } }
})
watch(scopeKey, load, { immediate: true, flush: 'sync' })
onUnmounted(() => { sequence++ })
async function ask() {
  if (!entry.value?.can_read || failure.value || openingChat.value) return
  openingChat.value = true
  try { await router.push({ path: '/platform/creatChat', query: { marketplace_product: entry.value.product_id } }) }
  finally { openingChat.value = false }
}
function showGraph(slug: string) {
  view.value = 'graph'
  void router.replace({ query: { ...route.query, slug } })
}
</script>

<template>
  <main class="market-page market-library-reader">
    <header class="market-library-reader__header">
      <RouterLink class="market-link" to="/platform/knowledge-bases">{{ $t('creatorMarketplace.libraryBack') }}</RouterLink>
      <div class="market-library-reader__title">
        <h1>{{ entry?.name || $t('creatorMarketplace.libraryTitle') }}</h1>
        <t-tag variant="light">{{ $t('creatorMarketplace.libraryReadOnly') }}</t-tag>
      </div>
      <p v-if="entry">{{ entry.product_title }}</p>
      <p v-if="entry?.can_read && !failure && entry.paid_through">{{ $t(entry.cancel_at_period_end ? 'creatorMarketplace.cancelScheduled' : 'creatorMarketplace.availableUntil', { date: new Date(entry.paid_through).toLocaleDateString() }) }}</p>
      <div class="market-library-reader__actions">
        <template v-if="viewer?.entry.wiki_enabled">
          <t-button :theme="view === 'browser' ? 'primary' : 'default'" :variant="view === 'browser' ? 'base' : 'outline'" @click="view = 'browser'">Wiki</t-button>
          <t-button :theme="view === 'graph' ? 'primary' : 'default'" :variant="view === 'graph' ? 'base' : 'outline'" @click="view = 'graph'">{{ $t('creatorMarketplace.libraryGraph') }}</t-button>
        </template>
        <t-button v-if="entry?.can_read && !failure && !loading" theme="primary" :loading="openingChat" @click="ask">{{ $t('creatorMarketplace.startChat') }}</t-button>
      </div>
      <p>{{ $t('creatorMarketplace.allowanceNote') }}</p>
    </header>
    <div v-if="loading" role="status"><t-loading /></div>
    <div v-else-if="failure" class="market-library-reader__notice" role="alert">
      <p>{{ $t(failure === 'denied' ? 'creatorMarketplace.libraryDenied' : 'creatorMarketplace.libraryLoadFailed') }}</p>
      <RouterLink v-if="failure === 'denied'" class="market-link" to="/platform/orders">{{ $t('creatorMarketplace.orders') }}</RouterLink>
      <t-button v-else theme="default" variant="outline" @click="load">{{ $t('creatorMarketplace.retry') }}</t-button>
    </div>
    <WikiBrowser v-else-if="viewer?.entry.wiki_enabled" :key="viewer.key"
      :knowledge-base-id="viewer.entry.knowledge_base_id" :marketplace-product-id="viewer.entry.product_id"
      :can-edit="false" :view="view" @read-error="viewer.onError" @view-graph="showGraph" />
    <p v-else role="status">{{ $t('creatorMarketplace.libraryEmpty') }}</p>
  </main>
</template>

<style scoped>
.market-page.market-library-reader { box-sizing: border-box; width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 20px; color: var(--td-text-color-primary); overflow: auto; }
.market-library-reader__header { flex: 0 0 auto; min-width: 0; }
.market-library-reader__header p { margin: 8px 0; font-size: 12px; color: var(--td-text-color-secondary); overflow-wrap: anywhere; }
.market-library-reader__title, .market-library-reader__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.market-library-reader__title h1 { margin: 12px 0; font-size: 20px; overflow-wrap: anywhere; }
.market-library-reader__notice { padding: 24px 0; }
.market-library-reader :deep(.wiki-browser) { flex: 1; min-height: 450px; min-width: 0; }
@media (max-width: 640px) {
  .market-page.market-library-reader { padding: 12px; }
  .market-library-reader :deep(.wiki-browser) { flex-direction: column; min-height: 580px; }
  .market-library-reader :deep(.wiki-sidebar) { width: 100%; min-width: 0; max-height: 230px; flex: 0 0 230px; }
  .market-library-reader :deep(.wiki-reader) { min-height: 320px; }
  .market-library-reader :deep(.wiki-reader-header) { padding: 12px; }
  .market-library-reader :deep(.wiki-reader-body) { padding: 16px; overflow-wrap: anywhere; }
  .market-library-reader :deep(.wiki-reader-footer) { padding: 12px; }
  .market-library-reader :deep(.wiki-graph-search-container) { max-width: calc(100% - 24px); }
  .market-library-reader :deep(.wiki-graph-legend) { max-width: calc(100% - 24px); }
}
</style>
