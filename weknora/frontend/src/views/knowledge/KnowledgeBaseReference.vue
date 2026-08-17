<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import DocContent from '@/components/doc-content.vue'
import KBSwitcherDropdown from '@/components/KBSwitcherDropdown.vue'
import ReferenceIcon from '@/components/ReferenceIcon.vue'
import useKnowledgeBase from '@/hooks/useKnowledgeBase'
import { useAuthStore } from '@/stores/auth'
import { useChatResourcesStore } from '@/stores/chatResources'
import { useEditorResourcesStore } from '@/stores/editorResources'
import { useOrganizationStore } from '@/stores/organization'
import { useUIStore } from '@/stores/ui'
import {
  batchDeleteKnowledge,
  batchReparseKnowledge,
  cancelKnowledgeParse,
  createKnowledgeFromURL,
  getKnowledgeSpans,
  listKnowledgeFolders,
  listKnowledgeTags,
  moveKnowledge,
  moveKnowledgeToFolder,
  getKnowledgeMoveProgress,
  listMoveTargets,
  renameKnowledgeFolder,
  reparseKnowledge,
  updateKnowledgeTagBatch,
  uploadKnowledgeFile,
  type KnowledgeFolderTree,
} from '@/api/knowledge-base'
import { getWikiStats } from '@/api/wiki'
import { knowledgeSpansPayloadHasTrace } from '@/utils/knowledgeTrace'
import type { ParserEngineInfo } from '@/api/system'
import {
  buildUploadFileName,
  canMoveFolderTo,
  childFolders,
  folderBreadcrumbs as buildFolderBreadcrumbs,
  folderPathExists as folderExistsInTree,
  isFilteringDocuments,
  ROOT_FOLDER_PATH,
} from './folderTree'
import { isKnowledgeParseInFlight } from './wikiStatusRefresh'
import DocumentBatchBar from './components/DocumentBatchBar.vue'
import DocumentCardView from './components/DocumentCardView.vue'
import DocumentListView from './components/DocumentListView.vue'
import FAQEntryManager from './components/FAQEntryManager.vue'
import KbFolderTree from './components/KbFolderTree.vue'
import KbTagManageDrawer from './components/KbTagManageDrawer.vue'
import KbUploadSourceDropdown from './components/KbUploadSourceDropdown.vue'
import TagEditDialog from './components/TagEditDialog.vue'
import WikiBrowser from './wiki/WikiBrowser.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const orgStore = useOrganizationStore()
const uiStore = useUIStore()
const chatResources = useChatResourcesStore()
const editorResources = useEditorResourcesStore()

const kbId = computed(() => String((route.params as any).kbId || ''))
const kbInfo = ref<any>(null)
const knowledgeList = ref<Array<{ id: string; name: string; type?: string }>>([])
const kbLoading = ref(false)
const docListLoading = ref(true)
const isFAQ = computed(() => (kbInfo.value?.type || '') === 'faq')
const isWiki = computed(() => Boolean(kbInfo.value?.indexing_strategy?.wiki_enabled))
const activeKbTab = ref<'documents' | 'wiki' | 'graph'>((route.query.tab as any) || 'documents')
const wikiStats = ref<any>(null)

const { cardList, total, details, getKnowled, delKnowledge, getCardDetails, getfDetails } = useKnowledgeBase(kbId.value)
const isCardDetails = ref(false)
const docContentRef = ref<any>(null)
const uploadSourceRef = ref<InstanceType<typeof KbUploadSourceDropdown> | null>(null)

const isOwner = computed(() => {
  const creatorId = kbInfo.value?.creator_id || ''
  return Boolean(creatorId && creatorId === authStore.user?.id)
})
const currentSharedKb = computed(() => orgStore.sharedKnowledgeBases.find((s) => s.knowledge_base?.id === kbId.value) ?? null)
const isViaShare = computed(() => Boolean(currentSharedKb.value))
const canEdit = computed(() => {
  if (isViaShare.value) return orgStore.canEditKB(kbId.value, false)
  if (isOwner.value) return true
  if (authStore.hasRole('admin')) return true
  return orgStore.canEditKB(kbId.value, false)
})
const canMutateKnowledge = computed(() => {
  if (!canEdit.value) return false
  if (isViaShare.value || isOwner.value || authStore.hasRole('admin')) return true
  return authStore.hasRole('contributor')
})
const effectiveKBPermission = computed(() => orgStore.getKBPermission(kbId.value) || kbInfo.value?.my_permission || '')
const canDownloadKnowledge = computed(() => {
  if (!authStore.hasRole('contributor')) return false
  const p = effectiveKBPermission.value
  return !p || p === 'owner' || p === 'admin' || p === 'editor'
})

watch(activeKbTab, (tab) => {
  const query = { ...route.query }
  if (tab === 'documents') delete query.tab
  else query.tab = tab
  void router.replace({ query })
})
const refreshWikiStats = async () => {
  if (!kbId.value || !isWiki.value) {
    wikiStats.value = null
    return
  }
  try {
    const res: any = await getWikiStats(kbId.value)
    wikiStats.value = res?.data || res || null
  } catch {
    wikiStats.value = null
  }
}
const wikiCount = computed(() => Number(wikiStats.value?.total_pages || 0))
const graphCount = computed(() => Number(wikiStats.value?.total_links || 0))
const wikiIsIndexing = computed(() => Boolean(wikiStats.value?.is_active || wikiStats.value?.pending_tasks))

