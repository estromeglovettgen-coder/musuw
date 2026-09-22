<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { listMarketplaceLibrary, type MarketplaceLibraryEntry } from '@/api/creator-marketplace'
import KnowledgeBaseListReferenceCard from '@/views/knowledge/components/KnowledgeBaseListReferenceCard.vue'

const emit = defineEmits<{ count: [value: number] }>()
const router = useRouter()
const auth = useAuthStore()
const entries = ref<MarketplaceLibraryEntry[]>([])
const failed = ref(false)
let sequence = 0
async function load() {
  const run = ++sequence
  entries.value = []
  failed.value = false
  emit('count', -1)
  if (!auth.isLoggedIn) return
  try {
    const data = await listMarketplaceLibrary()
    if (run === sequence) { entries.value = data; emit('count', data.length) }
  } catch {
    if (run === sequence) { failed.value = true; emit('count', 0) }
  }
}
watch(() => [auth.user?.id, auth.currentTenantId, auth.selectedTenantId], load, { immediate: true })
onUnmounted(() => { sequence++ })
const card = (entry: MarketplaceLibraryEntry) => ({ name: entry.name, description: entry.description, type: 'document', indexing_strategy: { wiki_enabled: entry.wiki_enabled } })
const open = (entry: MarketplaceLibraryEntry) => router.push({ name: 'marketplaceKnowledgeBase', params: { productId: entry.product_id, kbId: entry.knowledge_base_id } })
</script>

<template>
  <section v-if="entries.length || failed" class="market-library-cards" :aria-label="$t('creatorMarketplace.libraryTitle')">
    <h2>{{ $t('creatorMarketplace.libraryTitle') }} <small>{{ entries.length }}</small></h2>
    <div v-if="failed" role="alert">
      <p>{{ $t('creatorMarketplace.libraryLoadFailed') }}</p>
      <t-button variant="outline" @click="load">{{ $t('creatorMarketplace.retry') }}</t-button>
    </div>
    <div v-else class="visual-kb-grid">
      <KnowledgeBaseListReferenceCard
        v-for="entry in entries" :key="`${entry.product_id}:${entry.knowledge_base_id}`"
        :kb="card(entry)" shared :can-favorite="false" :can-duplicate="false" :can-manage="false"
        :show-strategies="entry.wiki_enabled" :show-footer="!entry.can_read"
        role="button" tabindex="0" :aria-label="entry.name" @open="open(entry)"
        @keydown.enter.prevent="open(entry)" @keydown.space.prevent="open(entry)"
      >
        <template #footer>
          <span>{{ $t('creatorMarketplace.libraryUnavailable') }}</span>
        </template>
      </KnowledgeBaseListReferenceCard>
    </div>
  </section>
</template>

<style scoped>
.market-library-cards { min-width: 0; margin-bottom: 24px; }
.market-library-cards h2 { margin: 0 0 12px; font-size: 15px; }
</style>
