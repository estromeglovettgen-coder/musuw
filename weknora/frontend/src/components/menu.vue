<template>
  <div class="aside_box" :class="{ 'aside_box--collapsed': uiStore.sidebarCollapsed }">
    <!-- 展开时：保留轻量品牌标识、搜索和收起操作。 -->
    <div class="logo_row" v-if="!uiStore.sidebarCollapsed">
      <div class="musuw-wordmark" aria-label="Musuw">
        <span class="musuw-wordmark__mark" aria-hidden="true">↯</span>
        <span class="musuw-wordmark__label">Musuw</span>
      </div>
      <div class="logo_actions">
        <t-tooltip placement="bottom">
          <template #content>
            <span class="cmdk-tip">
              <span class="cmdk-tip-label">{{ t("menu.search") }}</span>
              <span class="cmdk-tip-keys">{{ cmdModKeyLabel }}K</span>
            </span>
          </template>
          <div
            class="header-icon-btn"
            @click="commandPaletteStore.openPalette('')"
            :aria-label="t('menu.search')"
          >
            <t-icon name="search" class="header-icon-glyph" aria-hidden="true" />
          </div>
        </t-tooltip>
        <div
          class="sidebar-toggle"
          @click="toggleSidebar"
          :title="t('menu.collapseSidebar')"
        >
          <t-icon name="chevron-left" aria-hidden="true" />
        </div>
      </div>
    </div>
    <!-- 折叠时：展开按钮 -->
    <t-tooltip v-else :content="t('menu.expandSidebar')" placement="right">
      <div class="menu_item sidebar-toggle-item" @click="toggleSidebar">
        <div class="menu_item-box">
          <div class="menu_icon">
            <t-icon name="chevron-right" class="icon" aria-hidden="true" />
          </div>
        </div>
      </div>
    </t-tooltip>

    <!-- 折叠时右侧拖拽展开手柄 -->
    <div
      v-if="uiStore.sidebarCollapsed"
      class="sidebar-drag-handle"
      @mousedown="onDragHandleMouseDown"
    />

    <!-- 上半部分：新对话吸顶 + 知识库/智能体/共享空间/历史会话随滚动一起滚走 -->
    <div class="menu_top" ref="scrollContainer" @scroll="handleScroll">
      <!-- 全局搜索入口：点击打开命令面板（⌘K）。展开态移至顶部 logo_row 的图标按钮；
                 折叠态在此处保留为图标项 + 深色 tooltip。 -->
      <div class="menu_box menu_box--cmdk" v-if="uiStore.sidebarCollapsed">
        <t-tooltip placement="right">
          <template #content>
            <span class="cmdk-tip">
              <span class="cmdk-tip-label">{{ t("menu.search") }}</span>
              <span class="cmdk-tip-keys">{{ cmdModKeyLabel }}K</span>
            </span>
          </template>
          <div class="menu_item menu_item--cmdk" @click="commandPaletteStore.openPalette('')">
            <div class="menu_item-box">
              <div class="menu_icon">
                <t-icon name="search" class="icon" aria-hidden="true" />
              </div>
            </div>
          </div>
        </t-tooltip>
      </div>
      <div
        class="menu_box"
        :class="{ 'menu_box--sticky': item.children && !uiStore.sidebarCollapsed }"
        v-for="(item, index) in topMenuItems"
        :key="index"
      >
        <t-tooltip :content="item.title" placement="right" :disabled="!uiStore.sidebarCollapsed">
          <div
            @click="handleMenuClick(item.path)"
            @mouseenter="mouseenteMenu(item.path)"
            @mouseleave="mouseleaveMenu(item.path)"
            :data-guide="`nav-${item.path}`"
            :class="[
              'menu_item',
              item.childrenPath && item.childrenPath == currentpath
                ? 'menu_item_c_active'
                : isMenuItemActive(item.path)
                  ? 'menu_item_active'
                  : '',
            ]"
          >
            <div class="menu_item-box">
              <div class="menu_icon">
                <t-icon :name="menuIconName(item.path)" class="icon" aria-hidden="true" />
              </div>
              <template v-if="!uiStore.sidebarCollapsed">
                <span class="menu_title" :title="item.title">{{ item.title }}</span>
              </template>
            </div>
          </div>
        </t-tooltip>
      </div>

      <!-- 历史会话：按来源筛选后统一按日期分组展示 -->
      <div class="submenu" v-if="!uiStore.sidebarCollapsed">
        <!-- Stable, always-mounted source filter: reserving its row here
                     (instead of embedding it in the first date group, which
                     appears/disappears while a bucket loads) prevents the
                     top-right control from jumping when switching session type. -->
        <div v-if="showSessionSourceFilter && !batchMode" class="session-list-scope-header">
          <SessionSourceFilter
            inline
            :emphasized="sessionScopeFilterPinned"
            :sources="sessionSourceOptions"
            :current="activeSessionBucketKey"
            @select="switchSessionBucket"
          />
        </div>
        <template v-if="sessionListBooting && !hasAnySession">
          <div v-for="n in 4" :key="'skel-' + n" class="submenu_item_p session-chat-row">
            <div class="session-list-row session-list-row--flat">
              <t-skeleton
                animation="gradient"
                class="session-list-row__body"
                :row-col="[{ width: '100%', height: '14px' }]"
              />
            </div>
          </div>
        </template>

        <div v-else class="session-filtered-list">
          <template
            v-if="
              activeBucket?.loading && !activeBucket.loaded && filteredGroupedSessions.length === 0
            "
          >
            <div v-for="n in 4" :key="'bucket-skel-' + n" class="submenu_item_p session-chat-row">
              <div class="session-list-row session-list-row--flat">
                <t-skeleton
                  animation="gradient"
                  class="session-list-row__body"
                  :row-col="[{ width: '100%', height: '14px' }]"
                />
              </div>
            </div>
          </template>
          <template v-else-if="activeBucket?.loaded && filteredGroupedSessions.length === 0">
            <div class="submenu_empty">{{ t("menu.noSessions") }}</div>
          </template>
          <template v-else>
            <template v-for="group in filteredGroupedSessions" :key="group.key">
              <div
                v-if="group.label"
                class="timeline_header session-list-row session-list-row--flat"
              >
                <span class="session-list-row__body">
                  <span class="timeline_header-label">{{ group.label }}</span>
                </span>
              </div>
              <div
                v-for="subitem in group.items"
                :key="subitem.id"
                class="submenu_item_p session-chat-row"
                :class="{
                  'session-chat-row--active': !batchMode && subitem.path === currentSecondpath,
                  'session-chat-row--selected': batchMode && batchSelectedIds.includes(subitem.id),
                }"
              >
                <div class="session-list-row session-list-row--flat">
                  <div class="session-list-row__body">
                    <SessionSidebarRow
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
                  </div>
                </div>
              </div>
            </template>
            <div
              v-if="activeBucket?.loading && filteredGroupedSessions.length > 0"
              class="session-list-loading session-list-row session-list-row--flat"
            >
              <span class="session-list-row__body">
                <t-loading size="small" />
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 批量管理底部操作条：固定在侧栏底部、用户头像上方 -->
    <div v-if="batchMode && !uiStore.sidebarCollapsed" class="batch-inline-footer">
      <div class="batch-footer-left">
        <t-checkbox
          :checked="isAllBatchSelected"
          :indeterminate="isBatchIndeterminate"
          @change="toggleBatchSelectAll"
        >
          {{ t("batchManage.selectAll") }}
        </t-checkbox>
      </div>
      <div class="batch-footer-right">
        <t-button size="small" variant="text" @click="exitBatchMode">
          {{ t("batchManage.cancel") }}
        </t-button>
        <t-button
          size="small"
          theme="danger"
          variant="base"
          :disabled="batchSelectedIds.length === 0"
          :loading="batchDeleting"
          @click="handleInlineBatchDelete"
        >
          {{ t("batchManage.delete")
          }}{{ batchSelectedIds.length > 0 ? `(${batchDisplayCount})` : "" }}
        </t-button>
      </div>
    </div>

    <!-- 下半部分：用户菜单 -->
    <div class="menu_bottom">
      <UserMenu />
    </div>
  </div>
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
import { useI18n } from "vue-i18n";
import { getSystemInfo } from "@/api/system";

