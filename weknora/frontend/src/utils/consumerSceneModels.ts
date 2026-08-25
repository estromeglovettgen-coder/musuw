import type { ConsumerScene, ConsumerSceneOption, ModelConfig } from '@/api/model'
export type { ConsumerSceneOption } from '@/api/model'

export function resolveComposerConsumerScene(
  hasExplicitRetrievalScope: boolean,
  webSearchEnabled: boolean,
  hasBuiltinAllKnowledgeScope: boolean,
): ConsumerScene {
  return hasExplicitRetrievalScope || webSearchEnabled || hasBuiltinAllKnowledgeScope ? 'rag' : 'chat'
}

export function filterConsumerModelCatalog(models: readonly ModelConfig[]): ModelConfig[] {
  return models.filter((model) => (
    model.type === 'KnowledgeQA'
    && model.is_builtin === true
    && model.status === 'active'
    && model.parameters?.provider?.trim().toLowerCase() === 'openrouter'
  ))
}

export function normalizeConsumerModelIds(
  ids: readonly unknown[],
  catalog: readonly ModelConfig[],
): string[] {
  const allowed = new Set(filterConsumerModelCatalog(catalog).map((model) => model.id).filter(Boolean))
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of ids) {
    if (typeof value !== 'string') continue
    const id = value.trim()
    if (!id || seen.has(id) || !allowed.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  return normalized
}

export function resolveConsumerSceneCandidate(
  options: readonly ConsumerSceneOption[],
  candidateId?: string | null,
  effectiveModelId?: string | null,
): string {
  const selectable = new Set(
    options.filter((option) => option.selectable && !option.locked).map((option) => option.model_id),
  )
  if (candidateId && selectable.has(candidateId)) return candidateId
  if (effectiveModelId && selectable.has(effectiveModelId)) return effectiveModelId
  return options.find((option) => option.selectable && !option.locked)?.model_id || ''
}
