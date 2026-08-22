import type {
  BillingData,
  DocumentRow,
  IdentityData,
  InvestigationData,
  KnowledgeBaseRow,
  LangfuseData,
  OperationsConfig,
  OverviewData,
  PageResult,
  StorageData,
  TenantEntitlement,
  UserRow,
} from './types'
import { setOperationsCsrfHeader } from '@/utils/request'

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)musuw_admin_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

let synchronizedCsrfToken = ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (!['GET', 'HEAD'].includes(method)) {
    headers.set('Content-Type', 'application/json')
    headers.set('X-Musuw-CSRF', synchronizedCsrfToken || csrfToken())
  }
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || payload?.message || `HTTP ${response.status}`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return payload?.data ?? payload
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value).trim() !== '') params.set(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export const operationsApi = {
  config: async () => {
    const { csrf_token, ...config } = await request<OperationsConfig & { csrf_token: string }>('/admin-api/config')
    synchronizedCsrfToken = csrf_token
    setOperationsCsrfHeader(csrf_token)
    return config
  },
  overview: () => request<OverviewData>('/admin-api/overview'),
  users: (params: { page?: number; page_size?: number; q?: string; plan?: string; state?: string }) =>
    request<PageResult<UserRow>>(`/admin-api/users${queryString(params)}`),
  knowledge: <T extends DocumentRow | KnowledgeBaseRow>(params: { kind: 'documents' | 'knowledge_bases'; page?: number; page_size?: number; q?: string; status?: string }) =>
    request<PageResult<T> & { kind: string }>(`/admin-api/knowledge${queryString(params)}`),
  billing: () => request<BillingData>('/admin-api/billing'),
  identity: () => request<IdentityData>('/admin-api/identity'),
  storage: (params: { page?: number; page_size?: number; q?: string }) =>
    request<StorageData>(`/admin-api/storage${queryString(params)}`),
  langfuse: () => request<LangfuseData>('/admin-api/langfuse'),
  entitlement: (tenantId: number) =>
    request<TenantEntitlement>(`/api/v1/system/admin/tenants/${tenantId}/entitlement`),
  investigation: (userId: string) =>
    request<InvestigationData>(`/api/v1/system/admin/users/${encodeURIComponent(userId)}/investigation`),
  updateTenant: (tenantId: number, body: { status?: string; storage_quota_bytes?: number }) =>
    request(`/api/v1/system/admin/tenants/${tenantId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateCredits: (tenantId: number, body: { reset?: boolean; remaining_microusd?: number }) =>
    request<TenantEntitlement>(`/api/v1/system/admin/tenants/${tenantId}/openrouter-credits`, { method: 'PUT', body: JSON.stringify(body) }),
}
