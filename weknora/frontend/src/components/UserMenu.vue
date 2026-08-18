<template>
  <div
    ref="menuRef"
    class="user-menu"
    :class="{ 'user-menu--collapsed': uiStore.sidebarCollapsed }"
  >
    <div class="user-button" data-guide="user-menu" @click="toggleMenu">
      <div class="user-avatar">
        <img v-if="userAvatar" :src="userAvatar" :alt="$t('common.avatar')" />
        <span v-else class="avatar-placeholder">{{ userInitial }}</span>
      </div>
      <template v-if="!uiStore.sidebarCollapsed">
        <div class="user-info">
          <div class="user-name">{{ userName }}</div>
          <div class="user-email">{{ userEmail }}</div>
        </div>
        <t-icon :name="menuVisible ? 'chevron-up' : 'chevron-down'" class="dropdown-icon" />
      </template>
    </div>

    <Transition name="dropdown">
      <div v-if="menuVisible" class="user-dropdown" @click.stop>
        <div class="menu-item" @click="handleSettings">
          <t-icon name="setting" class="menu-icon" />
          <span>{{ $t("general.settings") }}</span>
        </div>
        <div class="menu-item danger" @click="handleLogout">
          <t-icon name="logout" class="menu-icon" />
          <span>{{ $t("auth.logout") }}</span>
        </div>
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
.user-menu {
  position: relative;
  width: 100%;

  &--collapsed {
    .user-button {
      justify-content: center;
      padding: 7px 3px;
    }

    .user-dropdown {
      left: calc(100% + 8px);
      bottom: 0;
      right: auto;
      min-width: 236px;
    }
  }
}

.user-button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  background: transparent;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: var(--musuw-surface);
    border-color: var(--musuw-line);
    box-shadow: var(--musuw-shadow-subtle);
  }

  &:active {
    transform: translateY(1px);
  }
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--musuw-ink-strong);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    color: var(--td-text-color-anti);
    font-size: 12px;
    font-weight: 600;
  }
}

.user-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.user-name,
.user-email {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name {
  font-size: 13px;
  font-weight: 620;
  color: var(--td-text-color-primary);
  line-height: 18px;
}

.user-email {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 16px;
}

.dropdown-icon {
  color: var(--td-text-color-secondary);
  font-size: 16px;
}

.user-dropdown {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  z-index: 1000;
  min-width: 236px;
  padding: 6px;
  border: 1px solid var(--musuw-line);
  border-radius: 14px;
  background: var(--td-bg-color-container);
  box-shadow: var(--musuw-shadow-raised);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 9px 10px;
  border-radius: 9px;
  color: var(--td-text-color-primary);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: var(--musuw-surface-hover);
  }

  &:active {
    transform: translateY(1px);
  }

  &.danger {
    color: var(--td-error-color);

    &:hover {
      background: var(--td-error-color-light);
    }
  }
}

.menu-icon {
  font-size: 16px;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .user-button,
  .menu-item,
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: none;
  }
}
</style>
