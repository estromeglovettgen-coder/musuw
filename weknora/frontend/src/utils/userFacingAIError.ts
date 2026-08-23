const PROVIDER_INTERNAL_ERROR =
  /OPENROUTER_[A-Z_]*|openrouter\.ai|create chat completion|LLM call failed/i

export const BILLING_RENEWAL_PENDING_CODE = 'billing_renewal_pending'

/**
 * Convert a backend error into text that is safe to show end users. Stable
 * machine codes take precedence over message text so billing state remains
 * honest even when a provider wraps or changes its wording.
 */
export function userFacingAIError(
  message: unknown,
  fallback: string,
  errorCode?: unknown,
  billingFallback?: string,
): string {
  if (errorCode === BILLING_RENEWAL_PENDING_CODE) {
    return billingFallback || fallback
  }
  const raw = String(message ?? '').trim()
  if (!raw || PROVIDER_INTERNAL_ERROR.test(raw)) return fallback
  return raw
}
