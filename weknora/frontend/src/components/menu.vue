<template>
  <aside class="reference-sidebar" :class="{ 'reference-sidebar--collapsed': uiStore.sidebarCollapsed }">
    <template v-if="uiStore.sidebarCollapsed">
      <div class="reference-sidebar-collapsed-top">
        <button type="button" class="reference-sidebar-collapsed-logo" title="Musuw 穆苏瓦" @click="toggleSidebar">
          <ReferenceIcon name="zap" :size="16" :filled="true" />
        </button>
        <button type="button" class="reference-sidebar-icon-button" :title="t('menu.expandSidebar')" @click="toggleSidebar">
          <ReferenceIcon name="chevron-right" :size="16" :stroke-width="1.8" />
        </button>
        <button type="button" class="reference-sidebar-icon-button" :title="t('menu.search')" @click="commandPaletteStore.openPalette('')">
          <ReferenceIcon name="search" :size="14" />
        </button>
        <div class="reference-sidebar-collapsed-rule" />
        <button type="button" class="reference-sidebar-collapsed-primary" :title="t('menu.newChat')" @click="handleMenuClick('creatChat')">
          <ReferenceIcon name="message-square-plus" :size="16" :stroke-width="1.9" />
        </button>
        <button type="button" class="reference-sidebar-collapsed-nav" :class="{ active: isMenuItemActive('knowledge-bases') }" :title="t('menu.knowledgeBase')" @click="handleMenuClick('knowledge-bases')">
          <ReferenceIcon name="folder" :size="16" :stroke-width="1.8" />
        </button>
      </div>
      <div class="reference-sidebar-collapsed-user"><UserMenu /></div>
      <div class="reference-sidebar-drag-handle" @mousedown="onDragHandleMouseDown" />
    </template>

    <template v-else>
      <header class="reference-sidebar-header">
        <button type="button" class="reference-sidebar-brand" @click="handleMenuClick('creatChat')">
          <span class="reference-sidebar-brand-mark"><ReferenceIcon name="zap" :size="14" :filled="true" /></span>
          <span class="reference-sidebar-brand-name">Musuw 穆苏瓦</span>
        </button>
        <div class="reference-sidebar-header-actions">
          <button type="button" class="reference-sidebar-icon-button" :title="t('menu.search')" :aria-label="t('menu.search')" @click="commandPaletteStore.openPalette('')">
            <ReferenceIcon name="search" :size="14" />
          </button>
          <button type="button" class="reference-sidebar-icon-button" :title="t('menu.collapseSidebar')" @click="toggleSidebar">
            <ReferenceIcon name="chevron-left" :size="16" :stroke-width="1.8" />
          </button>
        </div>
      </header>

      <nav class="reference-sidebar-primary-nav">
        <template v-for="item in topMenuItems" :key="item.path">
          <button v-if="item.path === 'creatChat'" type="button" class="reference-sidebar-new-chat" @click="handleMenuClick(item.path)">
            <ReferenceIcon name="message-square-plus" :size="16" :stroke-width="1.9" />
            <span>{{ item.title }}</span>
          </button>
          <button v-else type="button" class="reference-sidebar-kb" :class="{ active: isMenuItemActive(item.path) }" @click="handleMenuClick(item.path)">
            <span class="reference-sidebar-kb-label"><ReferenceIcon name="folder" :size="16" :stroke-width="1.8" /><span>{{ item.title }}</span></span>
          </button>
        </template>
      </nav>

      <section class="reference-sidebar-history" ref="scrollContainer" @scroll="handleScroll">
        <div v-if="showSessionSourceFilter && !batchMode" class="reference-sidebar-source-filter">
          <SessionSourceFilter inline :emphasized="sessionScopeFilterPinned" :sources="sessionSourceOptions" :current="activeSessionBucketKey" @select="switchSessionBucket" />
        </div>
        <template v-if="sessionListBooting && !hasAnySession">
          <div v-for="n in 5" :key="'sidebar-skeleton-' + n" class="reference-sidebar-skeleton" />
        </template>
        <div v-else-if="activeBucket?.loaded && filteredGroupedSessions.length === 0" class="reference-sidebar-empty">{{ t('menu.noSessions') }}</div>
        <template v-else>
          <section v-for="group in filteredGroupedSessions" :key="group.key" class="reference-sidebar-thread-group">
            <div v-if="group.label" class="reference-sidebar-thread-label">{{ group.label }}</div>
            <SessionSidebarRow
              v-for="subitem in group.items"
              :key="subitem.id"
              :item="subitem"
              :batch-mode="batchMode"
              :active-path="currentSecondpath"
              :selected-ids="batchSelectedIds"
              :menu-options="buildSessionMenuOptions(subitem)"
              @navigate="gotopage(subitem.path)"
              @toggle-select="toggleBatchSelect(subitem.id)"
              @menu-click="handleSessionMenuClick($event, subitem)"
              @rename-submit="renameSessionTitle(subitem, $event.title)"
              @hover-in="mouseenteBotDownr(subitem.id)"
              @hover-out="mouseleaveBotDown"
            />
          </section>
          <div v-if="activeBucket?.loading && filteredGroupedSessions.length > 0" class="reference-sidebar-loading"><ReferenceIcon name="loader-circle" :size="14" /></div>
        </template>
      </section>

      <div v-if="batchMode" class="reference-sidebar-batch-footer">
        <label class="reference-sidebar-batch-select">
          <input type="checkbox" :checked="isAllBatchSelected" :indeterminate.prop="isBatchIndeterminate" @change="toggleBatchSelectAll(($event.target as HTMLInputElement).checked)" />
          <span>{{ t('batchManage.selectAll') }}</span>
        </label>
        <div class="reference-sidebar-batch-actions">
          <button type="button" @click="exitBatchMode">{{ t('batchManage.cancel') }}</button>
          <button type="button" class="danger" :disabled="batchSelectedIds.length === 0 || batchDeleting" @click="handleInlineBatchDelete">
            {{ t('batchManage.delete') }}{{ batchSelectedIds.length > 0 ? `(${batchDisplayCount})` : '' }}
          </button>
        </div>
      </div>

      <footer class="reference-sidebar-user"><UserMenu /></footer>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, onUnmounted, watch, computed, ref, h, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getSessionsList, batchDelSessions, deleteAllSessions, getSession } from "@/api/chat/index";
