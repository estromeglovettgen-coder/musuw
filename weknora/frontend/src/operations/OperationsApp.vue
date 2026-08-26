<template>
  <div class="ops-shell">
    <aside class="ops-sidebar">
      <div class="ops-brand">
        <div class="ops-brand__mark">M</div>
        <div>
          <strong>Musuw</strong>
          <span>Operations</span>
        </div>
      </div>

      <nav class="ops-nav" aria-label="运营中台导航">
        <button
          v-for="item in navigation"
          :key="item.key"
          type="button"
          class="ops-nav__item"
          :class="{ 'ops-nav__item--active': currentPage === item.key }"
          :aria-current="currentPage === item.key ? 'page' : undefined"
          @click="navigate(item.key)"
        >
          <component :is="item.icon" size="19" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="ops-sidebar__footer">
        <div class="ops-runtime-state">
          <span class="ops-runtime-state__dot" :class="{ 'is-ready': config?.providers.weknora.available }" />
          <div>
            <strong>{{ config?.providers.weknora.available ? '管理 API 已连接' : '管理 API 不可用' }}</strong>
            <span>平台密钥仅由本机服务读取</span>
          </div>
        </div>
        <div class="ops-template-credit">Musuw · Operations</div>
      </div>
    </aside>

    <section class="ops-workspace">
      <header class="ops-topbar">
        <div class="ops-topbar__context">
          <span>运营中台</span>
          <span>/</span>
          <strong>{{ activeNavigation.label }}</strong>
        </div>
        <div class="ops-topbar__actions">
          <t-popup placement="bottom-right" trigger="click">
            <button
              class="ops-environment"
              type="button"
              :class="[`is-${config?.target || 'test'}`, { 'is-switching': switching }]"
              :disabled="switching"
              :aria-busy="switching"
            >
              <RefreshIcon v-if="switching" size="15" class="ops-spin" />
              <span v-else class="ops-environment__dot" />
              {{ switching ? `切换到 ${switchTargetLabel}…` : (config?.environment || '连接中') }}
              <ChevronDownIcon v-if="!switching" size="15" />
            </button>
            <template #content>
              <div class="ops-env-menu">
                <button type="button" class="is-current" :disabled="switching">
                  <span>{{ config?.environment || '当前环境' }}</span>
                  <RefreshIcon v-if="switching" size="16" class="ops-spin" />
                  <CheckIcon v-else size="16" />
                </button>
                <button
                  type="button"
                  :class="{ 'is-production': alternateTarget === 'production' }"
                  :disabled="switching || !config"
                  @click="switchEnvironment(alternateTarget)"
                >
                  <span>{{ alternateTargetLabel }}</span>
                  <ChevronDownIcon size="15" class="ops-env-menu__switch-icon" />
                </button>
                <p v-if="switching" class="ops-env-menu__status" role="status" aria-live="polite">
                  正在切换到 {{ switchTargetLabel }}，请稍候…
                </p>
                <p v-else-if="switchError" class="ops-env-menu__status is-error" role="alert">
                  {{ switchError }}
                </p>
                <p v-else>切换会重启本机运营台，并保持当前页面。</p>
              </div>
            </template>
          </t-popup>
          <button class="ops-icon-button" type="button" aria-label="刷新当前页面" :disabled="refreshing" @click="refresh">
            <RefreshIcon size="18" :class="{ 'ops-spin': refreshing }" />
          </button>
          <div class="ops-operator">
            <div class="ops-operator__avatar">OP</div>
            <div>
              <strong>本机运营会话</strong>
              <span>SameSite + CSRF 防护</span>
            </div>
          </div>
        </div>
      </header>

      <main class="ops-main">
        <div v-if="switching" class="ops-environment-status" role="status" aria-live="polite">
          <RefreshIcon size="15" class="ops-spin" />
          <span>正在切换到 {{ switchTargetLabel }}，请稍候…</span>
        </div>
        <div v-else-if="switchError" class="ops-environment-status is-error" role="alert">
          <span>{{ switchError }}</span>
          <button type="button" class="ops-environment-status__action" @click="recoverEnvironment">
            恢复当前环境
          </button>
        </div>
        <div v-if="bootstrapError" class="ops-bootstrap-error">
          <t-alert theme="error" title="运营中台启动失败" :message="bootstrapError">
            <template #operation>
              <t-button size="small" @click="bootstrap">重试</t-button>
            </template>
          </t-alert>
        </div>
        <component
          v-else
          :is="activeNavigation.component"
          :config="config"
          :refresh-key="refreshKey"
          @busy="setBusy"
        />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  DashboardIcon,
  FileIcon,
  MoneyIcon,
  RefreshIcon,
  SettingIcon,
  SystemLogIcon,
  UserSafetyIcon,
  UsergroupIcon,
} from 'tdesign-icons-vue-next'
import { operationsApi } from './api'
import type { EnvironmentTarget, OperationsConfig } from './types'
import OverviewPage from './pages/OverviewPage.vue'
import UsersPage from './pages/UsersPage.vue'
import KnowledgePage from './pages/KnowledgePage.vue'
import BillingPage from './pages/BillingPage.vue'
import IdentityPage from './pages/IdentityPage.vue'
import StoragePage from './pages/StoragePage.vue'
import LogsPage from './pages/LogsPage.vue'
import ModelsPolicyPage from './pages/ModelsPolicyPage.vue'

