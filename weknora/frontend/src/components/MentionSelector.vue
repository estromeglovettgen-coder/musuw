<template>
  <div v-if="visible" ref="menuRef" class="mention-menu" :style="style" @click.stop>
    <div ref="listRef" class="mention-list" @scroll="onScroll">
      <template v-if="!currentGroupType && !isFlatMode">
        <button
          v-for="(group, index) in groupRows"
          :key="group.type"
          type="button"
          class="mention-group-entry"
          :class="{ active: index === groupActiveIndex }"
          @click.stop="enterGroup(group.type)"
          @mouseenter="groupActiveIndex = index"
        >
          <span class="mention-icon" :class="`is-${group.type}`" aria-hidden="true">
            <svg v-if="group.type === 'kb'" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
            <svg v-else-if="group.type === 'tag'" viewBox="0 0 24 24"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none"/></svg>
            <svg v-else-if="group.type === 'mcp'" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0-1.4-1.4L10 8.2 8.6 6.8 11.9 3.5a1 1 0 0 0-1.4-1.4L7.2 5.4a2 2 0 0 0 0 2.8l1.4 1.4-6.3 6.3a2 2 0 1 0 2.8 2.8l6.3-6.3 1.4 1.4a2 2 0 0 0 2.8 0l3.3-3.3a1 1 0 0 0-1.4-1.4l-3.3 3.3-1.4-1.4 3.3-3.3a1 1 0 0 0-1.4-1.4Z"/></svg>
            <svg v-else-if="group.type === 'skill'" viewBox="0 0 24 24"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </span>
          <span class="mention-group-entry__label">{{ group.label }}</span>
          <span class="mention-group-entry__count">{{ formatGroupCount(group) }}</span>
          <svg class="mention-group-entry__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <div v-if="groupRows.length === 0 && !loading" class="empty">
          {{ emptyHint || $t('common.noResult') }}
        </div>
      </template>

      <template v-else>
        <button v-if="!isFlatMode" type="button" class="mention-back-row" @click.stop="leaveGroup">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          <span>{{ currentGroup?.label }}</span>
        </button>

        <template v-for="group in visibleGroups" :key="group.type">
          <div v-if="isFlatMode && groupTabs.length > 1" class="mention-group-header">{{ group.label }}</div>
          <div class="mention-group" :data-group-type="group.type">
            <button
              v-for="(item, index) in group.items"
              :key="`${item.type}:${item.id}`"
              type="button"
              class="mention-item"
              :class="{ active: group.offset + index === activeIndex }"
              @click="$emit('select', item)"
              @mouseenter="handleItemEnter(item, group.offset + index)"
              @mouseleave="scheduleDetailClose"
            >
              <span class="mention-icon" :class="`is-${item.type}`" aria-hidden="true">
                <svg v-if="item.type === 'kb' && item.kbType === 'faq'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4"/><path d="M12 18h.01"/></svg>
                <svg v-else-if="item.type === 'kb'" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                <svg v-else-if="item.type === 'tag'" viewBox="0 0 24 24"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" stroke="none"/></svg>
                <svg v-else-if="item.type === 'mcp'" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0-1.4-1.4L10 8.2 8.6 6.8 11.9 3.5a1 1 0 0 0-1.4-1.4L7.2 5.4a2 2 0 0 0 0 2.8l1.4 1.4-6.3 6.3a2 2 0 1 0 2.8 2.8l6.3-6.3 1.4 1.4a2 2 0 0 0 2.8 0l3.3-3.3a1 1 0 0 0-1.4-1.4l-3.3 3.3-1.4-1.4 3.3-3.3a1 1 0 0 0-1.4-1.4Z"/></svg>
                <svg v-else-if="item.type === 'skill'" viewBox="0 0 24 24"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z"/></svg>
                <svg v-else viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
              <span class="name" :title="item.name">{{ item.name }}</span>
              <span v-if="item.type === 'kb'" class="count">{{ item.count || 0 }}</span>
              <span v-if="item.kbName && item.type !== 'kb'" class="item-context">{{ item.kbName }}</span>
            </button>
          </div>
        </template>

        <div v-if="loading" class="loading-more"><span class="mention-spinner" /></div>
        <div v-if="items.length === 0 && !loading" class="empty">
          {{ emptyHint || $t('common.noResult') }}
        </div>
      </template>
    </div>

    <aside
      v-if="hoveredDetailItem && !isScrolling"
      class="mention-detail-card"
      @mouseenter="cancelDetailClose"
      @mouseleave="scheduleDetailClose"
    >
      <div class="detail-header">
        <span class="detail-name">{{ detailTitle }}</span>
        <span v-if="hoveredDetailItem.type === 'kb'" class="detail-type-badge">
          {{ hoveredDetailItem.kbType === 'faq' ? $t('knowledgeEditor.basic.typeFAQ') : $t('knowledgeEditor.basic.typeDocument') }}
        </span>
      </div>
      <div v-if="hoveredDetailState?.loading" class="detail-state"><span class="mention-spinner" /></div>
      <div v-else-if="hoveredDetailState?.error" class="detail-state is-error">{{ hoveredDetailState.error }}</div>
      <template v-else>
        <p v-if="detailDescription" class="detail-desc">{{ detailDescription }}</p>
        <div class="detail-meta">
          <button v-if="detailKbName" type="button" class="detail-link" @click.stop="handleKbClick(detailKbId)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
            <span>{{ $t('mentionDetail.belongsToKb') }}</span>
            <strong>{{ detailKbName }}</strong>
          </button>
          <button v-if="detailOrgName" type="button" class="detail-link" @click.stop="handleOrgClick(detailOrgName)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
            <span>{{ $t('mentionDetail.belongsToOrg') }}</span>
            <strong>{{ detailOrgName }}</strong>
          </button>
          <div v-if="hoveredDetailItem.serviceName" class="detail-line"><span>MCP</span><strong>{{ hoveredDetailItem.serviceName }}</strong></div>
        </div>
      </template>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getKnowledgeBaseById } from "@/api/knowledge-base";
