<template>
  <t-popup
    trigger="click"
    placement="bottom-left"
    :overlay-style="{ padding: 0 }"
    :overlay-inner-style="{ padding: '5px' }"
  >
    <template #content>
      <div class="visual-kb-switcher" role="listbox">
        <button
          v-for="item in sortedList"
          :key="item.id"
          type="button"
          class="visual-kb-switcher__row"
          :class="{ 'is-current': item.id === currentKbId }"
          role="option"
          :aria-selected="item.id === currentKbId"
          @click="handleSelect(item.id)"
        >
          <span class="visual-kb-switcher__icon" aria-hidden="true">
            <t-icon :name="iconFor(item.type)" />
          </span>
          <span class="visual-kb-switcher__name" :title="item.name">{{ item.name }}</span>
          <t-icon v-if="item.id === currentKbId" name="check" class="visual-kb-switcher__check" />
        </button>
        <div v-if="!sortedList.length" class="visual-kb-switcher__empty">{{ t('common.noData') }}</div>
      </div>
    </template>
    <slot />
  </t-popup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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

const sortedList = computed<KBEntry[]>(() => {
  const all = props.kbList || []
  const current = all.find((kb) => kb.id === props.currentKbId)
  if (!current) return all
  return [current, ...all.filter((kb) => kb.id !== props.currentKbId)]
})

const iconFor = (type?: string): string => type === 'faq' ? 'chat-bubble-help' : 'folder'

const handleSelect = (id: string): void => {
  if (id === props.currentKbId) return
  emit('select', id)
}
</script>

<style scoped lang="less">
.visual-kb-switcher {
  width: min(300px, calc(100vw - 24px));
  min-width: 220px;
  max-height: min(60vh, 420px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.visual-kb-switcher__row {
  width: 100%;
  min-height: 36px;
  padding: 6px 8px;
  border: 0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-size: 11px;
  line-height: 17px;
  text-align: left;
  cursor: pointer;
}

.visual-kb-switcher__row:hover,
.visual-kb-switcher__row.is-current {
  background: #f3f4f6;
  color: #111827;
}

.visual-kb-switcher__row.is-current {
  font-weight: 650;
}

.visual-kb-switcher__icon {
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  color: #6b7280;
}

.visual-kb-switcher__icon :deep(.t-icon) { font-size: 13px; }
.visual-kb-switcher__name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-kb-switcher__check { flex: 0 0 12px; font-size: 12px; color: #4b5563; }
.visual-kb-switcher__empty { padding: 18px 10px; color: #9ca3af; font-size: 11px; text-align: center; }
</style>