const selectedTagIds = ref<string[]>([])
const tagFilterPanelVisible = ref(false)
const tagList = ref<any[]>([])
const tagSearchQuery = ref('')
const tagLoading = ref(false)
const docSearchKeyword = ref('')
const selectedFileType = ref('')
const selectedParseStatus = ref('')
const selectedSource = ref('')
const updatedTimeRange = ref<string[]>([])
const disableFutureDate = { after: new Date(new Date().setHours(23, 59, 59, 999)) }
const fileTypeOptions = computed(() => [
  { label: t('knowledgeBase.allFileTypes'), value: '' },
  ...['pdf','docx','doc','pptx','ppt','epub','mhtml','txt','md','png','jpeg','jpg','wav','mp3','m4a','flac','ogg'].map(v => ({ label: v.toUpperCase(), value: v })),
  { label: 'URL', value: 'url' },
  { label: t('knowledgeBase.typeManual'), value: 'manual' },
])
const parseStatusOptions = computed(() => [
  { label: t('knowledgeBase.allParseStatuses'), value: '' },
  { label: t('knowledgeBase.parseStatusPending'), value: 'pending' },
  { label: t('knowledgeBase.parseStatusProcessing'), value: 'processing' },
  { label: t('knowledgeBase.parseStatusFinalizing'), value: 'finalizing' },
  { label: t('knowledgeBase.parseStatusCompleted'), value: 'completed' },
  { label: t('knowledgeBase.parseStatusFailed'), value: 'failed' },
  { label: t('knowledgeBase.parseStatusCancelled'), value: 'cancelled' },
  { label: t('knowledgeBase.parseStatusDraft'), value: 'draft' },
])
const sourceOptions = computed(() => [
  { label: t('knowledgeBase.allSources'), value: '' },
  { label: t('knowledgeBase.sourceUpload'), value: 'web' },
  { label: t('knowledgeBase.sourceUrl'), value: 'url' },
  { label: t('knowledgeBase.sourceManual'), value: 'manual' },
  { label: t('knowledgeBase.sourceApi'), value: 'api' },
  { label: t('knowledgeBase.sourceBrowserExtension'), value: 'browser_extension' },
  { label: t('knowledgeBase.channelFeishu'), value: 'feishu' },
  { label: t('knowledgeBase.channelNotion'), value: 'notion' },
  { label: t('knowledgeBase.channelWechat'), value: 'wechat' },
  { label: t('knowledgeBase.channelWecom'), value: 'wecom' },
  { label: t('knowledgeBase.channelDingtalk'), value: 'dingtalk' },
  { label: t('knowledgeBase.channelSlack'), value: 'slack' },
])

const FOLDER_TREE_COLLAPSED_KEY = 'weknora.kbFolderTreeCollapsed'
const readCollapsed = () => {
  try { return localStorage.getItem(FOLDER_TREE_COLLAPSED_KEY) === 'true' } catch { return false }
}
const folderTree = ref<KnowledgeFolderTree | null>(null)
const folderTreeLoading = ref(false)
const folderTreeCollapsed = ref(readCollapsed())
const selectedFolderPath = ref(ROOT_FOLDER_PATH)
const hasFolders = computed(() => (folderTree.value?.folders?.length ?? 0) > 0)
const showFolderTree = computed(() => !isFAQ.value && hasFolders.value)
const isFiltering = computed(() => isFilteringDocuments({
  keyword: docSearchKeyword.value,
  tagIds: selectedTagIds.value,
  fileType: selectedFileType.value,
  parseStatus: selectedParseStatus.value,
  source: selectedSource.value,
  timeRange: updatedTimeRange.value,
}))
const folderBreadcrumbs = computed(() => buildFolderBreadcrumbs(selectedFolderPath.value))
const currentChildFolders = computed(() => {
  if (isFiltering.value) return []
  if (showFolderTree.value && !folderTreeCollapsed.value) return []
  return childFolders(folderTree.value, selectedFolderPath.value)
})
const showDocumentFolderPath = computed(() => hasFolders.value && isFiltering.value)
const folderOptions = computed(() => {
  const out: Array<{ path: string; name: string; depth: number }> = []
  const walk = (nodes: any[], depth: number) => {
    for (const node of nodes || []) {
      out.push({ path: node.path, name: node.name, depth })
      walk(node.children || [], depth + 1)
    }
  }
  walk(folderTree.value?.folders || [], 0)
  return out
})
const handleFolderTreeCollapsedChange = (value: boolean) => {
  folderTreeCollapsed.value = value
  try { localStorage.setItem(FOLDER_TREE_COLLAPSED_KEY, String(value)) } catch { /* ignore */ }
}
const handleFolderSelect = (path: string) => {
  if (selectedFolderPath.value !== path) selectedFolderPath.value = path
}
const loadFolderTree = async () => {
  if (!kbId.value || isFAQ.value) return
  folderTreeLoading.value = true
  try {
    const res: any = await listKnowledgeFolders(kbId.value)
    folderTree.value = res?.data || null
    if (!folderExistsInTree(folderTree.value?.folders || [], selectedFolderPath.value)) selectedFolderPath.value = ROOT_FOLDER_PATH
  } catch {
    folderTree.value = null
  } finally {
    folderTreeLoading.value = false
  }
}
const handleFolderRename = async ({ from, to }: { from: string; to: string }) => {
  if (!canMoveFolderTo(from, to)) return
  try {
    await renameKnowledgeFolder(kbId.value, from, to)
    if (selectedFolderPath.value === from) selectedFolderPath.value = to
    await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
  } catch (e: any) {
    MessagePlugin.error(e?.message || t('knowledgeBase.folderTree.renameFailed'))
  }
}

