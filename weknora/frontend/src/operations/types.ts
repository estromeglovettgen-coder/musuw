export type EnvironmentName = 'TEST' | 'PRODUCTION'

export interface ProviderState {
  available: boolean
  authority: string
  reason?: string
}

export interface OperationsConfig {
  environment: EnvironmentName
  target: 'test' | 'production'
  providers: Record<'weknora' | 'paddle' | 'supabase' | 'r2' | 'langfuse', ProviderState>
  links: Record<string, string>
}

export interface PageResult<T> {
  rows: T[]
  total: number
  page: number
  page_size: number
}

export interface OverviewData {
  users: { total: number; active: number; new_30d: number }
  tenants: {
    total: number
    active: number
    paid: number
    storage_quota_bytes: string | number
    storage_used_bytes: string | number
  }
  knowledge: {
    knowledge_bases: number
    documents: number
    failed: number
    processing: number
    source_bytes: string | number
    index_bytes: string | number
  }
  storage_backends: Array<{ provider: string; status: string; source: string; count: number }>
  recent_documents: Array<Record<string, unknown>>
}

export interface UserRow {
  id: string
  username: string
  email: string
  avatar?: string
  is_active: boolean
  is_system_admin: boolean
  tenant_id: number
  tenant_name?: string
  tenant_status?: string
  plan?: string
  plan_status?: string
  storage_quota_bytes?: string | number
  storage_used_bytes?: string | number
  paddle_customer_id?: string
  paddle_subscription_id?: string
  paddle_billing_period?: string
  paddle_current_period_end?: string
  open_router_credit_period_end?: string
  knowledge_base_count: number
  document_count: number
  source_bytes: string | number
  index_bytes: string | number
  created_at: string
  updated_at: string
}

export interface KnowledgeBaseRow {
  id: string
  name: string
  description?: string
  type: string
  tenant_id: number
  tenant_name: string
  creator_id?: string
  storage_backend_id?: string
  storage_provider?: string
  storage_backend_status?: string
  plan?: string
  storage_quota_bytes: string | number
  storage_used_bytes: string | number
  document_count: number
  failed_count: number
  source_bytes: string | number
  index_bytes: string | number
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  tenant_id: number
  tenant_name: string
  knowledge_base_id: string
  knowledge_base_name: string
  type: string
  title: string
  description?: string
  source?: string
  parse_status: string
  enable_status: string
  file_name?: string
  file_type?: string
  source_bytes: string | number
  index_bytes: string | number
  object_reference?: string
  error_message?: string
  channel?: string
  storage_backend_id?: string
  storage_provider?: string
  storage_backend_status?: string
  storage_quota_bytes: string | number
  storage_used_bytes: string | number
  created_at: string
  updated_at: string
  processed_at?: string
}

export interface TenantBillingRow {
  tenant_id: number
  tenant_name: string
  tenant_status: string
  plan: string
  plan_status: string
  paddle_customer_id?: string
  paddle_subscription_id?: string
  paddle_billing_period?: string
  paddle_current_period_end?: string
  paddle_last_event_id?: string
  paddle_last_event_at?: string
  open_router_credit_period_end?: string
  created_at: string
  updated_at: string
}

export interface BillingData {
  mirror: TenantBillingRow[]
  provider: {
    available: boolean
    reason: string
    subscriptions_available: boolean
    subscriptions_reason: string
    subscriptions: Array<Record<string, unknown>>
    transactions_available: boolean
    transactions_reason: string
    transactions: Array<Record<string, unknown>>
  }
}

export interface IdentityData {
  account_summary: {
    total: number
    active: number
    system_admins: number
    new_30d: number
    latest_update?: string
  }
  provider: {
    available: boolean
    reason: string
    projects: Array<{ environment: EnvironmentName; name: string; ref: string }>
  }
}

export interface StorageObjectRow extends DocumentRow {
  quota_bytes: string | number
  measured_used_bytes: string | number
}

export interface StorageData extends PageResult<StorageObjectRow> {
  usage: {
    quota_bytes: string | number
    measured_used_bytes: string | number
    source_bytes: string | number
    index_bytes: string | number
  }
  backends: Array<{
    id: string
    tenant_id: number
    tenant_name: string
    name: string
    provider: string
    source: string
    status: string
    legacy_alias: boolean
    knowledge_base_count: number
    created_at: string
    updated_at: string
  }>
}

export interface TenantEntitlement {
  tenant_id: number
  tenant_name: string
  tenant_status: string
  configured_plan: string
  plan: string
  plan_status: string
  storage_quota_bytes: number
  storage_used_bytes: number
  storage_usage_percent: number
  billing_period?: string
  paddle_customer_id?: string
  paddle_subscription_id?: string
  paddle_current_period_end?: string
  openrouter_credit_period_end?: string
  openrouter_monthly_limit_microusd: number
  openrouter_used_microusd: number
  openrouter_remaining_microusd: number
  openrouter_provider_available?: boolean
  openrouter_provider_error?: string
  openrouter_provider_limit_microusd?: number
  openrouter_provider_usage_microusd?: number
}

export interface InvestigationData {
  user?: Record<string, unknown>
  tenant?: Record<string, unknown>
  entitlement?: TenantEntitlement
  sessions?: unknown[]
  knowledge_bases?: unknown[]
  documents?: unknown[]
  processing?: unknown[]
  runtime?: Record<string, unknown>
  audit?: unknown[]
  observability?: Record<string, unknown>
  [key: string]: unknown
}
