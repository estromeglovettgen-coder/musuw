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
  getKnowledgeMoveProgress,
  listKnowledgeFolders,
  listKnowledgeTags,
  listMoveTargets,
  moveKnowledge,
  moveKnowledgeToFolder,
  renameKnowledgeFolder,
  reparseKnowledge,
  updateKnowledgeTagBatch,
  uploadKnowledgeFile,
  type KnowledgeFolderTree,
} from '@/api/knowledge-base'
import { getWikiStats } from '@/api/wiki'
import type { ParserEngineInfo } from '@/api/system'
import { knowledgeSpansPayloadHasTrace } from '@/utils/knowledgeTrace'
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
import BatchTagDialog from './components/BatchTagDialog.vue'
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
  const permission = effectiveKBPermission.value
  return !permission || permission === 'owner' || permission === 'admin' || permission === 'editor'
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

const fileTypeOptions = computed(() => [
  { label: t('knowledgeBase.allFileTypes'), value: '' },
  ...['pdf', 'docx', 'doc', 'pptx', 'ppt', 'epub', 'mhtml', 'txt', 'md', 'png', 'jpeg', 'jpg', 'wav', 'mp3', 'm4a', 'flac', 'ogg']
    .map((value) => ({ label: value.toUpperCase(), value })),
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
  try { localStorage.setItem(FOLDER_TREE_COLLAPSED_KEY, String(value)) } catch { /* storage may be unavailable */ }
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
    if (!folderExistsInTree(folderTree.value?.folders || [], selectedFolderPath.value)) {
      selectedFolderPath.value = ROOT_FOLDER_PATH
    }
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
    else if (selectedFolderPath.value.startsWith(`${from}/`)) {
      selectedFolderPath.value = to + selectedFolderPath.value.slice(from.length)
    }
    await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('knowledgeBase.folderTree.renameFailed'))
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
    for (const fileType of engine.FileTypes || []) available.add(fileType)
  }
  return available
})
const acceptFileTypes = computed(() => [...supportedFileTypes.value].map((fileType) => `.${fileType}`).join(','))

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
    tagList.value = Array.isArray(raw) ? raw.map((tag: any) => ({ ...tag, id: String(tag.id) })) : []
  } catch {
    tagList.value = []
  } finally {
    tagLoading.value = false
  }
}
const loadKnowledgeList = async () => {
  await chatResources.ensureKnowledgeBases()
  const own = chatResources.rawKnowledgeBases.map((item: any) => ({ id: String(item.id), name: item.name, type: item.type || 'document' }))
  const shared = (orgStore.sharedKnowledgeBases || [])
    .filter((item) => item.knowledge_base)
    .map((item) => ({ id: String(item.knowledge_base.id), name: item.knowledge_base.name, type: item.knowledge_base.type || 'document' }))
  const ownIds = new Set(own.map((item) => item.id))
  knowledgeList.value = [...own, ...shared.filter((item) => !ownIds.has(item.id))]
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
let tagSearchTimer: number | undefined
watch(docSearchKeyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(loadKnowledgeFiles, 250)
})
watch(tagSearchQuery, () => {
  window.clearTimeout(tagSearchTimer)
  tagSearchTimer = window.setTimeout(loadTags, 250)
})
watch([selectedFileType, selectedParseStatus, selectedSource, updatedTimeRange], loadKnowledgeFiles, { deep: true })
watch(selectedFolderPath, loadKnowledgeFiles)
watch(selectedTagIds, () => {
  uiStore.clearSelectedTagIds()
  selectedTagIds.value.forEach((id) => uiStore.toggleSelectedTagId(id))
  void loadKnowledgeFiles()
}, { deep: true })
watch(kbId, async () => {
  selectedFolderPath.value = ROOT_FOLDER_PATH
  selectedTagIds.value = []
  await loadPage()
})

