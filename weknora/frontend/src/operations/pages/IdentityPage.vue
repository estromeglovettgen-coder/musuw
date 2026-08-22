<template>
  <div class="ops-page">
    <header class="ops-page-header">
      <div><h1>身份</h1><p>Musuw 账号镜像与 Supabase Auth 官方项目状态。缺少 Auth Admin 服务端凭据时明确标记 unavailable，不把 0 条当作成功。</p></div>
      <div class="ops-page-actions"><t-button variant="outline" @click="goToUsers"><UsergroupIcon />查看用户</t-button></div>
    </header>

    <div v-if="loading && !data" class="ops-panel ops-loading"><t-loading text="加载身份状态" /></div>
    <div v-else-if="error && !data" class="ops-panel ops-error"><t-alert theme="error" title="身份状态加载失败" :message="error"><template #operation><t-button size="small" @click="load">重试</t-button></template></t-alert></div>
    <template v-else-if="data">
      <section class="ops-metrics">
        <article class="ops-metric"><div class="ops-metric__top"><span class="ops-metric__label">Musuw 账号</span><span class="ops-metric__icon"><UsergroupIcon /></span></div><div class="ops-metric__value">{{ data.account_summary.total }}</div><div class="ops-metric__hint">数据库账号镜像</div></article>
        <article class="ops-metric"><div class="ops-metric__top"><span class="ops-metric__label">活跃账号</span><span class="ops-metric__icon"><UserCheckedIcon /></span></div><div class="ops-metric__value">{{ data.account_summary.active }}</div><div class="ops-metric__hint">当前 is_active = true</div></article>
        <article class="ops-metric"><div class="ops-metric__top"><span class="ops-metric__label">系统管理员</span><span class="ops-metric__icon"><UserSafetyIcon /></span></div><div class="ops-metric__value">{{ data.account_summary.system_admins }}</div><div class="ops-metric__hint">Musuw 系统管理员</div></article>
        <article class="ops-metric"><div class="ops-metric__top"><span class="ops-metric__label">近 30 天新增</span><span class="ops-metric__icon"><UserAddIcon /></span></div><div class="ops-metric__value">{{ data.account_summary.new_30d }}</div><div class="ops-metric__hint">账号创建时间口径</div></article>
      </section>

      <div class="ops-callout" :class="data.provider.available ? '' : 'is-warning'" style="margin-top:14px">
        <component :is="data.provider.available ? CheckCircleIcon : InfoCircleIcon" class="ops-callout__icon" />
        <div><strong>Supabase Auth Admin {{ data.provider.available ? '已连接' : 'unavailable' }}</strong><span>{{ data.provider.available ? '数据可从官方 Admin API 读取。' : data.provider.reason }}</span></div>
      </div>

      <section class="ops-grid ops-grid--equal">
        <article v-for="project in data.provider.projects" :key="project.ref" class="ops-panel identity-project">
          <header class="ops-panel__header">
            <div class="ops-panel__title"><h2>{{ project.name }}</h2><p>Supabase 官方项目</p></div>
            <t-tag :theme="project.environment === 'PRODUCTION' ? 'danger' : 'primary'" variant="light-outline">{{ project.environment }}</t-tag>
          </header>
          <div class="ops-panel__body">
            <dl class="ops-definition"><div><dt>Project ref</dt><dd class="ops-mono">{{ project.ref }}</dd></div><div><dt>Auth Admin</dt><dd>{{ data.provider.available ? 'available' : 'unavailable' }}</dd></div></dl>
            <a :href="projectUrl(project.ref)" target="_blank" rel="noopener noreferrer"><t-button block variant="outline">打开 Supabase Auth <LinkIcon /></t-button></a>
          </div>
        </article>
      </section>

      <section class="ops-panel" style="margin-top:14px">
        <header class="ops-panel__header"><div class="ops-panel__title"><h2>边界说明</h2><p>身份源与产品账号不是同一个数据表</p></div></header>
        <div class="ops-panel__body">
          <div class="identity-boundaries">
            <div><span class="identity-boundaries__icon"><UserSafetyIcon /></span><div><strong>Supabase Auth</strong><p>Google 登录、会话、provider 和官方审计。只能由 Supabase Admin API / Dashboard 操作。</p></div></div>
            <ChevronRightIcon class="identity-boundaries__arrow" />
            <div><span class="identity-boundaries__icon"><ServerIcon /></span><div><strong>Musuw 账号镜像</strong><p>用户、空间、套餐和业务权限。运营写操作只经过 Musuw 管理 API。</p></div></div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { CheckCircleIcon, ChevronRightIcon, InfoCircleIcon, LinkIcon, ServerIcon, UserAddIcon, UserCheckedIcon, UserSafetyIcon, UsergroupIcon } from 'tdesign-icons-vue-next'
import { operationsApi } from '../api'
import type { IdentityData, OperationsConfig } from '../types'

const props = defineProps<{ config: OperationsConfig | null; refreshKey: number }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const data = ref<IdentityData | null>(null), loading = ref(false), error = ref('')
function projectUrl(ref: string) { return `https://supabase.com/dashboard/project/${encodeURIComponent(ref)}/auth/users` }
function goToUsers() { window.location.hash = '/users' }
async function load() { loading.value = true; error.value = ''; emit('busy', true); try { data.value = await operationsApi.identity() } catch (e) { error.value = e instanceof Error ? e.message : '加载失败' } finally { loading.value = false; emit('busy', false) } }
onMounted(load); watch(() => props.refreshKey, load)
</script>

<style scoped>
.identity-project a { display: block; margin-top: 18px; text-decoration: none; }
.identity-boundaries { display: grid; grid-template-columns: minmax(0,1fr) 28px minmax(0,1fr); align-items: center; gap: 16px; }
.identity-boundaries > div { display: flex; align-items: flex-start; gap: 13px; }
.identity-boundaries__icon { width: 38px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 9px; color: #4d64d9; background: #eef2ff; }
.identity-boundaries strong { color: #344054; font-size: 13px; }
.identity-boundaries p { margin: 5px 0 0; color: #596579; font-size: 11px; line-height: 1.55; }
.identity-boundaries__arrow { color: #a5adba; }
</style>