import { getKnowledgeDetails } from "@/api/knowledge-base";
import { useOrganizationStore } from "@/stores/organization";
import { useSettingsStore } from "@/stores/settings";
import type { MentionItem, MentionItemType } from "@/types/mention";

type DetailState = { loading: boolean; error?: string; data?: any };

const props = defineProps<{
  visible: boolean;
  style: any;
  items: MentionItem[];
  activeIndex: number;
  hasMore?: boolean;
  loading?: boolean;
  emptyHint?: string;
  query?: string;
  groupCounts?: Partial<Record<MentionItemType, number>>;
}>();

const emit = defineEmits(["select", "update:activeIndex", "loadMore"]);
const router = useRouter();
const { t } = useI18n();
const orgStore = useOrganizationStore();
const settingsStore = useSettingsStore();
const menuRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const detailCache = ref<Record<string, DetailState>>({});
const isScrolling = ref(false);
const currentGroupType = ref<MentionItemType | null>(null);
const groupActiveIndex = ref(0);
const hoveredDetailItem = ref<MentionItem | null>(null);
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let detailCloseTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
  if (scrollTimer) clearTimeout(scrollTimer);
  if (detailCloseTimer) clearTimeout(detailCloseTimer);
});

const agentIdForDetail = computed(() => {
  const sourceTenantId = settingsStore.selectedAgentSourceTenantId;
  const agentId = settingsStore.selectedAgentId;
  return sourceTenantId && agentId ? agentId : undefined;
});
const agentSourceTenantIdForDetail = computed(
  () => settingsStore.selectedAgentSourceTenantId ?? undefined,
);

const mentionGroupDefs = computed<Array<{ type: MentionItemType; label: string; icon: string }>>(
  () => [
    { type: "kb", label: t("common.knowledgeBase"), icon: "folder" },
    { type: "tag", label: "标签", icon: "tag" },
    { type: "mcp", label: "MCP", icon: "tools" },
    { type: "skill", label: "Skills", icon: "bookmark" },
    { type: "file", label: t("common.file"), icon: "file" },
  ],
);

const mentionGroups = computed(() => {
  let offset = 0;
  return mentionGroupDefs.value.map((def) => {
    const items = props.items.filter((item) => item.type === def.type);
    const loadedCount = items.length;
    const count = props.groupCounts?.[def.type] ?? loadedCount;
    const group = { ...def, items, offset, count, loadedCount };
    offset += items.length;
    return group;
  });
});

