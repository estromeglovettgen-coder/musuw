import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listKnowledgeBases, getKnowledgeBaseById } from '@/api/knowledge-base'
import {
  listAgents,
  type CustomAgent,
} from '@/api/agent'
import {
  getConsumerSceneOptions,
  listModels,
  type ConsumerScene,
  type ConsumerSceneOptionsResponse,
  type ModelConfig,
} from '@/api/model'
import { getCurrentEntitlement, type ConsumerPlan } from '@/api/entitlement'
import { listWebSearchProviders, type WebSearchProviderEntity } from '@/api/web-search-provider'
import { useOrganizationStore } from '@/stores/organization'
import { filterChatModelsForPlan } from '@/utils/managedChatModels'

/** 空间级资源缓存 TTL */
const CACHE_TTL_MS = 60_000

type ResourceKey = 'knowledgeBases' | 'agents' | 'models' | 'webSearchProviders'

export type ListCreatorFilter = 'all' | 'mine' | 'others'

function isKbModelReady(kb: any): boolean {
  if (!kb.summary_model_id || kb.summary_model_id === '') return false
  const strategy = kb.indexing_strategy
  const needsEmbedding = !strategy || strategy.vector_enabled || strategy.keyword_enabled
  if (needsEmbedding && (!kb.embedding_model_id || kb.embedding_model_id === '')) return false
  return true
}

/**
 * Frontend-only exposure hint. Security never depends on this value: the Lite
 * server gate is authoritative. This prevents the browser from intentionally
 * calling management endpoints that the server would reject anyway.
 */
function isLiteProductMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('weknora_lite_mode') === 'true'
  } catch {
    return false
  }
}

