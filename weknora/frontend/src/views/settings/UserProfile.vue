<template>
  <div class="user-profile">
    <header class="visual-settings-page-header">
      <div class="visual-settings-page-header__copy">
        <h2 class="visual-settings-page-header__title">{{ $t('userProfile.title') }}</h2>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-inline">
      <t-loading size="small" />
      <span>{{ $t('tenant.loadingInfo') }}</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-inline">
      <t-alert theme="error" :message="error">
        <template #operation>
          <t-button size="small" @click="loadInfo">{{ $t('tenant.retry') }}</t-button>
        </template>
      </t-alert>
    </div>

    <!-- Content -->
    <div v-else class="user-profile__rows">
      <!-- 用户名 -->
      <div class="user-profile__row">
        <span class="user-profile__label">{{ $t('tenant.api.usernameLabel') }}</span>
        <span class="info-value">{{ userInfo?.username || '-' }}</span>
      </div>

      <!-- 邮箱 -->
      <div class="user-profile__row">
        <span class="user-profile__label">{{ $t('tenant.api.emailLabel') }}</span>
        <span class="info-value is-mono">{{ userInfo?.email || '-' }}</span>
      </div>

      <!-- 注册时间 -->
      <div class="user-profile__row">
        <span class="user-profile__label">{{ $t('tenant.api.createdAtLabel') }}</span>
        <span class="info-value is-mono">{{ formatDate(userInfo?.created_at) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCurrentUser, type UserInfo } from '@/api/auth'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const userInfo = ref<UserInfo | null>(null)
const loading = ref(true)
const error = ref('')

const loadInfo = async () => {
  try {
    loading.value = true
    error.value = ''
    const resp = await getCurrentUser()
    if ((resp as any).success && resp.data) {
      userInfo.value = resp.data.user
    } else {
      error.value = resp.message || t('tenant.messages.fetchFailed')
    }
  } catch (err: any) {
    error.value = err?.message || t('tenant.messages.networkError')
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return t('tenant.unknown')
  try {
    const d = new Date(dateStr)
    const fmt = new Intl.DateTimeFormat(locale.value || 'zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    return fmt.format(d)
  } catch {
    return t('tenant.formatError')
  }
}

onMounted(loadInfo)
</script>

<style lang="less" scoped>
.user-profile {
  width: 100%;
  max-width: none;
  color: #202123;
}

.loading-inline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  justify-content: center;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.error-inline {
  padding: 20px 0;
}

.user-profile__rows {
  display: flex;
  flex-direction: column;
}

.user-profile__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  gap: 16px;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
}

.user-profile__label {
  min-width: 0;
  flex: 1;
  color: #111827;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

.info-value {
  flex-shrink: 0;
  max-width: 58%;
  color: #374151;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

.info-value.is-mono {
  font-family: var(--app-font-family-mono);
}

@media (max-width: 640px) {
  .user-profile__row { align-items: flex-start; flex-direction: column; gap: 6px; }
  .info-value { max-width: 100%; text-align: left; }
}

:global(:root[theme-mode="dark"]) .user-profile { color: #e4e4e7; }
:global(:root[theme-mode="dark"]) .user-profile__row { border-bottom-color: #27272a; }
:global(:root[theme-mode="dark"]) .user-profile__label { color: #f4f4f5; }
:global(:root[theme-mode="dark"]) .info-value { color: #e4e4e7; }
</style>