const chatResources = useChatResourcesStore();
// Platform logos reused from IMChannelsOverviewPanel — keeps the session list
// visually consistent with the channels admin view.
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

// Platform-aware label for the ⌘K hint. navigator.platform is deprecated but
// the alternatives (userAgentData.platform) aren't universally available yet;
// this check is good enough for Mac vs. non-Mac.
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

/**
 * Narrow layouts start with the existing collapsed presentation so the route
 * keeps usable width.  This is deliberately a direct store assignment rather
 * than `collapseSidebar()`: automatic responsive presentation must not rewrite
 * the user's persisted desktop preference.  The preference is restored when
 * crossing back to desktop; the existing toggle remains available on mobile.
 */
const syncSidebarWithViewport = () => {
  if (typeof window === "undefined") return;
  const isNarrow = window.innerWidth <= SIDEBAR_NARROW_BREAKPOINT;
  if (isNarrow === sidebarWasNarrow) return;

  if (isNarrow) {
    let storedPreference: string | null = null;
    try {
      storedPreference = window.localStorage.getItem("sidebar_collapsed");
    } catch {
      // Sandboxed/private contexts may deny storage access; keep the live
      // store value as the best available desktop preference in that case.
    }
    sidebarPreferenceBeforeNarrow =
      storedPreference === null ? uiStore.sidebarCollapsed : storedPreference === "true";
    uiStore.sidebarCollapsed = true;
  } else if (sidebarPreferenceBeforeNarrow !== null) {
    uiStore.sidebarCollapsed = sidebarPreferenceBeforeNarrow;
    sidebarPreferenceBeforeNarrow = null;
  }

  sidebarWasNarrow = isNarrow;
};