const uploadFiles = async (files: File[]) => {
  if (!files.length || !canEdit.value) return
  for (const file of files) {
    const payload: any = {
      file,
      tag_ids: selectedTagIds.value.length ? [...selectedTagIds.value] : undefined,
    }
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    const fileName = relativePath
      ? buildUploadFileName(file, selectedFolderPath.value)
      : (selectedFolderPath.value ? `${selectedFolderPath.value}/${file.name}` : file.name)
    if (fileName) payload.fileName = fileName
    try {
      await uploadKnowledgeFile(kbId.value, payload)
    } catch (error: any) {
      MessagePlugin.error(error?.message || t('knowledgeBase.uploadFailed'))
    }
  }
  await Promise.all([loadKnowledgeFiles(), loadFolderTree(), refreshWikiStats()])
}
const importUrl = async (url: string) => {
  if (!canEdit.value) return
  try {
    await createKnowledgeFromURL(kbId.value, {
      url,
      tag_ids: selectedTagIds.value.length ? [...selectedTagIds.value] : undefined,
    })
    await Promise.all([loadKnowledgeFiles(), refreshWikiStats()])
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('knowledgeBase.urlImportFailed'))
  }
}
const createManual = () => {
  if (!canEdit.value) return
  uiStore.openManualEditor({
    mode: 'create',
    kbId: kbId.value,
    status: 'draft',
    onSuccess: () => void loadKnowledgeFiles(),
  })
}

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
  } catch {
    traceAvailableById[item.id] = false
  }
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
  const index = cardList.value.findIndex((candidate: any) => candidate.id === item.id)
  if (index < 0) return
  await delKnowledge(index, item, () => void loadKnowledgeFiles())
  await loadFolderTree()
}
const editManual = (item: any) => {
  uiStore.openManualEditor({
    mode: 'edit',
    kbId: item.knowledge_base_id || kbId.value,
    knowledgeId: item.id,
    onSuccess: () => void loadKnowledgeFiles(),
  })
}
const reparseItem = async (item: any) => {
  if (isKnowledgeParseInFlight(item.parse_status)) {
    MessagePlugin.info(t('knowledgeBase.rebuildInProgress'))
    return
  }
  await reparseKnowledge(item.id)
  delete traceAvailableById[item.id]
  traceAvailableById[item.id] = true
  await Promise.all([loadKnowledgeFiles(), refreshWikiStats()])
}
const cancelParseItem = async (item: any) => {
  await cancelKnowledgeParse(item.id)
  await loadKnowledgeFiles()
}

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
  moveTargetKbs.value = []
  try {
    const res: any = await listMoveTargets(kbId.value)
    moveTargetKbs.value = res?.data || []
  } finally {
    moveTargetsLoading.value = false
  }
}
const handleMoveSelectTarget = (kb: any) => {
  moveSelectedTargetId.value = kb.id
  moveSelectedTargetName.value = kb.name
  moveMode.value = 'reuse_vectors'
  moveMenuMode.value = 'confirm'
}
const handleMoveBack = () => {
  moveMenuMode.value = moveMenuMode.value === 'confirm' ? 'targets' : 'normal'
}
const stopMovePoll = () => {
  if (movePollTimer) {
    window.clearInterval(movePollTimer)
    movePollTimer = undefined
  }
}
const handleMoveConfirm = async () => {
  if (!moveSelectedTargetId.value || moveSubmitting.value) return
  moveSubmitting.value = true
  try {
    const res: any = await moveKnowledge({
      knowledge_ids: [moveKnowledgeId.value],
      source_kb_id: kbId.value,
      target_kb_id: moveSelectedTargetId.value,
      mode: moveMode.value,
    })
    const taskId = res?.data?.task_id
    moveMenuMode.value = 'normal'
    if (!taskId) {
      await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
      return
    }
    stopMovePoll()
    movePollTimer = window.setInterval(async () => {
      const progress: any = await getKnowledgeMoveProgress(taskId)
      if (progress?.data?.status === 'completed' || progress?.data?.status === 'failed') {
        stopMovePoll()
        moveSubmitting.value = false
        await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
      }
    }, 2000)
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('knowledgeBase.moveFailed'))
  } finally {
    if (!movePollTimer) moveSubmitting.value = false
  }
}
const moveKnowledgeIntoFolder = async (ids: string[], path: string) => {
  if (!ids.length) return
  await moveKnowledgeToFolder(kbId.value, ids, path)
  selectedIds.value.clear()
  batchMode.value = false
  await Promise.all([loadKnowledgeFiles(), loadFolderTree()])
}