const formatGroupCount = (group: { type: MentionItemType; count: number; loadedCount: number }) => {
  if (props.groupCounts?.[group.type] != null) return props.groupCounts[group.type]!;
  if (group.type === "file" && props.hasMore) return `${group.loadedCount}+`;
  return group.count;
};

const groupTabs = computed(() => mentionGroups.value.filter((group) => group.count > 0));
const groupRows = computed(() => groupTabs.value);
const isFlatMode = computed(() => (props.query ?? "").trim().length > 0);
const currentGroup = computed(() => mentionGroups.value.find((group) => group.type === currentGroupType.value));
const visibleGroups = computed(() => {
  if (isFlatMode.value) return mentionGroups.value.filter(group => group.items.length > 0);
  const group = currentGroup.value;
  return group && group.items.length > 0 ? [group] : [];
});

const enterGroup = (type: MentionItemType) => {
  const group = mentionGroups.value.find((item) => item.type === type && item.count > 0);
  if (!group || !listRef.value) return;
  currentGroupType.value = type;
  emit("update:activeIndex", group.offset);
  nextTick(() => { if (listRef.value) listRef.value.scrollTo({ top: 0 }); });
};

const leaveGroup = () => {
  if (isFlatMode.value || !currentGroupType.value) return false;
  const rowIndex = groupRows.value.findIndex((group) => group.type === currentGroupType.value);
  groupActiveIndex.value = Math.max(0, rowIndex);
  currentGroupType.value = null;
  hoveredDetailItem.value = null;
  nextTick(() => { if (listRef.value) listRef.value.scrollTop = 0; });
  return true;
};

watch(groupTabs, (groups) => {
  if (groupActiveIndex.value >= groups.length) groupActiveIndex.value = Math.max(0, groups.length - 1);
});

const moveActive = (delta: number) => {
  if (isFlatMode.value) {
    const next = Math.min(props.items.length - 1, Math.max(0, props.activeIndex + delta));
    emit("update:activeIndex", next);
    scrollToItem(next);
    return;
  }
  if (!currentGroupType.value) {
    const maxIndex = Math.max(0, groupRows.value.length - 1);
    groupActiveIndex.value = Math.min(maxIndex, Math.max(0, groupActiveIndex.value + delta));
    return;
  }
  const group = currentGroup.value;
  if (!group) return;
  const currentLocalIndex = props.activeIndex - group.offset;
  const nextLocalIndex = Math.min(group.items.length - 1, Math.max(0, currentLocalIndex + delta));
  emit("update:activeIndex", group.offset + nextLocalIndex);
  scrollToItem(nextLocalIndex);
};

const confirmActive = () => {
  if (isFlatMode.value) {
    const item = props.items[props.activeIndex];
    if (item) emit("select", item);
    return;
  }
  if (!currentGroupType.value) {
    const group = groupRows.value[groupActiveIndex.value];
    if (group) enterGroup(group.type);
    return;
  }
  const group = currentGroup.value;
  if (!group) return;
  const item = group.items[props.activeIndex - group.offset];
  if (item) emit("select", item);
};

defineExpose({ moveActive, confirmActive, leaveGroup });

async function fetchKbDetail(item: { id: string }) {
  if (detailCache.value[item.id]?.data || detailCache.value[item.id]?.loading) return;
  detailCache.value = { ...detailCache.value, [item.id]: { loading: true } };
  try {
    const opts = agentIdForDetail.value ? { agent_id: agentIdForDetail.value, agent_source_tenant_id: agentSourceTenantIdForDetail.value } : undefined;
    const res: any = await getKnowledgeBaseById(item.id, opts);
    detailCache.value = { ...detailCache.value, [item.id]: { loading: false, data: res?.data ?? res } };
  } catch (e: any) {
    detailCache.value = { ...detailCache.value, [item.id]: { loading: false, error: e?.message || "Failed to load" } };
  }
}

