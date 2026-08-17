<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import SettingDrawer from '@/components/settings/SettingDrawer.vue'
import { marked } from 'marked'
import { MessagePlugin } from 'tdesign-vue-next'
import { useUIStore } from '@/stores/ui'
import {
  listKnowledgeBases,
  getKnowledgeDetails,
  createManualKnowledge,
  updateManualKnowledge,
} from '@/api/knowledge-base'
import { useOrganizationStore } from '@/stores/organization'
import { sanitizeHTML, safeMarkdownToHTML } from '@/utils/security'
import { useI18n } from 'vue-i18n'

interface KnowledgeBaseOption {
  label: string
  value: string
}

interface KnowledgeDetailResponse {
  id: string
  knowledge_base_id: string
  title?: string
  file_name?: string
  metadata?: any
  parse_status?: string
  tags?: Array<{ id: string }>
}

type ManualStatus = 'draft' | 'publish'

/** Derive editor status from metadata + parse_status (parse pipeline wins when indexed or in flight). */
const resolveManualKnowledgeStatus = (
  metaStatus: ManualStatus | undefined,
  parseStatus?: string,
): ManualStatus => {
  if (!parseStatus || parseStatus === 'draft') {
    return metaStatus === 'publish' ? 'publish' : 'draft'
  }
  if (
    parseStatus === 'completed' ||
    parseStatus === 'pending' ||
    parseStatus === 'processing' ||
    parseStatus === 'finalizing'
  ) {
    return 'publish'
  }
  return metaStatus === 'publish' ? 'publish' : 'draft'
}

const uiStore = useUIStore()
const organizationStore = useOrganizationStore()
const { t } = useI18n()

const visible = computed({
  get: () => uiStore.manualEditorVisible,
  set: (val: boolean) => {
    if (!val) {
      handleClose()
    }
  },
})

const mode = computed(() => uiStore.manualEditorMode)
const knowledgeId = computed(() => uiStore.manualEditorKnowledgeId)
const currentKnowledgeId = ref<string | null>(null)
const manualTagIds = ref<string[]>([])

const form = reactive({
  kbId: '' as string,
  title: '',
  content: '',
  status: 'draft' as ManualStatus,
})

const initialLoaded = ref(false)
const kbOptions = ref<KnowledgeBaseOption[]>([])
const kbLoading = ref(false)
const contentLoading = ref(false)
const saving = ref(false)
const savingAction = ref<ManualStatus>('draft')
const activeTab = ref<'edit' | 'preview'>('edit')
const lastUpdatedAt = ref<string>('')

const textareaComponent = ref<any>(null)
const textareaElement = ref<HTMLTextAreaElement | null>(null)
const selectionRange = reactive({ start: 0, end: 0 })
const selectionEvents = ['select', 'keyup', 'click', 'mouseup', 'input']

const resolveTextareaElement = (): HTMLTextAreaElement | null => {
  const component = textareaComponent.value as any
  if (!component) return null
  if (typeof HTMLTextAreaElement !== 'undefined' && component instanceof HTMLTextAreaElement) {
    return component
  }
  if (component.textareaRef) {
    return component.textareaRef as HTMLTextAreaElement
  }
  if (component.$el) {
    const el = component.$el.querySelector('textarea')
    if (el) {
      return el as HTMLTextAreaElement
    }
  }
  return null
}

const handleTextareaSelectionEvent = () => {
  const textarea = textareaElement.value ?? resolveTextareaElement()
  if (!textarea) {
    return
  }
  selectionRange.start = textarea.selectionStart ?? 0
  selectionRange.end = textarea.selectionEnd ?? 0
}

const detachTextareaListeners = () => {
  if (!textareaElement.value) {
    return
  }
  selectionEvents.forEach((eventName) => {
    textareaElement.value?.removeEventListener(eventName, handleTextareaSelectionEvent)
  })
  textareaElement.value = null
}

const attachTextareaListeners = () => {
  nextTick(() => {
    const textarea = resolveTextareaElement()
    if (!textarea) {
      return
    }
    if (textareaElement.value === textarea) {
      return
    }
    detachTextareaListeners()
    textareaElement.value = textarea
    selectionEvents.forEach((eventName) => {
      textarea.addEventListener(eventName, handleTextareaSelectionEvent)
    })
    handleTextareaSelectionEvent()
  })
}

const setSelectionRange = (start: number, end: number) => {
  selectionRange.start = start
  selectionRange.end = end
  nextTick(() => {
    const textarea = resolveTextareaElement()
    if (!textarea || activeTab.value !== 'edit') {
      return
    }
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(start, end)
  })
}

const getSelectionRange = () => {
  return {
    start: selectionRange.start ?? 0,
    end: selectionRange.end ?? 0,
  }
}