const filterParams = computed(() => {
  const [start, end] = updatedTimeRange.value || []
  return {
    tag_ids: selectedTagIds.value.length ? selectedTagIds.value.join(',') : undefined,
    keyword: docSearchKeyword.value.trim() || undefined,
    file_type: selectedFileType.value || undefined,
    parse_status: selectedParseStatus.value || undefined,
    source: selectedSource.value || undefined,
    start_time: start ? `${start} 00:00:00` : undefined,
    end_time: end ? `${end} 23:59:59` : undefined,
    folder_path: selectedFolderPath.value,
    folder_recursive: isFiltering.value,
  }
})
const parserEngines = computed<ParserEngineInfo[]>(() => editorResources.parserEngines)
const supportedFileTypes = computed<Set<string>>(() => {
  const available = new Set<string>()
  for (const engine of parserEngines.value || []) {
    if (engine.Available === false) continue
    for (const ft of engine.FileTypes || []) available.add(ft)
  }
  return available
})
const acceptFileTypes = computed(() => [...supportedFileTypes.value].map(x => `.${x}`).join(','))

const loadKnowledgeFiles = async () => {
  if (!kbId.value || isFAQ.value) return
  docListLoading.value = true
  try {
    await getKnowled({ page: 1, page_size: 100, ...filterParams.value }, kbId.value)
  } finally {
    docListLoading.value = false
  }
}
const loadTags = async () => {
  if (!kbId.value) return
  tagLoading.value = true
  try {
    const res: any = await listKnowledgeTags(kbId.value, {
      page: 1,
      page_size: 100,
      keyword: tagSearchQuery.value || undefined,
    })
    const raw = res?.data?.data || res?.data || []
    tagList.value = Array.isArray(raw) ? raw.map((x: any) => ({ ...x, id: String(x.id) })) : []
  } catch {
    tagList.value = []
  } finally {
    tagLoading.value = false
  }
}
const loadKnowledgeList = async () => {
  await chatResources.ensureKnowledgeBases()
  const own = chatResources.rawKnowledgeBases.map((x: any) => ({ id: String(x.id), name: x.name, type: x.type || 'document' }))
  const shared = (orgStore.sharedKnowledgeBases || [])
    .filter(x => x.knowledge_base)
    .map(x => ({ id: String(x.knowledge_base.id), name: x.knowledge_base.name, type: x.knowledge_base.type || 'document' }))
  const ids = new Set(own.map(x => x.id))
  knowledgeList.value = [...own, ...shared.filter(x => !ids.has(x.id))]
}
const loadPage = async () => {
  if (!kbId.value) return
  kbLoading.value = true
  try {
    kbInfo.value = await chatResources.fetchKnowledgeBaseById(kbId.value, true)
    await Promise.all([loadKnowledgeFiles(), loadFolderTree(), loadTags(), refreshWikiStats()])
  } finally {
    kbLoading.value = false
  }
}
let searchTimer: number | undefined
watch(docSearchKeyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(loadKnowledgeFiles, 250)
})
watch([selectedTagIds, selectedFileType, selectedParseStatus, selectedSource, updatedTimeRange], loadKnowledgeFiles, { deep: true })
watch(selectedFolderPath, loadKnowledgeFiles)
watch(tagSearchQuery, loadTags)
watch(kbId, async () => {
  selectedFolderPath.value = ROOT_FOLDER_PATH
  selectedTagIds.value = []
  await loadPage()
})

const uploadFiles = async (files: File[]) => {
  if (!files.length) return
  for (const file of files) {
    const payload: any = { file, tag_ids: selectedTagIds.value.length ? [...selectedTagIds.value] : undefined }
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    const fileName = rel
      ? buildUploadFileName(file, selectedFolderPath.value)
      : (selectedFolderPath.value ? `${selectedFolderPath.value}/${file.name}` : file.name)
    if (fileName) payload.fileName = fileName
    try {
      await uploadKnowledgeFile(kbId.value, payload)
    } catch (e: any) {
      MessagePlugin.error(e?.message || t('knowledgeBase.uploadFailed'))
    }
  }
  await Promise.all([loadKnowledgeFiles(), loadFolderTree(), refreshWikiStats()])
}
const importUrl = async (url: string) => {
  try {
    await createKnowledgeFromURL(kbId.value, { url, tag_ids: selectedTagIds.value.length ? [...selectedTagIds.value] : undefined })
    await loadKnowledgeFiles()
  } catch (e: any) {
    MessagePlugin.error(e?.message || t('knowledgeBase.urlImportFailed'))
  }
}
const createManual = () => {
  uiStore.openManualEditor({ mode: 'create', kbId: kbId.value, status: 'draft', onSuccess: () => void loadKnowledgeFiles() })
}

