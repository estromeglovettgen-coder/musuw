<template>
  <div class="user-profile">
    <header class="visual-settings-page-header">
      <div class="visual-settings-page-header__copy">
        <h2 class="visual-settings-page-header__title">{{ $t('userProfile.title') }}</h2>
        <p class="visual-settings-page-header__description">{{ $t('userProfile.description') }}</p>
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
    <div v-else class="settings-group">
      <!-- 用户名 -->
      <div class="setting-row">
        <div class="setting-info">
          <label>{{ $t('tenant.api.usernameLabel') }}</label>
          <p class="desc">{{ $t('tenant.api.usernameDescription') }}</p>
        </div>
        <div class="setting-control">
          <span class="info-value">{{ userInfo?.username || '-' }}</span>
        </div>
      </div>

      <!-- 邮箱 -->
      <div class="setting-row">
        <div class="setting-info">
          <label>{{ $t('tenant.api.emailLabel') }}</label>
          <p class="desc">{{ $t('tenant.api.emailDescription') }}</p>
        </div>
        <div class="setting-control">
          <span class="info-value">{{ userInfo?.email || '-' }}</span>
        </div>
      </div>

      <!-- 注册时间 -->
      <div class="setting-row">
        <div class="setting-info">
          <label>{{ $t('tenant.api.createdAtLabel') }}</label>
          <p class="desc">{{ $t('tenant.api.createdAtDescription') }}</p>
        </div>
        <div class="setting-control">
          <span class="info-value">{{ formatDate(userInfo?.created_at) }}</span>
        </div>
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
  max-width: 640px;
  color: #202123;
}

.section-header {
  margin: 0 0 8px;
  padding: 0 0 12px;
  border-bottom: 1px solid #f3f4f6;

  h2 {
    margin: 0;
    color: #111827;
    font-size: 16px;
    line-height: 24px;
    font-weight: 700;
    letter-spacing: normal;
  }

  .section-description {
    margin: 2px 0 0;
    color: #9ca3af;
    font-size: 12px;
    line-height: 16px;
  }
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

.settings-group {
  overflow: hidden;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 14px 16px;
  gap: 16px;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.setting-info {
  min-width: 0;
  flex: 1;

  label {
    display: block;
    color: #111827;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
  }

  .desc {
    margin: 2px 0 0;
    color: #777;
    font-size: 12px;
    line-height: 18px;
  }
}

.setting-control {
  flex-shrink: 0;
  max-width: 52%;
  display: flex;
  justify-content: flex-end;
  align-items: center;

  .info-value {
    color: #374151;
    font-size: 12px;
    line-height: 18px;
    text-align: right;
    word-break: break-word;
  }
}

@media (max-width: 640px) {
  .setting-row { align-items: flex-start; flex-direction: column; gap: 6px; }
  .setting-control { max-width: 100%; justify-content: flex-start; }
  .setting-control .info-value { text-align: left; }
}
</style>