const clampRange = (start: number, end: number, length: number) => {
  let safeStart = Math.max(0, Math.min(start, length))
  let safeEnd = Math.max(0, Math.min(end, length))
  if (safeEnd < safeStart) {
    ;[safeStart, safeEnd] = [safeEnd, safeStart]
  }
  return { safeStart, safeEnd }
}

const updateContentWithSelection = (content: string, start: number, end: number) => {
  form.content = content
  setSelectionRange(start, end)
}

const findLineStart = (value: string, index: number) => {
  if (index <= 0) return 0
  const lastNewline = value.lastIndexOf('\n', index - 1)
  return lastNewline === -1 ? 0 : lastNewline + 1
}

const findLineEnd = (value: string, index: number) => {
  if (index >= value.length) return value.length
  const newlineIndex = value.indexOf('\n', index)
  return newlineIndex === -1 ? value.length : newlineIndex
}

const transformSelectedLines = (transformer: (line: string, index: number) => string) => {
  const value = form.content ?? ''
  const { start, end } = getSelectionRange()
  const { safeStart, safeEnd } = clampRange(start, end, value.length)
  const lineStart = findLineStart(value, safeStart)
  const lineEnd = findLineEnd(value, safeEnd)
  const selected = value.slice(lineStart, lineEnd)
  const lines = selected.split('\n')
  const transformed = lines.map((line, index) => transformer(line, index))
  const result = transformed.join('\n')
  const newContent = value.slice(0, lineStart) + result + value.slice(lineEnd)
  updateContentWithSelection(newContent, lineStart, lineStart + result.length)
}

const wrapSelection = (prefix: string, suffix: string, placeholder: string) => {
  const value = form.content ?? ''
  const { start, end } = getSelectionRange()
  const { safeStart, safeEnd } = clampRange(start, end, value.length)
  const hasSelection = safeEnd > safeStart
  const selectedText = hasSelection ? value.slice(safeStart, safeEnd) : placeholder
  const result =
    value.slice(0, safeStart) + prefix + selectedText + suffix + value.slice(safeEnd)
  const selectionStart = safeStart + prefix.length
  const selectionEnd = selectionStart + selectedText.length
  updateContentWithSelection(result, selectionStart, selectionEnd)
}

const insertBlock = (
  text: string,
  selectionStartOffset?: number,
  selectionEndOffset?: number,
) => {
  const value = form.content ?? ''
  const { start, end } = getSelectionRange()
  const { safeStart, safeEnd } = clampRange(start, end, value.length)
  const before = value.slice(0, safeStart)
  const after = value.slice(safeEnd)
  const result = before + text + after
  const base = safeStart
  const selectionStart =
    selectionStartOffset !== undefined ? base + selectionStartOffset : base + text.length
  const selectionEnd =
    selectionEndOffset !== undefined ? base + selectionEndOffset : selectionStart
  updateContentWithSelection(result, selectionStart, selectionEnd)
}