import { useChatResourcesStore } from "@/stores/chatResources";
import { listAllIMChannels } from "@/api/agent/index";
import SessionSidebarRow from "./SessionSidebarRow.vue";
import {
  clearSession,
  removeSession,
  renameSession,
  SESSION_MUTATION_EVENT,
  setSessionPinned,
  type SessionMutationDetail,
} from "./sessionMutations";
import SessionSourceFilter from "./SessionSourceFilter.vue";
import {
  SIDEBAR_BUCKET_PAGE_SIZE,
  applyBucketCountProbe,
  buildBucketDefinitions,
  bucketHasMore,
  bucketVisible,
  createEmptyBucket,
  flattenBucketItems,
  isChannelBucket,
  isChannelBucketKey,
  mergeBucketPage,
  prependSessionToWebBucket,
  removeSessionFromBuckets,
  type SidebarSessionBucket,
} from "./sessionSidebarBuckets";
import type { SessionForGrouping } from "./sessionGrouping";
import { listAllEmbedChannels } from "@/api/embed/index";
import {
  classifyDateBucket,
  configuredPlatforms,
  groupSessionsByDate,
  originGroupKey,
  resolveSessionOrigin,
  type DateBucketKey,
} from "./sessionGrouping";
import {
  DEFAULT_SESSION_BUCKET_KEY,
  buildSessionSourceOptions,
  findSessionBucketKey,
  shouldShowSessionSourceFilter,
} from "./sessionSidebarSourceFilter";
import { logout as logoutApi } from "@/api/auth";
import { useMenuStore } from "@/stores/menu";
import { useAuthStore } from "@/stores/auth";
import { handoffToExternalAuth } from "@/utils/nativeAuthHandoff";
import { useUIStore } from "@/stores/ui";
import { useCommandPaletteStore } from "@/stores/commandPalette";
import { MessagePlugin, DialogPlugin, Icon as TIcon } from "tdesign-vue-next";
import UserMenu from "@/components/UserMenu.vue";
import ReferenceIcon from "@/components/ReferenceIcon.vue";
import { useI18n } from "vue-i18n";
import { getSystemInfo } from "@/api/system";

const chatResources = useChatResourcesStore();
import wecomLogo from "@/assets/img/im/wecom.svg";
import feishuLogo from "@/assets/img/im/feishu.svg";
import larkLogo from "@/assets/img/im/lark.svg";
import slackLogo from "@/assets/img/im/slack.svg";
import telegramLogo from "@/assets/img/im/telegram.svg";
import dingtalkLogo from "@/assets/img/im/dingtalk.svg";
import mattermostLogo from "@/assets/img/im/mattermost.svg";
import wechatLogo from "@/assets/img/im/wechat.svg";
import qqbotLogo from "@/assets/img/im/qqbot.png";

const PLATFORM_LOGO: Record<string, string> = {
  wecom: wecomLogo,
  feishu: feishuLogo,
  lark: larkLogo,
  slack: slackLogo,
  telegram: telegramLogo,
  dingtalk: dingtalkLogo,
  mattermost: mattermostLogo,
  wechat: wechatLogo,
  qqbot: qqbotLogo,
};

const platformLogo = (p: string): string => (p ? PLATFORM_LOGO[p] || "" : "");

const { t } = useI18n();
const usemenuStore = useMenuStore();
const authStore = useAuthStore();
const uiStore = useUIStore();
const commandPaletteStore = useCommandPaletteStore();

const isMacLike =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
const cmdModKeyLabel = isMacLike ? "⌘" : "Ctrl";
const route = useRoute();
const router = useRouter();
const currentpath = ref("");
const total = ref(0);
const sessionBuckets = ref<Record<string, SidebarSessionBucket>>({});
const bucketOrder = ref<string[]>([]);
let bucketRequestToken = 0;
const sessionListBooting = ref(false);
const currentSecondpath = ref("");
const scrollContainer = ref<HTMLElement | null>(null);
const imPlatforms = ref<string[]>([]);
const embedChannelNames = ref<Record<string, string>>({});
const SIDEBAR_NARROW_BREAKPOINT = 760;
let sidebarWasNarrow = false;
let sidebarPreferenceBeforeNarrow: boolean | null = null;

