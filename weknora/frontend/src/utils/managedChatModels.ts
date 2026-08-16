export const MANAGED_CHAT_MODEL_IDS = [
  'builtin-deepseek-v4-flash',
  'builtin-deepseek-v4-pro',
] as const

export const DEFAULT_MANAGED_CHAT_MODEL_ID = 'builtin-deepseek-v4-flash'

type ChatModelLike = { id?: string | null }

/** Product chat deliberately exposes only the two platform-managed DeepSeek models. */
export function filterManagedChatModels<T extends ChatModelLike>(models: readonly T[]): T[] {
  return MANAGED_CHAT_MODEL_IDS.flatMap((id) => {
    const model = models.find((candidate) => candidate.id === id)
    return model ? [model] : []
  })
}

/** Keep a valid user choice; otherwise use Flash, then the first actually available option. */
export function resolveManagedChatModelId<T extends ChatModelLike>(
  candidateId: string | null | undefined,
  availableModels: readonly T[],
): string {
  if (candidateId && availableModels.some((model) => model.id === candidateId)) {
    return candidateId
  }
  if (availableModels.some((model) => model.id === DEFAULT_MANAGED_CHAT_MODEL_ID)) {
    return DEFAULT_MANAGED_CHAT_MODEL_ID
  }
  return availableModels[0]?.id || ''
}
