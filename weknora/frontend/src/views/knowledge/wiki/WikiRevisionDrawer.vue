<template>
  <SettingDrawer v-model:visible="drawerVisible" class="wiki-revision-drawer" :title="drawerTitle" icon="history"
    width="760px" :min-width="560" :max-width="1280" storage-key="setting-drawer:width:wiki-revision-history" hide-footer>
    <div class="reference-wiki-revision">
      <aside class="reference-wiki-revision__list">
        <div class="reference-wiki-revision__items">
          <button v-if="currentPage" type="button" class="reference-wiki-revision__item"
            :class="{ active: selectedVersion === currentPage.version }" @click="selectCurrent">
            <span class="reference-wiki-revision__item-top"><code>v{{ currentPage.version }}</code><em>{{ t('knowledgeEditor.wikiBrowser.revisionCurrent') }}</em></span>
            <span class="reference-wiki-revision__item-bottom"><span>{{ sourceLabel(currentPage.last_edit_source) }}</span><time>{{ formatShortTime(currentPage.updated_at) }}</time></span>
          </button>
          <button v-for="rev in revisions" :key="rev.id" type="button" class="reference-wiki-revision__item"
            :class="{ active: selectedVersion === rev.version }" @click="selectRevision(rev)">
            <span class="reference-wiki-revision__item-top"><code>v{{ rev.version }}</code></span>
            <span class="reference-wiki-revision__item-bottom"><span>{{ sourceLabel(rev.edit_source) }}</span><time>{{ formatShortTime(rev.edited_at) }}</time></span>
          </button>
          <button v-if="revisions.length < total" type="button" class="reference-wiki-revision__load" :disabled="loadingList" @click="loadMore">
            <span v-if="loadingList" class="reference-wiki-spinner" />{{ t('knowledgeEditor.wikiBrowser.loadMoreShort') }}
          </button>
        </div>
        <div v-if="!loadingList && !revisions.length" class="reference-wiki-revision__empty">{{ t('knowledgeEditor.wikiBrowser.revisionEmpty') }}</div>
      </aside>

      <section class="reference-wiki-revision__detail">
        <template v-if="selectedVersion !== null && canShowDiff">
          <header class="reference-wiki-revision__detail-head">
            <div class="reference-wiki-revision__context">
              <code>{{ versionRangeLabel }}</code>
              <small v-if="contextHint">{{ contextHint }}</small>
            </div>
            <div class="reference-wiki-revision__controls">
              <div v-if="viewModeOptions.length > 1" class="reference-wiki-revision__tabs" role="tablist" :aria-label="t('knowledgeEditor.wikiBrowser.revisionViewModeLabel')">
                <button v-for="option in viewModeOptions" :key="option.value" type="button" role="tab"
                  :aria-selected="viewMode === option.value" :class="{ active: viewMode === option.value }" @click="viewMode = option.value">{{ option.label }}</button>
              </div>
              <span v-if="canEdit && selectedRevision" class="reference-wiki-revision__revert-wrap">
                <button type="button" class="reference-wiki-revision__revert" :disabled="reverting" @click="revertConfirmOpen = !revertConfirmOpen">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
                  {{ t('knowledgeEditor.wikiBrowser.revertBtn') }}
                </button>
                <template v-if="revertConfirmOpen">
                  <span class="reference-wiki-revision__confirm-backdrop" @click="revertConfirmOpen = false" />
                  <div class="reference-wiki-revision__confirm">
                    <p>{{ t('knowledgeEditor.wikiBrowser.revertConfirm', { ver: selectedRevision.version }) }}</p>
                    <div><button type="button" @click="revertConfirmOpen = false">{{ t('common.cancel') }}</button><button type="button" class="primary" @click="revertConfirmOpen = false; doRevert()">{{ t('common.confirm') }}</button></div>
                  </div>
                </template>
              </span>
            </div>
          </header>

          <div v-if="loadingDetail || diffLoading" class="reference-wiki-revision__loading"><span class="reference-wiki-spinner" />{{ t('knowledgeEditor.wikiBrowser.loading') }}</div>
          <div v-else-if="viewMode !== 'raw'" class="reference-wiki-revision__diff">
            <div v-if="!diffSections.length" class="reference-wiki-revision__empty-diff">{{ t('knowledgeEditor.wikiBrowser.revisionDiffEmpty') }}</div>
            <article v-for="section in diffSections" :key="section.field">
              <label>{{ revisionDiffFieldLabel(section.field) }}</label>
              <pre><span v-for="(line, idx) in section.lines" :key="`${section.field}-${idx}`" :class="`line-${line.type}`">{{ diffPrefix(line.type) }}{{ line.text }}