const applyHeading = (level: number) => {
  const hashes = '#'.repeat(level)
  transformSelectedLines((line) => {
    const trimmed = line.replace(/^#+\s*/, '').trim()
    const content = trimmed || t('manualEditor.placeholders.heading', { level })
    return `${hashes} ${content}`
  })
}

const listPrefixPattern =
  /^(\s*(?:[-*+]|\d+\.)\s+|\s*-\s+\[[ xX]\]\s+)/

const applyBulletList = () => {
  transformSelectedLines((line) => {
    const trimmed = line.trim()
    const content = trimmed.replace(listPrefixPattern, '').trim()
    return `- ${content || t('manualEditor.placeholders.listItem')}`
  })
}

const applyOrderedList = () => {
  transformSelectedLines((line, index) => {
    const trimmed = line.trim()
    const content = trimmed.replace(listPrefixPattern, '').trim()
    return `${index + 1}. ${content || t('manualEditor.placeholders.listItem')}`
  })
}

const applyTaskList = () => {
  transformSelectedLines((line) => {
    const trimmed = line.trim()
    const content = trimmed.replace(listPrefixPattern, '').trim()
    return `- [ ] ${content || t('manualEditor.placeholders.taskItem')}`
  })
}

const applyBlockquote = () => {
  transformSelectedLines((line) => {
    const trimmed = line.trim().replace(/^>\s?/, '').trim()
    return `> ${trimmed || t('manualEditor.placeholders.quote')}`
  })
}

const insertCodeBlock = () => {
  const placeholder = t('manualEditor.placeholders.code')
  const block = `\n\`\`\`\n${placeholder}\n\`\`\`\n`
  const startOffset = block.indexOf(placeholder)
  insertBlock(block, startOffset, startOffset + placeholder.length)
}

const insertHorizontalRule = () => {
  insertBlock('\n---\n\n')
}

const insertTable = () => {
  const cell = t('manualEditor.table.cell')
  const template = `\n| ${t('manualEditor.table.column1')} | ${t('manualEditor.table.column2')} |\n| --- | --- |\n| ${cell} | ${cell} |\n`
  const placeholderIndex = template.indexOf(cell)
  insertBlock(template, placeholderIndex, placeholderIndex + cell.length)
}

const insertLink = () => {
  const value = form.content ?? ''
  const { start, end } = getSelectionRange()
  const { safeStart, safeEnd } = clampRange(start, end, value.length)
  const selectedText =
    safeEnd > safeStart ? value.slice(safeStart, safeEnd) : t('manualEditor.placeholders.linkText')
  const urlPlaceholder = 'https://'
  const result =
    value.slice(0, safeStart) +
    `[${selectedText}](${urlPlaceholder})` +
    value.slice(safeEnd)
  const urlStart = safeStart + selectedText.length + 3
  const urlEnd = urlStart + urlPlaceholder.length
  updateContentWithSelection(result, urlStart, urlEnd)
}

const insertImage = () => {
  const value = form.content ?? ''
  const { start, end } = getSelectionRange()
  const { safeStart, safeEnd } = clampRange(start, end, value.length)
  const altText = safeEnd > safeStart ? value.slice(safeStart, safeEnd) : t('manualEditor.placeholders.imageAlt')
  const urlPlaceholder = 'https://'
  const result =
    value.slice(0, safeStart) +
    `![${altText}](${urlPlaceholder})` +
    value.slice(safeEnd)
  const urlStart = safeStart + altText.length + 4
  const urlEnd = urlStart + urlPlaceholder.length
  updateContentWithSelection(result, urlStart, urlEnd)
}

type ToolbarAction = () => void
type ToolbarButton = {
  key: string
  tooltip: string
  action: ToolbarAction
  icon: string
}
type ToolbarGroup = {
  key: string
  buttons: ToolbarButton[]
}

const toolbarGroups = computed<ToolbarGroup[]>(() => [
  {
    key: 'format',
    buttons: [
      { key: 'bold', icon: 'textformat-bold', tooltip: t('manualEditor.toolbar.bold'), action: () => wrapSelection('**', '**', t('manualEditor.placeholders.bold')) },
      { key: 'italic', icon: 'textformat-italic', tooltip: t('manualEditor.toolbar.italic'), action: () => wrapSelection('*', '*', t('manualEditor.placeholders.italic')) },
      { key: 'strike', icon: 'textformat-strikethrough', tooltip: t('manualEditor.toolbar.strike'), action: () => wrapSelection('~~', '~~', t('manualEditor.placeholders.strike')) },
      { key: 'inline-code', icon: 'code', tooltip: t('manualEditor.toolbar.inlineCode'), action: () => wrapSelection('`', '`', t('manualEditor.placeholders.inlineCode')) },
    ],
  },
  {
    key: 'heading',
    buttons: [
      { key: 'h1', icon: 'numbers-1', tooltip: t('manualEditor.toolbar.heading1'), action: () => applyHeading(1) },
      { key: 'h2', icon: 'numbers-2', tooltip: t('manualEditor.toolbar.heading2'), action: () => applyHeading(2) },
      { key: 'h3', icon: 'numbers-3', tooltip: t('manualEditor.toolbar.heading3'), action: () => applyHeading(3) },
    ],
  },
  {
    key: 'list',
    buttons: [
      { key: 'ul', icon: 'view-list', tooltip: t('manualEditor.toolbar.bulletList'), action: applyBulletList },
      { key: 'ol', icon: 'list-numbered', tooltip: t('manualEditor.toolbar.orderedList'), action: applyOrderedList },
      { key: 'task', icon: 'check-rectangle', tooltip: t('manualEditor.toolbar.taskList'), action: applyTaskList },
      { key: 'quote', icon: 'quote', tooltip: t('manualEditor.toolbar.blockquote'), action: applyBlockquote },
    ],
  },
  {
    key: 'insert',
    buttons: [
      { key: 'codeblock', icon: 'code-1', tooltip: t('manualEditor.toolbar.codeBlock'), action: insertCodeBlock },
      { key: 'link', icon: 'link', tooltip: t('manualEditor.toolbar.link'), action: insertLink },
      { key: 'image', icon: 'image', tooltip: t('manualEditor.toolbar.image'), action: insertImage },
      { key: 'table', icon: 'table', tooltip: t('manualEditor.toolbar.table'), action: insertTable },
      { key: 'hr', icon: 'component-divider-horizontal', tooltip: t('manualEditor.toolbar.horizontalRule'), action: insertHorizontalRule },
    ],
  },
])

const isPreviewMode = computed(() => activeTab.value === 'preview')
const viewToggleIcon = computed(() => (isPreviewMode.value ? 'edit-1' : 'browse'))
const viewToggleLabel = computed(() =>
  isPreviewMode.value ? t('manualEditor.view.editLabel') : t('manualEditor.view.previewLabel'),
)

const handleToolbarAction = (action: ToolbarAction) => {
  if (saving.value) {
    return
  }
  if (activeTab.value !== 'edit') {
    activeTab.value = 'edit'
    nextTick(() => {
      attachTextareaListeners()
      action()
    })
  } else {
    attachTextareaListeners()
    action()
  }
}

const toggleEditorView = () => {
  activeTab.value = isPreviewMode.value ? 'edit' : 'preview'
}

marked.use({})

const previewHTML = computed(() => {
  if (!form.content) {
    return `<p class="empty-preview">${t('manualEditor.preview.empty')}</p>`
  }
  const safeMarkdown = safeMarkdownToHTML(form.content)
  const html = marked.parse(safeMarkdown, { async: false })
  return sanitizeHTML(html)
})

const kbDisabled = computed(() => mode.value === 'edit' && !!form.kbId)

const dialogTitle = computed(() =>
  mode.value === 'edit' ? t('manualEditor.title.edit') : t('manualEditor.title.create'),
)

const lastUpdatedText = computed(() =>
  lastUpdatedAt.value ? t('manualEditor.status.lastUpdated', { time: lastUpdatedAt.value }) : '',
)

const loadKnowledgeBases = async () => {
  kbLoading.value = true
  try {
    const [ownRes, sharedKbs] = await Promise.all([
      listKnowledgeBases() as Promise<any>,
      organizationStore.fetchSharedKnowledgeBases().catch(() => []),
    ])

    const isDocumentKb = (type?: string) => !type || type === 'document'

    const ownKbs = Array.isArray(ownRes?.data) ? ownRes.data : []
    const list: KnowledgeBaseOption[] = ownKbs
      .filter((item: any) => isDocumentKb(item.type))
      .map((item: any) => ({ label: item.name, value: item.id }))

    const seen = new Set(list.map((o) => o.value))
    for (const share of sharedKbs) {
      const kb = share?.knowledge_base
      const canWrite = share?.permission === 'editor' || share?.permission === 'admin'
      if (!kb || !canWrite || !isDocumentKb(kb.type) || seen.has(kb.id)) continue
      seen.add(kb.id)
      list.push({ label: kb.name, value: kb.id })
    }

    kbOptions.value = list

    if (mode.value === 'create') {
      const presetKbId = uiStore.manualEditorKBId
      if (presetKbId) {
        const exists = list.find((item) => item.value === presetKbId)
        if (!exists) {
          kbOptions.value.unshift({
            label: t('manualEditor.labels.currentKnowledgeBase'),
            value: presetKbId,
          })
        }
        form.kbId = presetKbId
      } else {
        form.kbId = list[0]?.value ?? ''
      }
    }
  } catch (error) {
    console.error('[ManualEditor] Failed to load knowledge base list:', error)
    kbOptions.value = []
  } finally {
    kbLoading.value = false
  }
}

const parseManualMetadata = (
  metadata: any,
): { content: string; status: ManualStatus; updatedAt?: string } | null => {
  if (!metadata) {
    return null
  }
  try {
    let parsed = metadata
    if (typeof metadata === 'string') {
      parsed = JSON.parse(metadata)
    }
    if (parsed && typeof parsed === 'object') {
      const status = parsed.status === 'publish' ? 'publish' : 'draft'
      return {
        content: parsed.content || '',
        status,
        updatedAt: parsed.updated_at || parsed.updatedAt,
      }
    }
  } catch (error) {
    console.warn('[ManualEditor] Failed to parse manual metadata:', error)
  }
  return null
}

const loadKnowledgeContent = async () => {
  if (!currentKnowledgeId.value) {
    return
  }
  contentLoading.value = true
  try {
    const res: any = await getKnowledgeDetails(currentKnowledgeId.value)
    const data: KnowledgeDetailResponse | undefined = res?.data
    if (!data) {
      MessagePlugin.error(t('manualEditor.error.fetchDetailFailed'))
      return
    }

    form.kbId = data.knowledge_base_id || form.kbId
    const meta = parseManualMetadata(data.metadata)
    form.title =
      data.title ||
      data.file_name?.replace(/\.md$/i, '') ||
      uiStore.manualEditorInitialTitle ||
      ''
    form.content = meta?.content || uiStore.manualEditorInitialContent || ''
    form.status = resolveManualKnowledgeStatus(meta?.status, data.parse_status)
    manualTagIds.value = (data.tags || []).map(tag => String(tag.id))
    if (meta?.updatedAt) {
      lastUpdatedAt.value = meta.updatedAt
    }

    if (form.kbId && !kbOptions.value.find((item) => item.value === form.kbId)) {
      kbOptions.value.unshift({
        label: t('manualEditor.labels.currentKnowledgeBase'),
        value: form.kbId,
      })
    }
  } catch (error) {
    console.error('[ManualEditor] Failed to load manual knowledge:', error)
    MessagePlugin.error(t('manualEditor.error.fetchDetailFailed'))
  } finally {
    contentLoading.value = false
  }
}

const resetForm = () => {
  currentKnowledgeId.value = knowledgeId.value || null
  form.kbId = uiStore.manualEditorKBId || ''
  form.title = uiStore.manualEditorInitialTitle || ''
  form.content = uiStore.manualEditorInitialContent || ''
  form.status = uiStore.manualEditorInitialStatus || 'draft'
  activeTab.value = 'edit'
  lastUpdatedAt.value = ''
  initialLoaded.value = false
  manualTagIds.value = mode.value === 'create' ? [...uiStore.selectedTagIds] : []
  selectionRange.start = 0
  selectionRange.end = 0
}

const generateDefaultTitle = () => {
  if (uiStore.manualEditorInitialTitle) {
    return uiStore.manualEditorInitialTitle
  }
  return `${t('manualEditor.defaultTitlePrefix')}-${new Date().toLocaleString()}`
}

const initialize = async () => {
  resetForm()
  await loadKnowledgeBases()

  if (mode.value === 'edit') {
    await loadKnowledgeContent()
  } else {
    const presetKbId = uiStore.manualEditorKBId
    if (presetKbId) {
      form.kbId = presetKbId
    } else if (!form.kbId && kbOptions.value.length) {
      form.kbId = kbOptions.value[0].value
    }
    form.title = form.title || generateDefaultTitle()
    form.content = form.content || ''
  }

  initialLoaded.value = true
}

const validateForm = (targetStatus: ManualStatus): boolean => {
  if (!form.kbId) {
    MessagePlugin.warning(t('manualEditor.warning.selectKnowledgeBase'))
    return false
  }
  if (!form.title || !form.title.trim()) {
    MessagePlugin.warning(t('manualEditor.warning.enterTitle'))
    return false
  }
  if (!form.content || !form.content.trim()) {
    MessagePlugin.warning(t('manualEditor.warning.enterContent'))
    return false
  }
  if (targetStatus === 'publish' && form.content.trim().length < 10) {
    MessagePlugin.warning(t('manualEditor.warning.contentTooShort'))
    return false
  }
  return true
}

const handleSave = async (targetStatus: ManualStatus) => {
  if (saving.value || !validateForm(targetStatus)) {
    return
  }
  saving.value = true
  savingAction.value = targetStatus
  try {
    const payload: {
      title: string
      content: string
      status: string
      tag_ids?: string[]
    } = {
      title: form.title.trim(),
      content: form.content,
      status: targetStatus,
    }
    payload.tag_ids = [...manualTagIds.value]

    let response: any
    let knowledgeID = currentKnowledgeId.value
    let kbId = form.kbId

    if (mode.value === 'edit' && currentKnowledgeId.value) {
      response = await updateManualKnowledge(currentKnowledgeId.value, payload)
    } else {
      response = await createManualKnowledge(form.kbId, payload)
      knowledgeID = response?.data?.id || knowledgeID
      currentKnowledgeId.value = knowledgeID || null
      uiStore.manualEditorKnowledgeId = currentKnowledgeId.value
      kbId = form.kbId
    }

    if (response?.success) {
      MessagePlugin.success(
        targetStatus === 'draft'
          ? t('manualEditor.success.draftSaved')
          : t('manualEditor.success.published'),
      )
      if (knowledgeID) {
        uiStore.notifyManualEditorSuccess({
          kbId,
          knowledgeId: knowledgeID,
          status: targetStatus,
        })
      }
      uiStore.closeManualEditor()
    } else {
      const message = response?.message || t('manualEditor.error.saveFailed')
      MessagePlugin.error(message)
    }
  } catch (error: any) {
    const message = error?.error?.message || error?.message || t('manualEditor.error.saveFailed')
    MessagePlugin.error(message)
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  uiStore.closeManualEditor()
}

watch(visible, async (val) => {
  if (val) {
    await nextTick()
    await initialize()
    await nextTick()
    attachTextareaListeners()
    const length = form.content ? form.content.length : 0
    setSelectionRange(length, length)
  } else {
    detachTextareaListeners()
    resetForm()
  }
})

watch(activeTab, (val) => {
  if (val === 'edit') {
    nextTick(() => {
      attachTextareaListeners()
    })
  } else {
    detachTextareaListeners()
  }
})

onBeforeUnmount(() => {
  detachTextareaListeners()
})
</script>

<template>
  <SettingDrawer
    :visible="visible"
    class="manual-editor-reference-drawer"
    title="在线编辑 Markdown 知识"
    description="使用 Markdown 编写知识内容，支持实时预览"
    width="672px"
    :min-width="560"
    :max-width="1280"
    storage-key="setting-drawer:width:manual-markdown-editor"
    :hide-footer="!initialLoaded"
    @update:visible="(v: boolean) => { visible = v }"
  >
    <template #headerIcon>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
    </template>

    <template #footer-left>
      <div class="reference-editor-status" :class="{ published: form.status === 'publish' }">
        <span class="reference-editor-status__dot" />
        <span>当前状态: {{ form.status === 'draft' ? '草稿' : '已发布' }}</span>
      </div>
    </template>

    <template #footer-right>
      <div class="reference-editor-actions">
        <button type="button" class="reference-editor-cancel" :disabled="saving" @click="handleClose">
          {{ $t('manualEditor.actions.cancel') }}
        </button>
        <button
          type="button"
          class="reference-editor-draft"
          :disabled="saving && savingAction !== 'draft'"
          @click="handleSave('draft')"
        >
          <span v-if="saving && savingAction === 'draft'" class="reference-editor-spinner" />
          {{ $t('manualEditor.actions.saveDraft') }}
        </button>
        <button
          type="button"
          class="reference-editor-publish"
          :disabled="saving || !form.title.trim()"
          @click="handleSave('publish')"
        >
          <span v-if="saving && savingAction === 'publish'" class="reference-editor-spinner" />
          {{ $t('manualEditor.actions.publish') }}
        </button>
      </div>
    </template>

    <div v-if="initialLoaded" class="reference-online-editor">
      <section class="reference-editor-section">
        <div class="reference-editor-section-title"><span />{{ $t('manualEditor.section.basic') }}</div>

        <div class="reference-editor-field">
          <label>{{ $t('manualEditor.form.titleLabel') }} <b>*</b></label>
          <div class="reference-editor-input-wrap">
            <input
              v-model="form.title"
              type="text"
              maxlength="100"
              :placeholder="$t('manualEditor.form.titlePlaceholder')"
              class="reference-editor-input"
            />
            <span class="reference-editor-count">{{ form.title.length }}/100</span>
          </div>
        </div>

        <div class="reference-editor-field">
          <label>{{ $t('manualEditor.form.knowledgeBaseLabel') }} <b>*</b></label>
          <div class="reference-editor-select-wrap">
            <select
              v-model="form.kbId"
              class="reference-editor-select"
              :disabled="kbDisabled || kbLoading"
            >
              <option value="" disabled>{{ $t('manualEditor.form.knowledgeBasePlaceholder') }}</option>
              <option v-for="option in kbOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </div>
          <p v-if="lastUpdatedText" class="reference-editor-help">{{ lastUpdatedText }}</p>
        </div>
      </section>

      <section class="reference-editor-section reference-editor-content-section">
        <div class="reference-editor-section-title"><span />{{ $t('manualEditor.section.content') }}</div>

        <div class="reference-editor-card">
          <div class="reference-editor-toolbar">
            <div class="reference-editor-toolbar__tools">
              <template v-for="(group, groupIndex) in toolbarGroups" :key="group.key">
                <div class="reference-editor-tool-group">
                  <button
                    v-for="btn in group.buttons"
                    :key="btn.key"
                    type="button"
                    class="reference-editor-tool"
                    :class="[`tool-${btn.key}`, { accent: btn.key === 'hr' }]"
                    :title="btn.tooltip"
                    :disabled="saving"
                    @mousedown.prevent
                    @click="handleToolbarAction(btn.action)"
                  >
                    <template v-if="btn.key === 'bold'"><strong>B</strong></template>
                    <template v-else-if="btn.key === 'italic'"><em>I</em></template>
                    <template v-else-if="btn.key === 'strike'"><s>S</s></template>
                    <template v-else-if="btn.key === 'inline-code'"><code>&lt;/&gt;</code></template>
                    <template v-else-if="btn.key === 'h1'"><strong>1</strong></template>
                    <template v-else-if="btn.key === 'h2'"><strong>2</strong></template>
                    <template v-else-if="btn.key === 'h3'"><strong>3</strong></template>
                    <svg v-else-if="btn.key === 'ul'" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
                    <svg v-else-if="btn.key === 'ol'" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                    <svg v-else-if="btn.key === 'task'" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 2 2 4-4"/></svg>
                    <svg v-else-if="btn.key === 'quote'" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h4c0 4-2 6-5 6z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h4c0 4-2 6-5 6z"/></svg>
                    <svg v-else-if="btn.key === 'codeblock'" viewBox="0 0 24 24" aria-hidden="true"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                    <svg v-else-if="btn.key === 'link'" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <svg v-else-if="btn.key === 'image'" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>
                    <svg v-else-if="btn.key === 'table'" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
                  </button>
                </div>
                <div v-if="groupIndex < toolbarGroups.length - 1" class="reference-editor-divider" />
              </template>
            </div>

            <button
              type="button"
              class="reference-editor-view-toggle"
              :class="{ preview: !isPreviewMode }"
              :disabled="saving"
              @click="toggleEditorView"
            >
              <svg v-if="isPreviewMode" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.67 7.8 7.33 5 12 5c4.67 0 8.33 2.8 9.94 6.65a1 1 0 0 1 0 .7C20.33 16.2 16.67 19 12 19c-4.67 0-8.33-2.8-9.94-6.65z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>{{ viewToggleLabel }}</span>
            </button>
          </div>

          <div v-if="contentLoading" class="reference-editor-loading">{{ $t('manualEditor.loading.content') }}</div>
          <textarea
            v-else-if="activeTab === 'edit'"
            ref="textareaComponent"
            v-model="form.content"
            :placeholder="$t('manualEditor.form.contentPlaceholder')"
            class="reference-editor-textarea"
          />
          <div v-else class="reference-editor-preview" v-html="previewHTML" />
        </div>
      </section>
    </div>

    <div v-else class="reference-editor-loading reference-editor-loading--page">{{ $t('manualEditor.loading.preparing') }}</div>
  </SettingDrawer>
</template>

<style scoped>
.reference-online-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #1f2937;
  font-family: Inter, "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;
}
.reference-online-editor :deep(*) { box-sizing: border-box; }
.reference-editor-section { display: flex; flex-direction: column; gap: 16px; }
.reference-editor-content-section { gap: 12px; }
.reference-editor-section-title { display: flex; align-items: center; gap: 8px; color: #111827; font-size: 12px; line-height: 16px; font-weight: 700; }
.reference-editor-section-title > span { width: 4px; height: 14px; border-radius: 1px; background: #1677ff; }
.reference-editor-field { display: flex; flex-direction: column; gap: 6px; }
.reference-editor-field label { color: #374151; font-size: 12px; line-height: 16px; font-weight: 500; }
.reference-editor-field label b { color: #ef4444; font-weight: 500; }
.reference-editor-input-wrap,.reference-editor-select-wrap { position: relative; }
.reference-editor-input,.reference-editor-select {
  width: 100%;
  height: 34px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: 0;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 12px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.reference-editor-input { padding-right: 64px; }
.reference-editor-input:focus,.reference-editor-select:focus { border-color: #1677ff; box-shadow: 0 0 0 1px rgb(22 119 255 / 20%); }
.reference-editor-count { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); color: #9ca3af; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; pointer-events: none; }
.reference-editor-select { appearance: none; padding-right: 36px; color: #374151; cursor: pointer; }
.reference-editor-select:disabled { cursor: not-allowed; background: #f9fafb; color: #9ca3af; }
.reference-editor-select-wrap > svg { position: absolute; top: 50%; right: 12px; width: 16px; height: 16px; transform: translateY(-50%); fill: none; stroke: #9ca3af; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.reference-editor-help { margin: 0; color: #9ca3af; font-size: 10px; line-height: 15px; }
.reference-editor-card { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 3%); transition: border-color 150ms ease; }
.reference-editor-card:focus-within { border-color: #1677ff; }
.reference-editor-toolbar { min-height: 37px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px; border-bottom: 1px solid rgb(229 231 235 / 80%); background: #fafafa; user-select: none; }
.reference-editor-toolbar__tools { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0; color: #4b5563; }
.reference-editor-tool-group { display: flex; align-items: center; gap: 2px; }
.reference-editor-divider { width: 1px; height: 14px; margin: 0 6px; background: #d1d5db; }
.reference-editor-tool { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #1f2937; cursor: pointer; transition: background-color 150ms ease; }
.reference-editor-tool:hover:not(:disabled) { background: rgb(229 231 235 / 80%); }
.reference-editor-tool:disabled { opacity: .45; cursor: not-allowed; }
.reference-editor-tool strong,.reference-editor-tool em,.reference-editor-tool s { font-size: 12px; line-height: 1; }
.reference-editor-tool em { font-family: serif; }
.reference-editor-tool code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; }
.reference-editor-tool svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.reference-editor-tool.accent { color: #3b82f6; }
.reference-editor-view-toggle { flex: 0 0 auto; height: 25px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border: 0; border-radius: 6px; background: #262626; color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 4%); font-size: 12px; line-height: 16px; font-weight: 500; cursor: pointer; }
.reference-editor-view-toggle.preview { background: #eff6ff; color: #1677ff; box-shadow: none; }
.reference-editor-view-toggle:hover:not(:disabled) { filter: brightness(.96); }
.reference-editor-view-toggle:disabled { opacity: .45; cursor: not-allowed; }
.reference-editor-view-toggle svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.reference-editor-textarea { width: 100%; min-height: 380px; max-height: 55vh; display: block; padding: 16px; border: 0; outline: 0; resize: none; overflow-y: auto; background: #fff; color: #1f2937; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; line-height: 1.625; }
.reference-editor-preview { min-height: 380px; max-height: 55vh; padding: 20px; overflow-y: auto; background: #fff; color: #1f2937; font-size: 12px; line-height: 1.625; user-select: text; }
.reference-editor-preview :deep(h1),.reference-editor-preview :deep(h2),.reference-editor-preview :deep(h3) { margin: 14px 0 6px; color: #111827; font-weight: 700; line-height: 1.35; }
.reference-editor-preview :deep(h1){font-size:20px}.reference-editor-preview :deep(h2){font-size:17px}.reference-editor-preview :deep(h3){font-size:15px}
.reference-editor-preview :deep(p),.reference-editor-preview :deep(ul),.reference-editor-preview :deep(ol),.reference-editor-preview :deep(blockquote),.reference-editor-preview :deep(pre),.reference-editor-preview :deep(table){margin:6px 0}
.reference-editor-preview :deep(code){font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;background:#f3f4f6;border-radius:4px;padding:1px 4px}.reference-editor-preview :deep(pre){overflow:auto;padding:12px;border-radius:8px;background:#111827;color:#f9fafb}.reference-editor-preview :deep(pre code){padding:0;background:transparent;color:inherit}.reference-editor-preview :deep(table){width:100%;border-collapse:collapse}.reference-editor-preview :deep(th),.reference-editor-preview :deep(td){padding:6px;border:1px solid #e5e7eb;text-align:left}.reference-editor-preview :deep(blockquote){padding-left:10px;border-left:3px solid #d1d5db;color:#6b7280}
.reference-editor-loading { min-height: 380px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; }
.reference-editor-loading--page { min-height: 420px; }
.reference-editor-status { display: inline-flex; align-items: center; gap: 6px; color: #f59e0b; font-size: 12px; line-height: 16px; font-weight: 500; }
.reference-editor-status__dot { width: 6px; height: 6px; border-radius: 999px; background: #fbbf24; animation: reference-status-pulse 1.5s ease-in-out infinite; }
.reference-editor-status.published { color: #16a34a; }.reference-editor-status.published .reference-editor-status__dot { background: #22c55e; animation: none; }
@keyframes reference-status-pulse { 50% { opacity: .35; } }
.reference-editor-actions { display: flex; align-items: center; gap: 10px; }
.reference-editor-actions button { height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 16px; border-radius: 8px; font-size: 12px; line-height: 16px; font-weight: 500; cursor: pointer; transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease; }
.reference-editor-actions button:disabled { opacity: .45; cursor: not-allowed; }
.reference-editor-cancel { border: 0; background: #f3f4f6; color: #4b5563; }.reference-editor-cancel:hover:not(:disabled){background:#e5e7eb;color:#111827}
.reference-editor-draft { border: 1px solid #d1d5db; background: #fff; color: #374151; box-shadow: 0 1px 2px rgb(0 0 0 / 3%); }.reference-editor-draft:hover:not(:disabled){background:#f9fafb;color:#111827}
.reference-editor-publish { min-width: 82px; border: 1px solid #1f2328; background: #1f2328; color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }.reference-editor-publish:hover:not(:disabled){background:#000}.reference-editor-publish:disabled{border-color:#e5e7eb;background:#e5e7eb;color:#9ca3af}
.reference-editor-spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: reference-editor-spin .7s linear infinite; }
@keyframes reference-editor-spin { to { transform: rotate(360deg); } }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__header) { min-height: 73px; padding: 16px 18px 16px 24px; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__header-icon) { width: 40px; height: 40px; flex-basis: 40px; border-radius: 999px; border-color: rgb(186 224 255 / 50%); background: #e6f4ff; color: #1677ff; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__header-icon svg) { width: 20px; height: 20px; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__header-copy h3) { font-size: 15px; line-height: 18px; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__header-copy p) { margin-top: 2px; font-size: 12px; line-height: 16px; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__close) { width: 30px; height: 30px; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__body) { padding: 20px 24px; }
.manual-editor-reference-drawer :deep(.reference-setting-drawer__footer) { min-height: 58px; padding: 14px 24px; background: #fafafa; }
@media (max-width: 680px) { .reference-editor-toolbar { align-items: flex-start; } .reference-editor-view-toggle { margin-top: 1px; } .reference-editor-actions { gap: 6px; }.reference-editor-actions button{padding-inline:10px}.reference-editor-status{font-size:10px} }
</style>