// ---------------------------------------------------------------------------
// Document actions. Existing child menus emit into these production APIs.
// ---------------------------------------------------------------------------
const traceAvailableById = reactive<Record<string, boolean>>({})
const probeTraceAvailable = async (item: any) => {
  if (!item?.id || Object.prototype.hasOwnProperty.call(traceAvailableById, item.id)) return
  if (isKnowledgeParseInFlight(item.parse_status)) {
    traceAvailableById[item.id] = true
    return
  }
  try {
    const res: any = await getKnowledgeSpans(item.id)
    traceAvailableById[item.id] = Boolean(res?.success && knowledgeSpansPayloadHasTrace(res.data))
  } catch { traceAvailableById[item.id] = false }
}
const openKnowledgeItem = (item: any) => {
  isCardDetails.value = true
  getCardDetails(item)
}
const closeDoc = () => { isCardDetails.value = false }
const getDoc = (page: number) => getfDetails(details.id, page)
const openTrace = (item: any) => {
  getCardDetails(item)
  details.id = item.id
  details.parse_status = item.parse_status
  nextTick(() => docContentRef.value?.openTimeline?.())
}
const deleteItem = async (item: any) => {
  const idx = cardList.value.findIndex((x: any) => x.id === item.id)
  if (idx < 0) return
  await delKnowledge(idx, item, () => void loadKnowledgeFiles())
  await loadFolderTree()
}
const editManual = (item: any) => {
  uiStore.openManualEditor({ mode: 'edit', kbId: item.knowledge_base_id || kbId.value, knowledgeId: item.id, onSuccess: () => void loadKnowledgeFiles() })
}
const reparseItem = async (item: any) => {
  if (isKnowledgeParseInFlight(item.parse_status)) {
    MessagePlugin.info(t('knowledgeBase.rebuildInProgress'))
    return
  }
  await reparseKnowledge(item.id)
  await loadKnowledgeFiles()
  await refreshWikiStats()
}
const cancelParseItem = async (item: any) => {
  await cancelKnowledgeParse(item.id)
  await loadKnowledgeFiles()
}

// Move-to-KB sub-flow expected by DocumentCardView.
const moveMenuMode = ref<'normal' | 'targets' | 'confirm'>('normal')
const moveKnowledgeId = ref('')
const moveTargetKbs = ref<any[]>([])
const moveTargetsLoading = ref(false)
const moveSelectedTargetId = ref('')
const moveSelectedTargetName = ref('')
const moveMode = ref<'reuse_vectors' | 'reparse'>('reuse_vectors')
const moveSubmitting = ref(false)
let movePollTimer: number | undefined
const handleMoveKnowledge = async (item: any) => {
  moveKnowledgeId.value = item.id
  moveMenuMode.value = 'targets'
  moveTargetsLoading.value = true
  try {
    const res: any = await listMoveTargets(kbId.value)
    moveTargetKbs.value = res?.data || []
  } finally { moveTargetsLoading.value = false }
}
const handleMoveSelectTarget = (kb: any) => {
  moveSelectedTargetId.value = kb.id
  moveSelectedTargetName.value = kb.name
  moveMode.value = 'reuse_vectors'
  moveMenuMode.value = 'confirm'
}
const handleMoveBack = () => { moveMenuMode.value = moveMenuMode.value === 'confirm' ? 'targets' : 'normal' }
const stopMovePoll = () => { if (movePollTimer) { window.clearInterval(movePollTimer); movePollTimer = undefined } }
const handleMoveConfirm = async () => {
  if (!moveSelectedTargetId.value) return
  moveSubmitting.value = true
  try {
    const res: any = await moveKnowledge({ knowledge_ids: [moveKnowledgeId.value], source_kb_id: kbId.value, target_kb_id: moveSelectedTargetId.value, mode: moveMode.value })
    const taskId = res?.data?.task_id
    moveMenuMode.value = 'normal'
    if (!taskId) {
      await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
      return
    }
    stopMovePoll()
    movePollTimer = window.setInterval(async () => {
      const p: any = await getKnowledgeMoveProgress(taskId)
      if (p?.data?.status === 'completed' || p?.data?.status === 'failed') {
        stopMovePoll()
        moveSubmitting.value = false
        await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
      }
    }, 2000)
  } catch (e: any) {
    MessagePlugin.error(e?.message || t('knowledgeBase.moveFailed'))
  } finally {
    if (!movePollTimer) moveSubmitting.value = false
  }
}
const moveKnowledgeIntoFolder = async (ids: string[], path: string) => {
  if (!ids.length) return
  await moveKnowledgeToFolder(kbId.value, ids, path)
  selectedIds.value.clear()
  await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
}

// Batch mode.
const viewMode = ref<'grid' | 'list'>('grid')
const selectedIds = ref<Set<string>>(new Set())
const batchMode = ref(false)
const batchDeleting = ref(false)
const batchReparsing = ref(false)
const batchTagging = ref(false)
const toggleRow = (id: string, checked: boolean) => checked ? selectedIds.value.add(id) : selectedIds.value.delete(id)
const toggleAll = (checked: boolean) => {
  if (!checked) return selectedIds.value.clear()
  for (const x of cardList.value) selectedIds.value.add(x.id)
}
const cancelBatch = () => { selectedIds.value.clear(); batchMode.value = false }
const deleteBatch = async () => {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  batchDeleting.value = true
  try { await batchDeleteKnowledge(kbId.value, ids); cancelBatch(); await loadKnowledgeFiles(); await loadFolderTree() }
  finally { batchDeleting.value = false }
}
const reparseBatch = async () => {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  batchReparsing.value = true
  try { await batchReparseKnowledge(kbId.value, ids); cancelBatch(); await loadKnowledgeFiles() }
  finally { batchReparsing.value = false }
}
const tagEditDialogVisible = ref(false)
const tagEditTarget = ref<any>(null)
const tagManageDrawerVisible = ref(false)
const openTagEditDialog = (item: any) => { tagEditTarget.value = item; tagEditDialogVisible.value = true }
const onTagEditConfirm = async (ids: string[]) => {
  if (!tagEditTarget.value) return
  await updateKnowledgeTagBatch({ updates: { [tagEditTarget.value.id]: ids } })
  await Promise.all([loadKnowledgeFiles(), loadTags()])
}
const batchTag = () => { batchTagging.value = false; MessagePlugin.info(t('knowledgeBase.batchTagHint') || '请从文档菜单逐项编辑标签') }

