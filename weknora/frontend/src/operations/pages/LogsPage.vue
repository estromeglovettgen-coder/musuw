<template>
  <div class="ops-page">
    <header class="ops-page-header">
      <div><h1>日志与追踪</h1><p>复用 Musuw 原生运行队列与系统审计组件。Langfuse 未配置时明确 unavailable；不会用空表伪装查询成功。</p></div>
      <div class="ops-page-actions"><t-tag :theme="config?.providers.langfuse.available ? 'success' : 'warning'" variant="light-outline">Langfuse {{ config?.providers.langfuse.available ? 'available' : 'unavailable' }}</t-tag></div>
    </header>

    <div v-if="!config?.providers.langfuse.available" class="ops-callout is-warning" style="margin-bottom:14px"><InfoCircleIcon class="ops-callout__icon"/><div><strong>Langfuse 查询未配置</strong><span>{{ config?.providers.langfuse.reason }}。运行队列、处理 span、request ID 和系统审计仍可从 Musuw 查看。</span></div></div>

    <div class="ops-segmented" style="margin-bottom:14px"><button :class="{ 'is-active': tab === 'runtime' }" @click="tab = 'runtime'">运行队列</button><button :class="{ 'is-active': tab === 'audit' }" @click="tab = 'audit'">系统审计</button></div>
    <section class="ops-panel logs-host"><RuntimeQueues v-if="tab === 'runtime'" :key="`runtime-${refreshKey}`" /><SystemAuditLog v-else :key="`audit-${refreshKey}`" /></section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { InfoCircleIcon } from 'tdesign-icons-vue-next'
import RuntimeQueues from '@/views/system/RuntimeQueues.vue'
import SystemAuditLog from '@/views/system/SystemAuditLog.vue'
import type { OperationsConfig } from '../types'

defineProps<{ config: OperationsConfig | null; refreshKey: number }>()
defineEmits<{ busy: [value: boolean] }>()
const tab = ref<'runtime'|'audit'>('runtime')
</script>

<style scoped>
.logs-host { min-height: 560px; overflow: hidden; padding: 18px; }
.logs-host :deep(.runtime-queues), .logs-host :deep(.system-audit-log) { min-height: 520px; }
.logs-host :deep(.section-header) { margin-top: 0; }
</style>