</span></pre>
            </article>
          </div>
          <div v-else-if="selectedRevision" class="reference-wiki-revision__raw"><pre>{{ rawRevisionText }}</pre></div>
        </template>
        <div v-else class="reference-wiki-revision__hint">{{ t('knowledgeEditor.wikiBrowser.revisionSelectHint') }}</div>
      </section>
    </div>
  </SettingDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import SettingDrawer from '@/components/settings/SettingDrawer.vue'
import { listWikiRevisions, getWikiRevision, revertWikiPage, type WikiPage, type WikiPageRevision } from '@/api/wiki'
import { diffWikiRevision, type WikiRevisionDiffField, type WikiRevisionSnapshot } from '@/utils/wikiRevisionDiff'

type ViewMode = 'incremental' | 'cumulative' | 'raw'
interface DiffPair { fromVersion: number; toVersion: number; from: WikiRevisionSnapshot; to: WikiRevisionSnapshot }
const props = defineProps<{ visible: boolean; kbId: string; slug: string; currentPage: WikiPage | null; canEdit?: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', visible: boolean): void; (e: 'reverted', page: WikiPage): void }>()
const { t } = useI18n()
const drawerVisible = computed({ get: () => props.visible, set: (val) => emit('update:visible', val) })
const drawerTitle = computed(() => t('knowledgeEditor.wikiBrowser.historyTitle', { title: props.currentPage?.title || props.slug }))
const PAGE_SIZE = 50
const revisions = ref<WikiPageRevision[]>([])
const total = ref(0)
const loadingList = ref(false)
const selectedVersion = ref<number | null>(null)
const selectedRevision = ref<WikiPageRevision | null>(null)
const detailContent = ref('')
const loadingDetail = ref(false)
const viewMode = ref<ViewMode>('incremental')
const reverting = ref(false)
const revertConfirmOpen = ref(false)
const diffLoading = ref(false)
const diffPair = ref<DiffPair | null>(null)
const snapshotCache = new Map<number, WikiRevisionSnapshot>()
const currentVersion = computed(() => props.currentPage?.version ?? null)
const isCurrentSelected = computed(() => currentVersion.value !== null && selectedVersion.value === currentVersion.value)
const canShowDiff = computed(() => {
  if (selectedVersion.value === null || !props.currentPage) return false
  if (viewMode.value === 'raw') return true
  if (viewMode.value === 'cumulative') return !isCurrentSelected.value && selectedVersion.value! < currentVersion.value!
  return selectedVersion.value! >= 1
})
const viewModeOptions = computed(() => {
  if (isCurrentSelected.value) return []
  const ver = selectedVersion.value!, cur = currentVersion.value!
  const options: Array<{ value: ViewMode; label: string }> = [{ value: 'incremental', label: t('knowledgeEditor.wikiBrowser.revisionDiffIncremental') }]
  if (ver < cur) options.push({ value: 'cumulative', label: t('knowledgeEditor.wikiBrowser.revisionDiffCumulative') })
  options.push({ value: 'raw', label: t('knowledgeEditor.wikiBrowser.revisionRaw') })
  return options
})
const versionRangeLabel = computed(() => {
  if (viewMode.value === 'raw') return selectedRevision.value ? `v${selectedRevision.value.version}` : ''
  if (!diffPair.value) return ''
  if (diffPair.value.fromVersion < 1) return t('knowledgeEditor.wikiBrowser.revisionInitialRange', { ver: diffPair.value.toVersion })
  return `v${diffPair.value.fromVersion} → v${diffPair.value.toVersion}`
})
const contextHint = computed(() => {
  if (viewMode.value === 'raw' && selectedRevision.value) return [sourceLabel(selectedRevision.value.edit_source), formatShortTime(selectedRevision.value.edited_at)].filter(Boolean).join(' · ')
  if (viewMode.value === 'incremental') {
    if ((isCurrentSelected.value && (currentVersion.value ?? 0) <= 1) || selectedVersion.value === 1) return t('knowledgeEditor.wikiBrowser.revisionInitialCreationHint')
    return isCurrentSelected.value ? t('knowledgeEditor.wikiBrowser.revisionLatestChangeHint') : t('knowledgeEditor.wikiBrowser.revisionIncrementalHint', { ver: selectedVersion.value ?? 0 })
  }
  if (viewMode.value === 'cumulative') return t('knowledgeEditor.wikiBrowser.revisionCumulativeHint')
  return ''
})
const rawRevisionText = computed(() => {
  if (!selectedRevision.value) return detailContent.value
  const parts: string[] = []
  if (selectedRevision.value.title) parts.push(selectedRevision.value.title)
  if (selectedRevision.value.summary) { if (parts.length) parts.push(''); parts.push(selectedRevision.value.summary) }
  if (detailContent.value) { if (parts.length) parts.push(''); parts.push(detailContent.value) }
  return parts.join('\n')
})
const diffSections = computed(() => !diffPair.value || viewMode.value === 'raw' ? [] : diffWikiRevision(diffPair.value.from, diffPair.value.to))
watch(() => [props.visible, props.slug] as const, ([visible]) => { if (visible && props.slug) resetAndLoad() })
watch(() => viewModeOptions.value, (options) => { if (options.length && !options.some(option => option.value === viewMode.value)) viewMode.value = options[0].value })
watch(() => [selectedVersion.value, viewMode.value, props.currentPage?.version, props.currentPage?.content, props.currentPage?.title, props.currentPage?.summary] as const,
  () => { if (props.visible && viewMode.value !== 'raw') void loadDiffPair() })
function snapshotFromPage(page: WikiPage): WikiRevisionSnapshot { return { title: page.title || '', summary: page.summary || '', content: page.content || '' } }
function snapshotFromRevisionData(data: WikiPageRevision, content: string): WikiRevisionSnapshot { return { title: data.title || '', summary: data.summary || '', content } }
async function loadVersionSnapshot(version: number): Promise<WikiRevisionSnapshot> {
  if (!props.currentPage) return { title: '', summary: '', content: '' }
  if (version === props.currentPage.version) return snapshotFromPage(props.currentPage)
  const cached = snapshotCache.get(version); if (cached) return cached
  const res = await getWikiRevision(props.kbId, props.slug, version); const data = (res as any).data || (res as any)
  const snap = snapshotFromRevisionData(data, data.content || ''); snapshotCache.set(version, snap); return snap
}
let diffRequestSeq = 0
async function loadDiffPair() {
  const seq = ++diffRequestSeq
  if (!props.currentPage || selectedVersion.value === null || !canShowDiff.value) { diffPair.value = null; diffLoading.value = false; return }
  const currentVer = props.currentPage.version
  let fromVer = 0, toVer = 0
  if (viewMode.value === 'incremental') { toVer = isCurrentSelected.value ? currentVer : selectedVersion.value!; fromVer = toVer - 1 }
  else { fromVer = selectedVersion.value!; toVer = currentVer }
  if (fromVer < 0 || toVer < 1 || fromVer >= toVer) { diffPair.value = null; diffLoading.value = false; return }
  diffLoading.value = true
  try {
    const from = fromVer < 1 ? { title: '', summary: '', content: '' } : await loadVersionSnapshot(fromVer)
    if (seq !== diffRequestSeq) return
    const to = await loadVersionSnapshot(toVer); if (seq !== diffRequestSeq) return
    diffPair.value = { fromVersion: fromVer, toVersion: toVer, from, to }
  } catch (e: any) { if (seq !== diffRequestSeq) return; diffPair.value = null; MessagePlugin.error(e?.message || t('knowledgeEditor.wikiBrowser.revisionLoadFailed')) }
  finally { if (seq === diffRequestSeq) diffLoading.value = false }
}
function resetAndLoad() {
  detailRequestSeq++; diffRequestSeq++; snapshotCache.clear(); revisions.value = []; total.value = 0
  selectedVersion.value = props.currentPage?.version ?? null; selectedRevision.value = null; detailContent.value = ''; loadingDetail.value = false
  diffPair.value = null; diffLoading.value = false; viewMode.value = 'incremental'; revertConfirmOpen.value = false; loadList(0); void loadDiffPair()
}
async function loadList(offset: number) {
  loadingList.value = true
  try {
    const res = await listWikiRevisions(props.kbId, props.slug, { limit: PAGE_SIZE, offset }); const data = (res as any).data || (res as any); const items: WikiPageRevision[] = data.revisions || []
    if (offset === 0) revisions.value = items
    else { const seen = new Set(revisions.value.map(r => r.version)); revisions.value = [...revisions.value, ...items.filter(r => !seen.has(r.version))] }
    total.value = data.total ?? revisions.value.length
  } catch (e: any) { MessagePlugin.error(e?.message || t('knowledgeEditor.wikiBrowser.revisionLoadFailed')) }
  finally { loadingList.value = false }
}
function loadMore() { if (!loadingList.value) loadList(revisions.value.length) }
function selectCurrent() { detailRequestSeq++; selectedVersion.value = props.currentPage?.version ?? null; selectedRevision.value = null; detailContent.value = ''; loadingDetail.value = false; viewMode.value = 'incremental'; revertConfirmOpen.value = false }
let detailRequestSeq = 0
async function selectRevision(rev: WikiPageRevision) {
  const seq = ++detailRequestSeq; selectedVersion.value = rev.version; selectedRevision.value = rev; detailContent.value = ''; viewMode.value = 'incremental'; loadingDetail.value = true; revertConfirmOpen.value = false
  try {
    const res = await getWikiRevision(props.kbId, props.slug, rev.version); if (seq !== detailRequestSeq) return
    const data = (res as any).data || (res as any); selectedRevision.value = { ...rev, ...data }; detailContent.value = data.content || ''; snapshotCache.set(rev.version, snapshotFromRevisionData(data, data.content || ''))
  } catch (e: any) { if (seq !== detailRequestSeq) return; MessagePlugin.error(e?.message || t('knowledgeEditor.wikiBrowser.revisionLoadFailed')) }
  finally { if (seq === detailRequestSeq) loadingDetail.value = false }
}
async function doRevert() {
  if (!selectedRevision.value) return
  reverting.value = true
  try {
    const res = await revertWikiPage(props.kbId, props.slug, selectedRevision.value.version); const updated = ((res as any).data || (res as any)) as WikiPage
    MessagePlugin.success(t('knowledgeEditor.wikiBrowser.revertSuccess', { ver: selectedRevision.value.version })); emit('reverted', updated); resetAndLoad()
  } catch (e: any) { MessagePlugin.error(e?.message || t('knowledgeEditor.wikiBrowser.revertFailed')) }
  finally { reverting.value = false }
}
function diffPrefix(type: 'same' | 'add' | 'del'): string { return type === 'add' ? '+ ' : type === 'del' ? '- ' : '  ' }
function revisionDiffFieldLabel(field: WikiRevisionDiffField): string { return field === 'title' ? t('knowledgeEditor.wikiBrowser.revisionDiffTitle') : field === 'summary' ? t('knowledgeEditor.wikiBrowser.revisionDiffSummary') : t('knowledgeEditor.wikiBrowser.revisionDiffContent') }
function sourceLabel(source?: string): string {
  switch (source) { case 'user': return t('knowledgeEditor.wikiBrowser.editSourceUser'); case 'agent': return t('knowledgeEditor.wikiBrowser.editSourceAgent'); case 'revert': return t('knowledgeEditor.wikiBrowser.editSourceRevert'); default: return t('knowledgeEditor.wikiBrowser.editSourcePipeline') }
}
function formatShortTime(iso?: string): string {
  if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso; const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.reference-wiki-revision{height:100%;min-height:0;display:flex;color:#111827;font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,sans-serif}.reference-wiki-revision__list{width:220px;flex:0 0 220px;min-height:0;display:flex;flex-direction:column;border-right:1px solid #f3f4f6;background:#fdfdfd}.reference-wiki-revision__items{min-height:0;overflow:auto;padding:10px 8px}.reference-wiki-revision__item{width:100%;min-height:48px;display:flex;flex-direction:column;justify-content:center;gap:3px;padding:7px 9px;border:0;border-radius:9px;background:transparent;color:#6b7280;text-align:left;cursor:pointer}.reference-wiki-revision__item:hover{background:#f3f4f6}.reference-wiki-revision__item.active{background:#111827;color:#fff}.reference-wiki-revision__item-top,.reference-wiki-revision__item-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px}.reference-wiki-revision__item-top code{color:inherit;font:700 10px/14px "JetBrains Mono",monospace}.reference-wiki-revision__item-top em{font-size:8px;font-style:normal;font-weight:700;opacity:.7}.reference-wiki-revision__item-bottom{font-size:8px;line-height:11px;opacity:.72}.reference-wiki-revision__item-bottom time{white-space:nowrap}.reference-wiki-revision__load{width:100%;height:30px;margin-top:7px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#6b7280;font-size:9px;font-weight:700;cursor:pointer}.reference-wiki-revision__empty,.reference-wiki-revision__hint,.reference-wiki-revision__loading,.reference-wiki-revision__empty-diff{display:flex;align-items:center;justify-content:center;text-align:center;color:#9ca3af;font-size:10px}.reference-wiki-revision__empty{flex:1;padding:20px}.reference-wiki-revision__detail{min-width:0;min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden;padding:14px 18px 18px}.reference-wiki-revision__detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #f3f4f6}.reference-wiki-revision__context{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}.reference-wiki-revision__context code{font:700 11px/15px "JetBrains Mono",monospace;color:#111827}.reference-wiki-revision__context small{color:#9ca3af;font-size:9px;line-height:13px}.reference-wiki-revision__controls{display:flex;align-items:center;gap:7px}.reference-wiki-revision__tabs{display:inline-flex;align-items:center;padding:2px;border:1px solid #e5e7eb;border-radius:9px;background:#f3f4f6}.reference-wiki-revision__tabs button{height:26px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:#9ca3af;font-size:8.5px;font-weight:700;cursor:pointer}.reference-wiki-revision__tabs button.active{background:#fff;color:#111827;box-shadow:0 1px 2px rgb(0 0 0 / 6%)}.reference-wiki-revision__revert-wrap{position:relative;display:inline-flex}.reference-wiki-revision__revert{height:29px;display:inline-flex;align-items:center;gap:5px;padding:0 9px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#92400e;font-size:8.5px;font-weight:700;cursor:pointer}.reference-wiki-revision__revert svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.reference-wiki-revision__confirm-backdrop{position:fixed;inset:0;z-index:160}.reference-wiki-revision__confirm{position:absolute;right:0;top:calc(100% + 6px);z-index:170;width:240px;padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;box-shadow:0 12px 24px rgb(0 0 0 / 12%)}.reference-wiki-revision__confirm p{margin:0 0 9px;color:#6b7280;font-size:9px;line-height:14px}.reference-wiki-revision__confirm>div{display:flex;justify-content:flex-end;gap:6px}.reference-wiki-revision__confirm button{height:27px;padding:0 9px;border:1px solid #e5e7eb;border-radius:7px;background:#fff;color:#6b7280;font-size:8px;font-weight:700}.reference-wiki-revision__confirm button.primary{border-color:#111827;background:#111827;color:#fff}.reference-wiki-revision__loading{flex:1;gap:7px}.reference-wiki-spinner{width:13px;height:13px;display:inline-block;border:2px solid #e5e7eb;border-top-color:#6b7280;border-radius:50%;animation:wiki-spin .8s linear infinite}@keyframes wiki-spin{to{transform:rotate(360deg)}}.reference-wiki-revision__diff{min-height:0;flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px}.reference-wiki-revision__diff article{display:flex;flex-direction:column;gap:5px}.reference-wiki-revision__diff label{color:#9ca3af;font-size:8.5px;font-weight:700}.reference-wiki-revision__diff pre,.reference-wiki-revision__raw pre{margin:0;padding:10px 11px;border:1px solid #e5e7eb;border-radius:9px;background:#f9fafb;color:#374151;font:8.5px/1.7 "JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word}.reference-wiki-revision__diff pre span{display:block}.reference-wiki-revision__diff .line-add{background:#f0fdf4;color:#166534}.reference-wiki-revision__diff .line-del{background:#fef2f2;color:#991b1b}.reference-wiki-revision__raw{min-height:0;flex:1;overflow:auto}.reference-wiki-revision__hint{flex:1;padding:24px}.reference-wiki-revision__empty-diff{padding:24px}
:deep(.reference-setting-drawer__body){padding:0!important;overflow:hidden!important}
</style>
