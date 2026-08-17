<template>
  <span class="reference-kb-switcher">
    <span class="reference-kb-switcher__trigger" @click.stop="open = !open">
      <slot />
    </span>

    <template v-if="open">
      <span class="reference-kb-switcher__backdrop" @click="open = false" />
      <div class="reference-kb-switcher__menu" role="menu">
        <button
          v-for="item in sortedList"
          :key="item.id"
          type="button"
          class="reference-kb-switcher__row"
          :class="{ active: item.id === currentKbId }"
          @click="handleSelect(item.id)"
        >
          <ReferenceIcon :name="iconFor(item.type)" :size="14" class="reference-kb-switcher__icon" />
          <span :title="item.name">{{ item.name }}</span>
          <ReferenceIcon
            v-if="item.id === currentKbId"
            name="check-circle-2"
            :size="13"
            class="reference-kb-switcher__check"
          />
        </button>
        <div v-if="!sortedList.length" class="reference-kb-switcher__empty">
          {{ t('common.noData') }}
        </div>
      </div>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReferenceIcon from '@/components/ReferenceIcon.vue'

interface KBEntry {
  id: string
  name: string
  type?: string
}

const props = defineProps<{
  kbList: KBEntry[]
  currentKbId: string
}>()
const emit = defineEmits<{
  (e: 'select', kbId: string): void
}>()
const { t } = useI18n()
const open = ref(false)

const sortedList = computed<KBEntry[]>(() => {
  const all = props.kbList || []
  const current = all.find((kb) => kb.id === props.currentKbId)
  if (!current) return all
  return [current, ...all.filter((kb) => kb.id !== props.currentKbId)]
})

const iconFor = (type?: string): 'folder' | 'message-square-plus' =>
  type === 'faq' ? 'message-square-plus' : 'folder'

const handleSelect = (id: string): void => {
  open.value = false
  if (id === props.currentKbId) return
  emit('select', id)
}
</script>

<style scoped>
.reference-kb-switcher {
  position: relative;
  display: inline-flex;
  min-width: 0;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-kb-switcher__trigger { display: inline-flex; min-width: 0; }
.reference-kb-switcher__backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
}
.reference-kb-switcher__menu {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 90;
  width: 260px;
  max-width: min(320px, calc(100vw - 32px));
  max-height: min(60vh, 420px);
  overflow-y: auto;
  padding: 6px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / .10), 0 8px 10px -6px rgb(0 0 0 / .10);
}
.reference-kb-switcher__row {
  width: 100%;
  min-height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  font-family: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
}
.reference-kb-switcher__row:hover { background: #f3f4f6; color: #111827; }
.reference-kb-switcher__row.active { background: #f3f4f6; color: #111827; font-weight: 700; }
.reference-kb-switcher__row > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-kb-switcher__icon { color: #9ca3af; flex: 0 0 auto; }
.reference-kb-switcher__check { color: #6b7280; flex: 0 0 auto; }
.reference-kb-switcher__empty { padding: 20px 10px; text-align: center; color: #9ca3af; font-size: 11px; }
</style>