// Keep the existing toggle affordance usable on a phone without persisting a
// temporary mobile override as the desktop preference.  Desktop clicks retain
// the store action's original persistence behavior.
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
// 批量管理状态
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

// 是否可以访问所有空间

// 是否处于知识库详情页（不包括全局聊天）
const isInKnowledgeBase = computed<boolean>(() => {
  return (
    route.name === "knowledgeBaseDetail" ||
    route.name === "kbCreatChat" ||
    route.name === "knowledgeBaseSettings"
  );
});

// 是否在知识库列表页面
const isInKnowledgeBaseList = computed<boolean>(() => {
  return route.name === "knowledgeBaseList";
});

// 是否在创建聊天页面
const isInCreatChat = computed<boolean>(() => {
  return route.name === "globalCreatChat" || route.name === "kbCreatChat";
});

// 是否在对话详情页
const isInChatDetail = computed<boolean>(() => route.name === "chat");

// 统一的菜单项激活状态判断
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

// 分离上下两部分菜单（使用 visibleMenuArr 以便 lite 模式过滤 logout）
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

// 当前知识库信息
const currentKbName = ref<string>("");
const currentKbInfo = ref<any>(null);

// 进行中的置顶/取消置顶请求，避免重复点击
const pinningIds = ref<Set<string>>(new Set());

// 「聊天」区内按日期分组（当前筛选来源）
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

/** 列表未撑满滚动区时自动续页（按当前可见 DOM 测量，避免折叠导致误判） */
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

// Web 会话没有来源图标；带来源的会话继续使用其已有的平台标识。

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

/** 创建会话后 menuStore 已乐观写入，但列表实际渲染自 sessionBuckets，需补齐。 */
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

/** 首屏轻量探测各渠道是否有会话（page_size=1 只取 total），避免展示空文件夹 */
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
  // On a hard refresh only the web bucket is loaded, so a session opened from
  // any other folder (IM, embed, or the admin-only API folder) isn't in any
  // bucket or the menu store. Fetch its detail and classify its origin folder
  // so the sidebar stays in sync with the chat pane instead of snapping back
  // to "my chats". Only switch when that folder is actually present.
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
    } catch {
      // Fall through: leave the default bucket active on lookup failure.
    }
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

  // 首屏：拉 web 会话 + 轻量探测各渠道 count（不拉完整列表）；有会话的渠道才展示文件夹
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

