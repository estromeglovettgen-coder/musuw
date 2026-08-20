import { get, post } from '@/utils/request'

export type ConsumerPlan = 'free' | 'plus' | 'pro' | 'max'
export type OpenRouterCreditsStatus = 'available' | 'unavailable' | 'unprovisioned'
export type PaidConsumerPlan = Exclude<ConsumerPlan, 'free'>
export type BillingPeriod = 'monthly' | 'yearly'

export interface PaddleCheckoutOption {
  price_id: string
  checkout_binding: string
}

export interface PaddleBillingConfig {
  configured: boolean
  portal_available: boolean
  environment?: 'sandbox' | 'live'
  client_token?: string
  tenant_id?: string
  prices?: Partial<Record<PaidConsumerPlan, Partial<Record<BillingPeriod, PaddleCheckoutOption>>>>
}

export interface ConsumerEntitlement {
  plan: ConsumerPlan
  plan_status: string
  storage_bytes: number
  storage_used: number
  monthly_openrouter_microusd: number
  openrouter_used_microusd: number
  openrouter_remaining_microusd: number
  openrouter_usage_month: string
  openrouter_credits_status: OpenRouterCreditsStatus
  max_knowledge_bases: number
  max_documents_per_kb: number
  video_upload: boolean
}

export interface EntitlementResponse {
  data: ConsumerEntitlement
  billing: PaddleBillingConfig
}

export async function getCurrentEntitlement(): Promise<EntitlementResponse> {
  return get('/api/v1/entitlements/current') as unknown as Promise<EntitlementResponse>
}

export async function createPaddlePortalSession(): Promise<{ authorization_url: string }> {
  return post('/api/v1/billing/paddle/portal-session') as Promise<{ authorization_url: string }>
}
