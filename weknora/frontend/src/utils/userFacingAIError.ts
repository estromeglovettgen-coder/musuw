const PROVIDER_INTERNAL_ERROR =
  /OPENROUTER_[A-Z_]*|openrouter\.ai|create chat completion|LLM call failed/i

export function userFacingAIError(message: unknown, fallback: string): string {
  const raw = String(message ?? '').trim()
  if (!raw || PROVIDER_INTERNAL_ERROR.test(raw)) return fallback
  return raw
}
