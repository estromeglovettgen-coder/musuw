export const DEFAULT_CHAT_MODEL_ID = 'builtin-deepseek-v4-flash'

type ChatModelLike = {
  id?: string | null
  is_default?: boolean
  is_builtin?: boolean
}

/** Keep a valid user choice, then prefer a tenant default over the shared platform fallback. */
export function resolveChatModelId<T extends ChatModelLike>(
  candidateId: string | null | undefined,
  availableModels: readonly T[],
): string {
  if (candidateId && availableModels.some((model) => model.id === candidateId)) {
    return candidateId
  }

  const tenantDefault = availableModels.find((model) => model.is_default && !model.is_builtin)
  if (tenantDefault?.id) return tenantDefault.id

  const platformDefault = availableModels.find((model) => model.is_default)
  if (platformDefault?.id) return platformDefault.id

  if (availableModels.some((model) => model.id === DEFAULT_CHAT_MODEL_ID)) {
    return DEFAULT_CHAT_MODEL_ID
  }
  return availableModels[0]?.id || ''
}