async function fetchFileDetail(item: { id: string }) {
  if (detailCache.value[item.id]?.data || detailCache.value[item.id]?.loading) return;
  detailCache.value = { ...detailCache.value, [item.id]: { loading: true } };
  try {
    const opts = agentIdForDetail.value ? { agent_id: agentIdForDetail.value, agent_source_tenant_id: agentSourceTenantIdForDetail.value } : undefined;
    const res: any = await getKnowledgeDetails(item.id, opts);
    detailCache.value = { ...detailCache.value, [item.id]: { loading: false, data: res?.data ?? res } };
  } catch (e: any) {
    detailCache.value = { ...detailCache.value, [item.id]: { loading: false, error: e?.message || "Failed to load" } };
  }
}

const handleItemEnter = (item: MentionItem, index: number) => {
  cancelDetailClose();
  emit("update:activeIndex", index);
  hoveredDetailItem.value = item;
  if (item.type === "kb") void fetchKbDetail(item);
  if (item.type === "file") void fetchFileDetail(item);
};
const scheduleDetailClose = () => {
  if (detailCloseTimer) clearTimeout(detailCloseTimer);
  detailCloseTimer = setTimeout(() => { hoveredDetailItem.value = null; }, 100);
};
const cancelDetailClose = () => {
  if (detailCloseTimer) clearTimeout(detailCloseTimer);
  detailCloseTimer = null;
};
const hoveredDetailState = computed(() => hoveredDetailItem.value ? detailCache.value[hoveredDetailItem.value.id] : undefined);
const hoveredDetailData = computed(() => hoveredDetailState.value?.data || null);
const detailTitle = computed(() => hoveredDetailData.value?.title || hoveredDetailData.value?.file_name || hoveredDetailData.value?.name || hoveredDetailItem.value?.name || "");
const detailDescription = computed(() => hoveredDetailData.value?.description || hoveredDetailItem.value?.description || "");
const detailKbName = computed(() => hoveredDetailData.value?.knowledge_base_name || hoveredDetailItem.value?.kbName || "");
const detailKbId = computed(() => hoveredDetailData.value?.knowledge_base_id || (hoveredDetailItem.value as any)?.kbId || undefined);
const detailOrgName = computed(() => hoveredDetailData.value?.org_name || hoveredDetailItem.value?.orgName || "");

function handleKbClick(kbId: string | undefined) {
  if (!kbId) return;
  router.push(`/platform/knowledge-bases/${kbId}`);
}

function handleOrgClick(orgName: string) {
  if (!orgName) return;
  const sharedKb = orgStore.sharedKnowledgeBases.find((s: any) => s.org_name === orgName);
  if (sharedKb?.organization_id) router.push("/platform/organizations");
  else router.push("/platform/organizations");
}

const onScroll = (e: Event) => {
  isScrolling.value = true;
  hoveredDetailItem.value = null;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { isScrolling.value = false; }, 150);
  const target = e.target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = target;
  if ((currentGroupType.value === "file" || isFlatMode.value) && scrollHeight - scrollTop - clientHeight < 50 && props.hasMore && !props.loading) emit("loadMore");
};

watch(() => props.activeIndex, (newIndex) => {
  if (isFlatMode.value) { scrollToItem(newIndex); return; }
  if (currentGroupType.value) {
    const group = currentGroup.value;
    if (group) scrollToItem(newIndex - group.offset);
  }
});

watch(isFlatMode, (flat) => {
  if (flat) {
    currentGroupType.value = null;
    nextTick(() => { if (listRef.value) listRef.value.scrollTop = 0; });
  }
});

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    nextTick(() => {
      if (listRef.value) listRef.value.scrollTop = 0;
      currentGroupType.value = null;
      groupActiveIndex.value = 0;
      hoveredDetailItem.value = null;
    });
  }
});

const scrollToItem = (index: number) => {
  nextTick(() => {
    if (!listRef.value) return;
    const items = listRef.value.querySelectorAll(".mention-item");
    if (!items || items.length <= index) return;
    const activeItem = items[index] as HTMLElement;
    const menu = listRef.value;
    if (!activeItem) return;
    const menuRect = menu.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    if (itemRect.top < menuRect.top) menu.scrollTop -= menuRect.top - itemRect.top;
    else if (itemRect.bottom > menuRect.bottom) menu.scrollTop += itemRect.bottom - menuRect.bottom;
  });
};
</script>

