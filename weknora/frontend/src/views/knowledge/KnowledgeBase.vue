<script lang="ts">
import { defineComponent, type SetupContext } from 'vue'
import LegacyKnowledgeBaseBusiness from '@/assets/business-baselines/KnowledgeBase.pre-view.vue'
import DocContent from '@/components/doc-content.vue'
import EmptyKnowledge from '@/components/empty-knowledge.vue'
import KBSwitcherDropdown from '@/components/KBSwitcherDropdown.vue'
import KnowledgeBaseEditorModal from './KnowledgeBaseEditorModal.vue'
import FAQEntryManager from './components/FAQEntryManager.vue'
import DocumentListView from './components/DocumentListView.vue'
import DocumentCardView from './components/DocumentCardView.vue'
import DocumentBatchBar from './components/DocumentBatchBar.vue'
import KbUploadSourceDropdown from './components/KbUploadSourceDropdown.vue'
import KbFolderTree from './components/KbFolderTree.vue'
import TagEditDialog from './components/TagEditDialog.vue'
import BatchTagDialog from './components/BatchTagDialog.vue'
import KbTagManageDrawer from './components/KbTagManageDrawer.vue'
import WikiBrowser from './wiki/WikiBrowser.vue'

const legacy = LegacyKnowledgeBaseBusiness as any
const legacySetup = legacy.setup

export default defineComponent({
  ...legacy,
  name: 'KnowledgeBase',
  components: {
    ...(legacy.components || {}),
    DocContent, EmptyKnowledge, KBSwitcherDropdown, KnowledgeBaseEditorModal, FAQEntryManager,
    DocumentListView, DocumentCardView, DocumentBatchBar, KbUploadSourceDropdown, KbFolderTree,
    TagEditDialog, BatchTagDialog, KbTagManageDrawer, WikiBrowser,
  },
  setup(props: Record<string, unknown>, context: SetupContext) {
    const state = legacySetup?.(props, context)
    if (state && typeof state === 'object' && typeof state.then !== 'function') return { ...state }
    return state
  },
})
</script>