const syncSidebarWithViewport = () => {
  if (typeof window === "undefined") return;
  const isNarrow = window.innerWidth <= SIDEBAR_NARROW_BREAKPOINT;
  if (isNarrow === sidebarWasNarrow) return;

  if (isNarrow) {
    let storedPreference: string | null = null;
    try {
      storedPreference = window.localStorage.getItem("sidebar_collapsed");
    } catch {}
    sidebarPreferenceBeforeNarrow =
      storedPreference === null ? uiStore.sidebarCollapsed : storedPreference === "true";
    uiStore.sidebarCollapsed = true;
  } else if (sidebarPreferenceBeforeNarrow !== null) {
    uiStore.sidebarCollapsed = sidebarPreferenceBeforeNarrow;
    sidebarPreferenceBeforeNarrow = null;
  }

  sidebarWasNarrow = isNarrow;
};

const toggleSidebar = () => {
  if (sidebarWasNarrow) {
    uiStore.sidebarCollapsed = !uiStore.sidebarCollapsed;
    return;
  }
  uiStore.toggleSidebar();
};
const activeSessionBucketKey = ref(DEFAULT_SESSION_BUCKET_KEY);
const sessionListCanScroll = ref(false);
const visibleChannelBuckets = computed(() =>
  bucketOrder.value
    .map((key) => sessionBuckets.value[key])
    .filter(
      (bucket): bucket is SidebarSessionBucket =>
        !!bucket && isChannelBucket(bucket) && bucketVisible(bucket),
    ),
);
const showSessionSourceFilter = computed(() =>
  shouldShowSessionSourceFilter(visibleChannelBuckets.value.length),
);
const sessionScopeFilterPinned = computed(
  () => activeSessionBucketKey.value !== DEFAULT_SESSION_BUCKET_KEY,
);
const sessionSourceOptions = computed(() =>
  buildSessionSourceOptions(
    t("menu.myChats"),
    visibleChannelBuckets.value.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      platform: bucket.platform,
    })),
    (platform) => platformLogo(platform),
  ),
);
const activeBucket = computed(() => sessionBuckets.value[activeSessionBucketKey.value]);
const hasAnySession = computed(() =>
  Object.values(sessionBuckets.value).some((bucket) => bucket.items.length > 0),
);
type MenuItem = {
  title: string;
  icon: string;
  path: string;
  childrenPath?: string;
  children?: any[];
};
const { menuArr, visibleMenuArr } = storeToRefs(usemenuStore);
let activeSubmenu = ref<string>("");
const batchMode = ref(false);
const batchSelectedIds = ref<string[]>([]);
const batchDeleting = ref(false);

const allSessionIds = computed(() => {
  const chatMenu = (menuArr.value as unknown as MenuItem[]).find(
    (item: MenuItem) => item.path === "creatChat",
  );
  if (!chatMenu?.children) return [];
  return (chatMenu.children as any[]).map((s: any) => s.id);
});

const isAllBatchSelected = computed(
  () =>
    allSessionIds.value.length > 0 && batchSelectedIds.value.length === allSessionIds.value.length,
);

const isBatchIndeterminate = computed(
  () =>
    batchSelectedIds.value.length > 0 && batchSelectedIds.value.length < allSessionIds.value.length,
);

const batchDisplayCount = computed(() =>
  isAllBatchSelected.value ? total.value : batchSelectedIds.value.length,
);

const isInKnowledgeBase = computed<boolean>(() => {
  return (
    route.name === "knowledgeBaseDetail" ||
    route.name === "kbCreatChat" ||
    route.name === "knowledgeBaseSettings"
  );
});

const isInKnowledgeBaseList = computed<boolean>(() => {
  return route.name === "knowledgeBaseList";
});

const isInCreatChat = computed<boolean>(() => {
  return route.name === "globalCreatChat" || route.name === "kbCreatChat";
});

const isInChatDetail = computed<boolean>(() => route.name === "chat");

const isMenuItemActive = (itemPath: string): boolean => {
  const currentRoute = route.name;

  switch (itemPath) {
    case "knowledge-bases":
      return (
        currentRoute === "knowledgeBaseList" ||
        currentRoute === "knowledgeBaseDetail" ||
        currentRoute === "knowledgeBaseSettings"
      );
    case "creatChat":
      return currentRoute === "kbCreatChat" || currentRoute === "globalCreatChat";
    case "settings":
      return currentRoute === "settings";
    default:
      return itemPath === currentpath.value;
  }
};

const topMenuItems = computed<MenuItem[]>(() => {
  return (visibleMenuArr.value as unknown as MenuItem[]).filter(
    (item: MenuItem) => item.path === "knowledge-bases" || item.path === "creatChat",
  );
});

const bottomMenuItems = computed<MenuItem[]>(() => {
  return (visibleMenuArr.value as unknown as MenuItem[]).filter((item: MenuItem) => {
    if (item.path === "knowledge-bases" || item.path === "creatChat") {
      return false;
    }
    return true;
  });
});

const currentKbName = ref<string>("");
const currentKbInfo = ref<any>(null);
const pinningIds = ref<Set<string>>(new Set());

const dateBucketLabels = computed<Record<DateBucketKey, string>>(() => ({
  pinned: t("time.pinned"),
  today: t("time.today"),
  yesterday: t("time.yesterday"),
  last7Days: t("time.last7Days"),
  last30Days: t("time.last30Days"),
  lastYear: t("time.lastYear"),
  earlier: t("time.earlier"),
}));

const filteredGroupedSessions = computed(() => {
  const bucket = activeBucket.value;
  if (!bucket?.items.length) return [];
  return groupSessionsByDate(
    bucket.items.map((item) => ({
      ...item,
      path: `chat/${item.id}`,
      title: item.title || "",
    })),
    dateBucketLabels.value,
    (session) => classifyDateBucket(session.updated_at || session.created_at),
  );
});