// 滚动到底时为当前筛选来源加载下一页
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

  // 创建新会话时 creatChat 会先 updataMenuChildren，再跳转 chat/:id。
  // 侧栏实际渲染 sessionBuckets，需按 buckets 判断是否缺失，不能把 menuStore 当真相来源。
  const newChatId = (newvalue[1] as any)?.chatid as string | undefined;
  if (nameStr === "chat" && newChatId) {
    ensureSessionInSidebar(newChatId);
    void syncActiveBucketFromChat(newChatId);
  }

  // 如果切换了知识库，更新知识库名称但不重新加载对话列表
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
    // 知识库菜单项：如果在知识库内部，跳转到当前知识库文件页；否则跳转到知识库列表
    const kbId = await getCurrentKbId();
    if (kbId) {
      router.push(`/platform/knowledge-bases/${kbId}`);
    } else {
      router.push("/platform/knowledge-bases");
    }
  } else if (path === "settings") {
    // 设置菜单项：打开设置弹窗并跳转路由
    uiStore.openSettings();
    router.push("/platform/settings");
  } else {
    gotopage(path);
  }
};

// 处理退出登录确认
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
  // 处理退出登录
  if (path === "logout") {
    try {
      // 调用后端API注销
      await logoutApi();
    } catch (error) {
      // 即使API调用失败，也继续执行本地清理
      console.error("注销API调用失败:", error);
    }
    // 清理所有状态和本地存储
    authStore.logout();
    MessagePlugin.success(t("menu.logoutSuccess"));
    handoffToExternalAuth("logout");
    return;
  } else {
    if (path === "creatChat") {
      // 如果在知识库详情页，跳转到全局对话创建页
      if (isInKnowledgeBase.value) {
        router.push("/platform/creatChat");
      } else {
        // 如果不在知识库内，进入对话创建页
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
<style lang="less" scoped>
.aside_box {
  // Musuw shell grid: the navigation and session rows share one calm, readable rail.
  --sidebar-inset-x: 12px;
  --sidebar-icon-size: 18px;
  --sidebar-channel-icon: 14px;
  --sidebar-icon-gap: 10px;
  --sidebar-text-inset: calc(
    var(--sidebar-inset-x) + var(--sidebar-icon-size) + var(--sidebar-icon-gap)
  ); // 40px

  min-width: 256px;
  width: 256px;
  padding: 10px 8px 8px;
  background: var(--musuw-sidebar);
  box-sizing: border-box;
  /* Avoid 100vh because <html> carries a `zoom` multiplier for font-size
       control; 100vh is evaluated against the unscaled viewport and then
       scaled, so at "large" the sidebar would extend past the window. The
       ancestor chain (html/body/#app/.main) is already height: 100%. */
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--musuw-line);
  box-shadow: none;
  transition:
    width 0.2s ease,
    min-width 0.2s ease;
  position: relative;

  // macOS Wails 桌面：红绿灯位于 HiddenInset 标题栏区域，需让出顶部空间
  html.wails-desktop & {
    padding-top: 30px;
  }

  &--collapsed {
    min-width: 64px;
    width: 64px;
    padding: 10px 6px 8px;
    overflow: visible;

    .menu_item {
      justify-content: center;
      padding: 9px 0;

      .menu_item-box {
        justify-content: center;
        width: auto;
      }

      .menu_icon {
        margin-right: 0;
      }
    }

    .menu_bottom {
      align-items: center;
    }

    .menu_top {
      margin-right: 0;
      padding-right: 0;
    }
  }

  .logo_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    flex-shrink: 0;
    padding: 0 4px 0 var(--sidebar-inset-x);
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--td-text-color-secondary);
    border: 1px solid transparent;
    border-radius: 8px;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
    box-sizing: border-box;

    &:hover {
      background: var(--musuw-surface);
      border-color: var(--musuw-line);
      color: var(--td-text-color-primary);
    }
  }

  .sidebar-drag-handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: ew-resize;
    z-index: 10;

    &:hover {
      background: var(--musuw-accent-soft);
    }
  }

  .menu_top {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    // 抵消 .aside_box 的右内边距，让滚动条贴近面板右缘；
    // 等量 padding 补回，保证列表文字位置不变。
    margin-right: -2px;
    padding-right: 2px;

    // Claude 风格细滚动条：默认透明，悬浮时显示一条圆角细灰条
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    transition: scrollbar-color 0.2s ease;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 6px;
      transition: background-color 0.2s ease;
    }

    &:hover {
      scrollbar-color: var(--td-scrollbar-color, rgba(0, 0, 0, 0.18)) transparent;

      &::-webkit-scrollbar-thumb {
        background-color: var(--td-scrollbar-color, rgba(0, 0, 0, 0.18));
      }
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: var(--td-scrollbar-hover-color, rgba(0, 0, 0, 0.32));
    }
  }

  .menu_bottom {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    margin-top: 8px;
    padding: 8px 2px 0;
    border-top: 1px solid var(--musuw-line);
  }

  .menu_box {
    display: flex;
    flex-direction: column;

    // 「新对话」吸顶：作为滚动容器(.menu_top)的直接子级，滚动时钉在顶部，
    // 知识库/智能体/共享空间及历史列表一起从其下方滚走。背景遮挡滚动内容。
    &--sticky {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 0 4px 8px;
      background: var(--musuw-sidebar);
    }
  }

  .menu_box--sticky .menu_item {
    background: var(--musuw-surface);
    border-color: var(--musuw-line);
    border-radius: var(--musuw-radius-control);
    box-shadow: none;

    &:hover {
      background: var(--musuw-surface);
      border-color: var(--musuw-line-strong);
    }

    &.menu_item_active,
    &.menu_item_c_active {
      background: var(--musuw-accent-soft) !important;
      border-color: transparent;
      box-shadow: none;
    }
  }

  .upload-file-wrap {
    padding: 6px;
    border-radius: 3px;
    height: 32px;
    width: 32px;
    box-sizing: border-box;
  }

  .upload-file-wrap:hover {
    background-color: var(--td-brand-color-light);
    color: var(--td-brand-color);
  }

  .upload-file-icon {
    width: 20px;
    height: 20px;
    color: var(--td-text-color-secondary);
  }

  .active-upload {
    color: var(--td-brand-color);
  }

  .menu_item_active {
    border-radius: var(--musuw-radius-control);
    background: var(--musuw-surface-hover) !important;

    .menu_icon,
    .menu_title {
      color: var(--td-text-color-primary) !important;
    }
  }

  .menu_item_c_active {
    border-radius: var(--musuw-radius-control);
    background: var(--musuw-surface-hover);
    .menu_icon,
    .menu_title {
      color: var(--td-text-color-primary);
    }
  }

  .menu_p {
    height: 46px;
    padding: 3px 0;
    box-sizing: border-box;
  }

  .menu_item {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    height: 42px;
    padding: 10px 12px;
    box-sizing: border-box;
    margin: 2px 0;
    border: 1px solid transparent;
    border-radius: var(--musuw-radius-control);
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    .menu_item-box {
      display: flex;
      align-items: center;
    }

    &:hover {
      background: var(--musuw-surface-hover);

      .menu_icon,
      .menu_title {
        color: var(--td-text-color-primary);
      }
    }
  }

  .menu_icon {
    display: flex;
    flex: 0 0 var(--sidebar-icon-size);
    width: var(--sidebar-icon-size);
    margin-right: var(--sidebar-icon-gap);
    color: var(--td-text-color-secondary);

    .icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      overflow: visible;
    }
  }

  .menu_title {
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    font-family: var(--app-font-family);
    font-size: 14px;
    font-style: normal;
    font-weight: 560;
    line-height: 20px;
    overflow: hidden;
    white-space: nowrap;
    max-width: 120px;
    flex: 1;
  }

  .submenu {
    position: relative;
    font-family: var(--app-font-family);
    font-size: 14px;
    font-style: normal;
    min-width: 0;
    padding-top: 3px;
  }

  :deep(.submenu_pin_icon) {
    color: inherit;
    font-size: 12px;
    margin-right: 4px;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .submenu_source_icon {
    width: 14px;
    height: 14px;
    margin-right: 0px;
    vertical-align: middle;
    object-fit: contain;
    flex-shrink: 0;
    // 默认淡化处理，避免未选中状态下彩色图标与灰色标题不协调；
    // 悬浮或选中时恢复彩色，交互时才引人注意。
    filter: grayscale(1);
    opacity: 0.55;
    transition:
      filter 0.15s ease,
      opacity 0.15s ease;
  }

  :deep(.submenu_item:hover .submenu_source_icon),
  :deep(.submenu_item_active .submenu_source_icon) {
    filter: none;
    opacity: 1;
  }

  // 列表行统一栅格：左缘 inset-x + 图标槽 18px + 间距 8px → 文案列与主菜单文字对齐
  .session-list-row {
    display: flex;
    align-items: center;
    gap: var(--sidebar-icon-gap);
    padding: 0 10px 0 var(--sidebar-inset-x);
    min-width: 0;
    box-sizing: border-box;
  }

  .session-list-row__icon {
    flex: 0 0 var(--sidebar-icon-size);
    width: var(--sidebar-icon-size);
    height: var(--sidebar-icon-size);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .session-list-row__body {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }

  // 聊天区分组标题 / 会话行：与「聊天」节标题同列左对齐，不再预留图标槽
  .session-list-row--flat {
    padding-left: var(--sidebar-inset-x);
    gap: 0;
  }

  .session-list-loading {
    display: flex;
    align-items: center;
    min-height: 26px;
    color: var(--td-text-color-placeholder);
  }

  .timeline_header {
    font-family: var(--app-font-family);
    font-size: 11px;
    font-weight: 600;
    color: var(--musuw-muted);
    padding-top: 12px;
    padding-bottom: 3px;
    margin-top: 0;
    line-height: 16px;
    user-select: none;
  }

  .timeline_header-label {
    white-space: nowrap;
  }

  // Stable filter control: always mounted and absolutely pinned to the list's
  // top-right so it visually sits on the first row (e.g. beside "近30天") and
  // never jumps when switching session type reloads a bucket. It overlays the
  // empty right side of the first header row, so it needs no reserved height.
  .session-list-scope-header {
    position: absolute;
    top: 4px;
    right: 10px;
    z-index: 2;
    display: flex;
    justify-content: flex-end;
    max-width: calc(100% - var(--sidebar-inset-x) - 10px);

    :deep(.session-source-filter--inline) {
      flex: 0 1 auto;
      min-width: 0;
      max-width: 100%;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
  }

  .submenu:hover .session-list-scope-header :deep(.session-source-filter--inline),
  .session-list-scope-header:hover :deep(.session-source-filter--inline),
  .session-list-scope-header:focus-within :deep(.session-source-filter--inline),
  .session-list-scope-header
    :deep(.session-source-filter--inline.session-source-filter--emphasized) {
    opacity: 1;
  }

  .submenu_item_p {
    padding: 0;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;

    &.session-chat-row .session-list-row {
      min-height: 30px;
      border-radius: 6px;
      transition:
        background 0.15s ease,
        color 0.15s ease;
    }

    &.session-chat-row:hover .session-list-row {
      background: var(--musuw-surface-hover);

      :deep(.menu-more) {
        color: var(--td-text-color-primary);
      }

      :deep(.menu-more-wrap) {
        opacity: 1;
      }
    }

    &.session-chat-row--active .session-list-row {
      background: var(--musuw-accent-soft);

      :deep(.submenu_item) {
        color: var(--td-brand-color);
      }

      :deep(.menu-more) {
        color: var(--td-text-color-primary);
      }

      :deep(.menu-more-wrap) {
        opacity: 1;
      }
    }

    &.session-chat-row--selected .session-list-row {
      background: var(--musuw-accent-soft);
    }
  }

  // SessionSidebarRow 为子组件，需 :deep 才能让标题省略号生效
  :deep(.submenu_item) {
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--td-text-color-primary);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    height: 100%;
    width: 100%;
    padding: 6px 0;
    position: relative;
    min-width: 0;
    background: transparent;

    .submenu_title {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
    }

    .submenu_title-text {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .menu-more-wrap {
      opacity: 0;
      transition: opacity 0.2s ease;
      flex-shrink: 0;
    }

    .menu-more {
      display: inline-block;
      font-weight: bold;
      color: var(--td-brand-color);
    }

    .submenu_title--batch {
      margin-left: 4px;
    }

    &.submenu_item_batch {
      padding-left: 0;
    }
  }

  :deep(.submenu_item_batch) {
    cursor: pointer;
    user-select: none;
  }

  .batch-checkbox {
    flex-shrink: 0;
  }
}

.batch-inline-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid var(--td-component-stroke);
  background: var(--td-bg-color-container);

  .batch-footer-left {
    display: flex;
    align-items: center;
    font-size: 13px;
    color: var(--td-text-color-placeholder);
  }

  .batch-footer-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

/* 知识库下拉菜单样式 */
.kb-dropdown-icon {
  margin-left: auto;
  color: var(--td-text-color-secondary);
  transition:
    transform 0.3s ease,
    color 0.2s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;

  &.rotate-180 {
    transform: rotate(180deg);
  }

  &:hover {
    color: var(--td-brand-color);
  }

  &.active {
    color: var(--td-brand-color);
  }

  &.active:hover {
    color: var(--td-brand-color-active);
  }

  svg {
    width: 12px;
    height: 12px;
    transition: inherit;
  }
}

.kb-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;
  box-shadow: var(--td-shadow-2);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
}

.kb-dropdown-item {
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 14px;
  color: var(--td-text-color-primary);

  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }

  &.active {
    background-color: var(--td-brand-color-light);
    color: var(--td-brand-color);
    font-weight: 500;
  }

  &:first-child {
    border-radius: 6px 6px 0 0;
  }

  &:last-child {
    border-radius: 0 0 6px 6px;
  }
}