<template>
  <template v-if="!isFAQ">
    <main class="visual-knowledge-page">
      <header class="visual-knowledge-header">
        <div class="visual-knowledge-header__copy">
          <nav class="visual-knowledge-breadcrumb" :aria-label="$t('menu.knowledgeBase')">
            <button type="button" class="visual-knowledge-breadcrumb__back" @click="handleNavigateToKbList">
              <t-icon name="chevron-left" /><span>{{ $t('menu.knowledgeBase') }}</span>
            </button>
            <span class="visual-knowledge-breadcrumb__sep">/</span>
            <KBSwitcherDropdown v-if="knowledgeList.length" :kb-list="knowledgeList" :current-kb-id="kbId" @select="(id: string) => handleKnowledgeDropdownSelect({ value: id })">
              <button type="button" class="visual-knowledge-breadcrumb__current" :disabled="!kbId">
                <template v-if="!kbInfo"><t-skeleton animation="gradient" :row-col="[{ width: '112px', height: '16px' }]" /></template>
                <template v-else><span>{{ kbInfo.name }}</span><t-icon name="chevron-down" /></template>
              </button>
            </KBSwitcherDropdown>
            <button v-else type="button" class="visual-knowledge-breadcrumb__current" :disabled="!kbId" @click="handleNavigateToCurrentKB">
              <template v-if="!kbInfo"><t-skeleton animation="gradient" :row-col="[{ width: '112px', height: '16px' }]" /></template>
              <template v-else>{{ kbInfo.name }}</template>
            </button>
            <span class="visual-knowledge-breadcrumb__sep">/</span>
            <span class="visual-knowledge-breadcrumb__section">{{ activeKbTab === 'documents' ? $t('knowledgeEditor.wikiBrowser.tabDocuments') : activeKbTab === 'wiki' ? 'Wiki' : $t('knowledgeEditor.wikiBrowser.tabGraph') }}</span>
          </nav>
          <p class="visual-knowledge-header__subtitle">{{ kbInfo?.description || $t('knowledgeEditor.document.subtitle') }}</p>
        </div>

        <div v-if="isWiki" class="visual-knowledge-tabs" role="tablist">
          <button type="button" :class="{ 'is-active': activeKbTab === 'documents' }" role="tab" :aria-selected="activeKbTab === 'documents'" @click="activeKbTab = 'documents'">
            <t-icon name="file" /><span>{{ $t('knowledgeEditor.wikiBrowser.tabDocuments') }}<template v-if="typeof total === 'number'"> ({{ total }})</template></span>
          </button>
          <button type="button" :class="{ 'is-active': activeKbTab === 'wiki' }" role="tab" :aria-selected="activeKbTab === 'wiki'" @click="activeKbTab = 'wiki'">
            <t-icon name="book" /><span>Wiki</span><t-tooltip v-if="wikiIsIndexing" :content="wikiIndexingTip" placement="bottom"><t-loading size="small" /></t-tooltip>
          </button>
          <t-tooltip :content="$t('knowledgeEditor.wikiBrowser.tabGraphTip')" placement="bottom">
            <button type="button" :class="{ 'is-active': activeKbTab === 'graph' }" role="tab" :aria-selected="activeKbTab === 'graph'" @click="activeKbTab = 'graph'">
              <t-icon name="chart-bubble" /><span>{{ $t('knowledgeEditor.wikiBrowser.tabGraph') }}</span><t-tooltip v-if="wikiIsIndexing" :content="wikiIndexingTip" placement="bottom"><t-loading size="small" /></t-tooltip>
            </button>
          </t-tooltip>
        </div>
        <span v-else class="visual-knowledge-header__plain-tab">{{ $t('knowledgeEditor.document.title') }}</span>
      </header>

      <div v-if="unsupportedFileTypes.length || missingStorageEngine" class="visual-knowledge-alerts">
        <button v-if="unsupportedFileTypes.length" type="button" :disabled="authStore.isLiteMode" @click="goToParserSettings"><t-icon name="info-circle" /><span>{{ $t('knowledgeBase.unsupportedTypesHint', { types: unsupportedFileTypes.map((t: string) => '.' + t).join('、') }) }}</span><strong v-if="!authStore.isLiteMode">{{ $t('knowledgeBase.goToParserSettings') }} →</strong></button>
        <button v-if="missingStorageEngine" type="button" :disabled="authStore.isLiteMode" @click="handleOpenKBSettings"><t-icon name="info-circle" /><span>{{ $t('knowledgeBase.missingStorageEngine') }}</span><strong v-if="!authStore.isLiteMode">{{ $t('knowledgeBase.goToStorageSettings') }} →</strong></button>
      </div>

      <section v-if="isWiki && (activeKbTab === 'wiki' || activeKbTab === 'graph')" class="visual-knowledge-wiki-host">
        <WikiBrowser v-if="kbId" :knowledge-base-id="kbId" :view="activeKbTab === 'graph' ? 'graph' : 'browser'" :can-edit="canEdit" @open-source-doc="openSourceDoc" @status-change="onWikiStatusChange" @view-graph="onViewWikiInGraph" />
      </section>

      <section v-if="activeKbTab === 'documents' || !isWiki" class="visual-knowledge-documents">
        <KbFolderTree v-if="showFolderTree" class="visual-knowledge-documents__tree" :tree="folderTree" :selected-path="selectedFolderPath" :loading="folderTreeLoading" :collapsed="folderTreeCollapsed" :can-edit="canEdit" @select="handleFolderSelect" @update:collapsed="handleFolderTreeCollapsedChange" @rename="handleFolderRename" />

        <div class="visual-knowledge-content">
          <div class="visual-knowledge-toolbar">
            <div class="visual-knowledge-toolbar__left">
              <div class="visual-knowledge-path-pill" :aria-label="$t('knowledgeBase.folderTree.rootRow')">
                <t-icon name="folder" />
                <button type="button" class="visual-knowledge-path-pill__segment is-root" @click="handleFolderSelect('')">{{ $t('knowledgeBase.folderTree.rootRow') }}</button>
                <template v-for="(crumb, index) in folderBreadcrumbs" :key="crumb.path">
                  <t-icon name="chevron-right" />
                  <button
                    v-if="Number(index) < folderBreadcrumbs.length - 1"
                    type="button"
                    class="visual-knowledge-path-pill__segment"
                    @click="handleFolderSelect(crumb.path)"
                  >
                    {{ crumb.name }}
                  </button>
                  <span v-else class="visual-knowledge-path-pill__segment is-current">{{ crumb.name }}</span>
                </template>
              </div>

              <t-input v-model.trim="docSearchKeyword" :placeholder="$t('knowledgeBase.docSearchPlaceholder')" clearable class="visual-knowledge-search" @clear="loadKnowledgeFiles(kbId)" @enter="loadKnowledgeFiles(kbId)">
                <template #prefix-icon><t-icon name="search" /></template>
              </t-input>

              <div class="visual-knowledge-filters">
                <t-popup v-model:visible="tagFilterPanelVisible" trigger="click" placement="bottom-left" overlay-class-name="visual-tag-filter-popup" :overlay-inner-style="{ padding: 0 }">
                  <template #content>
                    <section class="visual-tag-filter" @click.stop>
                      <header><strong>{{ $t('knowledgeBase.tagFilterTitle') }}</strong><span>{{ sidebarCategoryCount }}</span></header>
                      <t-input v-model.trim="tagSearchQuery" size="small" :placeholder="$t('knowledgeBase.tagSearchPlaceholder')" clearable><template #prefix-icon><t-icon name="search" /></template></t-input>
                      <div class="visual-tag-filter__body">
                        <template v-if="tagLoading && !sidebarTags.length"><t-skeleton v-for="n in 6" :key="n" animation="gradient" :row-col="[{ width: '72px', height: '26px', type: 'rect' }]" /></template>
                        <template v-else>
                          <button v-for="tag in sidebarTags" :key="tag.id" type="button" class="visual-tag-filter__chip" :class="{ 'is-active': isTagFilterActive(tag.id) }" @click="handleTagRowClick(tag.id)"><span>{{ tag.name }}</span><small>{{ tag.knowledge_count || 0 }}</small></button>
                          <p v-if="!sidebarTags.length">{{ $t('knowledgeBase.tagEmptyResult') }}</p>
                        </template>
                      </div>
                      <footer v-if="tagHasMore || canEdit"><button v-if="tagHasMore" type="button" :disabled="tagLoadingMore" @click.stop="kbId && loadTags(kbId)"><t-loading v-if="tagLoadingMore" size="small" /><span>{{ $t('tenant.loadMore') }}</span></button><button v-if="canEdit" type="button" @click="openTagManageDrawer">{{ $t('knowledgeBase.tagManageLink') }}</button></footer>
                    </section>
                  </template>
                  <button type="button" class="visual-knowledge-filter-button" :class="{ 'is-active': !isTagFilterPlaceholder }" :title="activeTagFilterTitle">
                    <t-icon name="discount" /><span>{{ activeTagFilterLabel }}</span><span v-if="showTagFilterClear" class="visual-knowledge-filter-button__clear" role="button" tabindex="0" @click.stop="clearTagFilter" @keydown.enter.stop.prevent="clearTagFilter"><t-icon name="close" /></span><t-icon v-else name="chevron-down" />
                  </button>
                </t-popup>

                <t-select v-model="selectedFileType" :options="fileTypeOptions" :placeholder="$t('knowledgeBase.fileTypeFilter')" class="visual-knowledge-select" clearable><template #prefixIcon><t-icon name="file" /></template></t-select>
                <t-select v-model="selectedParseStatus" :options="parseStatusOptions" :placeholder="$t('knowledgeBase.parseStatusFilter')" class="visual-knowledge-select" clearable><template #prefixIcon><t-icon name="check-circle" /></template></t-select>
                <t-select v-model="selectedSource" :options="sourceOptions" :placeholder="$t('knowledgeBase.sourceFilter')" class="visual-knowledge-select" clearable><template #prefixIcon><t-icon name="link" /></template></t-select>
                <t-date-range-picker v-model="updatedTimeRange" :placeholder="[$t('knowledgeBase.updatedTimeFrom'), $t('knowledgeBase.updatedTimeTo')]" :disable-date="disableFutureDate" class="visual-knowledge-date" clearable allow-input><template #prefixIcon><t-icon name="calendar" /></template></t-date-range-picker>
              </div>
            </div>

            <div class="visual-knowledge-toolbar__right">
              <div class="visual-knowledge-view-toggle" role="group" :aria-label="$t('knowledgeBase.viewModeToggle')">
                <button type="button" :class="{ 'is-active': viewMode === 'grid' }" :aria-pressed="viewMode === 'grid'" @click="viewMode = 'grid'"><t-icon name="view-module" /></button>
                <button type="button" :class="{ 'is-active': viewMode === 'list' }" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'"><t-icon name="view-list" /></button>
              </div>
              <KbUploadSourceDropdown v-if="canEdit" ref="uploadSourceRef" :accept-file-types="acceptFileTypes" :supported-file-types="[...supportedFileTypes]" include-manual trigger-icon="add" data-guide="kb-detail-add-doc" :tooltip="t('knowledgeBase.addDocument')" placement="bottom-right" @files="handleUploadSourceFiles" @url="handleUploadSourceUrl" @manual="handleManualCreate" />
            </div>
          </div>

          <div ref="knowledgeScroll" class="visual-knowledge-scroll" :class="{ 'is-empty': !cardList.length && !currentChildFolders.length && !docListLoading, 'is-marquee-active': docMarqueeVisible }" @scroll="handleScroll" @mousedown="onDocMarqueeMouseDown">
            <div v-if="docMarqueeVisible" class="visual-knowledge-marquee" :class="{ 'is-add': docMarqueeMode === 'add', 'is-subtract': docMarqueeMode === 'subtract' }" :style="docMarqueeBoxStyle" aria-hidden="true" />
            <div v-if="docListLoading && cardList.length === 0 && !currentChildFolders.length" class="visual-knowledge-skeleton-grid" aria-hidden="true">
              <div v-for="n in 8" :key="n" class="visual-knowledge-skeleton-card"><t-skeleton animation="gradient" :row-col="[{ width: '68%', height: '15px' },{ width: '100%', height: '12px' },{ width: '52%', height: '12px' }]" /></div>
            </div>

            <DocumentCardView v-else-if="(cardList.length || currentChildFolders.length) && viewMode === 'grid'" :items="cardList" :folders="currentChildFolders" :folder-options="folderOptions" :selected-ids="selectedIds" :batch-mode="batchMode" :can-edit="canEdit" :can-mutate-knowledge="canMutateKnowledge" :trace-available-by-id="traceAvailableById" :tag-list="tagList" :move-menu-mode="moveMenuMode" :move-target-kbs="moveTargetKbs" :move-targets-loading="moveTargetsLoading" :move-selected-target-name="moveSelectedTargetName" :move-mode="moveMode" :move-submitting="moveSubmitting" :show-folder-path="showDocumentFolderPath" @open="(item: any) => openKnowledgeItem(item)" @open-folder="handleFolderSelect" @move-to-folder="(item: any, path: string) => moveKnowledgeIntoFolder([item.id], path)" @toggle-checkbox="onCardGridCheckboxChange" @menu-visible-change="(visible: boolean, item: any) => onCardMoreVisibleChange(visible, item)" @action="(action: string, item: any) => handleCardAction(action, item)" @tag-edit="(item: any) => openTagEditDialog(item)" @move-select-target="(kb: any) => handleMoveSelectTarget(kb)" @move-back="handleMoveBack" @move-confirm="handleMoveConfirm" @update:move-mode="(mode: any) => moveMode = mode" />

            <DocumentListView v-else-if="(cardList.length || currentChildFolders.length) && viewMode === 'list'" :items="cardList" :folders="currentChildFolders" :folder-options="folderOptions" :selected-ids="selectedIds" :tag-list="tagList" :can-edit="canEdit" :can-mutate-knowledge="canMutateKnowledge" :trace-visible-ids="traceAvailableById" :move-menu-mode="moveMenuMode" :move-target-kbs="moveTargetKbs" :move-targets-loading="moveTargetsLoading" :move-selected-target-name="moveSelectedTargetName" :move-mode="moveMode" :move-submitting="moveSubmitting" :show-folder-path="showDocumentFolderPath" @open-folder="handleFolderSelect" @move-to-folder="(item: any, path: string) => moveKnowledgeIntoFolder([item.id], path)" @open="(item: any) => openKnowledgeItem(item)" @toggle-row="toggleSelectRow" @toggle-all="toggleSelectAll" @action="(action: string, item: any) => handleListAction(action, item)" @probe-trace="(item: any) => probeTraceAvailable(item)" @tag-edit="(item: any) => openTagEditDialog(item)" @move-select-target="(kb: any) => handleMoveSelectTarget(kb)" @move-back="handleMoveBack" @move-confirm="handleMoveConfirm" @update:move-mode="(mode: any) => moveMode = mode" @reset-move-state="moveMenuMode = 'normal'" />

            <div v-else-if="!docListLoading" class="visual-knowledge-empty"><p v-if="selectedFolderPath || isFiltering">{{ isFiltering ? $t('knowledgeBase.folderTree.emptySearch') : $t('knowledgeBase.folderTree.emptyFolder') }}</p><EmptyKnowledge v-else /></div>
          </div>

          <div v-show="batchMode || selectedIds.size > 0" class="visual-knowledge-batch-anchor"><DocumentBatchBar :count="selectedIds.size" :delete-loading="batchDeleting" :reparse-loading="batchReparsing" :tag-loading="batchTagging" :visible="batchMode || selectedIds.size > 0" :show-move-to-folder="canEdit" :folder-options="folderOptions" @cancel="handleBatchCancel" @delete="confirmBatchDelete" @reparse="confirmBatchReparse" @batch-tag="handleBatchTag" @move-to-folder="(path: string) => moveKnowledgeIntoFolder(Array.from(selectedIds), path)" /></div>
        </div>
      </section>

      <DocContent ref="docContentRef" :visible="isCardDetails" :details="details" :canEditKB="canEdit" :canDownloadKB="canDownloadKnowledge" :kbId="kbId" @closeDoc="closeDoc" @getDoc="getDoc" @summaryStateChange="syncDocumentSummaryState" />
    </main>
  </template>

  <section v-else class="visual-faq-manager"><FAQEntryManager v-if="kbId" :kb-id="kbId" /></section>
  <KnowledgeBaseEditorModal :visible="uiStore.showKBEditorModal" :mode="uiStore.kbEditorMode" :kb-id="uiStore.currentKBId || undefined" :initial-type="uiStore.kbEditorType" @update:visible="(val: boolean) => val ? null : uiStore.closeKBEditor()" @success="handleKBEditorSuccess" />
  <TagEditDialog :visible="tagEditDialogVisible" :knowledge-name="tagEditTarget?.display_name || tagEditTarget?.file_name || tagEditTarget?.title || ''" :kb-id="kbId" :tag-list="tagList" :selected-tags="tagEditTarget?.tags || []" :can-manage="canEdit" @update:visible="tagEditDialogVisible = $event" @confirm="onTagEditConfirm" @tag-created="loadTags(kbId, true)" @open-manage="openTagManageFromEditDialog" />
  <BatchTagDialog :visible="batchTagDialogVisible" :count="selectedIds.size" :kb-id="kbId" :tag-list="tagList" :pre-selected-tag-ids="batchTagPreSelectedIds" :can-manage="canEdit" :confirm-loading="batchTagging" @update:visible="batchTagDialogVisible = $event" @confirm="onBatchTagConfirm" @tag-created="loadTags(kbId, true)" @open-manage="openTagManageFromBatchDialog" />
  <KbTagManageDrawer v-if="!isFAQ" v-model:visible="tagManageDrawerVisible" :kb-id="kbId" :is-faq="isFAQ" @changed="onTagManageChanged" />