const refreshSessionListScrollability = async () => {
  await nextTick();
  const container = scrollContainer.value;
  sessionListCanScroll.value = !!container && container.scrollHeight > container.clientHeight + 1;
};

const ensureBucketFillsViewport = async (key: string) => {
  const MAX_ITERATIONS = 20;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const container = scrollContainer.value;
    const bucket = sessionBuckets.value[key];
    if (!container || !bucket || !bucketHasMore(bucket) || bucket.loading) break;

    const hasOverflow = container.scrollHeight > container.clientHeight + 1;
    if (hasOverflow) break;

    const prevCount = bucket.items.length;
    await loadBucketPage(key);
    if ((sessionBuckets.value[key]?.items.length ?? 0) <= prevCount) break;
  }
};

const mouseenteBotDownr = (val: string) => {
  activeSubmenu.value = val;
};
const mouseleaveBotDown = () => {
  activeSubmenu.value = "";
};

const enterBatchMode = () => {
  batchMode.value = true;
  batchSelectedIds.value = [];
};

const exitBatchMode = () => {
  batchMode.value = false;
  batchSelectedIds.value = [];
};

const toggleBatchSelect = (id: string) => {
  const idx = batchSelectedIds.value.indexOf(id);
  if (idx > -1) {
    batchSelectedIds.value.splice(idx, 1);
  } else {
    batchSelectedIds.value.push(id);
  }
};

const toggleBatchSelectAll = (checked: boolean) => {
  batchSelectedIds.value = checked ? [...allSessionIds.value] : [];
};

const handleInlineBatchDelete = () => {
  if (batchSelectedIds.value.length === 0) return;
  const isDeleteAll = isAllBatchSelected.value;
  const displayCount = batchDisplayCount.value;
  const confirmDialog = DialogPlugin.confirm({
    header: t("batchManage.deleteConfirmTitle"),
    body: isDeleteAll
      ? t("batchManage.deleteAllConfirmBody") ||
        t("batchManage.deleteConfirmBody", { count: displayCount })
      : t("batchManage.deleteConfirmBody", { count: displayCount }),
    confirmBtn: { content: t("batchManage.delete"), theme: "danger" as const },
    cancelBtn: t("batchManage.cancel"),
    theme: "warning",
    onConfirm: async () => {
      batchDeleting.value = true;
      try {
        let res: any;
        if (isDeleteAll) {
          res = await deleteAllSessions();
        } else {
          res = await batchDelSessions([...batchSelectedIds.value]);
        }
        if (res && res.success === true) {
          if (isDeleteAll) {
            usemenuStore.clearMenuArr();
            total.value = 0;
            await getMessageList();
          } else {
            let next = sessionBuckets.value;
            for (const id of batchSelectedIds.value) {
              next = removeSessionFromBuckets(next, id);
            }
            sessionBuckets.value = next;
            syncMenuStoreFromBuckets();
          }
          const currentChatId = route.params.chatid as string;
          if (currentChatId && (isDeleteAll || batchSelectedIds.value.includes(currentChatId))) {
            router.push("/platform/creatChat");
          }
          batchSelectedIds.value = [];
          MessagePlugin.success(t("batchManage.deleteSuccess"));
          exitBatchMode();
        } else {
          MessagePlugin.error(t("batchManage.deleteFailed"));
        }
      } catch {
        MessagePlugin.error(t("batchManage.deleteFailed"));
      }
      batchDeleting.value = false;
      confirmDialog.destroy();
    },
  });
};

const handleSessionMenuClick = (data: { value: string }, item: any) => {
  if (data?.value === "delete") {
    delCard(item);
  } else if (data?.value === "clearMessages") {
    clearMessages(item);
  } else if (data?.value === "batchManage") {
    enterBatchMode();
  } else if (data?.value === "pin" || data?.value === "unpin") {
    togglePin(item, data.value === "pin");
  }
};

const buildSessionMenuOptions = (item: any) => {
  const options: any[] = [];
  if (item.is_pinned) {
    options.push({
      content: t("menu.unpin"),
      value: "unpin",
      prefixIcon: () => h(TIcon, { name: "pin-filled", size: "16px" }),
    });
  } else {
    options.push({
      content: t("menu.pin"),
      value: "pin",
      prefixIcon: () => h(TIcon, { name: "pin", size: "16px" }),
    });
  }
  options.push(
    {
      content: t("menu.renameSession"),
      value: "rename",
      prefixIcon: () => h(TIcon, { name: "edit-1", size: "16px" }),
    },
    {
      content: t("menu.clearMessages"),
      value: "clearMessages",
      prefixIcon: () => h(TIcon, { name: "clear", size: "16px" }),
    },
    {
      content: t("menu.batchManage"),
      value: "batchManage",
      prefixIcon: () => h(TIcon, { name: "queue", size: "16px" }),
    },
    {
      content: t("upload.deleteRecord"),
      value: "delete",
      theme: "error",
      prefixIcon: () => h(TIcon, { name: "delete", size: "16px" }),
    },
  );
  return options;
};