.menu_item-box {
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
}

/* Empty state when there are no sessions. */
.submenu_empty {
  padding: 24px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  user-select: none;
}

// 顶部操作组（搜索 + 收起）与侧栏控制保持同一视觉密度。
.logo_actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.musuw-wordmark {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
  color: var(--td-text-color-primary);
  font-family: var(--app-font-family);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1;
  user-select: none;
}

.musuw-wordmark__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--musuw-ink);
  color: var(--musuw-panel);
  font-family: var(--app-font-family-mono);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.musuw-wordmark__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--td-text-color-secondary);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
  box-sizing: border-box;

  &:hover {
    background: var(--musuw-surface);
    border-color: var(--musuw-line);
    color: var(--td-text-color-primary);
  }

  .header-icon-glyph {
    font-size: 17px;
  }
}

// 深色 tooltip 内容：标签 + 浅灰快捷键内联
.cmdk-tip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;

  .cmdk-tip-label {
    font-size: 13px;
  }

  .cmdk-tip-keys {
    font-size: 13px;
    opacity: 0.6;
    letter-spacing: 0.5px;
  }
}

.menu-pending-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 6px;
  border-radius: 9px;
  background: rgba(250, 173, 20, 0.2);
  color: var(--td-warning-color);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  flex-shrink: 0;
}