// Preserve the original per-browser grid/list preference.
type DocViewMode = 'grid' | 'list'
const VIEW_MODE_KEY = 'weknora.kb.docs.viewMode'
const initViewMode = (): DocViewMode => {
  try { return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid' }
  catch { return 'grid' }
}
const viewMode = ref<DocViewMode>(initViewMode())
watch(viewMode, (mode) => {
  try { localStorage.setItem(VIEW_MODE_KEY, mode) } catch { /* storage may be unavailable */ }
  if (mode === 'grid' && selectedIds.value.size > 0) batchMode.value = true
})

const selectedIds = ref<Set<string>>(new Set())
let lastSelectedIndex = -1
const batchMode = ref(false)
const batchDeleting = ref(false)
const batchReparsing = ref(false)
const batchTagging = ref(false)
const batchTagDialogVisible = ref(false)

const toggleRow = (id: string, checked: boolean, shiftKey = false) => {
  const items = cardList.value || []
  const index = items.findIndex((item: any) => item.id === id)
  if (shiftKey && lastSelectedIndex >= 0 && index >= 0) {
    const [start, end] = index < lastSelectedIndex ? [index, lastSelectedIndex] : [lastSelectedIndex, index]
    for (let cursor = start; cursor <= end; cursor++) {
      if (checked) selectedIds.value.add(items[cursor].id)
      else selectedIds.value.delete(items[cursor].id)
    }
  } else if (checked) selectedIds.value.add(id)
  else selectedIds.value.delete(id)
  lastSelectedIndex = index
}
const toggleAll = (checked: boolean) => {
  if (!checked) {
    selectedIds.value.clear()
    return
  }
  for (const item of cardList.value) selectedIds.value.add(item.id)
}
const cancelBatch = () => {
  selectedIds.value.clear()
  lastSelectedIndex = -1
  batchMode.value = false
}
const deleteBatch = async () => {
  const ids = [...selectedIds.value]
  if (!ids.length || batchDeleting.value || batchReparsing.value) return
  batchDeleting.value = true
  try {
    await batchDeleteKnowledge(kbId.value, ids)
    cancelBatch()
    await Promise.all([loadKnowledgeFiles(), loadFolderTree(), loadTags()])
  } finally {
    batchDeleting.value = false
  }
}
const reparseBatch = async () => {
  const allIds = [...selectedIds.value]
  if (!allIds.length || batchDeleting.value || batchReparsing.value) return
  const ids = allIds.filter((id) => {
    const item = cardList.value.find((candidate: any) => candidate.id === id)
    return !item || !isKnowledgeParseInFlight(item.parse_status)
  })
  if (!ids.length) {
    MessagePlugin.info(t('knowledgeBase.rebuildInProgress'))
    return
  }
  batchReparsing.value = true
  try {
    await batchReparseKnowledge(kbId.value, ids)
    for (const id of ids) {
      const card = cardList.value.find((candidate: any) => candidate.id === id)
      if (card) {
        card.parse_status = 'pending'
        card.summary_status = undefined
        card.description = ''
        traceAvailableById[id] = true
      }
    }
    cancelBatch()
    void refreshWikiStats()
    await loadKnowledgeFiles()
  } finally {
    batchReparsing.value = false
  }
}
const batchTagPreSelectedIds = computed(() => {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) return []
  const cards = ids
    .map((id) => cardList.value.find((card: any) => card.id === id))
    .filter(Boolean) as any[]
  if (!cards.length) return []
  const intersection = new Set<string>((cards[0].tags || []).map((tag: any) => String(tag.id)))
  for (let index = 1; index < cards.length; index++) {
    const current = new Set<string>((cards[index].tags || []).map((tag: any) => String(tag.id)))
    for (const tagId of intersection) {
      if (!current.has(tagId)) intersection.delete(tagId)
    }
  }
  return Array.from(intersection)
})
const batchTag = () => {
  if (!selectedIds.value.size || batchDeleting.value || batchReparsing.value || batchTagging.value) return
  batchTagDialogVisible.value = true
}
const onBatchTagConfirm = async (tagIds: string[]) => {
  if (batchTagging.value || selectedIds.value.size === 0) return
  const ids = Array.from(selectedIds.value)
  const updates: Record<string, string[]> = {}
  ids.forEach((id) => { updates[id] = tagIds })
  batchTagging.value = true
  try {
    await updateKnowledgeTagBatch({ updates })
    MessagePlugin.success(t('knowledgeBase.batchTagSuccess', { count: ids.length }))
    batchTagDialogVisible.value = false
    cancelBatch()
    await Promise.all([loadKnowledgeFiles(), loadTags()])
  } catch (error: any) {
    MessagePlugin.error(error?.message || t('knowledgeBase.batchTagFailed'))
  } finally {
    batchTagging.value = false
  }
}