<style scoped>
.mention-menu {
  position: fixed;
  z-index: 10000;
  width: 248px;
  max-height: 388px;
  display: flex;
  flex-direction: column;
  overflow: visible;
  border: 1px solid rgb(229 231 235 / .9);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 16px 32px -10px rgb(0 0 0 / .16), 0 4px 10px rgb(0 0 0 / .06);
  color: #1f2937;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.mention-list { flex: 1; min-height: 0; max-height: 388px; overflow-y: auto; padding: 6px; }
.mention-group-entry, .mention-back-row, .mention-item {
  width: 100%; min-height: 34px; padding: 5px 8px; border: 0; border-radius: 9px;
  display: flex; align-items: center; gap: 8px; background: transparent; color: #4b5563;
  font: inherit; font-size: 12px; line-height: 16px; text-align: left; cursor: pointer;
}
.mention-group-entry:hover, .mention-group-entry.active, .mention-back-row:hover, .mention-item:hover, .mention-item.active { background: #f9fafb; color: #111827; }
.mention-icon { width: 24px; height: 24px; flex: 0 0 24px; display: grid; place-items: center; border-radius: 7px; background: #f3f4f6; color: #6b7280; }
.mention-icon.is-tag { background: #f5f3ff; color: #7c3aed; }
.mention-icon.is-mcp { background: #eff6ff; color: #2563eb; }
.mention-icon.is-skill { background: #ecfdf5; color: #059669; }
.mention-icon svg, .mention-group-entry__arrow, .mention-back-row > svg, .detail-link svg {
  width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.mention-group-entry__label, .name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.mention-group-entry__count, .count, .item-context { flex: 0 0 auto; color: #9ca3af; font-family: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace; font-size: 10px; }
.mention-group-entry__count { min-width: 18px; padding: 1px 6px; border-radius: 999px; background: #f3f4f6; text-align: center; }
.mention-group-entry__arrow { flex: 0 0 14px; color: #9ca3af; }
.mention-back-row { margin-bottom: 4px; border-bottom: 1px solid #f3f4f6; border-radius: 0; color: #6b7280; }
.mention-group-header { padding: 7px 8px 4px; color: #9ca3af; font-size: 10px; line-height: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.mention-group + .mention-group { border-top: 1px solid #f3f4f6; padding-top: 4px; }
.empty { padding: 26px 12px; text-align: center; color: #9ca3af; font-size: 11px; }
.loading-more { display: flex; justify-content: center; padding: 8px 12px; }
.mention-spinner { width: 12px; height: 12px; display: inline-block; border: 1.5px solid #d1d5db; border-right-color: #4b5563; border-radius: 50%; animation: mention-spin .75s linear infinite; }

.mention-detail-card {
  position: absolute; top: 0; left: calc(100% + 8px); width: 280px; box-sizing: border-box;
  padding: 12px; border: 1px solid rgb(229 231 235 / .9); border-radius: 12px; background: #fff;
  box-shadow: 0 16px 32px -10px rgb(0 0 0 / .16), 0 4px 10px rgb(0 0 0 / .06); color: #1f2937;
}
.detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.detail-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 16px; font-weight: 700; color: #111827; }
.detail-type-badge { flex: 0 0 auto; padding: 2px 6px; border-radius: 6px; background: #f3f4f6; color: #6b7280; font-size: 9px; line-height: 13px; font-weight: 700; }
.detail-desc { margin: 0 0 8px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; color: #6b7280; font-size: 11px; line-height: 1.6; }
.detail-state { padding: 10px 0; color: #9ca3af; font-size: 11px; }
.detail-state.is-error { color: #dc2626; }
.detail-meta { display: flex; flex-direction: column; gap: 5px; }
.detail-link, .detail-line { width: 100%; min-height: 24px; padding: 3px 0; border: 0; display: flex; align-items: center; gap: 5px; background: transparent; color: #9ca3af; font: inherit; font-size: 10px; text-align: left; }
.detail-link { cursor: pointer; }
.detail-link:hover strong { color: #111827; text-decoration: underline; }
.detail-link svg { width: 12px; height: 12px; flex: 0 0 12px; }
.detail-link strong, .detail-line strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6b7280; font-weight: 600; }
@keyframes mention-spin { to { transform: rotate(360deg); } }
</style>