.menu_box {
  position: relative;
}
</style>
<style lang="less">
// Dark mode: the slim scrollbar remains visible against the ink rail.
html[theme-mode="dark"] .aside_box .menu_top:hover {
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
}

html[theme-mode="dark"] .aside_box .menu_top:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.22);
}

html[theme-mode="dark"] .aside_box .menu_top::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.38);
}

// 下拉菜单样式已统一至 @/assets/dropdown-menu.less

// 退出登录确认框样式
:deep(.t-popconfirm) {
  .t-popconfirm__content {
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-component-stroke);
    border-radius: 6px;
    box-shadow: var(--td-shadow-3);
    padding: 12px 16px;
    font-size: 14px;
    color: var(--td-text-color-primary);
    max-width: 200px;
  }

  .t-popconfirm__arrow {
    border-bottom-color: var(--td-component-stroke);
  }

  .t-popconfirm__arrow::after {
    border-bottom-color: var(--td-bg-color-container);
  }

  .t-popconfirm__buttons {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .t-button--variant-outline {
    border-color: var(--td-component-border);
    color: var(--td-text-color-secondary);
  }

  .t-button--theme-danger {
    background-color: var(--td-error-color);
    border-color: var(--td-error-color);
  }

  .t-button--theme-danger:hover {
    background-color: var(--td-error-color);
    border-color: var(--td-error-color);
  }
}
</style>