const updateSessionInBuckets = (
  sessionId: string,
  patch: Partial<{
    is_pinned: boolean;
    pinned_at: string | null;
    title: string;
    isNoTitle?: boolean;
  }>,
) => {
  const next: Record<string, SidebarSessionBucket> = {};
  for (const [key, bucket] of Object.entries(sessionBuckets.value)) {
    next[key] = {
      ...bucket,
      items: bucket.items.map((row) => (row.id === sessionId ? { ...row, ...patch } : row)),
    };
  }
  sessionBuckets.value = next;
  syncMenuStoreFromBuckets();
};

const renameSessionTitle = async (item: any, title: string) => {
  try {
    await renameSession(item.id, title, item.description || "");
    MessagePlugin.success(t("menu.renameSessionSuccess"));
  } catch {
    MessagePlugin.error(t("menu.renameSessionFailed"));
  }
};

const togglePin = (item: any, pin: boolean) => {
  if (pinningIds.value.has(item.id)) return;
  pinningIds.value.add(item.id);

  setSessionPinned(item.id, pin)
    .catch(() => {
      MessagePlugin.error(pin ? t("menu.pinFailed") : t("menu.unpinFailed"));
    })
    .finally(() => {
      pinningIds.value.delete(item.id);
    });
};

const clearMessages = (item: any) => {
  clearSession(item.id)
    .then(() => {
      MessagePlugin.success(t("menu.clearMessagesSuccess"));
    })
    .catch(() => {
      MessagePlugin.error(t("menu.clearMessagesFailed"));
    });
};

const delCard = (item: any) => {
  removeSession(item.id).catch(() => MessagePlugin.error(t("chat.deleteSessionFailed")));
};