const handleCardAction = (action: string, item: any) => {
  if (action === 'edit') return editManual(item)
  if (action === 'view-trace') return openTrace(item)
  if (action === 'reparse') return void reparseItem(item)
  if (action === 'cancel-parse') return void cancelParseItem(item)
  if (action === 'move') return void handleMoveKnowledge(item)
  if (action === 'batch-manage') { selectedIds.value.clear(); batchMode.value = true; return }
  if (action === 'delete') return void deleteItem(item)
}

const handleNavigateToKbList = () => router.push('/platform/knowledge-bases')
const handleKnowledgeDropdownSelect = (id: string) => id && id !== kbId.value && router.push(`/platform/knowledge-bases/${id}`)
const onViewWikiInGraph = async (slug: string) => {
  await router.replace({ query: { ...route.query, tab: 'graph', slug } })
  activeKbTab.value = 'graph'
}

onMounted(async () => {
  await loadKnowledgeList()
  await editorResources.ensureParserEngines()
  await loadPage()
})
onUnmounted(() => stopMovePoll())
</script>

<template>
  <div v-if="isFAQ" class="ref-faq-stage">
    <FAQEntryManager v-if="kbId" :kb-id="kbId" />
  </div>

  <div v-else class="ref-kb-page">
    <header class="ref-kb-header">
      <div class="ref-kb-header-copy">
        <div class="ref-breadcrumb">
          <button class="ref-crumb-link" type="button" @click="handleNavigateToKbList">
            <ReferenceIcon name="arrow-left" :size="14" />
            <span>{{ $t('menu.knowledgeBase') }}</span>
          </button>
          <span class="ref-crumb-sep">/</span>
          <KBSwitcherDropdown
            v-if="knowledgeList.length"
            :kb-list="knowledgeList"
            :current-kb-id="kbId"
            @select="handleKnowledgeDropdownSelect"
          >
            <button class="ref-kb-name" type="button">
              <span>{{ kbInfo?.name || '...' }}</span>
              <ReferenceIcon name="chevron-down" :size="14" />
            </button>
          </KBSwitcherDropdown>
          <span v-else class="ref-kb-name">{{ kbInfo?.name || '...' }}</span>
          <span class="ref-crumb-sep">/</span>
          <span class="ref-crumb-current">{{ $t('knowledgeEditor.document.title') }}</span>
        </div>
        <p>{{ $t('knowledgeEditor.document.subtitle') }}</p>
      </div>

      <nav v-if="isWiki" class="ref-tabs" aria-label="knowledge views">
        <button :class="{ active: activeKbTab === 'documents' }" @click="activeKbTab = 'documents'">
          <ReferenceIcon name="file-text" :size="14" />
          <span>{{ $t('knowledgeEditor.wikiBrowser.tabDocuments') }} ({{ total }})</span>
        </button>
        <button :class="{ active: activeKbTab === 'wiki' }" @click="activeKbTab = 'wiki'">
          <ReferenceIcon name="book-open" :size="14" />
          <span>Wiki ({{ wikiCount }})</span>
          <t-loading v-if="wikiIsIndexing" size="small" />
        </button>
        <button :class="{ active: activeKbTab === 'graph' }" @click="activeKbTab = 'graph'">
          <ReferenceIcon name="network" :size="14" />
          <span>{{ $t('knowledgeEditor.wikiBrowser.tabGraph') }} ({{ graphCount }})</span>
        </button>
      </nav>
    </header>

    <div v-if="isWiki && activeKbTab !== 'documents'" class="ref-wiki-stage">
      <WikiBrowser
        v-if="kbId"
        :knowledge-base-id="kbId"
        :view="activeKbTab === 'graph' ? 'graph' : 'browser'"
        :can-edit="canEdit"
        @open-source-doc="(id) => openKnowledgeItem({ id })"
        @status-change="refreshWikiStats"
        @view-graph="onViewWikiInGraph"
      />
    </div>

    <main v-else class="ref-doc-stage">
      <KbFolderTree
        v-if="showFolderTree && !folderTreeCollapsed"
        class="ref-directory"
        :tree="folderTree"
        :selected-path="selectedFolderPath"
        :loading="folderTreeLoading"
        :can-edit="canEdit"
        @select="handleFolderSelect"
        @update:collapsed="handleFolderTreeCollapsedChange"
        @rename="handleFolderRename"
      />

      <div v-else-if="showFolderTree" class="ref-directory-collapsed">
        <button type="button" title="展开目录" @click="handleFolderTreeCollapsedChange(false)">
          <ReferenceIcon name="panel-left-open" :size="16" />
          <span>目录</span>
        </button>
      </div>

      <section class="ref-document-workspace">
        <div class="ref-toolbar">
          <div class="ref-toolbar-left">
            <div class="ref-root-pill">
              <ReferenceIcon name="folder" :size="14" class="ref-root-icon" />
              <button type="button" class="ref-root-link" @click="handleFolderSelect(ROOT_FOLDER_PATH)">
                {{ $t('knowledgeBase.folderTree.rootRow') }}
              </button>
              <template v-for="crumb in folderBreadcrumbs" :key="crumb.path">
                <ReferenceIcon name="chevron-right" :size="12" class="ref-root-chevron" />
                <button type="button" class="ref-root-link ref-root-link--current" @click="handleFolderSelect(crumb.path)">
                  {{ crumb.name }}
                </button>
              </template>
            </div>

            <t-input
              v-model.trim="docSearchKeyword"
              clearable
              class="ref-search"
              :placeholder="$t('knowledgeBase.docSearchPlaceholder')"
            >
              <template #prefix-icon><ReferenceIcon name="search" :size="14" /></template>
            </t-input>

            <t-popup v-model:visible="tagFilterPanelVisible" trigger="click" placement="bottom-left">
              <template #content>
                <div class="ref-tag-popup">
                  <t-input
                    v-model.trim="tagSearchQuery"
                    size="small"
                    :placeholder="$t('knowledgeBase.tagSearchPlaceholder')"
                    clearable
                  />
                  <div class="ref-tag-list">
                    <button
                      v-for="tag in tagList"
                      :key="tag.id"
                      type="button"
                      :class="{ active: selectedTagIds.includes(tag.id) }"
                      @click="selectedTagIds = selectedTagIds.includes(tag.id) ? selectedTagIds.filter(id => id !== tag.id) : [...selectedTagIds, tag.id]"
                    >
                      <span>{{ tag.name }}</span>
                      <small>{{ tag.knowledge_count || 0 }}</small>
                    </button>
                  </div>
                  <button
                    v-if="canEdit"
                    class="ref-manage-tags"
                    @click="tagManageDrawerVisible = true; tagFilterPanelVisible = false"
                  >
                    {{ $t('knowledgeBase.tagManageLink') }}
                  </button>
                </div>
              </template>
              <button class="ref-filter-button" type="button">
                <ReferenceIcon name="tag" :size="14" class="ref-filter-muted" />
                <span>{{ selectedTagIds.length ? `${selectedTagIds.length} ${$t('knowledgeBase.tagFilterTitle')}` : $t('knowledgeBase.allTags') }}</span>
                <ReferenceIcon name="chevron-down" :size="12" class="ref-filter-muted" />
              </button>
            </t-popup>

            <t-select v-model="selectedFileType" :options="fileTypeOptions" class="ref-select" clearable>
              <template #prefixIcon><ReferenceIcon name="file-text" :size="14" class="ref-filter-muted" /></template>
            </t-select>

            <t-select v-model="selectedParseStatus" :options="parseStatusOptions" class="ref-select ref-select-status" clearable>
              <template #prefixIcon><ReferenceIcon name="check-circle-2" :size="14" class="ref-filter-muted" /></template>
            </t-select>
          </div>

          <div class="ref-toolbar-right">
            <div class="ref-view-toggle">
              <button type="button" title="卡片网格视图" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">
                <ReferenceIcon name="layout-grid" :size="14" />
              </button>
              <button type="button" title="列表视图" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
                <ReferenceIcon name="list" :size="14" />
              </button>
            </div>
            <KbUploadSourceDropdown
              v-if="canEdit"
              ref="uploadSourceRef"
              class="ref-add-document"
              :accept-file-types="acceptFileTypes"
              :supported-file-types="[...supportedFileTypes]"
              include-manual
              trigger-icon="add"
              trigger-class="ref-add-document-trigger"
              :tooltip="$t('knowledgeBase.addDocument')"
              placement="bottom-right"
              @files="uploadFiles"
              @url="importUrl"
              @manual="createManual"
            />
          </div>
        </div>

        <div class="ref-doc-scroll">
          <div v-if="docListLoading && !cardList.length" class="ref-skeleton-grid">
            <div v-for="n in 8" :key="n" class="ref-skeleton-card"><t-skeleton animation="gradient" /></div>
          </div>

          <DocumentCardView
            v-else-if="(cardList.length || currentChildFolders.length) && viewMode === 'grid'"
            :items="cardList"
            :folders="currentChildFolders"
            :folder-options="folderOptions"
            :selected-ids="selectedIds"
            :batch-mode="batchMode"
            :can-edit="canEdit"
            :can-mutate-knowledge="canMutateKnowledge"
            :trace-available-by-id="traceAvailableById"
            :tag-list="tagList"
            :move-menu-mode="moveMenuMode"
            :move-target-kbs="moveTargetKbs"
            :move-targets-loading="moveTargetsLoading"
            :move-selected-target-name="moveSelectedTargetName"
            :move-mode="moveMode"
            :move-submitting="moveSubmitting"
            :show-folder-path="showDocumentFolderPath"
            @open="openKnowledgeItem"
            @open-folder="handleFolderSelect"
            @move-to-folder="(item, path) => moveKnowledgeIntoFolder([item.id], path)"
            @toggle-checkbox="(id, checked) => toggleRow(id, checked)"
            @menu-visible-change="(visible, item) => visible && probeTraceAvailable(item)"
            @action="handleCardAction"
            @tag-edit="openTagEditDialog"
            @move-select-target="handleMoveSelectTarget"
            @move-back="handleMoveBack"
            @move-confirm="handleMoveConfirm"
            @update:move-mode="(mode) => moveMode = mode"
          />

          <DocumentListView
            v-else-if="(cardList.length || currentChildFolders.length) && viewMode === 'list'"
            :items="cardList"
            :folders="currentChildFolders"
            :folder-options="folderOptions"
            :selected-ids="selectedIds"
            :tag-list="tagList"
            :can-edit="canEdit"
            :can-mutate-knowledge="canMutateKnowledge"
            :trace-visible-ids="traceAvailableById"
            :move-menu-mode="moveMenuMode"
            :move-target-kbs="moveTargetKbs"
            :move-targets-loading="moveTargetsLoading"
            :move-selected-target-name="moveSelectedTargetName"
            :move-mode="moveMode"
            :move-submitting="moveSubmitting"
            :show-folder-path="showDocumentFolderPath"
            @open="openKnowledgeItem"
            @open-folder="handleFolderSelect"
            @move-to-folder="(item, path) => moveKnowledgeIntoFolder([item.id], path)"
            @toggle-row="toggleRow"
            @toggle-all="toggleAll"
            @action="handleCardAction"
            @probe-trace="probeTraceAvailable"
            @tag-edit="openTagEditDialog"
            @move-select-target="handleMoveSelectTarget"
            @move-back="handleMoveBack"
            @move-confirm="handleMoveConfirm"
            @update:move-mode="(mode) => moveMode = mode"
            @reset-move-state="moveMenuMode = 'normal'"
          />

          <div v-else-if="!docListLoading" class="ref-empty">
            <ReferenceIcon name="file-text" :size="38" :stroke-width="1.5" />
            <strong>暂无文档</strong>
          </div>
        </div>

        <div class="ref-batch-anchor" v-show="batchMode || selectedIds.size">
          <DocumentBatchBar
            :count="selectedIds.size"
            :delete-loading="batchDeleting"
            :reparse-loading="batchReparsing"
            :tag-loading="batchTagging"
            :visible="batchMode || selectedIds.size > 0"
            :show-move-to-folder="canEdit"
            :folder-options="folderOptions"
            @cancel="cancelBatch"
            @delete="deleteBatch"
            @reparse="reparseBatch"
            @batch-tag="batchTag"
            @move-to-folder="(path) => moveKnowledgeIntoFolder([...selectedIds], path)"
          />
        </div>
      </section>
    </main>

    <DocContent
      ref="docContentRef"
      :visible="isCardDetails"
      :details="details"
      :canEditKB="canEdit"
      :canDownloadKB="canDownloadKnowledge"
      :kbId="kbId"
      @closeDoc="closeDoc"
      @getDoc="getDoc"
    />

    <TagEditDialog
      :visible="tagEditDialogVisible"
      :knowledge-name="tagEditTarget?.display_name || tagEditTarget?.file_name || tagEditTarget?.title || ''"
      :kb-id="kbId"
      :tag-list="tagList"
      :selected-tags="tagEditTarget?.tags || []"
      :can-manage="canEdit"
      @update:visible="tagEditDialogVisible = $event"
      @confirm="onTagEditConfirm"
      @tag-created="loadTags"
      @open-manage="tagManageDrawerVisible = true"
    />
    <KbTagManageDrawer
      v-model:visible="tagManageDrawerVisible"
      :kb-id="kbId"
      :is-faq="false"
      @changed="() => { loadTags(); loadKnowledgeFiles() }"
    />
  </div>