export const useChatResourcesStore = defineStore('chatResources', () => {
  const rawKnowledgeBases = ref<any[]>([])
  const agents = ref<CustomAgent[]>([])
  const disabledOwnAgentIds = ref<string[]>([])
  const allModels = ref<ModelConfig[]>([])
  const consumerPlan = ref<ConsumerPlan | null>(null)
  const consumerSceneOptions = ref<Partial<Record<ConsumerScene, ConsumerSceneOptionsResponse>>>({})
  const webSearchProviders = ref<WebSearchProviderEntity[]>([])

  const loadedAt = ref<Partial<Record<ResourceKey, number>>>({})
  const inflight = new Map<ResourceKey, Promise<void>>()
  // creator==='all' 的列表请求单独去重：首屏 platform 预取与对话页 onMounted
  // 可能并发触发，缓存尚未写入时不去重会重复打 listKnowledgeBases / listAgents。
  let kbAllInflight: Promise<any[]> | null = null
  let agentsAllInflight: Promise<{ data: CustomAgent[]; disabled_own_agent_ids: string[] }> | null = null
  // 代际计数：force 与非 force 并发时句柄会被后来者覆盖，旧请求结束时凭此判断
  // 自己是否仍是最新的那次，避免误清正在飞行的句柄。
  let kbAllGen = 0
  let agentsAllGen = 0

  const agentKbCache = new Map<string, { at: number; data: any[] }>()
  const agentKbInflight = new Map<string, Promise<any[]>>()
  const kbDetailCache = new Map<string, { at: number; data: any }>()
  const kbDetailInflight = new Map<string, Promise<any | null>>()
  const sceneOptionsLoadedAt = new Map<ConsumerScene, number>()
  const sceneOptionsInflight = new Map<ConsumerScene, Promise<void>>()

  const validKnowledgeBases = computed(() => rawKnowledgeBases.value.filter(isKbModelReady))
  const chatModels = computed(() => {
    const models = allModels.value.filter((m) => m.type === 'KnowledgeQA')
    return consumerPlan.value ? filterChatModelsForPlan(models, consumerPlan.value) : models
  })

  function isFresh(key: ResourceKey): boolean {
    const at = loadedAt.value[key]
    return !!at && Date.now() - at < CACHE_TTL_MS
  }

  async function runOnce(key: ResourceKey, force: boolean, loader: () => Promise<void>): Promise<void> {
    if (!force && isFresh(key)) return
    const existing = inflight.get(key)
    if (existing) return existing
    const p = loader().finally(() => {
      inflight.delete(key)
    })
    inflight.set(key, p)
    return p
  }

  /**
   * 知识库列表（支持 creator 筛选）。creator=all 时写入缓存供对话页复用。
   */
  async function fetchKnowledgeBasesForList(
    params?: { creator?: ListCreatorFilter },
    force = false,
  ): Promise<any[]> {
    const creator = params?.creator ?? 'all'
    // 带 creator 过滤的列表是列表页专用、不进缓存，直接透传请求。
    if (creator !== 'all') {
      const res: any = await listKnowledgeBases({ creator })
      return res?.data && Array.isArray(res.data) ? res.data : []
    }

    if (!force && isFresh('knowledgeBases')) {
      return rawKnowledgeBases.value
    }
    if (!force && kbAllInflight) return kbAllInflight

    const gen = ++kbAllGen
    kbAllInflight = (async () => {
      try {
        const res: any = await listKnowledgeBases()
        const data = res?.data && Array.isArray(res.data) ? res.data : []
        rawKnowledgeBases.value = data
        loadedAt.value.knowledgeBases = Date.now()
        const orgStore = useOrganizationStore()
        await orgStore.fetchSharedKnowledgeBases({ force })
        return data
      } finally {
        if (kbAllGen === gen) kbAllInflight = null
      }
    })()
    return kbAllInflight
  }

  async function ensureKnowledgeBases(force = false): Promise<void> {
    await fetchKnowledgeBasesForList({ creator: 'all' }, force)
  }

  /**
   * 智能体列表（支持 creator 筛选）。creator=all 时写入缓存。
   * Lite 使用原生租户 Agent 列表，但不加载跨租户共享 Agent。
   */
  async function fetchAgentsForList(
    params?: { creator?: ListCreatorFilter },
    force = false,
  ): Promise<{ data: CustomAgent[]; disabled_own_agent_ids: string[] }> {
    const creator = params?.creator ?? 'all'

    if (isLiteProductMode()) {
      if (creator === 'all' && !force && isFresh('agents')) {
        return { data: agents.value, disabled_own_agent_ids: [] }
      }
      const response = await listAgents({ creator }) as {
        data?: CustomAgent[]
        disabled_own_agent_ids?: string[]
      }
      const data = response.data || []
      const disabled = response.disabled_own_agent_ids || []
      if (creator === 'all') {
        agents.value = data
        disabledOwnAgentIds.value = disabled
        loadedAt.value.agents = Date.now()
      }
      return { data, disabled_own_agent_ids: disabled }
    }

    const orgStore = useOrganizationStore()

    // 带 creator 过滤的列表不进缓存，但仍需刷新共享智能体（与全量路径保持一致）。
    if (creator !== 'all') {
      const [agentsRes] = await Promise.all([
        listAgents({ creator }),
        orgStore.fetchSharedAgents({ force }),
      ])
      const res = agentsRes as { data?: CustomAgent[]; disabled_own_agent_ids?: string[] }
      return { data: res.data || [], disabled_own_agent_ids: res.disabled_own_agent_ids || [] }
    }

    if (!force && isFresh('agents')) {
      return { data: agents.value, disabled_own_agent_ids: disabledOwnAgentIds.value }
    }
    if (!force && agentsAllInflight) return agentsAllInflight

    const gen = ++agentsAllGen
    agentsAllInflight = (async () => {
      try {
        const [agentsRes] = await Promise.all([
          listAgents(),
          orgStore.fetchSharedAgents({ force }),
        ])
        const res = agentsRes as { data?: CustomAgent[]; disabled_own_agent_ids?: string[] }
        const data = res.data || []
        agents.value = data
        disabledOwnAgentIds.value = res.disabled_own_agent_ids || []
        loadedAt.value.agents = Date.now()
        return { data, disabled_own_agent_ids: res.disabled_own_agent_ids || [] }
      } finally {
        if (agentsAllGen === gen) agentsAllInflight = null
      }
    })()
    return agentsAllInflight
  }

  async function ensureAgents(force = false): Promise<void> {
    await fetchAgentsForList({ creator: 'all' }, force)
  }

  async function ensureModels(force = false): Promise<void> {
    return runOnce('models', force, async () => {
      const liteMode = isLiteProductMode()
      const [models, entitlement] = await Promise.all([
        listModels(),
        liteMode ? getCurrentEntitlement().catch(() => null) : Promise.resolve(null),
      ])
      allModels.value = Array.isArray(models) ? models : []
      // A missing entitlement response must not broaden a Lite chat catalog.
      consumerPlan.value = liteMode ? (entitlement?.data?.plan ?? 'free') : null
      loadedAt.value.models = Date.now()
    })
  }

  async function ensureConsumerSceneOptions(scene: ConsumerScene, force = false): Promise<void> {
    const loadedAt = sceneOptionsLoadedAt.get(scene)
    if (!force && loadedAt && Date.now() - loadedAt < CACHE_TTL_MS) return
    const existing = sceneOptionsInflight.get(scene)
    if (existing) return existing

    const request = getConsumerSceneOptions(scene).then((response) => {
      consumerSceneOptions.value[scene] = response
      sceneOptionsLoadedAt.set(scene, Date.now())
    }).finally(() => {
      sceneOptionsInflight.delete(scene)
    })
    sceneOptionsInflight.set(scene, request)
    return request
  }

  function isConsumerSceneOptionsFresh(scene: ConsumerScene): boolean {
    const at = sceneOptionsLoadedAt.get(scene)
    return !!at && Date.now() - at < CACHE_TTL_MS
  }

  function invalidateConsumerSceneOptions(scene?: ConsumerScene) {
    if (scene) {
      delete consumerSceneOptions.value[scene]
      sceneOptionsLoadedAt.delete(scene)
      sceneOptionsInflight.delete(scene)
      return
    }
    consumerSceneOptions.value = {}
    sceneOptionsLoadedAt.clear()
    sceneOptionsInflight.clear()
  }

  /** @deprecated 使用 ensureModels；保留别名供对话输入栏调用 */
  async function ensureChatModels(force = false): Promise<void> {
    return ensureModels(force)
  }

  async function ensureWebSearchProviders(force = false): Promise<void> {
    if (isLiteProductMode()) {
      webSearchProviders.value = []
      loadedAt.value.webSearchProviders = Date.now()
      return
    }
    return runOnce('webSearchProviders', force, async () => {
      const response = await listWebSearchProviders()
      const providers = (response as any)?.data
      webSearchProviders.value = Array.isArray(providers) ? providers : []
      loadedAt.value.webSearchProviders = Date.now()
    })
  }

  /** 并行预取对话输入栏及列表页常用的空间级资源 */
  async function prefetchChatInput(force = false): Promise<void> {
    if (isLiteProductMode()) {
      await Promise.all([
        ensureKnowledgeBases(force),
        ensureAgents(force),
        ensureModels(force),
      ])
      return
    }

    const orgStore = useOrganizationStore()
    await Promise.all([
      ensureKnowledgeBases(force),
      ensureAgents(force),
      ensureModels(force),
      ensureWebSearchProviders(force),
      orgStore.fetchOrganizations({ force }),
    ])
  }

  async function ensureAgentKnowledgeBases(agentId: string, sourceTenantId?: string, force = false): Promise<any[]> {
    const cacheKey = `${agentId}:${sourceTenantId || 'current'}`
    const cached = agentKbCache.get(cacheKey)
    if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data
    }
    const existing = agentKbInflight.get(cacheKey)
    if (existing) return existing

    const p = (async () => {
      try {
        const res: any = await listKnowledgeBases({
          agent_id: agentId,
          agent_source_tenant_id: sourceTenantId,
        })
        const list = res?.data && Array.isArray(res.data) ? res.data : []
        agentKbCache.set(cacheKey, { at: Date.now(), data: list })
        return list
      } finally {
        agentKbInflight.delete(cacheKey)
      }
    })()
    agentKbInflight.set(cacheKey, p)
    return p
  }

  /** 单个知识库详情（侧栏 + 详情页共用，去重并发请求） */
  async function fetchKnowledgeBaseById(kbId: string, force = false): Promise<any | null> {
    if (!kbId) return null
    const cached = kbDetailCache.get(kbId)
    if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data
    }
    const existing = kbDetailInflight.get(kbId)
    if (existing) return existing

    const p = (async () => {
      try {
        const res: any = await getKnowledgeBaseById(kbId)
        const data = res?.data ?? null
        if (data) {
          kbDetailCache.set(kbId, { at: Date.now(), data })
        }
        return data
      } catch {
        return null
      } finally {
        kbDetailInflight.delete(kbId)
      }
    })()
    kbDetailInflight.set(kbId, p)
    return p
  }

  function invalidateKnowledgeBaseDetail(kbId?: string) {
    if (kbId) {
      kbDetailCache.delete(kbId)
      kbDetailInflight.delete(kbId)
    } else {
      kbDetailCache.clear()
      kbDetailInflight.clear()
    }
  }

  function invalidate(...keys: ResourceKey[]) {
    if (keys.length === 0) {
      loadedAt.value = {}
      rawKnowledgeBases.value = []
      agents.value = []
      disabledOwnAgentIds.value = []
      allModels.value = []
      consumerPlan.value = null
      invalidateConsumerSceneOptions()
      webSearchProviders.value = []
      agentKbCache.clear()
      // 同时丢弃所有 inflight 句柄，否则失效后仍在飞行的请求会把旧数据写回缓存。
      inflight.clear()
      agentKbInflight.clear()
      kbAllInflight = null
      agentsAllInflight = null
      invalidateKnowledgeBaseDetail()
      return
    }
    keys.forEach((k) => {
      delete loadedAt.value[k]
      inflight.delete(k)
    })
    if (keys.includes('models')) invalidateConsumerSceneOptions()
    if (keys.includes('knowledgeBases')) {
      agentKbCache.clear()
      agentKbInflight.clear()
      kbAllInflight = null
      invalidateKnowledgeBaseDetail()
    }
    if (keys.includes('agents')) {
      agentsAllInflight = null
    }
  }

  return {
    rawKnowledgeBases,
    validKnowledgeBases,
    agents,
    disabledOwnAgentIds,
    allModels,
    chatModels,
    consumerSceneOptions,
    webSearchProviders,
    isFresh,
    fetchKnowledgeBasesForList,
    fetchAgentsForList,
    ensureKnowledgeBases,
    ensureAgents,
    ensureModels,
    ensureChatModels,
    ensureConsumerSceneOptions,
    isConsumerSceneOptionsFresh,
    ensureWebSearchProviders,
    ensureAgentKnowledgeBases,
    prefetchChatInput,
    fetchKnowledgeBaseById,
    invalidateKnowledgeBaseDetail,
    invalidate,
    invalidateConsumerSceneOptions,
  }
})
