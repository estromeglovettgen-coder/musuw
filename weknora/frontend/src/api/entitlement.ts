import { get } from '@/utils/request'

export type ConsumerPlan = 'free' | 'plus' | 'pro' | 'max'
export type OpenRouterCreditsStatus = 'available' | 'unavailable' | 'unprovisioned'

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
  billing: {
    configured: boolean
    environment?: string
  }
}

export async function getCurrentEntitlement(): Promise<EntitlementResponse> {
  return get('/api/v1/entitlements/current') as unknown as Promise<EntitlementResponse>
}