</template>

<style scoped lang="less">
.visual-knowledge-page { width: 100%; height: 100%; min-width: 0; min-height: 0; padding: 20px 28px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; overflow: hidden; background: rgb(249 250 251 / 30%); color: #374151; }
.visual-knowledge-header { flex: 0 0 auto; padding-bottom: 16px; border-bottom: 1px solid rgb(229 231 235 / 80%); display: flex; flex-direction: column; gap: 16px; }
.visual-knowledge-header__copy { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.visual-knowledge-breadcrumb { min-width: 0; display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px; line-height: 18px; font-weight: 600; }
.visual-knowledge-breadcrumb button { font: inherit; }
.visual-knowledge-breadcrumb__back { padding: 0; border: 0; display: inline-flex; align-items: center; gap: 4px; background: transparent; color: #6b7280; cursor: pointer; }
.visual-knowledge-breadcrumb__back:hover { color: #111827; }
.visual-knowledge-breadcrumb__back :deep(.t-icon) { font-size: 14px; }
.visual-knowledge-breadcrumb__sep { color: #d1d5db; }
.visual-knowledge-breadcrumb__current { max-width: 320px; padding: 2px 8px; border: 0; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; background: transparent; color: #111827; font-weight: 700; cursor: pointer; }
.visual-knowledge-breadcrumb__current:hover:not(:disabled) { background: #f3f4f6; }
.visual-knowledge-breadcrumb__current span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-knowledge-breadcrumb__current :deep(.t-icon) { font-size: 14px; color: #9ca3af; }
.visual-knowledge-breadcrumb__section { color: #9ca3af; font-weight: 400; }
.visual-knowledge-header__subtitle { max-width: 768px; margin: 0; overflow: hidden; color: #6b7280; font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.visual-knowledge-tabs { flex: 0 0 auto; align-self: flex-start; padding: 4px; border: 1px solid rgb(229 231 235 / 80%); border-radius: 12px; display: flex; background: rgb(243 244 246 / 90%); box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.visual-knowledge-tabs button { min-height: 30px; padding: 6px 14px; border: 1px solid transparent; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; background: transparent; color: #6b7280; font: inherit; font-size: 12px; line-height: 18px; font-weight: 700; cursor: pointer; transition: all 150ms ease; }
.visual-knowledge-tabs button:hover { color: #111827; background: rgb(249 250 251 / 50%); }
.visual-knowledge-tabs button.is-active { border-color: rgb(229 231 235 / 60%); background: #fff; color: #111827; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.visual-knowledge-tabs button :deep(.t-icon) { font-size: 14px; color: #374151; }
.visual-knowledge-tabs :deep(.t-loading) { width: 12px; height: 12px; }
.visual-knowledge-header__plain-tab { color: #374151; font-size: 12px; font-weight: 700; }
.visual-knowledge-alerts { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 8px; }
.visual-knowledge-alerts button { min-height: 30px; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; background: #fff; color: #6b7280; font: inherit; font-size: 11px; cursor: pointer; }
.visual-knowledge-alerts button:disabled { cursor: default; }
.visual-knowledge-alerts strong { color: #374151; }
.visual-knowledge-wiki-host { min-height: 0; flex: 1 1 auto; overflow: hidden; }
.visual-knowledge-documents { min-height: 0; flex: 1 1 auto; display: flex; gap: 12px; }
.visual-knowledge-documents__tree { flex: 0 0 auto; }
.visual-knowledge-content { position: relative; min-width: 0; min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 12px; }

.visual-knowledge-toolbar { flex: 0 0 auto; padding: 10px; border: 1px solid rgb(229 231 235 / 90%); border-radius: 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.visual-knowledge-toolbar__left { min-width: 280px; flex: 1 1 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.visual-knowledge-toolbar__right { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
.visual-knowledge-path-pill { min-height: 28px; padding: 4px 10px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; background: rgb(243 244 246 / 90%); color: #374151; font: inherit; font-size: 12px; line-height: 18px; font-weight: 600; }
.visual-knowledge-path-pill > :deep(.t-icon) { flex: 0 0 auto; font-size: 14px; color: #6b7280; }
.visual-knowledge-path-pill__segment { max-width: 160px; padding: 0; border: 0; border-radius: 5px; overflow: hidden; background: transparent; color: #4b5563; font: inherit; font-size: inherit; line-height: inherit; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
button.visual-knowledge-path-pill__segment { cursor: pointer; }
button.visual-knowledge-path-pill__segment:hover { color: #111827; text-decoration: underline; text-underline-offset: 2px; }
.visual-knowledge-path-pill__segment.is-root { color: #111827; font-weight: 700; }
.visual-knowledge-path-pill__segment.is-current { color: #6b7280; cursor: default; }
.visual-knowledge-search { min-width: 160px; max-width: 220px; flex: 1 1 160px; }
.visual-knowledge-filters { min-width: 0; display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.visual-knowledge-filters::-webkit-scrollbar { display: none; }
.visual-knowledge-toolbar :deep(.t-input),.visual-knowledge-toolbar :deep(.t-select-input),.visual-knowledge-toolbar :deep(.t-date-range-picker) { min-height: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background: rgb(249 250 251 / 80%); box-shadow: none !important; color: #374151; font-size: 12px; }
.visual-knowledge-toolbar :deep(.t-input:hover),.visual-knowledge-toolbar :deep(.t-select-input:hover),.visual-knowledge-toolbar :deep(.t-input.t-is-focused) { border-color: #9ca3af; background: #fff; }
.visual-knowledge-select { flex: 0 0 126px; width: 126px; }
.visual-knowledge-date { flex: 0 0 210px; width: 210px; }
.visual-knowledge-filter-button { min-height: 30px; padding: 6px 12px; border: 1px solid #e5e7eb; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; background: #fff; color: #374151; font: inherit; font-size: 12px; line-height: 18px; font-weight: 600; cursor: pointer; }
.visual-knowledge-filter-button:hover { background: #f9fafb; }
.visual-knowledge-filter-button.is-active { border-color: #d1d5db; background: #f3f4f6; color: #111827; font-weight: 700; }
.visual-knowledge-filter-button > span:not(.visual-knowledge-filter-button__clear) { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-knowledge-filter-button :deep(.t-icon) { font-size: 14px; color: #9ca3af; }
.visual-knowledge-filter-button__clear { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; }
.visual-knowledge-view-toggle { padding: 2px; border: 1px solid #e5e7eb; border-radius: 12px; display: flex; background: #f3f4f6; }
.visual-knowledge-view-toggle button { width: 28px; height: 28px; padding: 6px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #9ca3af; cursor: pointer; }
.visual-knowledge-view-toggle button:hover { color: #374151; }
.visual-knowledge-view-toggle button.is-active { background: #fff; color: #111827; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.visual-knowledge-view-toggle :deep(.t-icon) { font-size: 14px; }
.visual-knowledge-scroll { position: relative; min-height: 0; flex: 1 1 auto; overflow: auto; }
.visual-knowledge-scroll.is-marquee-active { user-select: none; cursor: crosshair; }
.visual-knowledge-marquee { position: absolute; z-index: 50; border: 1px solid #9ca3af; background: rgb(156 163 175 / 10%); pointer-events: none; }
.visual-knowledge-marquee.is-subtract { border-style: dashed; }
.visual-knowledge-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(240px,1fr)); gap: 16px; }
.visual-knowledge-skeleton-card { min-height: 192px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; }
.visual-knowledge-empty { min-height: 260px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; text-align: center; }
.visual-knowledge-batch-anchor { position: absolute; left: 50%; bottom: 12px; z-index: 100; transform: translateX(-50%); }
.visual-faq-manager { width: 100%; height: 100%; min-height: 0; overflow: auto; background: #fff; }

.visual-tag-filter { width: 280px; max-height: min(480px,70vh); padding: 8px; display: flex; flex-direction: column; gap: 8px; color: #374151; }
.visual-tag-filter > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 4px; }
.visual-tag-filter > header strong { font-size: 11px; font-weight: 700; }
.visual-tag-filter > header span { color: #9ca3af; font-size: 10px; }
.visual-tag-filter__body { min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 6px; }
.visual-tag-filter__chip { min-height: 28px; padding: 5px 8px; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #4b5563; font: inherit; font-size: 11px; cursor: pointer; }
.visual-tag-filter__chip:hover,.visual-tag-filter__chip.is-active { background: #f3f4f6; color: #111827; }
.visual-tag-filter__chip small { color: #9ca3af; font-size: 9px; }
.visual-tag-filter__body p { width: 100%; margin: 16px 0; color: #9ca3af; font-size: 11px; text-align: center; }
.visual-tag-filter > footer { padding-top: 6px; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; gap: 6px; }
.visual-tag-filter > footer button { min-height: 28px; padding: 5px 8px; border: 0; border-radius: 8px; background: transparent; color: #4b5563; font: inherit; font-size: 11px; cursor: pointer; }
.visual-tag-filter > footer button:hover { background: #f3f4f6; }

@media (min-width: 768px) { .visual-knowledge-header { flex-direction: row; align-items: center; justify-content: space-between; } .visual-knowledge-tabs { align-self: auto; } }
@media (max-width: 900px) { .visual-knowledge-page { padding: 20px; } .visual-knowledge-toolbar__left { min-width: 0; } }
@media (max-width: 760px) { .visual-knowledge-page { padding: 16px 12px; } .visual-knowledge-documents { gap: 8px; } .visual-knowledge-date { flex-basis: 190px; width: 190px; } }
</style>
<style>
.visual-tag-filter-popup .t-popup__content { padding: 0 !important; overflow: hidden; border: 1px solid #e5e7eb !important; border-radius: 12px !important; background: #fff !important; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 10%),0 4px 6px -4px rgb(0 0 0 / 10%) !important; }
</style>
