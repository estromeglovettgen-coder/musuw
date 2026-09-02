import i18n from '../i18n'

const CONSUMER_PLAN_ERROR_KEYS: Record<string, string> = {
  'Free plan supports one knowledge base; upgrade to create another': 'entitlement.freeKnowledgeBaseLimit',
  'Free plan supports ten documents per knowledge base; upgrade to add more': 'entitlement.freeDocumentLimit',
  'Free plan does not support video upload': 'entitlement.freeVideoLimit',
  'Free plan does not support URL import': 'entitlement.freeUrlImport',
}

export function localizeConsumerPlanError(message?: string): string | undefined {
  const key = message ? CONSUMER_PLAN_ERROR_KEYS[message] : undefined
  return key ? String(i18n.global.t(key)) : message
}