const tagEditDialogVisible = ref(false)
const tagEditTarget = ref<any>(null)
const tagManageDrawerVisible = ref(false)
const openTagEditDialog = (item: any) => {
  tagEditTarget.value = item
  tagEditDialogVisible.value = true
}
const onTagEditConfirm = async (tagIds: string[]) => {
  if (!tagEditTarget.value) return
  await updateKnowledgeTagBatch({ updates: { [tagEditTarget.value.id]: tagIds } })
  await Promise.all([loadKnowledgeFiles(), loadTags()])
}

const handleCardAction = (action: string, item: any) => {
  if (action === 'edit') return editManual(item)
  if (action === 'view-trace') return openTrace(item)
  if (action === 'reparse') return void reparseItem(item)
  if (action === 'cancel-parse') return void cancelParseItem(item)
  if (action === 'move') return void handleMoveKnowledge(item)
  if (action === 'batch-manage') {
    selectedIds.value.clear()
    batchMode.value = true
    return
  }
  if (action === 'delete') return void deleteItem(item)
}

const handleNavigateToKbList = () => router.push('/platform/knowledge-bases')
const handleKnowledgeDropdownSelect = (id: string) => {
  if (id && id !== kbId.value) void router.push(`/platform/knowledge-bases/${id}`)
}
const onViewWikiInGraph = async (slug: string) => {
  await router.replace({ query: { ...route.query, tab: 'graph', slug } })
  activeKbTab.value = 'graph'
}

const handleKnowledgeFileDrop = (event: Event) => {
  const detail = (event as CustomEvent<{ kbId?: string; files?: File[] }>).detail
  if (detail?.kbId !== kbId.value || isFAQ.value || !Array.isArray(detail.files)) return
  void uploadFiles(detail.files)
}
const handleOpenURLImportDialog = (event: Event) => {
  const detail = (event as CustomEvent<{ kbId?: string }>).detail
  if (detail?.kbId === kbId.value && !isFAQ.value) uploadSourceRef.value?.openUrlDialog?.()
}
const handleFileUploaded = (event: Event) => {
  const detail = (event as CustomEvent<{ kbId?: string }>).detail
  if (detail?.kbId !== kbId.value || isFAQ.value) return
  void Promise.all([loadKnowledgeFiles(), loadFolderTree(), loadTags(), refreshWikiStats()])
}
const handleOpenKnowledgeEvent = (event: Event) => {
  const detail = (event as CustomEvent<{ kbId?: string; knowledgeId?: string }>).detail
  if (!detail?.knowledgeId || (detail.kbId && detail.kbId !== kbId.value)) return
  openKnowledgeItem({ id: detail.knowledgeId })
}

onMounted(async () => {
  await loadKnowledgeList()
  await editorResources.ensureParserEngines()
  await loadPage()
  window.addEventListener('weknora:knowledge-file-drop', handleKnowledgeFileDrop)
  window.addEventListener('openURLImportDialog', handleOpenURLImportDialog)
  window.addEventListener('knowledgeFileUploaded', handleFileUploaded)
  window.addEventListener('weknora:open-knowledge', handleOpenKnowledgeEvent)
  const queryKnowledgeId = typeof route.query.knowledge_id === 'string' ? route.query.knowledge_id : ''
  if (queryKnowledgeId) openKnowledgeItem({ id: queryKnowledgeId })
})
onUnmounted(() => {
  stopMovePoll()
  window.clearTimeout(searchTimer)
  window.clearTimeout(tagSearchTimer)
  window.removeEventListener('weknora:knowledge-file-drop', handleKnowledgeFileDrop)
  window.removeEventListener('openURLImportDialog', handleOpenURLImportDialog)
  window.removeEventListener('knowledgeFileUploaded', handleFileUploaded)
  window.removeEventListener('weknora:open-knowledge', handleOpenKnowledgeEvent)
})
</script>

