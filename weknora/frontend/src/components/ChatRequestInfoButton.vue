<template>
  <span class="reference-request-info">
    <button type="button" class="reference-request-info__trigger" :title="$t('chat.requestInfoTitle')" @click="visible = !visible">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
    </button>

    <template v-if="visible">
      <span class="reference-request-info__backdrop" @click="visible = false" />
      <div class="reference-request-info__card" @click.stop>
        <header>
          <strong>{{ $t('chat.requestInfoTitle') }}</strong>
          <button v-if="rows.length" type="button" :title="$t('common.copy')" @click="copyAll">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
        </header>
        <div v-if="!rows.length" class="reference-request-info__empty">{{ $t('chat.requestInfoEmpty') }}</div>
        <div v-else class="reference-request-info__rows">
          <div v-for="row in rows" :key="row.key">
            <span>{{ row.label }}</span>
            <code>{{ row.value }}</code>
          </div>
        </div>
      </div>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { MessagePlugin } from 'tdesign-vue-next';
import { buildChatRequestDebugPayload, type ChatRequestDebugInfo } from '@/utils/chatRequestDebug';
import { copyTextToClipboard } from '@/utils/chatMessageShared';

const props = defineProps<{ session: Record<string, unknown>; sessionId?: string }>();
const { t } = useI18n();
const visible = ref(false);
const debugInfo = computed((): ChatRequestDebugInfo => {
  const s = props.session;
  const dr = s.debugRequest as ChatRequestDebugInfo | undefined;
  return {
    requestId: (s.request_id as string) || dr?.requestId,
    messageId: (s.id as string) || undefined,
    sessionId: props.sessionId || dr?.sessionId,
    url: dr?.url,
    method: dr?.method,
    body: dr?.body ?? null,
    sentAt: dr?.sentAt,
  };
});
const rows = computed(() => {
  const info = debugInfo.value;
  const list: { key: string; label: string; value: string }[] = [];
  const add = (key: string, labelKey: string, val?: string) => { if (val) list.push({ key, label: t(labelKey), value: val }); };
  add('requestId', 'chat.requestInfoRequestId', info.requestId);
  add('messageId', 'chat.requestInfoMessageId', info.messageId);
  add('sessionId', 'chat.requestInfoSessionId', info.sessionId);
  if (info.method && info.url) list.push({ key: 'url', label: t('chat.requestInfoUrl'), value: `${info.method} ${info.url}` });
  if (info.sentAt) add('sentAt', 'chat.requestInfoSentAt', new Date(info.sentAt).toLocaleString());
  return list;
});
const copyAll = async () => {
  try {
    await copyTextToClipboard(buildChatRequestDebugPayload(debugInfo.value));
    MessagePlugin.success(t('common.copied'));
    visible.value = false;
  } catch { MessagePlugin.error(t('common.copyFailed')); }
};
</script>

<style scoped>
.reference-request-info{position:relative;display:inline-flex}.reference-request-info__trigger{width:27px;height:27px;padding:0;border:0;border-radius:8px;background:transparent;color:#9ca3af;display:grid;place-items:center;cursor:pointer}.reference-request-info__trigger:hover{background:#f3f4f6;color:#374151}.reference-request-info__trigger svg,.reference-request-info__card header button svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.reference-request-info__backdrop{position:fixed;inset:0;z-index:110}.reference-request-info__card{position:absolute;left:0;bottom:calc(100% + 7px);z-index:120;width:300px;max-width:min(360px,calc(100vw - 32px));padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 20px 25px -5px rgb(0 0 0 / 10%),0 8px 10px -6px rgb(0 0 0 / 10%);font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif;color:#111827}.reference-request-info__card header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:7px;margin-bottom:6px;border-bottom:1px solid #f3f4f6}.reference-request-info__card header strong{font-size:10px;line-height:14px;font-weight:800}.reference-request-info__card header button{width:25px;height:25px;padding:0;border:0;border-radius:7px;background:transparent;color:#9ca3af;display:grid;place-items:center;cursor:pointer}.reference-request-info__card header button:hover{background:#f3f4f6;color:#374151}.reference-request-info__rows{display:flex;flex-direction:column}.reference-request-info__rows>div{display:grid;grid-template-columns:74px minmax(0,1fr);gap:8px;padding:4px 0;align-items:start}.reference-request-info__rows span{color:#9ca3af;font-size:9px;line-height:14px;font-weight:600}.reference-request-info__rows code{color:#374151;font:500 8.5px/1.55 "JetBrains Mono",ui-monospace,monospace;word-break:break-all;white-space:pre-wrap}.reference-request-info__empty{padding:8px 0;color:#9ca3af;font-size:9px}
</style>