type PageKey = 'overview' | 'users' | 'knowledge' | 'model-policy' | 'billing' | 'identity' | 'storage' | 'logs'

const navigation = [
  { key: 'overview' as const, label: '概览', icon: markRaw(DashboardIcon), component: markRaw(OverviewPage) },
  { key: 'users' as const, label: '用户', icon: markRaw(UsergroupIcon), component: markRaw(UsersPage) },
  { key: 'knowledge' as const, label: '知识库与文档', icon: markRaw(FileIcon), component: markRaw(KnowledgePage) },
  { key: 'model-policy' as const, label: '模型策略', icon: markRaw(SettingIcon), component: markRaw(ModelsPolicyPage) },
  { key: 'billing' as const, label: '账单', icon: markRaw(MoneyIcon), component: markRaw(BillingPage) },
  { key: 'identity' as const, label: '身份', icon: markRaw(UserSafetyIcon), component: markRaw(IdentityPage) },
  { key: 'storage' as const, label: '存储', icon: markRaw(CloudIcon), component: markRaw(StoragePage) },
  { key: 'logs' as const, label: '日志与追踪', icon: markRaw(SystemLogIcon), component: markRaw(LogsPage) },
]

const validPages = new Set<PageKey>(navigation.map((item) => item.key))
const initialHash = window.location.hash.replace(/^#\/?/, '') as PageKey
const currentPage = ref<PageKey>(validPages.has(initialHash) ? initialHash : 'overview')
const config = ref<OperationsConfig | null>(null)
const bootstrapError = ref('')
const refreshKey = ref(0)
const busyChildren = ref(0)
const switching = ref(false)
const switchTarget = ref<EnvironmentTarget | null>(null)
const switchError = ref('')
let switchPollTimer: ReturnType<typeof setTimeout> | null = null
const refreshing = computed(() => busyChildren.value > 0)
const activeNavigation = computed(() => navigation.find((item) => item.key === currentPage.value) || navigation[0])
const alternateTarget = computed<EnvironmentTarget>(() => (config.value?.target === 'production' ? 'test' : 'production'))
const environmentLabel = (target: EnvironmentTarget) => (target === 'production' ? 'PRODUCTION' : 'TEST')
const alternateTargetLabel = computed(() => environmentLabel(alternateTarget.value))
const switchTargetLabel = computed(() => (switchTarget.value ? environmentLabel(switchTarget.value) : '目标环境'))

function navigate(page: PageKey) {
  currentPage.value = page
  window.location.hash = `/${page}`
  document.querySelector('.ops-main')?.scrollTo({ top: 0, behavior: 'instant' })
}

function handleHashChange() {
  const page = window.location.hash.replace(/^#\/?/, '') as PageKey
  if (validPages.has(page)) currentPage.value = page
}

async function bootstrap() {
  bootstrapError.value = ''
  try {
    config.value = await operationsApi.config()
  } catch (error) {
    bootstrapError.value = error instanceof Error ? error.message : '无法加载运营配置'
  }
}

function refresh() {
  if (refreshing.value) return
  refreshKey.value += 1
}

function setBusy(value: boolean) {
  busyChildren.value = Math.max(0, busyChildren.value + (value ? 1 : -1))
}

function clearSwitchPollTimer() {
  if (switchPollTimer) {
    clearTimeout(switchPollTimer)
    switchPollTimer = null
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    switchPollTimer = setTimeout(() => {
      switchPollTimer = null
      resolve()
    }, milliseconds)
  })
}

async function healthMatches(target: EnvironmentTarget) {
  try {
    const health = await Promise.race([
      operationsApi.health(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('health check timeout')), 1000)),
    ])
    return health.environment === environmentLabel(target)
  } catch {
    return false
  }
}

async function waitForEnvironment(target: EnvironmentTarget) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await healthMatches(target)) return true
    await wait(Math.min(500, Math.max(0, deadline - Date.now())))
  }
  return false
}

async function switchEnvironment(target: EnvironmentTarget) {
  if (switching.value || !config.value || target === config.value.target) return
  switching.value = true
  switchTarget.value = target
  switchError.value = ''
  try {
    await operationsApi.switchEnvironment(target)
    if (!(await waitForEnvironment(target))) {
      throw new Error(`切换到 ${environmentLabel(target)} 超时（30 秒）。当前环境未确认改变。`)
    }
    switching.value = false
    switchTarget.value = null
    // Reloading the current URL keeps its hash route intact after the process restarts.
    window.location.reload()
  } catch (error) {
    switchError.value = error instanceof Error ? error.message : `切换到 ${environmentLabel(target)} 失败`
    MessagePlugin.error(switchError.value)
  } finally {
    clearSwitchPollTimer()
    switching.value = false
    switchTarget.value = null
  }
}

function recoverEnvironment() {
  switchError.value = ''
  void bootstrap()
}

onMounted(() => {
  window.addEventListener('hashchange', handleHashChange)
  if (!window.location.hash) window.history.replaceState(null, '', '#/overview')
  bootstrap()
})

onBeforeUnmount(() => {
  clearSwitchPollTimer()
  window.removeEventListener('hashchange', handleHashChange)
})
</script>
