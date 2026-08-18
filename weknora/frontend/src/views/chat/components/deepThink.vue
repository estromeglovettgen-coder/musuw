<template>
  <section class="visual-thinking-panel" :class="{ 'is-running': deepSession?.thinking, 'is-folded': isFold }">
    <button type="button" class="visual-thinking-panel__header" :disabled="deepSession?.thinking" @click="toggleFold">
      <span class="visual-thinking-panel__status">
        <span v-if="deepSession?.thinking" class="visual-thinking-panel__spinner" aria-hidden="true" />
        <t-icon v-else name="check-circle" class="visual-thinking-panel__done" />
        <span>{{ deepSession?.thinking ? $t('chat.thinking') : $t('chat.deepThoughtCompleted') }}</span>
      </span>
      <t-icon v-if="!deepSession?.thinking" :name="isFold ? 'chevron-right' : 'chevron-down'" class="visual-thinking-panel__chevron" />
    </button>
    <div v-show="!isFold || deepSession?.thinking" class="visual-thinking-panel__body">
      <div ref="contentInnerRef" class="visual-thinking-panel__content">{{ deepSession?.thinkContent }}</div>
    </div>
  </section>
</template>
<script setup>
import { watch, ref, onMounted, nextTick } from 'vue';
const isFold = ref(false)
const contentInnerRef = ref(null)
const props = defineProps({ deepSession: { type: Object, required: false } });
onMounted(() => { if (props.deepSession?.thinking === false) isFold.value = true; });
watch(() => props.deepSession?.thinking, (newVal, oldVal) => { if (oldVal === true && newVal === false) isFold.value = true; });
watch(() => props.deepSession?.thinkContent, () => {
  if (props.deepSession?.thinking) nextTick(() => { if (contentInnerRef.value) contentInnerRef.value.scrollTop = contentInnerRef.value.scrollHeight; });
});
const toggleFold = () => { if (!props.deepSession?.thinking) isFold.value = !isFold.value; }
</script>
<style scoped lang="less">
.visual-thinking-panel { width: 100%; margin: 2px 0 8px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; color: #6b7280; }
.visual-thinking-panel__header { width: 100%; min-height: 34px; padding: 6px 9px; border: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: transparent; color: #6b7280; font: inherit; font-size: 10px; line-height: 16px; text-align: left; cursor: pointer; }
.visual-thinking-panel__header:hover:not(:disabled) { background: #f9fafb; color: #374151; }
.visual-thinking-panel__header:disabled { cursor: default; }
.visual-thinking-panel__status { min-width: 0; display: flex; align-items: center; gap: 7px; }
.visual-thinking-panel__spinner { flex: 0 0 10px; width: 10px; height: 10px; border: 1px solid #9ca3af; border-right-color: transparent; border-radius: 50%; animation: visual-thinking-spin .85s linear infinite; }
.visual-thinking-panel__done { flex: 0 0 11px; font-size: 11px; color: #6b7280; }
.visual-thinking-panel__chevron { flex: 0 0 11px; font-size: 11px; color: #9ca3af; }
.visual-thinking-panel__body { border-top: 1px solid #f3f4f6; background: #f9fafb; }
.visual-thinking-panel__content { max-height: 210px; overflow-y: auto; padding: 9px 11px; color: #6b7280; font-size: 10px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; scrollbar-width: thin; }
@keyframes visual-thinking-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .visual-thinking-panel__spinner { animation: none; } }
</style>
