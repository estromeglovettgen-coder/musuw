<template>
  <div
    ref="menuRef"
    class="visual-user-menu"
    :class="{ 'is-collapsed': uiStore.sidebarCollapsed }"
  >
    <button
      type="button"
      class="visual-user-menu__trigger"
      data-guide="user-menu"
      :aria-expanded="menuVisible"
      @click="toggleMenu"
    >
      <span class="visual-user-menu__avatar">
        <img v-if="userAvatar" :src="userAvatar" :alt="$t('common.avatar')" />
        <span v-else>{{ userInitial }}</span>
      </span>

      <template v-if="!uiStore.sidebarCollapsed">
        <span class="visual-user-menu__identity">
          <strong>{{ userName }}</strong>
          <small>{{ userEmail }}</small>
        </span>
        <t-icon :name="menuVisible ? 'chevron-up' : 'chevron-down'" class="visual-user-menu__caret" />
      </template>
    </button>

    <Transition name="visual-user-menu-pop">
      <div v-if="menuVisible" class="visual-user-menu__dropdown" @click.stop>
        <button type="button" class="visual-user-menu__item" @click="handleSettings">
          <t-icon name="setting" />
          <span>{{ $t("general.settings") }}</span>
        </button>
        <button type="button" class="visual-user-menu__item is-danger" @click="handleLogout">
          <t-icon name="logout" />
          <span>{{ $t("auth.logout") }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";
import { useI18n } from "vue-i18n";
import { logout as logoutApi } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { handoffToExternalAuth } from "@/utils/nativeAuthHandoff";

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();
const menuRef = ref<HTMLElement>();
const menuVisible = ref(false);

const userName = computed(
  () => authStore.user?.username || authStore.user?.email || t("common.defaultUser"),
);
const userEmail = computed(() => authStore.user?.email || "");
const userAvatar = computed(() => authStore.user?.avatar || "");
const userInitial = computed(() => userName.value.charAt(0).toUpperCase());

const toggleMenu = () => {
  menuVisible.value = !menuVisible.value;
};

const handleSettings = () => {
  menuVisible.value = false;
  uiStore.openSettings("general");
  void router.push({ path: "/platform/settings", query: { section: "general" } });
};

const handleLogout = async () => {
  menuVisible.value = false;
  try {
    await logoutApi();
  } catch (error) {
    console.error("Logout API failed:", error);
  }
  authStore.logout();
  MessagePlugin.success(t("auth.logout"));
  handoffToExternalAuth("logout");
};

const handleClickOutside = (event: MouseEvent) => {
  if (!menuRef.value?.contains(event.target as Node)) {
    menuVisible.value = false;
  }
};

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));
</script>

<style lang="less" scoped>
.visual-user-menu {
  position: relative;
  width: 100%;
  min-width: 0;
}

.visual-user-menu__trigger {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 6px;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  color: #111827;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.visual-user-menu__trigger:hover,
.visual-user-menu__trigger[aria-expanded='true'] {
  background: #f3f4f6;
}

.visual-user-menu.is-collapsed .visual-user-menu__trigger {
  justify-content: center;
  padding: 6px 2px;
}

.visual-user-menu__avatar {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  overflow: hidden;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #fff;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

.visual-user-menu__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.visual-user-menu__identity {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.visual-user-menu__identity strong,
.visual-user-menu__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visual-user-menu__identity strong {
  color: #111827;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
}

.visual-user-menu__identity small {
  max-width: 130px;
  color: #9ca3af;
  font-size: 10px;
  line-height: 14px;
  font-weight: 400;
}

.visual-user-menu__caret {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  font-size: 14px;
  color: #9ca3af;
}

.visual-user-menu__dropdown {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 3000;
  min-width: 188px;
  padding: 5px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 30px rgb(0 0 0 / 12%);
}

.visual-user-menu.is-collapsed .visual-user-menu__dropdown {
  left: calc(100% + 8px);
  right: auto;
  bottom: 0;
}

.visual-user-menu__item {
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #374151;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
}

.visual-user-menu__item:hover {
  background: #f3f4f6;
  color: #111827;
}

.visual-user-menu__item.is-danger {
  color: #b91c1c;
}

.visual-user-menu__item.is-danger:hover {
  background: #fef2f2;
}

.visual-user-menu__item :deep(.t-icon) {
  flex: 0 0 15px;
  width: 15px;
  height: 15px;
  font-size: 15px;
}

.visual-user-menu-pop-enter-active,
.visual-user-menu-pop-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.visual-user-menu-pop-enter-from,
.visual-user-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .visual-user-menu__trigger,
  .visual-user-menu-pop-enter-active,
  .visual-user-menu-pop-leave-active {
    transition: none !important;
  }
}
</style>