</template>

<style scoped>
.ref-faq-stage {
  height: 100%;
  overflow: auto;
  padding: 24px 32px;
  box-sizing: border-box;
}

.ref-kb-page {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 28px 0;
  box-sizing: border-box;
  background: rgb(249 250 251 / 0.3);
  color: #1f2937;
  font-family: "Inter", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
  overflow: hidden;
}

.ref-kb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(229 231 235 / 0.8);
  flex: 0 0 auto;
}

.ref-kb-header-copy { min-width: 0; }
.ref-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 24px;
  font-size: 12px;
  color: #6b7280;
}
.ref-kb-header-copy p {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ref-crumb-link,
.ref-kb-name {
  border: 0;
  background: transparent;
  padding: 0;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  max-width: 440px;
}
.ref-kb-name { font-weight: 700; color: #1f2937; }
.ref-kb-name span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ref-crumb-current { color: #9ca3af; }
.ref-crumb-sep { color: #d1d5db; }

.ref-tabs {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 4px;
  gap: 2px;
  flex: 0 0 auto;
}
.ref-tabs button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.ref-tabs button.active {
  border-color: rgb(229 231 235 / 0.6);
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.ref-doc-stage {
  display: flex;
  gap: 12px;
  min-height: 0;
  flex: 1;
  padding-top: 20px;
  overflow: hidden;
}
.ref-document-workspace {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ref-directory-collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 6px;
  background: #fff;
  border: 1px solid rgb(229 231 235 / 0.9);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.025);
  flex: 0 0 auto;
}
.ref-directory-collapsed button {
  padding: 6px;
  border: 0;
  background: transparent;
  color: #4b5563;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  line-height: 12px;
  font-weight: 700;
  cursor: pointer;
}
.ref-directory-collapsed button:hover { background: #f3f4f6; }

.ref-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #fff;
  padding: 10px;
  border: 1px solid rgb(229 231 235 / 0.9);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.025);
  flex: 0 0 auto;
}
.ref-toolbar-left {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 280px;
}
.ref-toolbar-right {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.ref-root-pill {
  min-height: 30px;
  border: 0;
  border-radius: 12px;
  background: rgb(243 244 246 / 0.9);
  color: #374151;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.ref-root-icon { color: #6b7280; }
.ref-root-chevron { color: #9ca3af; }
.ref-root-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: #374151;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.ref-root-link--current { color: #111827; }

.ref-filter-button {
  height: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #374151;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.ref-filter-button:hover { background: #f9fafb; }
.ref-filter-muted { color: #9ca3af; }
.ref-search { width: 220px; min-width: 160px; }
.ref-select { width: 140px; }
.ref-select-status { width: 132px; }

.ref-view-toggle {
  display: flex;
  background: #f3f4f6;
  padding: 2px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}
.ref-view-toggle button {
  width: 30px;
  height: 28px;
  border: 0;
  background: transparent;
  color: #9ca3af;
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ref-view-toggle button.active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.ref-doc-scroll { position: relative; min-height: 0; flex: 1; overflow: auto; }
.ref-empty {
  height: 100%;
  min-height: 260px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 12px;
}
.ref-empty strong { font-size: 13px; color: #4b5563; }
.ref-skeleton-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.ref-skeleton-card { height: 192px; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; box-sizing: border-box; }
.ref-batch-anchor { position: absolute; left: 0; right: 0; bottom: 14px; z-index: 20; display: flex; justify-content: center; pointer-events: none; }
.ref-batch-anchor > * { pointer-events: auto; }
.ref-wiki-stage { min-height: 0; flex: 1; padding-top: 14px; overflow: hidden; }
.ref-tag-popup { width: 300px; padding: 12px; background: #fff; border-radius: 12px; }
.ref-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; max-height: 240px; overflow: auto; }
.ref-tag-list button { height: 26px; border: 1px solid #e5e7eb; border-radius: 7px; background: #fff; padding: 0 8px; font-size: 11px; color: #4b5563; display: flex; gap: 5px; align-items: center; cursor: pointer; }
.ref-tag-list button.active { background: #111827; border-color: #111827; color: #fff; }
.ref-tag-list small { opacity: .6; }
.ref-manage-tags { margin-top: 10px; border: 0; background: transparent; color: #4b5563; font-size: 11px; cursor: pointer; }

:deep(.ref-directory.kb-folder-tree) {
  width: 224px !important;
  min-width: 224px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 1px solid rgb(229 231 235 / 0.9) !important;
  border-radius: 16px !important;
  background: #fff !important;
  overflow: hidden !important;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.025) !important;
}
:deep(.ref-directory .kb-folder-tree__header) {
  height: 48px !important;
  padding: 0 14px !important;
  border-bottom: 1px solid #f3f4f6 !important;
  background: rgb(249 250 251 / 0.5) !important;
}
:deep(.ref-directory .kb-folder-tree__body) { padding: 8px !important; }
.ref-kb-page :deep(.kb-folder-row) { min-height: 30px !important; border-radius: 10px !important; font-size: 12px !important; }
.ref-kb-page :deep(.kb-folder-row.active) { background: #111827 !important; color: #fff !important; }
.ref-kb-page :deep(.kb-folder-row.active .kb-folder-row__icon),
.ref-kb-page :deep(.kb-folder-row.active .kb-folder-row__count) { color: #fff !important; }

.ref-kb-page :deep(.doc-card-list) {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 16px !important;
  width: 100% !important;
}
.ref-kb-page :deep(.knowledge-card),
.ref-kb-page :deep(.folder-card) {
  min-width: 0 !important;
  height: 192px !important;
  border: 1px solid rgb(229 231 235 / 0.9) !important;
  border-radius: 16px !important;
  background: #fff !important;
  box-shadow: none !important;
  overflow: hidden !important;
}
.ref-kb-page :deep(.knowledge-card:hover),
.ref-kb-page :deep(.folder-card:hover) {
  border-color: #9ca3af !important;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.06) !important;
}
.ref-kb-page :deep(.knowledge-card .card-content) { padding: 16px !important; }
.ref-kb-page :deep(.knowledge-card .card-content-title) { font-size: 12px !important; font-weight: 700 !important; color: #030712 !important; }
.ref-kb-page :deep(.knowledge-card .card-content-txt) { font-size: 11px !important; line-height: 17px !important; color: #6b7280 !important; -webkit-line-clamp: 3 !important; line-clamp: 3 !important; }
.ref-kb-page :deep(.knowledge-card .card-bottom) { padding: 10px 16px 16px !important; border-top: 1px solid #f3f4f6 !important; }
.ref-kb-page :deep(.knowledge-card .card-time) { font-family: "JetBrains Mono", ui-monospace, monospace !important; font-size: 10px !important; color: #9ca3af !important; }
.ref-kb-page :deep(.knowledge-card .card-type) { background: #f3f4f6 !important; border-radius: 6px !important; padding: 2px 8px !important; font-size: 9px !important; font-weight: 700 !important; color: #4b5563 !important; }

/* TDesign remains only as the data/overlay engine. Strip its independent visual skin. */
.ref-kb-page :deep(.ref-search .t-input),
.ref-kb-page :deep(.ref-select .t-input) {
  min-height: 30px !important;
  height: 30px !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 12px !important;
  background: #fff !important;
  box-shadow: none !important;
  font-size: 12px !important;
  color: #374151 !important;
}
.ref-kb-page :deep(.ref-search .t-input) { background: rgb(249 250 251 / 0.8) !important; }
.ref-kb-page :deep(.ref-add-document .kb-upload-source-trigger) {
  height: 30px !important;
  min-width: 126px !important;
  padding: 0 28px 0 12px !important;
  border-radius: 12px !important;
  background: #111827 !important;
  color: #fff !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}
.ref-kb-page :deep(.ref-add-document .kb-upload-source-trigger::after) { content: "添加文档"; }
.ref-kb-page :deep(.ref-add-document .kb-upload-source-trigger:hover) { background: #000 !important; color: #fff !important; }

@media (max-width: 1280px) {
  .ref-kb-page :deep(.doc-card-list) { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .ref-search { width: 190px; }
}

@media (max-width: 767px) {
  .ref-kb-page { padding: 20px 20px 0; }
  .ref-kb-header { align-items: flex-start; flex-direction: column; }
  .ref-tabs { align-self: stretch; }
  .ref-tabs button { flex: 1 1 0; }
  .ref-toolbar-left { min-width: 0; }
  .ref-toolbar-right { margin-left: auto; }
  .ref-kb-page :deep(.doc-card-list) { grid-template-columns: 1fr !important; }
}
</style>
