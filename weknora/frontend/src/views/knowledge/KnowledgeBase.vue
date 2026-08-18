<script lang="ts">
import { defineComponent } from 'vue'
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
    DocContent,
    EmptyKnowledge,
    KBSwitcherDropdown,
    KnowledgeBaseEditorModal,
    FAQEntryManager,
    DocumentListView,
    DocumentCardView,
    DocumentBatchBar,
    KbUploadSourceDropdown,
    KbFolderTree,
    TagEditDialog,
    BatchTagDialog,
    KbTagManageDrawer,
    WikiBrowser,
  },
  setup(props, context) {
    const state = legacySetup?.(props, context)
    if (state && typeof state === 'object' && typeof state.then !== 'function') {
      return { ...state }
    }
    return state
  },
})
</script>

<template>
  <template v-if="!isFAQ">
    <main
      class="visual-knowledge-page"
      :class="{
        'is-documents': activeKbTab === 'documents' || !isWiki,
        'is-wiki-view': isWiki && activeKbTab === 'wiki',
        'is-graph-view': isWiki && activeKbTab === 'graph',
      }"
    >
      <header class="visual-knowledge-header">
        <div class="visual-knowledge-header__main">
          <nav class="visual-knowledge-breadcrumb" :aria-label="$t('menu.knowledgeBase')">
            <button type="button" @click="handleNavigateToKbList">{{ $t('menu.knowledgeBase') }}</button>
            <t-icon name="chevron-right" />
            <KBSwitcherDropdown
              v-if="knowledgeList.length"
              :kb-list="knowledgeList"
              :current-kb-id="kbId"
              @select="(id) => handleKnowledgeDropdownSelect({ value: id })"
            >
              <button type="button" class="visual-knowledge-breadcrumb__current" :disabled="!kbId">
                <template v-if="!kbInfo">
                  <t-skeleton animation="gradient" :row-col="[{ width: '112px', height: '16px' }]" />
                </template>
                <template v-else>
                  <span>{{ kbInfo.name }}</span>
                  <t-icon name="chevron-down" />
                </template>
              </button>
            </KBSwitcherDropdown>
            <button
              v-else
              type="button"
              class="visual-knowledge-breadcrumb__current"
              :disabled="!kbId"
              @click="handleNavigateToCurrentKB"
            >
              <template v-if="!kbInfo">
                <t-skeleton animation="gradient" :row-col="[{ width: '112px', height: '16px' }]" />
              </template>
              <template v-else>{{ kbInfo.name }}</template>
            </button>
          </nav>

          <div v-if="isWiki" class="visual-knowledge-tabs" role="tablist">
            <button
              type="button"
              :class="{ 'is-active': activeKbTab === 'documents' }"
              role="tab"
              :aria-selected="activeKbTab === 'documents'"
              @click="activeKbTab = 'documents'"
            >
              {{ $t('knowledgeEditor.wikiBrowser.tabDocuments') }}
            </button>
            <button
              type="button"
              :class="{ 'is-active': activeKbTab === 'wiki' }"
              role="tab"
              :aria-selected="activeKbTab === 'wiki'"
              @click="activeKbTab = 'wiki'"
            >
              <span>Wiki</span>
              <t-tooltip v-if="wikiIsIndexing" :content="wikiIndexingTip" placement="bottom">
                <t-loading size="small" />
              </t-tooltip>
            </button>
            <t-tooltip :content="$t('knowledgeEditor.wikiBrowser.tabGraphTip')" placement="bottom">
              <button
                type="button"
                :class="{ 'is-active': activeKbTab === 'graph' }"
                role="tab"
                :aria-selected="activeKbTab === 'graph'"
                @click="activeKbTab = 'graph'"
              >
                <span>{{ $t('knowledgeEditor.wikiBrowser.tabGraph') }}</span>
                <t-loading v-if="wikiIsIndexing" size="small" />
              </button>
            </t-tooltip>
          </div>
          <span v-else class="visual-knowledge-header__section">{{ $t('knowledgeEditor.document.title') }}</span>
        </div>

        <p class="visual-knowledge-header__subtitle">{{ $t('knowledgeEditor.document.subtitle') }}</p>

        <div v-if="unsupportedFileTypes.length || missingStorageEngine" class="visual-knowledge-alerts">
          <button v-if="unsupportedFileTypes.length" type="button" @click="goToParserSettings">
            <t-icon name="info-circle" />
            <span>
              {{ $t('knowledgeBase.unsupportedTypesHint', { types: unsupportedFileTypes.map(t => '.' + t).join('、') }) }}
            </span>
            <strong>{{ $t('knowledgeBase.goToParserSettings') }} →</strong>
          </button>
          <button v-if="missingStorageEngine" type="button" @click="handleOpenKBSettings">
            <t-icon name="info-circle" />
            <span>{{ $t('knowledgeBase.missingStorageEngine') }}</span>
            <strong>{{ $t('knowledgeBase.goToStorageSettings') }} →</strong>
          </button>
        </div>
      </header>

      <section
        v-if="isWiki && (activeKbTab === 'wiki' || activeKbTab === 'graph')"
        class="visual-knowledge-wiki-host"
      >
        <WikiBrowser
          v-if="kbId"
          :knowledge-base-id="kbId"
          :view="activeKbTab === 'graph' ? 'graph' : 'browser'"
          :can-edit="canEdit"
          @open-source-doc="openSourceDoc"
          @status-change="onWikiStatusChange"
          @view-graph="onViewWikiInGraph"
        />
      </section>

      <section v-if="activeKbTab === 'documents' || !isWiki" class="visual-knowledge-documents">
        <KbFolderTree
          v-if="showFolderTree && !folderTreeCollapsed"
          class="visual-knowledge-documents__tree"
          :tree="folderTree"
          :selected-path="selectedFolderPath"
          :loading="folderTreeLoading"
          :can-edit="canEdit"
          @select="handleFolderSelect"
          @update:collapsed="handleFolderTreeCollapsedChange"
          @rename="handleFolderRename"
        />

        <div class="visual-knowledge-content">
          <nav
            v-if="showFolderTree"
            class="visual-knowledge-folder-path"
            :aria-label="$t('knowledgeBase.folderTree.title')"
          >
            <t-tooltip v-if="folderTreeCollapsed" :content="$t('knowledgeBase.folderTree.expand')" placement="top">
              <button
                type="button"
                class="visual-knowledge-folder-path__tree-toggle"
                :aria-label="$t('knowledgeBase.folderTree.expand')"
                @click="handleFolderTreeCollapsedChange(false)"
              >
                <t-icon name="folder" />
              </button>
            </t-tooltip>
            <span v-if="!folderBreadcrumbs.length" class="visual-knowledge-folder-path__crumb is-current">
              {{ $t('knowledgeBase.folderTree.rootRow') }}
            </span>
            <button v-else type="button" class="visual-knowledge-folder-path__crumb" @click="handleFolderSelect('')">
              {{ $t('knowledgeBase.folderTree.rootRow') }}
            </button>
            <template v-for="(crumb, index) in folderBreadcrumbs" :key="crumb.path">
              <t-icon name="chevron-right" class="visual-knowledge-folder-path__sep" />
              <span
                v-if="index === folderBreadcrumbs.length - 1"
                class="visual-knowledge-folder-path__crumb is-current"
              >
                {{ crumb.name }}
              </span>
              <button
                v-else
                type="button"
                class="visual-knowledge-folder-path__crumb"
                @click="handleFolderSelect(crumb.path)"
              >
                {{ crumb.name }}
              </button>
            </template>
            <span v-if="isFiltering" class="visual-knowledge-folder-path__scope">
              {{ $t('knowledgeBase.folderTree.searchingSubtree') }}
            </span>
          </nav>

          <div class="visual-knowledge-toolbar">
            <t-input
              v-model.trim="docSearchKeyword"
              :placeholder="$t('knowledgeBase.docSearchPlaceholder')"
              clearable
              class="visual-knowledge-toolbar__search"
              @clear="loadKnowledgeFiles(kbId)"
              @enter="loadKnowledgeFiles(kbId)"
            >
              <template #prefix-icon><t-icon name="search" /></template>
            </t-input>

            <div class="visual-knowledge-toolbar__filters">
              <t-popup
                v-model:visible="tagFilterPanelVisible"
                trigger="click"
                placement="bottom-left"
                overlay-class-name="visual-tag-filter-popup"
                :overlay-inner-style="{ padding: 0 }"
              >
                <template #content>
                  <section class="visual-tag-filter" @click.stop>
                    <header>
                      <strong>{{ $t('knowledgeBase.tagFilterTitle') }}</strong>
                      <span>{{ sidebarCategoryCount }}</span>
                    </header>
                    <t-input
                      v-model.trim="tagSearchQuery"
                      size="small"
                      :placeholder="$t('knowledgeBase.tagSearchPlaceholder')"
                      clearable
                    >
                      <template #prefix-icon><t-icon name="search" /></template>
                    </t-input>
                    <div class="visual-tag-filter__body">
                      <template v-if="tagLoading && !sidebarTags.length">
                        <t-skeleton
                          v-for="n in 6"
                          :key="n"
                          animation="gradient"
                          :row-col="[{ width: '72px', height: '26px', type: 'rect' }]"
                        />
                      </template>
                      <template v-else>
                        <button
                          v-for="tag in sidebarTags"
                          :key="tag.id"
                          type="button"
                          class="visual-tag-filter__chip"
                          :class="{ 'is-active': isTagFilterActive(tag.id) }"
                          :title="`${tag.name} (${tag.knowledge_count || 0})`"
                          @click="handleTagRowClick(tag.id)"
                        >
                          <span>{{ tag.name }}</span>
                          <small>{{ tag.knowledge_count || 0 }}</small>
                        </button>
                        <p v-if="!sidebarTags.length">{{ $t('knowledgeBase.tagEmptyResult') }}</p>
                      </template>
                    </div>
                    <footer v-if="tagHasMore || canEdit">
                      <button v-if="tagHasMore" type="button" :disabled="tagLoadingMore" @click.stop="kbId && loadTags(kbId)">
                        <t-loading v-if="tagLoadingMore" size="small" />
                        <span>{{ $t('tenant.loadMore') }}</span>
                      </button>
                      <button v-if="canEdit" type="button" @click="openTagManageDrawer">
                        {{ $t('knowledgeBase.tagManageLink') }}
                      </button>
                    </footer>
                  </section>
                </template>
                <button
                  type="button"
                  class="visual-knowledge-filter-button"
                  :class="{ 'is-open': tagFilterPanelVisible, 'is-placeholder': isTagFilterPlaceholder }"
                  :title="activeTagFilterTitle"
                  @mouseenter="tagFilterTriggerHover = true"
                  @mouseleave="tagFilterTriggerHover = false"
                >
                  <t-icon name="discount" />
                  <span>{{ activeTagFilterLabel }}</span>
                  <span
                    v-if="showTagFilterClear"
                    class="visual-knowledge-filter-button__clear"
                    role="button"
                    tabindex="0"
                    :aria-label="$t('common.clear')"
                    @click.stop="clearTagFilter"
                    @keydown.enter.stop.prevent="clearTagFilter"
                    @mousedown.stop
                  >
                    <t-icon name="close-circle-filled" />
                  </span>
                  <t-icon v-else name="chevron-down" />
                </button>
              </t-popup>

              <t-select
                v-model="selectedFileType"
                :options="fileTypeOptions"
                :placeholder="$t('knowledgeBase.fileTypeFilter')"
                class="visual-knowledge-toolbar__select"
                clearable
              >
                <template #prefixIcon><t-icon name="file" /></template>
              </t-select>

              <t-select
                v-model="selectedParseStatus"
                :options="parseStatusOptions"
                :placeholder="$t('knowledgeBase.parseStatusFilter')"
                class="visual-knowledge-toolbar__select"
                clearable
              >
                <template #prefixIcon><t-icon name="check-circle" /></template>
              </t-select>

              <t-select
                v-model="selectedSource"
                :options="sourceOptions"
                :placeholder="$t('knowledgeBase.sourceFilter')"
                class="visual-knowledge-toolbar__select"
                clearable
              >
                <template #prefixIcon><t-icon name="link" /></template>
              </t-select>

              <t-date-range-picker
                v-model="updatedTimeRange"
                :placeholder="[$t('knowledgeBase.updatedTimeFrom'), $t('knowledgeBase.updatedTimeTo')]"
                :disable-date="disableFutureDate"
                class="visual-knowledge-toolbar__date"
                clearable
                allow-input
              >
                <template #prefixIcon><t-icon name="time" /></template>
              </t-date-range-picker>
            </div>

            <div class="visual-knowledge-toolbar__actions">
              <div class="visual-knowledge-view-toggle" role="group" :aria-label="$t('knowledgeBase.viewModeToggle')">
                <button
                  type="button"
                  :class="{ 'is-active': viewMode === 'grid' }"
                  :aria-pressed="viewMode === 'grid'"
                  :title="$t('knowledgeBase.viewModeGrid')"
                  @click="viewMode = 'grid'"
                >
                  <t-icon name="view-module" />
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': viewMode === 'list' }"
                  :aria-pressed="viewMode === 'list'"
                  :title="$t('knowledgeBase.viewModeList')"
                  @click="viewMode = 'list'"
                >
                  <t-icon name="view-list" />
                </button>
              </div>

              <KbUploadSourceDropdown
                v-if="canEdit"
                ref="uploadSourceRef"
                :accept-file-types="acceptFileTypes"
                :supported-file-types="[...supportedFileTypes]"
                include-manual
                trigger-icon="file-add"
                data-guide="kb-detail-add-doc"
                :tooltip="t('knowledgeBase.addDocument')"
                placement="bottom-right"
                @files="handleUploadSourceFiles"
                @url="handleUploadSourceUrl"
                @manual="handleManualCreate"
              />
            </div>
          </div>

          <div
            ref="knowledgeScroll"
            class="visual-knowledge-scroll"
            :class="{
              'is-empty': !cardList.length && !currentChildFolders.length && !docListLoading,
              'is-marquee-active': docMarqueeVisible,
            }"
            @scroll="handleScroll"
            @mousedown="onDocMarqueeMouseDown"
          >
            <div
              v-if="docMarqueeVisible"
              class="visual-knowledge-marquee"
              :class="{ 'is-add': docMarqueeMode === 'add', 'is-subtract': docMarqueeMode === 'subtract' }"
              :style="docMarqueeBoxStyle"
              aria-hidden="true"
            />

            <div
              v-if="docListLoading && cardList.length === 0 && !currentChildFolders.length"
              class="visual-knowledge-skeleton-grid"
              aria-hidden="true"
            >
              <div v-for="n in 8" :key="n" class="visual-knowledge-skeleton-card">
                <t-skeleton
                  animation="gradient"
                  :row-col="[
                    { width: '68%', height: '15px' },
                    { width: '100%', height: '12px' },
                    { width: '52%', height: '12px' },
                  ]"
                />
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
              @open="(item) => openKnowledgeItem(item)"
              @open-folder="handleFolderSelect"
              @move-to-folder="(item, path) => moveKnowledgeIntoFolder([item.id], path)"
              @toggle-checkbox="onCardGridCheckboxChange"
              @menu-visible-change="(visible, item) => onCardMoreVisibleChange(visible, item)"
              @action="(action, item) => handleCardAction(action, item)"
              @tag-edit="(item) => openTagEditDialog(item)"
              @move-select-target="(kb) => handleMoveSelectTarget(kb)"
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
              @open-folder="handleFolderSelect"
              @move-to-folder="(item, path) => moveKnowledgeIntoFolder([item.id], path)"
              @open="(item) => openKnowledgeItem(item)"
              @toggle-row="toggleSelectRow"
              @toggle-all="toggleSelectAll"
              @action="(action, item) => handleListAction(action, item)"
              @probe-trace="(item) => probeTraceAvailable(item)"
              @tag-edit="(item) => openTagEditDialog(item)"
              @move-select-target="(kb) => handleMoveSelectTarget(kb)"
              @move-back="handleMoveBack"
              @move-confirm="handleMoveConfirm"
              @update:move-mode="(mode) => moveMode = mode"
              @reset-move-state="moveMenuMode = 'normal'"
            />

            <div v-else-if="!docListLoading" class="visual-knowledge-empty">
              <p v-if="selectedFolderPath || isFiltering">
                {{ isFiltering ? $t('knowledgeBase.folderTree.emptySearch') : $t('knowledgeBase.folderTree.emptyFolder') }}
              </p>
              <EmptyKnowledge v-else />
            </div>
          </div>

          <div v-show="batchMode || selectedIds.size > 0" class="visual-knowledge-batch-anchor">
            <DocumentBatchBar
              :count="selectedIds.size"
              :delete-loading="batchDeleting"
              :reparse-loading="batchReparsing"
              :tag-loading="batchTagging"
              :visible="batchMode || selectedIds.size > 0"
              :show-move-to-folder="canEdit"
              :folder-options="folderOptions"
              @cancel="handleBatchCancel"
              @delete="confirmBatchDelete"
              @reparse="confirmBatchReparse"
              @batch-tag="handleBatchTag"
              @move-to-folder="(path) => moveKnowledgeIntoFolder(Array.from(selectedIds), path)"
            />
          </div>
        </div>
      </section>

      <DocContent
        ref="docContentRef"
        :visible="isCardDetails"
        :details="details"
        :canEditKB="canEdit"
        :canDownloadKB="canDownloadKnowledge"
        :kbId="kbId"
        @closeDoc="closeDoc"
        @getDoc="getDoc"
        @summaryStateChange="syncDocumentSummaryState"
      />
    </main>
  </template>

  <section v-else class="visual-faq-manager">
    <FAQEntryManager v-if="kbId" :kb-id="kbId" />
  </section>

  <KnowledgeBaseEditorModal
    :visible="uiStore.showKBEditorModal"
    :mode="uiStore.kbEditorMode"
    :kb-id="uiStore.currentKBId || undefined"
    :initial-type="uiStore.kbEditorType"
    @update:visible="(val) => val ? null : uiStore.closeKBEditor()"
    @success="handleKBEditorSuccess"
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
    @tag-created="loadTags(kbId, true)"
    @open-manage="openTagManageFromEditDialog"
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
    @tag-created="loadTags(kbId, true)"
    @open-manage="openTagManageFromBatchDialog"
  />

  <KbTagManageDrawer
    v-if="!isFAQ"
    v-model:visible="tagManageDrawerVisible"
    :kb-id="kbId"
    :is-faq="isFAQ"
    @changed="onTagManageChanged"
  />