const debounce = (fn: (...args: any[]) => void, delay: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
const mapSessionRow = (item: any) => ({
  title: item.title ? item.title : t("menu.newSession"),
  path: `chat/${item.id}`,
  id: item.id,
  isMore: false,
  isNoTitle: item.title ? false : true,
  created_at: item.created_at,
  updated_at: item.updated_at,
  is_pinned: !!item.is_pinned,
  pinned_at: item.pinned_at || null,
  im_platform: item.im_platform || "",
  description: item.description || "",
  user_id: item.user_id || "",
});

const syncMenuStoreFromBuckets = () => {
  usemenuStore.clearMenuArr();
  const flat = flattenBucketItems(sessionBuckets.value, bucketOrder.value);
  flat.forEach((item) => usemenuStore.updatemenuArr(item));
  total.value = flat.length;
};

const menuChildToSessionRow = (
  item: Record<string, unknown>,
): SessionForGrouping & { path: string } => {
  const id = String(item.id);
  return {
    id,
    path: typeof item.path === "string" ? item.path : `chat/${id}`,
    title: typeof item.title === "string" ? item.title : undefined,
    is_pinned: !!item.is_pinned,
    created_at: typeof item.created_at === "string" ? item.created_at : undefined,
    updated_at: typeof item.updated_at === "string" ? item.updated_at : undefined,
    im_platform: typeof item.im_platform === "string" ? item.im_platform : "",
    description: typeof item.description === "string" ? item.description : "",
    user_id: typeof item.user_id === "string" ? item.user_id : "",
  };
};

const sessionExistsInBuckets = (sessionId: string) =>
  Object.values(sessionBuckets.value).some((bucket) =>
    bucket.items.some((row) => row.id === sessionId),
  );

const ensureSessionInSidebar = (sessionId: string) => {
  if (!sessionId || sessionExistsInBuckets(sessionId)) return;

  const web = sessionBuckets.value.web;
  if (!web) return;

  const chatMenu = (menuArr.value as unknown as MenuItem[]).find(
    (item) => item.path === "creatChat",
  );
  const fromStore = (chatMenu?.children as Record<string, unknown>[] | undefined)?.find(
    (item) => item.id === sessionId,
  );
  if (!fromStore) return;

  sessionBuckets.value = {
    ...sessionBuckets.value,
    web: prependSessionToWebBucket(web, menuChildToSessionRow(fromStore)),
  };
  total.value = flattenBucketItems(sessionBuckets.value, bucketOrder.value).length;
};

const rebuildBucketDefinitions = () =>
  buildBucketDefinitions(
    imPlatforms.value,
    embedChannelNames.value,
    {
      web: t("menu.myChats"),
      imPlatform: (platform) => t(`agentEditor.im.${platform}`),
      embedChannel: (name) => name,
      api: t("menu.apiChats"),
    },
    { includeAdminChannelBuckets: authStore.hasRole("admin") },
  );

const probeChannelBucketCounts = async (keys: string[], token: number) => {
  const targets = keys.filter((key) => isChannelBucketKey(key));
  await Promise.all(
    targets.map(async (key) => {
      const bucket = sessionBuckets.value[key];
      if (!bucket) return;
      try {
        const res: any = await getSessionsList(1, 1, bucket.apiSource);
        if (token !== bucketRequestToken) return;
        sessionBuckets.value = {
          ...sessionBuckets.value,
          [key]: applyBucketCountProbe(bucket, res?.total ?? 0),
        };
      } catch {
        if (token !== bucketRequestToken) return;
        sessionBuckets.value = {
          ...sessionBuckets.value,
          [key]: applyBucketCountProbe(bucket, 0),
        };
      }
    }),
  );
};

const loadBucketPage = async (key: string, page?: number, token?: number) => {
  const activeToken = token ?? bucketRequestToken;
  const bucket = sessionBuckets.value[key];
  if (!bucket || bucket.loading) return;

  const nextPage = page ?? bucket.page + 1;
  sessionBuckets.value = {
    ...sessionBuckets.value,
    [key]: { ...bucket, loading: true },
  };

  try {
    const res: any = await getSessionsList(nextPage, SIDEBAR_BUCKET_PAGE_SIZE, bucket.apiSource);
    if (activeToken !== bucketRequestToken) return;
    const rows = (res?.data || []).map((item: any) => mapSessionRow(item));
    const current = sessionBuckets.value[key];
    sessionBuckets.value = {
      ...sessionBuckets.value,
      [key]: mergeBucketPage(current, rows, res?.total ?? rows.length, nextPage),
    };
    syncMenuStoreFromBuckets();
    await refreshSessionListScrollability();
  } catch {
    if (activeToken !== bucketRequestToken) return;
    const current = sessionBuckets.value[key];
    sessionBuckets.value = {
      ...sessionBuckets.value,
      [key]: { ...current, loading: false, loaded: true },
    };
  }
};

const switchSessionBucket = async (key: string) => {
  if (key === activeSessionBucketKey.value) return;
  activeSessionBucketKey.value = key;
  const bucket = sessionBuckets.value[key];
  if (bucket && !bucket.loaded && !bucket.loading) {
    await loadBucketPage(key, 1);
  }
  await ensureBucketFillsViewport(key);
  await refreshSessionListScrollability();
};

const syncActiveBucketFromChat = async (sessionId: string | undefined) => {
  if (!sessionId) return;

  let bucketKey = findSessionBucketKey(sessionBuckets.value, sessionId);
  if (!bucketKey) {
    const chatMenu = (menuArr.value as unknown as MenuItem[]).find(
      (item) => item.path === "creatChat",
    );
    const fromStore = (chatMenu?.children as Record<string, unknown>[] | undefined)?.find(
      (item) => item.id === sessionId,
    );
    if (fromStore) {
      bucketKey = originGroupKey(resolveSessionOrigin(menuChildToSessionRow(fromStore)));
    }
  }
  if (!bucketKey) {
    try {
      const res: any = await getSession(sessionId);
      const candidate = originGroupKey(
        resolveSessionOrigin({
          id: sessionId,
          im_platform: res?.data?.im_platform || "",
          description: res?.data?.description || "",
          user_id: res?.data?.user_id || "",
        }),
      );
      if (sessionBuckets.value[candidate]) {
        bucketKey = candidate;
      }
    } catch {}
  }
  if (!bucketKey || bucketKey === activeSessionBucketKey.value) return;

  activeSessionBucketKey.value = bucketKey;
  const bucket = sessionBuckets.value[bucketKey];
  if (bucket && !bucket.loaded && !bucket.loading) {
    await loadBucketPage(bucketKey, 1);
  }
};

const initSessionBuckets = async () => {
  const token = ++bucketRequestToken;
  sessionListBooting.value = true;

  const defs = rebuildBucketDefinitions();
  bucketOrder.value = defs.map((def) => def.key);
  const buckets: Record<string, SidebarSessionBucket> = {};
  for (const def of defs) {
    buckets[def.key] = createEmptyBucket(def);
  }
  sessionBuckets.value = buckets;

  const channelKeys = defs.map((def) => def.key).filter((key) => isChannelBucketKey(key));
  await Promise.all([
    loadBucketPage("web", 1, token),
    probeChannelBucketCounts(channelKeys, token),
  ]);

  if (token === bucketRequestToken) {
    sessionListBooting.value = false;
    syncMenuStoreFromBuckets();
    await ensureBucketFillsViewport("web");
    await refreshSessionListScrollability();
  }
};

const getMessageList = async () => {
  await initSessionBuckets();
};

const checkScrollBottom = async () => {
  const container = scrollContainer.value;
  const key = activeSessionBucketKey.value;
  const bucket = sessionBuckets.value[key];
  if (!container || !bucket || !bucketHasMore(bucket) || bucket.loading) return;

  const { scrollTop, scrollHeight, clientHeight } = container;
  const hasOverflow = scrollHeight > clientHeight + 1;
  if (!hasOverflow) {
    await ensureBucketFillsViewport(key);
    return;
  }

  const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;
  if (!isNearBottom) return;

  await loadBucketPage(key);
};

const handleScroll = debounce(checkScrollBottom, 200);

async function loadCurrentKbInfo(kbId: string) {
  if (!kbId || !isInKnowledgeBase.value) {
    currentKbName.value = "";
    currentKbInfo.value = null;
    return;
  }
  const data = await chatResources.fetchKnowledgeBaseById(kbId);
  if (data) {
    currentKbName.value = data.name || "";
    currentKbInfo.value = data;
  } else {
    currentKbInfo.value = null;
  }
}

const loadSessionOriginMeta = async () => {
  try {
    const res: any = await listAllIMChannels();
    imPlatforms.value = configuredPlatforms(res?.data || []);
  } catch {
    imPlatforms.value = [];
  }
  try {
    const res: any = await listAllEmbedChannels();
    const names: Record<string, string> = {};
    for (const ch of res?.data || []) {
      if (ch?.id && ch?.name) names[ch.id] = ch.name;
    }
    embedChannelNames.value = names;
  } catch {
    embedChannelNames.value = {};
  }
};

const handleSessionMutation = (event: Event) => {
  const detail = (event as CustomEvent<SessionMutationDetail>).detail;
  if (!detail?.sessionId) return;
  if (detail.patch) {
    updateSessionInBuckets(detail.sessionId, {
      ...detail.patch,
      ...(detail.patch.title ? { isNoTitle: false } : {}),
    });
  }
  if (detail.removed) {
    sessionBuckets.value = removeSessionFromBuckets(sessionBuckets.value, detail.sessionId);
    syncMenuStoreFromBuckets();
    if (detail.sessionId === route.params.chatid) {
      router.push("/platform/creatChat");
    }
  }
};

onMounted(async () => {
  syncSidebarWithViewport();
  window.addEventListener("resize", syncSidebarWithViewport);

  const routeName =
    typeof route.name === "string" ? route.name : route.name ? String(route.name) : "";
  currentpath.value = routeName;
  if (route.params.chatid) {
    currentSecondpath.value = `chat/${route.params.chatid}`;
  }

  window.addEventListener(SESSION_MUTATION_EVENT, handleSessionMutation);

  getSystemInfo()
    .then((res) => {
      if (res.data?.edition === "lite") {
        authStore.setLiteMode(true);
      }
    })
    .catch(() => {});

  await loadCurrentKbInfo((route.params as any)?.kbId as string);

  await loadSessionOriginMeta();
  await getMessageList();
  const initialChatId = route.params.chatid as string | undefined;
  if (initialChatId) {
    ensureSessionInSidebar(initialChatId);
    await syncActiveBucketFromChat(initialChatId);
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", syncSidebarWithViewport);
  window.removeEventListener(SESSION_MUTATION_EVENT, handleSessionMutation);
  sidebarWasNarrow = false;
  sidebarPreferenceBeforeNarrow = null;
});

watch([() => route.name, () => route.params], (newvalue, oldvalue) => {
  const nameStr =
    typeof newvalue[0] === "string"
      ? (newvalue[0] as string)
      : newvalue[0]
        ? String(newvalue[0])
        : "";
  currentpath.value = nameStr;
  if (newvalue[1].chatid) {
    currentSecondpath.value = `chat/${newvalue[1].chatid}`;
  } else {
    currentSecondpath.value = "";
  }

  const newChatId = (newvalue[1] as any)?.chatid as string | undefined;
  if (nameStr === "chat" && newChatId) {
    ensureSessionInSidebar(newChatId);
    void syncActiveBucketFromChat(newChatId);
  }

  if (newvalue[1].kbId !== oldvalue?.[1]?.kbId) {
    loadCurrentKbInfo((newvalue[1] as any)?.kbId as string);
  }
});
let pathPrefix = ref(route.name);
const menuIconName = (path: string) => {
  switch (path) {
    case "creatChat":
      return "chat-add";
    case "knowledge-bases":
      return "folder";
    case "settings":
      return "setting";
    case "logout":
      return "logout";
    default:
      return "chat";
  }
};
const handleMenuClick = async (path: string) => {
  if (path === "knowledge-bases") {
    const kbId = await getCurrentKbId();
    if (kbId) {
      router.push(`/platform/knowledge-bases/${kbId}`);
    } else {
      router.push("/platform/knowledge-bases");
    }
  } else if (path === "settings") {
    uiStore.openSettings();
    router.push("/platform/settings");
  } else {
    gotopage(path);
  }
};

const handleLogout = () => {
  gotopage("logout");
};

const getCurrentKbId = async (): Promise<string | null> => {
  const kbId = (route.params as any)?.kbId as string;
  if (isInKnowledgeBase.value && kbId) {
    return kbId;
  }
  return null;
};

const gotopage = async (path: string) => {
  pathPrefix.value = path;
  if (path === "logout") {
    try {
      await logoutApi();
    } catch (error) {
      console.error("注销API调用失败:", error);
    }
    authStore.logout();
    MessagePlugin.success(t("menu.logoutSuccess"));
    handoffToExternalAuth("logout");
    return;
  } else {
    if (path === "creatChat") {
      if (isInKnowledgeBase.value) {
        router.push("/platform/creatChat");
      } else {
        router.push(`/platform/creatChat`);
      }
    } else {
      router.push(`/platform/${path}`);
    }
  }
};

const mouseenteMenu = (path: string) => {};
const mouseleaveMenu = (path: string) => {};

const onDragHandleMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  const startX = e.clientX;
  const expandThreshold = 40;

  const onMouseMove = (ev: MouseEvent) => {
    if (ev.clientX - startX > expandThreshold) {
      if (sidebarWasNarrow) {
        uiStore.sidebarCollapsed = false;
      } else {
        uiStore.expandSidebar();
      }
      cleanup();
    }
  };
  const onMouseUp = () => cleanup();
  const cleanup = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};
</script>

<style scoped>
.reference-sidebar {
  width: 256px;
  height: 100%;
  flex: 0 0 256px;
  min-height: 0;
  box-sizing: border-box;
  padding: 12px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border-right: 1px solid rgb(229 231 235 / .8);
  background: #fbfbfb;
  color: #374151;
  font-family: var(--app-font-family);
  user-select: none;
  transition: width 200ms ease, flex-basis 200ms ease, padding 200ms ease;
}
html.wails-desktop .reference-sidebar { padding-top: 30px; }
.reference-sidebar--collapsed { width: 56px; flex-basis: 56px; padding: 14px 8px; align-items: center; justify-content: space-between; }
.reference-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; margin-bottom: 10px; }
.reference-sidebar-brand { min-width: 0; padding: 0; border: 0; background: transparent; display: flex; align-items: center; gap: 10px; color: #111827; cursor: pointer; }
.reference-sidebar-brand-mark { width: 26px; height: 26px; flex: 0 0 26px; border-radius: 8px; background: #000; color: #fff; display: grid; place-items: center; box-shadow: 0 1px 2px rgb(0 0 0 / .05); transition: transform 150ms ease; }
.reference-sidebar-brand:hover .reference-sidebar-brand-mark { transform: scale(1.05); }
.reference-sidebar-brand-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 20px; font-weight: 700; letter-spacing: -.025em; }
.reference-sidebar-header-actions { display: flex; align-items: center; gap: 2px; color: #9ca3af; }
.reference-sidebar-icon-button { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #9ca3af; display: grid; place-items: center; cursor: pointer; transition: color 150ms ease, background-color 150ms ease; }
.reference-sidebar-icon-button:hover { color: #1f2937; background: rgb(229 231 235 / .6); }
.reference-sidebar-primary-nav { display: flex; flex-direction: column; gap: 4px; padding: 0 2px; margin-bottom: 8px; }
.reference-sidebar-new-chat, .reference-sidebar-kb { width: 100%; height: 34px; padding: 0 12px; border-radius: 12px; font-family: inherit; cursor: pointer; transition: all 150ms ease; }
.reference-sidebar-new-chat { border: 1px solid rgb(229 231 235 / .8); background: #fff; color: #111827; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 2px rgb(0 0 0 / .04); font-size: 13px; font-weight: 600; }
.reference-sidebar-new-chat:hover { background: #f3f4f6; }
.reference-sidebar-kb { border: 0; background: transparent; color: #374151; display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.reference-sidebar-kb:hover { color: #030712; background: rgb(229 231 235 / .5); }
.reference-sidebar-kb.active { color: #030712; background: rgb(229 231 235 / .9); font-weight: 700; box-shadow: 0 1px 2px rgb(0 0 0 / .04); }
.reference-sidebar-kb-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.reference-sidebar-history { flex: 1; min-height: 0; margin-top: 4px; padding: 4px 4px 4px 2px; overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; }
.reference-sidebar-history::-webkit-scrollbar { width: 4px; }
.reference-sidebar-history::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; }
.reference-sidebar-source-filter { margin: 0 4px 8px; }
.reference-sidebar-thread-group { margin-bottom: 12px; }
.reference-sidebar-thread-label { padding: 4px 10px; color: #9ca3af; font-size: 11px; line-height: 16px; font-weight: 500; letter-spacing: .025em; }
.reference-sidebar-skeleton { height: 28px; margin: 3px 6px; border-radius: 8px; background: linear-gradient(90deg,#f3f4f6,#fafafa,#f3f4f6); background-size: 200% 100%; animation: sidebar-shimmer 1.2s linear infinite; }
.reference-sidebar-empty { padding: 28px 12px; color: #9ca3af; font-size: 12px; text-align: center; }
.reference-sidebar-loading { height: 28px; display: grid; place-items: center; color: #9ca3af; }
.reference-sidebar-loading :deep(.reference-icon) { animation: sidebar-spin .9s linear infinite; }
.reference-sidebar-user { flex: 0 0 auto; margin-top: 4px; padding-top: 8px; border-top: 1px solid rgb(229 231 235 / .7); }
.reference-sidebar-batch-footer { flex: 0 0 auto; margin: 6px 2px 0; padding: 8px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 6px 16px rgb(0 0 0 / .05); }
.reference-sidebar-batch-select { display: flex; align-items: center; gap: 7px; color: #4b5563; font-size: 11px; font-weight: 600; }
.reference-sidebar-batch-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.reference-sidebar-batch-actions button { height: 28px; padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 9px; background: #fff; color: #4b5563; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.reference-sidebar-batch-actions button.danger { border-color: #dc2626; background: #dc2626; color: #fff; }
.reference-sidebar-batch-actions button:disabled { opacity: .4; cursor: not-allowed; }
.reference-sidebar-collapsed-top { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.reference-sidebar-collapsed-logo { width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: #000; color: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 1px 2px rgb(0 0 0 / .05); transition: transform 150ms ease; }
.reference-sidebar-collapsed-logo:hover { transform: scale(1.05); }
.reference-sidebar-collapsed-rule { width: 32px; height: 1px; margin: 4px 0; background: rgb(229 231 235 / .8); }
.reference-sidebar-collapsed-primary, .reference-sidebar-collapsed-nav { width: 36px; height: 36px; padding: 0; border: 0; border-radius: 12px; display: grid; place-items: center; cursor: pointer; transition: all 150ms ease; }
.reference-sidebar-collapsed-primary { background: #f3f4f6; color: #111827; }
.reference-sidebar-collapsed-primary:hover { background: #e5e7eb; }
.reference-sidebar-collapsed-nav { background: transparent; color: #4b5563; }
.reference-sidebar-collapsed-nav:hover { color: #111827; background: #f3f4f6; }
.reference-sidebar-collapsed-nav.active { background: #111827; color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / .05); }
.reference-sidebar-collapsed-user { width: 32px; min-height: 32px; overflow: visible; border-radius: 999px; }
.reference-sidebar-drag-handle { position: absolute; right: -2px; top: 0; width: 5px; height: 100%; cursor: ew-resize; z-index: 2; }
@keyframes sidebar-shimmer { to { background-position: -200% 0; } }
@keyframes sidebar-spin { to { transform: rotate(360deg); } }
</style>