<template>
  <div v-if="isFAQ" class="reference-faq-stage">
    <FAQEntryManager v-if="kbId" :kb-id="kbId" />
  </div>

  <div v-else class="reference-kb-page">
    <header class="reference-kb-header">
      <div class="reference-kb-header__copy">
        <div class="reference-breadcrumb">
          <button type="button" class="reference-breadcrumb__back" @click="handleNavigateToKbList">
            <ReferenceIcon name="arrow-left" :size="14" />
            <span>{{ $t('menu.knowledgeBase') }}</span>
          </button>
          <span class="reference-breadcrumb__separator">/</span>
          <KBSwitcherDropdown
            v-if="knowledgeList.length"
            :kb-list="knowledgeList"
            :current-kb-id="kbId"
            @select="handleKnowledgeDropdownSelect"
          >
            <button type="button" class="reference-breadcrumb__kb">
              <span>{{ kbInfo?.name || '...' }}</span>
              <ReferenceIcon name="chevron-down" :size="13" />
            </button>
          </KBSwitcherDropdown>
          <span v-else class="reference-breadcrumb__kb">{{ kbInfo?.name || '...' }}</span>
          <span class="reference-breadcrumb__separator">/</span>
          <span class="reference-breadcrumb__current">{{ $t('knowledgeEditor.document.title') }}</span>
        </div>
        <p>{{ $t('knowledgeEditor.document.subtitle') }}</p>
      </div>

      <nav v-if="isWiki" class="reference-kb-tabs" aria-label="knowledge views">
        <button type="button" :class="{ active: activeKbTab === 'documents' }" @click="activeKbTab = 'documents'">
          <ReferenceIcon name="file-text" :size="14" />
          <span>{{ $t('knowledgeEditor.wikiBrowser.tabDocuments') }} ({{ total }})</span>
        </button>
        <button type="button" :class="{ active: activeKbTab === 'wiki' }" @click="activeKbTab = 'wiki'">
          <ReferenceIcon name="book-open" :size="14" />
          <span>Wiki ({{ wikiCount }})</span>
          <ReferenceIcon v-if="wikiIsIndexing" name="loader-circle" :size="12" class="reference-spin" />
        </button>
        <button type="button" :class="{ active: activeKbTab === 'graph' }" @click="activeKbTab = 'graph'">
          <ReferenceIcon name="network" :size="14" />
          <span>{{ $t('knowledgeEditor.wikiBrowser.tabGraph') }} ({{ graphCount }})</span>
        </button>
      </nav>
    </header>

    <div v-if="isWiki && activeKbTab !== 'documents'" class="reference-wiki-stage">
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

    <main v-else class="reference-doc-stage">
      <KbFolderTree
        v-if="showFolderTree && !folderTreeCollapsed"
        class="reference-directory"
        :tree="folderTree"
        :selected-path="selectedFolderPath"
        :loading="folderTreeLoading"
        :can-edit="canEdit"
        @select="handleFolderSelect"
        @update:collapsed="handleFolderTreeCollapsedChange"
        @rename="handleFolderRename"
      />

      <aside v-else-if="showFolderTree" class="reference-directory-collapsed">
        <button type="button" :title="$t('knowledgeBase.folderTree.expand')" @click="handleFolderTreeCollapsedChange(false)">
          <ReferenceIcon name="panel-left-open" :size="16" />
          <span>{{ $t('knowledgeBase.folderTree.title') }}</span>
        </button>
      </aside>

      <section class="reference-document-workspace">
        <div class="reference-toolbar">
          <div class="reference-toolbar__primary">
            <div class="reference-root-path">
              <ReferenceIcon name="folder" :size="14" />
              <button type="button" @click="handleFolderSelect(ROOT_FOLDER_PATH)">{{ $t('knowledgeBase.folderTree.rootRow') }}</button>
              <template v-for="crumb in folderBreadcrumbs" :key="crumb.path">
                <ReferenceIcon name="chevron-right" :size="11" class="muted" />
                <button type="button" class="current" @click="handleFolderSelect(crumb.path)">{{ crumb.name }}</button>
              </template>
            </div>

            <label class="reference-search-field">
              <ReferenceIcon name="search" :size="14" />
              <input v-model.trim="docSearchKeyword" :placeholder="$t('knowledgeBase.docSearchPlaceholder')" />
              <button v-if="docSearchKeyword" type="button" aria-label="清空" @click="docSearchKeyword = ''">×</button>
            </label>

            <div class="reference-filter-anchor">
              <button type="button" class="reference-filter-button" @click="tagFilterPanelVisible = !tagFilterPanelVisible">
                <ReferenceIcon name="tag" :size="14" />
                <span>{{ selectedTagIds.length ? `${selectedTagIds.length} ${$t('knowledgeBase.tagFilterTitle')}` : $t('knowledgeBase.allTags') }}</span>
                <ReferenceIcon name="chevron-down" :size="11" class="muted" />
              </button>
              <template v-if="tagFilterPanelVisible">
                <div class="reference-filter-backdrop" @click="tagFilterPanelVisible = false" />
                <div class="reference-tag-filter-menu">
                  <label class="reference-tag-filter-search">
                    <ReferenceIcon name="search" :size="13" />
                    <input v-model.trim="tagSearchQuery" :placeholder="$t('knowledgeBase.tagSearchPlaceholder')" />
                  </label>
                  <div v-if="tagLoading && !tagList.length" class="reference-filter-loading">...</div>
                  <div v-else class="reference-tag-filter-list">
                    <button
                      v-for="tag in tagList"
                      :key="tag.id"
                      type="button"
                      :class="{ active: selectedTagIds.includes(tag.id) }"
                      @click="selectedTagIds = selectedTagIds.includes(tag.id)
                        ? selectedTagIds.filter((id) => id !== tag.id)
                        : [...selectedTagIds, tag.id]"
                    >
                      <span>{{ tag.name }}</span>
                      <small>{{ tag.knowledge_count || 0 }}</small>
                    </button>
                  </div>
                  <button
                    v-if="canEdit"
                    type="button"
                    class="reference-tag-filter-manage"
                    @click="tagManageDrawerVisible = true; tagFilterPanelVisible = false"
                  >{{ $t('knowledgeBase.tagManageLink') }}</button>
                </div>
              </template>
            </div>

            <label class="reference-select-field">
              <ReferenceIcon name="file-text" :size="14" />
              <select v-model="selectedFileType" :aria-label="$t('knowledgeBase.allFileTypes')">
                <option v-for="option in fileTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <ReferenceIcon name="chevron-down" :size="11" class="muted" />
            </label>

            <label class="reference-select-field reference-select-field--status">
              <ReferenceIcon name="check-circle-2" :size="14" />
              <select v-model="selectedParseStatus" :aria-label="$t('knowledgeBase.allParseStatuses')">
                <option v-for="option in parseStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <ReferenceIcon name="chevron-down" :size="11" class="muted" />
            </label>
          </div>

          <div class="reference-toolbar__actions">
            <div class="reference-view-toggle">
              <button type="button" :class="{ active: viewMode === 'grid' }" title="卡片网格视图" @click="viewMode = 'grid'">
                <ReferenceIcon name="layout-grid" :size="14" />
              </button>
              <button type="button" :class="{ active: viewMode === 'list' }" title="列表视图" @click="viewMode = 'list'">
                <ReferenceIcon name="list" :size="14" />
              </button>
            </div>
            <KbUploadSourceDropdown
              v-if="canEdit"
              ref="uploadSourceRef"
              :accept-file-types="acceptFileTypes"
              :supported-file-types="[...supportedFileTypes]"
              include-manual
              :tooltip="$t('knowledgeBase.addDocument')"
              @files="uploadFiles"
              @url="importUrl"
              @manual="createManual"
            />
          </div>

          <!-- Product-only filters retained without changing their behavior. -->
          <div class="reference-toolbar__secondary">
            <label class="reference-select-field reference-select-field--source">
              <ReferenceIcon name="globe" :size="14" />
              <select v-model="selectedSource" :aria-label="$t('knowledgeBase.allSources')">
                <option v-for="option in sourceOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <ReferenceIcon name="chevron-down" :size="11" class="muted" />
            </label>
            <label class="reference-date-field">
              <input v-model="updatedTimeRange[0]" type="date" :aria-label="$t('knowledgeBase.updatedTimeFrom')" />
              <span>–</span>
              <input v-model="updatedTimeRange[1]" type="date" :aria-label="$t('knowledgeBase.updatedTimeTo')" />
            </label>
          </div>
        </div>

        <div class="reference-doc-scroll">
          <div v-if="docListLoading && !cardList.length" class="reference-skeleton-grid">
            <div v-for="n in 8" :key="n" class="reference-skeleton-card">
              <span class="reference-skeleton-line title" />
              <span class="reference-skeleton-line" />
              <span class="reference-skeleton-line short" />
            </div>
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

          <div v-else-if="!docListLoading" class="reference-empty-state">
            <ReferenceIcon name="file-text" :size="38" :stroke-width="1.5" />
            <strong>暂无文档</strong>
          </div>
        </div>

        <div class="reference-batch-anchor" v-show="batchMode || selectedIds.size">
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
    <BatchTagDialog
      :visible="batchTagDialogVisible"
      :count="selectedIds.size"
      :kb-id="kbId"
      :tag-list="tagList"
      :pre-selected-tag-ids="batchTagPreSelectedIds"
      :can-manage="canEdit"
      :confirm-loading="batchTagging"
      @update:visible="batchTagDialogVisible = $event"
      @confirm="onBatchTagConfirm"
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
.reference-faq-stage { height: 100%; overflow: auto; padding: 24px 32px; box-sizing: border-box; }
.reference-kb-page {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 28px 0;
  box-sizing: border-box;
  background: rgb(249 250 251 / .3);
  color: #1f2937;
  font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
  overflow: hidden;
}
.reference-kb-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(229 231 235 / .8);
  flex: 0 0 auto;
}
.reference-kb-header__copy { min-width: 0; }
.reference-breadcrumb { display: flex; align-items: center; gap: 8px; min-height: 24px; color: #6b7280; font-size: 12px; }
.reference-breadcrumb__back,
.reference-breadcrumb__kb {
  max-width: 440px;
  min-width: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.reference-breadcrumb__kb { color: #111827; font-weight: 700; }
.reference-breadcrumb__kb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-breadcrumb__separator { color: #d1d5db; }
.reference-breadcrumb__current { color: #9ca3af; }
.reference-kb-header__copy > p { margin: 3px 0 0; color: #6b7280; font-size: 12px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reference-kb-tabs { display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid #e5e7eb; border-radius: 14px; background: #f3f4f6; flex: 0 0 auto; }
.reference-kb-tabs button { height: 30px; padding: 0 12px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: #6b7280; display: flex; align-items: center; gap: 6px; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.reference-kb-tabs button.active { border-color: rgb(229 231 235 / .6); background: #fff; color: #111827; box-shadow: 0 1px 2px rgb(0 0 0 / .04); }
.reference-spin { animation: reference-spin 900ms linear infinite; }
.reference-wiki-stage { min-height: 0; flex: 1; padding-top: 14px; overflow: hidden; }
.reference-doc-stage { display: flex; gap: 12px; min-height: 0; flex: 1; padding-top: 20px; overflow: hidden; }
.reference-directory-collapsed { width: 36px; flex: 0 0 36px; min-height: 0; padding: 12px 4px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; }
.reference-directory-collapsed button { width: 100%; padding: 4px 0; border: 0; border-radius: 8px; background: transparent; color: #4b5563; display: flex; flex-direction: column; align-items: center; gap: 4px; font-family: inherit; font-size: 10px; font-weight: 600; cursor: pointer; }
.reference-directory-collapsed button:hover { background: #f3f4f6; }
.reference-document-workspace { position: relative; min-width: 0; min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 12px; }
.reference-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "primary actions" "secondary secondary"; gap: 8px 10px; padding: 10px; border: 1px solid rgb(229 231 235 / .9); border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / .025); flex: 0 0 auto; }
.reference-toolbar__primary { grid-area: primary; display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.reference-toolbar__actions { grid-area: actions; display: flex; align-items: center; gap: 8px; }
.reference-toolbar__secondary { grid-area: secondary; display: flex; align-items: center; gap: 8px; }
.reference-root-path { height: 30px; max-width: 230px; padding: 0 10px; border-radius: 12px; background: #f3f4f6; color: #6b7280; display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap; overflow: hidden; }
.reference-root-path button { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0; padding: 0; background: transparent; color: #374151; font: inherit; font-weight: 700; cursor: pointer; }
.reference-root-path button.current { color: #111827; }
.muted { color: #9ca3af; }
.reference-search-field { width: 220px; min-width: 160px; height: 30px; padding: 0 9px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 12px; background: rgb(249 250 251 / .8); color: #9ca3af; display: flex; align-items: center; gap: 7px; }
.reference-search-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #374151; font: inherit; font-size: 12px; }
.reference-search-field input::placeholder { color: #9ca3af; }
.reference-search-field button { width: 18px; height: 18px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #9ca3af; cursor: pointer; }
.reference-filter-anchor { position: relative; }
.reference-filter-button,
.reference-select-field { height: 30px; padding: 0 10px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; color: #374151; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; font-size: 12px; font-weight: 600; white-space: nowrap; }
.reference-filter-button { cursor: pointer; }
.reference-filter-button:hover { background: #f9fafb; }
.reference-filter-backdrop { position: fixed; inset: 0; z-index: 80; }
.reference-tag-filter-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 90; width: 300px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; box-shadow: 0 16px 30px rgb(0 0 0 / .10); }
.reference-tag-filter-search { height: 30px; padding: 0 9px; border: 1px solid #e5e7eb; border-radius: 9px; color: #9ca3af; display: flex; align-items: center; gap: 6px; }
.reference-tag-filter-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #111827; font: inherit; font-size: 11px; }
.reference-tag-filter-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; max-height: 220px; overflow: auto; }
.reference-tag-filter-list button { height: 26px; padding: 0 8px; border: 1px solid #e5e7eb; border-radius: 7px; background: #fff; color: #4b5563; display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 10px; cursor: pointer; }
.reference-tag-filter-list button.active { border-color: #111827; background: #111827; color: #fff; }
.reference-tag-filter-list small { opacity: .6; }
.reference-filter-loading { padding: 18px 4px; color: #9ca3af; text-align: center; font-size: 11px; }
.reference-tag-filter-manage { margin-top: 9px; padding: 4px 0; border: 0; background: transparent; color: #6b7280; font: inherit; font-size: 10px; font-weight: 600; cursor: pointer; }
.reference-select-field { position: relative; min-width: 132px; padding-right: 8px; }
.reference-select-field select { flex: 1; min-width: 0; height: 28px; border: 0; outline: 0; appearance: none; background: transparent; color: #374151; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.reference-select-field--status { min-width: 132px; }
.reference-select-field--source { min-width: 148px; }
.reference-date-field { height: 30px; padding: 0 8px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 12px; display: flex; align-items: center; gap: 5px; color: #9ca3af; }
.reference-date-field input { width: 120px; border: 0; outline: 0; background: transparent; color: #6b7280; font: inherit; font-size: 10px; }
.reference-view-toggle { display: flex; padding: 2px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f3f4f6; }
.reference-view-toggle button { width: 30px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #9ca3af; display: grid; place-items: center; cursor: pointer; }
.reference-view-toggle button.active { background: #fff; color: #111827; box-shadow: 0 1px 2px rgb(0 0 0 / .04); }
.reference-doc-scroll { position: relative; min-height: 0; flex: 1; overflow: auto; }
.reference-skeleton-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.reference-skeleton-card { height: 192px; padding: 16px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; overflow: hidden; }
.reference-skeleton-line { display: block; width: 100%; height: 12px; margin-top: 12px; border-radius: 6px; background: linear-gradient(90deg, #f3f4f6, #fafafa, #f3f4f6); background-size: 200% 100%; animation: reference-shimmer 1.2s linear infinite; }
.reference-skeleton-line.title { width: 62%; height: 14px; margin-top: 0; }
.reference-skeleton-line.short { width: 74%; }
.reference-empty-state { height: 100%; min-height: 260px; border: 1px solid #e5e7eb; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #9ca3af; font-size: 12px; }
.reference-empty-state strong { color: #4b5563; font-size: 13px; }
.reference-batch-anchor { position: absolute; left: 0; right: 0; bottom: 14px; z-index: 20; display: flex; justify-content: center; pointer-events: none; }
.reference-batch-anchor > * { pointer-events: auto; }
@media (max-width: 1320px) { .reference-skeleton-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .reference-search-field { width: 190px; } }
@media (max-width: 900px) { .reference-toolbar { grid-template-columns: 1fr; grid-template-areas: "primary" "actions" "secondary"; } .reference-toolbar__actions { justify-content: flex-end; } .reference-toolbar__secondary { flex-wrap: wrap; } }
@media (max-width: 767px) { .reference-kb-page { padding: 16px 16px 0; } .reference-kb-header { flex-direction: column; } .reference-kb-tabs { align-self: stretch; } .reference-kb-tabs button { flex: 1; justify-content: center; } .reference-doc-stage { flex-direction: column; } .reference-skeleton-grid { grid-template-columns: 1fr; } .reference-directory-collapsed { width: 100%; min-height: 38px; flex-basis: auto; padding: 4px; } .reference-directory-collapsed button { flex-direction: row; justify-content: center; } }
@keyframes reference-spin { to { transform: rotate(360deg); } }
@keyframes reference-shimmer { to { background-position: -200% 0; } }
</style>