</template>

<style scoped lang="less">
.visual-knowledge-page { min-width: 0; min-height: 0; width: 100%; height: 100%; flex: 1 1 auto; padding: 20px 24px 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; overflow: hidden; background: #fff; color: #374151; }
.visual-knowledge-header { flex: 0 0 auto; display: flex; flex-direction: column; gap: 5px; }
.visual-knowledge-header__main { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.visual-knowledge-breadcrumb { min-width: 0; display: flex; align-items: center; gap: 5px; color: #9ca3af; }
.visual-knowledge-breadcrumb > button, .visual-knowledge-breadcrumb__current { min-width: 0; padding: 3px 4px; border: 0; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; background: transparent; color: #6b7280; font: inherit; font-size: 11px; line-height: 17px; cursor: pointer; }
.visual-knowledge-breadcrumb > button:hover:not(:disabled), .visual-knowledge-breadcrumb__current:hover:not(:disabled) { background: #f3f4f6; color: #111827; }
.visual-knowledge-breadcrumb__current span { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-knowledge-breadcrumb :deep(.t-icon) { flex: 0 0 11px; font-size: 11px; }
.visual-knowledge-tabs { min-height: 30px; padding: 2px; border-radius: 9px; display: inline-flex; align-items: center; gap: 2px; background: #f3f4f6; }
.visual-knowledge-tabs button { min-height: 26px; padding: 4px 8px; border: 0; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; background: transparent; color: #9ca3af; font: inherit; font-size: 10px; cursor: pointer; }
.visual-knowledge-tabs button:hover, .visual-knowledge-tabs button.is-active { background: #fff; color: #374151; box-shadow: 0 1px 2px rgb(15 23 42 / 5%); }
.visual-knowledge-tabs :deep(.t-loading) { width: 10px; height: 10px; }
.visual-knowledge-header__section { color: #374151; font-size: 11px; line-height: 17px; font-weight: 600; }
.visual-knowledge-header__subtitle { margin: 0; color: #9ca3af; font-size: 10px; line-height: 15px; }
.visual-knowledge-alerts { display: flex; flex-wrap: wrap; gap: 5px; }
.visual-knowledge-alerts button { min-height: 28px; padding: 4px 7px; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #f9fafb; color: #6b7280; font: inherit; font-size: 9px; line-height: 15px; cursor: pointer; }
.visual-knowledge-alerts button:hover { background: #f3f4f6; color: #374151; }
.visual-knowledge-alerts button strong { color: #4b5563; font-weight: 600; }
.visual-knowledge-alerts :deep(.t-icon) { font-size: 11px; }
.visual-knowledge-wiki-host { min-height: 0; flex: 1 1 auto; overflow: hidden; }
.visual-knowledge-documents { min-height: 0; flex: 1 1 auto; display: flex; gap: 12px; }
.visual-knowledge-documents__tree { flex: 0 0 auto; }
.visual-knowledge-content { position: relative; min-width: 0; min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; }
.visual-knowledge-folder-path { flex: 0 0 auto; min-height: 30px; padding: 2px 2px 6px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }
.visual-knowledge-folder-path__tree-toggle { width: 26px; height: 26px; padding: 5px; border: 1px solid #e5e7eb; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #9ca3af; cursor: pointer; }
.visual-knowledge-folder-path__crumb { max-width: 220px; padding: 3px 4px; border: 0; border-radius: 5px; background: transparent; color: #9ca3af; font: inherit; font-size: 9px; line-height: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.visual-knowledge-folder-path__crumb:hover:not(.is-current) { background: #f3f4f6; color: #4b5563; }
.visual-knowledge-folder-path__crumb.is-current { color: #6b7280; cursor: default; font-weight: 600; }
.visual-knowledge-folder-path__sep { flex: 0 0 9px; font-size: 9px; color: #d1d5db; }
.visual-knowledge-folder-path__scope { margin-left: 4px; color: #9ca3af; font-size: 9px; }
.visual-knowledge-toolbar { flex: 0 0 auto; min-height: 44px; padding: 5px 6px; border: 1px solid #e5e7eb; border-radius: 11px; display: flex; align-items: center; gap: 6px; background: #f9fafb; }
.visual-knowledge-toolbar__search { flex: 1 1 190px; min-width: 150px; max-width: 300px; }
.visual-knowledge-toolbar__filters { min-width: 0; flex: 1 1 auto; display: flex; align-items: center; gap: 5px; overflow-x: auto; scrollbar-width: none; }
.visual-knowledge-toolbar__filters::-webkit-scrollbar { display: none; }
.visual-knowledge-toolbar__actions { flex: 0 0 auto; margin-left: auto; display: flex; align-items: center; gap: 5px; }
.visual-knowledge-toolbar :deep(.t-input), .visual-knowledge-toolbar :deep(.t-select-input), .visual-knowledge-toolbar :deep(.t-date-range-picker) { min-height: 32px; border-color: transparent; border-radius: 8px; background: #fff; box-shadow: none !important; font-size: 10px; }
.visual-knowledge-toolbar :deep(.t-input:hover), .visual-knowledge-toolbar :deep(.t-input.t-is-focused), .visual-knowledge-toolbar :deep(.t-select-input:hover) { border-color: #d1d5db; }
.visual-knowledge-toolbar__select { flex: 0 0 124px; width: 124px; }
.visual-knowledge-toolbar__date { flex: 0 0 208px; width: 208px; }
.visual-knowledge-filter-button { min-width: 116px; max-width: 160px; min-height: 32px; padding: 5px 7px; border: 1px solid transparent; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #6b7280; font: inherit; font-size: 10px; cursor: pointer; }
.visual-knowledge-filter-button:hover, .visual-knowledge-filter-button.is-open { border-color: #d1d5db; color: #374151; }
.visual-knowledge-filter-button > span:not(.visual-knowledge-filter-button__clear) { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.visual-knowledge-filter-button :deep(.t-icon) { flex: 0 0 11px; font-size: 11px; }
.visual-knowledge-filter-button__clear { flex: 0 0 18px; width: 18px; height: 18px; padding: 3px; display: inline-flex; align-items: center; justify-content: center; color: #c1c5cc; cursor: pointer; }
.visual-knowledge-view-toggle { padding: 2px; border-radius: 8px; display: flex; background: #eceef1; }
.visual-knowledge-view-toggle button { width: 28px; height: 28px; padding: 6px; border: 0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #9ca3af; cursor: pointer; }
.visual-knowledge-view-toggle button:hover, .visual-knowledge-view-toggle button.is-active { background: #fff; color: #374151; box-shadow: 0 1px 2px rgb(15 23 42 / 6%); }
.visual-knowledge-view-toggle :deep(.t-icon) { font-size: 13px; }
.visual-knowledge-scroll { position: relative; min-height: 0; flex: 1 1 auto; margin-top: 8px; overflow: auto; scrollbar-width: thin; }
.visual-knowledge-scroll.is-marquee-active { user-select: none; cursor: crosshair; }
.visual-knowledge-marquee { position: absolute; z-index: 50; border: 1px solid #9ca3af; background: rgb(156 163 175 / 10%); pointer-events: none; }
.visual-knowledge-marquee.is-subtract { border-style: dashed; }
.visual-knowledge-skeleton-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 2px; }
.visual-knowledge-skeleton-card { min-height: 150px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
.visual-knowledge-empty { min-height: 260px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 11px; text-align: center; }
.visual-knowledge-batch-anchor { position: absolute; left: 50%; bottom: 12px; z-index: 100; transform: translateX(-50%); }
.visual-faq-manager { width: 100%; height: 100%; min-height: 0; overflow: auto; background: #fff; }
.visual-tag-filter { width: 300px; max-width: calc(100vw - 24px); max-height: min(480px, 70vh); padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; color: #374151; }
.visual-tag-filter > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.visual-tag-filter > header strong { font-size: 11px; font-weight: 650; }
.visual-tag-filter > header span { color: #9ca3af; font-size: 9px; }
.visual-tag-filter__body { min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 5px; }
.visual-tag-filter__chip { max-width: 100%; min-height: 26px; padding: 4px 7px; border: 1px solid #e5e7eb; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #6b7280; font: inherit; font-size: 9px; cursor: pointer; }
.visual-tag-filter__chip:hover, .visual-tag-filter__chip.is-active { border-color: #d1d5db; background: #f3f4f6; color: #374151; }
.visual-tag-filter__chip small { color: #9ca3af; font-size: 8px; }
.visual-tag-filter__body p { width: 100%; margin: 12px 0; color: #9ca3af; font-size: 9px; text-align: center; }
.visual-tag-filter > footer { padding-top: 7px; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; gap: 6px; }
.visual-tag-filter > footer button { min-height: 26px; padding: 4px 6px; border: 0; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; background: transparent; color: #6b7280; font: inherit; font-size: 9px; cursor: pointer; }
.visual-tag-filter > footer button:hover { background: #f3f4f6; color: #374151; }
@media (max-width: 1200px) { .visual-knowledge-page { padding-inline: 18px; } .visual-knowledge-toolbar { align-items: flex-start; flex-wrap: wrap; } .visual-knowledge-toolbar__search { max-width: none; } .visual-knowledge-toolbar__filters { order: 3; flex-basis: 100%; } .visual-knowledge-skeleton-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) { .visual-knowledge-page { padding: 14px 12px 0; } .visual-knowledge-documents { gap: 8px; } .visual-knowledge-toolbar__select { flex-basis: 116px; width: 116px; } .visual-knowledge-toolbar__date { flex-basis: 190px; width: 190px; } .visual-knowledge-skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .visual-knowledge-skeleton-grid { grid-template-columns: 1fr; } }
</style>

<style>
.visual-tag-filter-popup .t-popup__content { padding: 0 !important; overflow: hidden; border: 1px solid #e5e7eb !important; border-radius: 12px !important; background: #fff !important; box-shadow: 0 14px 34px rgb(15 23 42 / 14%) !important; }
</style>
