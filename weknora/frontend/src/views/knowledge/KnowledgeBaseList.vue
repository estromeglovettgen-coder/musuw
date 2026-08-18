<script lang="ts">
import { defineComponent } from 'vue'
import LegacyKnowledgeBaseListBusiness from '@/assets/business-baselines/KnowledgeBaseList.pre-view.vue'
import KnowledgeBaseEditorModal from './KnowledgeBaseEditorModal.vue'
import KbWikiBadge from './components/KbWikiBadge.vue'
import ShareKnowledgeBaseDialog from '@/components/ShareKnowledgeBaseDialog.vue'
import ResourceOriginBadge from '@/components/ResourceOriginBadge.vue'

const legacy = LegacyKnowledgeBaseListBusiness as any
const legacySetup = legacy.setup

export default defineComponent({
  ...legacy,
  name: 'KnowledgeBaseList',
  components: {
    ...(legacy.components || {}),
    KnowledgeBaseEditorModal,
    KbWikiBadge,
    ShareKnowledgeBaseDialog,
    ResourceOriginBadge,
  },
  setup(props, context) {
    const state = legacySetup?.(props, context)
    if (state && typeof state === 'object' && typeof state.then !== 'function') return { ...state }
    return state
  },
})
</script>

<template>
  <main class="visual-kb-list">
    <header class="visual-kb-list__header" style="--wails-draggable: drag">
      <div>
        <h1>{{ $t('knowledgeBase.title') }}</h1>
        <p>{{ $t('knowledgeList.subtitle') }}</p>
      </div>
      <button
        v-if="authStore.hasRole('contributor')"
        type="button"
        class="visual-kb-list__create"
        data-guide="kb-list-create"
        @click="handleCreateKnowledgeBase"
      >
        <t-icon name="folder-add" />
        <span>{{ $t('knowledgeList.create') }}</span>
      </button>
    </header>

    <section v-if="uploadSummaries.length" class="visual-kb-upload-status" aria-live="polite">
      <article v-for="summary in uploadSummaries" :key="summary.kbId">
        <span class="visual-kb-upload-status__icon" :class="{ 'is-done': summary.completed === summary.total }">
          <t-icon :name="summary.completed === summary.total ? 'check-circle-filled' : 'upload'" />
        </span>
        <div class="visual-kb-upload-status__copy">
          <strong>
            {{ summary.completed === summary.total
              ? $t('knowledgeList.uploadProgress.completedTitle', { name: summary.kbName })
              : $t('knowledgeList.uploadProgress.uploadingTitle', { name: summary.kbName }) }}
          </strong>
          <span>
            {{ summary.completed === summary.total
              ? $t('knowledgeList.uploadProgress.completedDetail', { total: summary.total })
              : $t('knowledgeList.uploadProgress.detail', { completed: summary.completed, total: summary.total }) }}
          </span>
          <span class="is-muted">
            {{ summary.completed === summary.total
              ? $t('knowledgeList.uploadProgress.refreshing')
              : $t('knowledgeList.uploadProgress.keepPageOpen') }}
          </span>
          <span v-if="summary.hasError" class="is-error">{{ $t('knowledgeList.uploadProgress.errorTip') }}</span>
          <span class="visual-kb-upload-status__bar"><span :style="{ width: summary.progress + '%' }" /></span>
        </div>
      </article>
    </section>

    <section class="visual-kb-list__content">
      <div v-if="loading && kbs.length === 0" class="visual-kb-grid" aria-hidden="true">
        <article v-for="n in 8" :key="n" class="visual-kb-card is-skeleton">
          <t-skeleton animation="gradient" :row-col="[
            { width: '62%', height: '16px' },
            { width: '100%', height: '12px' },
            { width: '76%', height: '12px' },
          ]" />
        </article>
      </div>

      <div v-else-if="sortedMineKbs.length > 0" class="visual-kb-grid">
        <button
          v-if="sortedMineKbs[0]?.is_pinned"
          type="button"
          class="visual-kb-section"
          @click="toggleKbSection('pinned')"
        >
          <t-icon name="pin-filled" />
          <span>{{ $t('knowledgeList.sections.pinned') }}</span>
          <small>{{ mineKbSectionCounts.pinned }}</small>
          <t-icon :name="isKbSectionCollapsed('pinned') ? 'chevron-right' : 'chevron-down'" />
        </button>

        <template v-for="(kb, index) in sortedMineKbs" :key="kb.id">
          <button
            v-if="
              showShareGroupHeaders &&
              !isMyKb(kb) &&
              !kb.is_pinned &&
              (index === 0 || isMyKb(sortedMineKbs[index - 1]) || sortedMineKbs[index - 1].is_pinned)
            "
            type="button"
            class="visual-kb-section"
            @click="toggleKbSection('tenantOthers')"
          >
            <t-icon :name="tenantSectionIconName" />
            <span>{{ $t(tenantSectionLabelKey) }}</span>
            <small>{{ mineKbSectionCounts.tenantOthers }}</small>
            <t-icon :name="isKbSectionCollapsed('tenantOthers') ? 'chevron-right' : 'chevron-down'" />
          </button>

          <article
            v-show="!isKbSectionCollapsed(kbSectionOf(kb))"
            class="visual-kb-card"
            :class="{
              'is-faq': kb.type === 'faq',
              'is-highlighted': highlightedKbId !== null && highlightedKbId === kb.id,
            }"
            :ref="(el) => {
              if (highlightedKbId !== null && highlightedKbId === kb.id && el) highlightedCardRef = el as HTMLElement
            }"
            @click="handleCardClick(kb)"
          >
            <button
              type="button"
              class="visual-kb-card__favorite"
              :class="{ 'is-active': isKbFavorited(kb.id) }"
              :aria-label="isKbFavorited(kb.id) ? $t('knowledgeList.favorites.remove') : $t('knowledgeList.favorites.add')"
              @click.stop="toggleFavoriteKb(kb.id, $event)"
            >
              <t-icon :name="isKbFavorited(kb.id) ? 'star-filled' : 'star'" />
            </button>

            <header class="visual-kb-card__header">
              <div class="visual-kb-card__title" :title="kb.name">
                <KbWikiBadge v-if="isWikiKb(kb)" />
                <strong>{{ kb.name }}</strong>
              </div>
              <t-popup trigger="click" destroy-on-close placement="bottom-right">
                <button type="button" class="visual-kb-card__more" @click.stop>
                  <t-icon name="ellipsis" />
                </button>
                <template #content>
                  <div class="visual-kb-card-menu" @click.stop>
                    <button type="button" @click="handleTogglePin(kb)">
                      <t-icon :name="kb.is_pinned ? 'pin-filled' : 'pin'" />
                      <span>{{ kb.is_pinned ? $t('knowledgeList.pin.unpin') : $t('knowledgeList.pin.pin') }}</span>
                    </button>
                    <button v-if="canDuplicateKBCard(kb)" type="button" @click="handleDuplicate(kb)">
                      <t-icon name="file-copy" />
                      <span>{{ $t('knowledgeList.menu.duplicate') }}</span>
                    </button>
                    <button v-if="canManageKBCard(kb)" type="button" class="is-danger" @click="handleDelete(kb)">
                      <t-icon name="delete" />
                      <span>{{ $t('common.delete') }}</span>
                    </button>
                  </div>
                </template>
              </t-popup>
            </header>

            <p class="visual-kb-card__description">{{ kb.description || $t('knowledgeBase.noDescription') }}</p>

            <footer class="visual-kb-card__footer">
              <span class="visual-kb-card__metric">
                <t-icon :name="kb.type === 'faq' ? 'chat-bubble-help' : 'folder'" />
                <span>{{ kb.type === 'faq' ? kb.chunk_count || 0 : kb.knowledge_count || 0 }}</span>
                <span v-if="kb.isProcessing" class="visual-kb-card__spinner" />
              </span>
              <t-tooltip v-if="kb.question_generation_config?.enabled" :content="$t('knowledgeList.features.questionGeneration')" placement="top">
                <span class="visual-kb-card__feature"><t-icon name="help-circle" /></span>
              </t-tooltip>
              <t-tooltip v-if="(kb.share_count ?? 0) > 0" :content="$t('knowledgeList.sharedToOrgs', { count: kb.share_count ?? 0 })" placement="top">
                <span class="visual-kb-card__feature"><t-icon name="share" /></span>
              </t-tooltip>
              <span class="visual-kb-card__spacer" />
              <ResourceOriginBadge
                v-if="!authStore.isLiteMode && showKbOriginBadge(kb)"
                :variant="kbOriginVariant(kb)"
                :creator-name="kb.creator_name"
              />
            </footer>
          </article>
        </template>

        <button
          v-if="authStore.hasRole('contributor')"
          type="button"
          class="visual-kb-card visual-kb-card--create"
          data-guide="kb-list-create"
          @click="handleCreateKnowledgeBase"
        >
          <span><t-icon name="folder-add" /></span>
          <strong>{{ $t('knowledgeList.create') }}</strong>
        </button>
      </div>

      <section v-else-if="!loading" class="visual-kb-empty">
        <t-icon name="folder" />
        <strong>{{ $t('knowledgeList.empty.title') }}</strong>
        <p>{{ $t('knowledgeList.empty.description') }}</p>
        <button
          v-if="authStore.hasRole('contributor')"
          type="button"
          data-guide="kb-list-create"
          @click="handleCreateKnowledgeBase"
        >
          <t-icon name="folder-add" />
          <span>{{ $t('knowledgeList.create') }}</span>
        </button>
      </section>
    </section>

    <t-dialog
      v-model:visible="deleteVisible"
      :close-btn="false"
      :cancel-btn="null"
      :confirm-btn="null"
      dialog-class-name="visual-kb-delete-dialog"
    >
      <div class="visual-kb-delete">
        <t-icon name="error-circle" />
        <div>
          <strong>{{ $t('knowledgeList.delete.confirmTitle') }}</strong>
          <p>{{ $t('knowledgeList.delete.confirmMessage', { name: deletingKb?.name ?? '' }) }}</p>
        </div>
        <footer>
          <button type="button" @click="deleteVisible = false">{{ $t('common.cancel') }}</button>
          <button type="button" class="is-danger" @click="confirmDelete">{{ $t('knowledgeList.delete.confirmButton') }}</button>
        </footer>
      </div>
    </t-dialog>

    <KnowledgeBaseEditorModal
      :visible="uiStore.showKBEditorModal"
      :mode="uiStore.kbEditorMode"
      :kb-id="uiStore.currentKBId || undefined"
      :initial-type="uiStore.kbEditorType"
      @update:visible="(val) => (val ? null : uiStore.closeKBEditor())"
      @success="handleKBEditorSuccess"
    />

    <ShareKnowledgeBaseDialog
      v-model:visible="shareDialogVisible"
      :knowledge-base-id="sharingKbId"
      :knowledge-base-name="sharingKbName"
      @shared="handleShareSuccess"
    />

    <Teleport to="body">
      <Transition name="visual-shared-detail">
        <div
          v-if="sharedDetailPanelVisible && currentSharedKbForDetail"
          class="visual-shared-detail__overlay"
          @click.self="closeSharedDetailPanel"
        >
          <aside class="visual-shared-detail">
            <header>
              <h3>{{ $t('knowledgeList.detail.title') }}</h3>
              <button type="button" :aria-label="$t('general.close')" @click="closeSharedDetailPanel"><t-icon name="close" /></button>
            </header>
            <div class="visual-shared-detail__body">
              <dl>
                <div><dt>{{ $t('knowledgeBase.name') }}</dt><dd>{{ currentSharedKbForDetail.knowledge_base.name }}</dd></div>
                <div>
                  <dt>{{ $t('knowledgeList.detail.sourceType') }}</dt>
                  <dd>{{ currentSharedKbForDetail.source_from_agent ? $t('knowledgeList.detail.sourceTypeAgent') : $t('knowledgeList.detail.sourceTypeKbShare') }}</dd>
                </div>
                <div>
                  <dt>{{ currentSharedKbForDetail.source_from_agent ? $t('knowledgeList.detail.sourceFromAgent') : $t('knowledgeList.detail.sourceOrg') }}</dt>
                  <dd>{{ currentSharedKbForDetail.source_from_agent ? currentSharedKbForDetail.source_from_agent.agent_name : currentSharedKbForDetail.org_name }}</dd>
                </div>
                <div v-if="currentSharedKbForDetail.source_from_agent">
                  <dt>{{ $t('knowledgeList.detail.agentKbStrategy') }}</dt>
                  <dd>{{ agentKbStrategyText(currentSharedKbForDetail.source_from_agent?.kb_selection_mode ?? '') }}</dd>
                </div>
                <div><dt>{{ $t('knowledgeList.detail.sharedAt') }}</dt><dd>{{ formatStringDate(new Date(currentSharedKbForDetail.shared_at)) }}</dd></div>
                <div><dt>{{ $t('knowledgeList.detail.myPermission') }}</dt><dd>{{ $t(`organization.role.${currentSharedKbForDetail.permission}`) }}</dd></div>
              </dl>
            </div>
            <footer>
              <button type="button" @click="closeSharedDetailPanel">{{ $t('common.close') }}</button>
              <button type="button" class="is-primary" @click="goToSharedKbFromPanel">{{ $t('knowledgeList.detail.goToKb') }}</button>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped lang="less">
.visual-kb-list { width: 100%; height: 100%; min-width: 0; min-height: 0; flex: 1 1 auto; padding: 30px 32px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 18px; overflow: hidden; background: #fff; color: #374151; }
.visual-kb-list__header { flex: 0 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.visual-kb-list__header h1 { margin: 0; color: #111827; font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -.02em; }
.visual-kb-list__header p { margin: 4px 0 0; color: #9ca3af; font-size: 11px; line-height: 17px; }
.visual-kb-list__create { min-height: 34px; padding: 6px 11px; border: 1px solid #111827; border-radius: 9px; display: inline-flex; align-items: center; gap: 6px; background: #111827; color: #fff; font: inherit; font-size: 10px; font-weight: 600; cursor: pointer; }
.visual-kb-list__create:hover { background: #292f39; }
.visual-kb-list__create :deep(.t-icon) { font-size: 13px; }
.visual-kb-upload-status { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; }
.visual-kb-upload-status article { min-height: 54px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 10px; display: flex; gap: 8px; background: #f9fafb; }
.visual-kb-upload-status__icon { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f6; color: #6b7280; }
.visual-kb-upload-status__icon.is-done { color: #047857; }
.visual-kb-upload-status__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; color: #6b7280; font-size: 9px; line-height: 14px; }
.visual-kb-upload-status__copy strong { color: #374151; font-size: 10px; line-height: 16px; }
.visual-kb-upload-status__copy .is-muted { color: #9ca3af; }
.visual-kb-upload-status__copy .is-error { color: #dc2626; }
.visual-kb-upload-status__bar { height: 2px; margin-top: 4px; overflow: hidden; border-radius: 999px; background: #e5e7eb; }
.visual-kb-upload-status__bar span { display: block; height: 100%; background: #6b7280; transition: width 140ms linear; }
.visual-kb-list__content { min-height: 0; flex: 1 1 auto; overflow-y: auto; padding: 2px 4px 10px 2px; scrollbar-width: thin; }
.visual-kb-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.visual-kb-section { grid-column: 1 / -1; min-height: 28px; padding: 4px 3px; border: 0; display: flex; align-items: center; gap: 6px; background: #fff; color: #9ca3af; font: inherit; font-size: 9px; text-align: left; cursor: pointer; }
.visual-kb-section:hover { color: #4b5563; }
.visual-kb-section small { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; font-size: 8px; }
.visual-kb-section :deep(.t-icon:last-child) { margin-left: 2px; }
.visual-kb-card { position: relative; min-width: 0; min-height: 150px; padding: 13px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; background: #fff; cursor: pointer; transition: border-color 140ms ease, background-color 140ms ease, transform 140ms ease; }
.visual-kb-card:hover { border-color: #d1d5db; background: #f9fafb; transform: translateY(-1px); }
.visual-kb-card.is-highlighted { border-color: #9ca3af; box-shadow: 0 0 0 2px rgb(107 114 128 / 10%); }
.visual-kb-card.is-skeleton { cursor: default; min-height: 150px; }
.visual-kb-card__favorite { position: absolute; top: 7px; right: 36px; z-index: 2; width: 26px; height: 26px; padding: 6px; border: 0; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #d1d5db; cursor: pointer; opacity: 0; }
.visual-kb-card:hover .visual-kb-card__favorite,.visual-kb-card__favorite.is-active { opacity: 1; }
.visual-kb-card__favorite.is-active { color: #d97706; }
.visual-kb-card__favorite:hover { background: #f3f4f6; }
.visual-kb-card__header { min-height: 30px; display: flex; align-items: flex-start; gap: 7px; }
.visual-kb-card__title { min-width: 0; flex: 1; padding-right: 54px; display: flex; align-items: center; gap: 5px; }
.visual-kb-card__title strong { min-width: 0; overflow: hidden; color: #111827; font-size: 12px; line-height: 18px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.visual-kb-card__more { position: absolute; top: 7px; right: 7px; width: 26px; height: 26px; padding: 6px; border: 0; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #9ca3af; cursor: pointer; opacity: 0; }
.visual-kb-card:hover .visual-kb-card__more { opacity: 1; }
.visual-kb-card__more:hover { background: #f3f4f6; color: #374151; }
.visual-kb-card__description { min-height: 38px; margin: 5px 0 10px; overflow: hidden; color: #6b7280; font-size: 10px; line-height: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.visual-kb-card__footer { margin-top: auto; min-height: 28px; padding-top: 7px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; gap: 5px; }
.visual-kb-card__metric { min-height: 22px; padding: 3px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; background: #f3f4f6; color: #6b7280; font-size: 9px; }
.visual-kb-card__metric :deep(.t-icon) { font-size: 11px; }
.visual-kb-card__spinner { width: 8px; height: 8px; border: 1px solid #9ca3af; border-right-color: transparent; border-radius: 50%; animation: visual-kb-spin .8s linear infinite; }
.visual-kb-card__feature { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; }
.visual-kb-card__feature :deep(.t-icon) { font-size: 11px; }
.visual-kb-card__spacer { flex: 1; }
.visual-kb-card--create { align-items: center; justify-content: center; gap: 8px; border-style: dashed; color: #9ca3af; text-align: center; }
.visual-kb-card--create > span { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f6; }
.visual-kb-card--create strong { color: #6b7280; font-size: 10px; font-weight: 600; }
.visual-kb-empty { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; text-align: center; }
.visual-kb-empty > :deep(.t-icon) { font-size: 34px; color: #d1d5db; }
.visual-kb-empty strong { margin-top: 10px; color: #6b7280; font-size: 12px; }
.visual-kb-empty p { margin: 4px 0 14px; font-size: 10px; }
.visual-kb-empty button { min-height: 32px; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #4b5563; font: inherit; font-size: 10px; font-weight: 600; cursor: pointer; }
.visual-kb-card-menu { min-width: 160px; padding: 4px; }
.visual-kb-card-menu button { width: 100%; min-height: 30px; padding: 5px 7px; border: 0; border-radius: 7px; display: flex; align-items: center; gap: 7px; background: transparent; color: #4b5563; font: inherit; font-size: 10px; text-align: left; cursor: pointer; }
.visual-kb-card-menu button:hover { background: #f3f4f6; color: #111827; }
.visual-kb-card-menu button.is-danger { color: #dc2626; }
.visual-kb-card-menu button.is-danger:hover { background: #fef2f2; }
.visual-kb-delete { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: 8px; padding: 4px; }
.visual-kb-delete > :deep(.t-icon) { margin-top: 1px; color: #dc2626; font-size: 18px; }
.visual-kb-delete strong { color: #111827; font-size: 12px; }
.visual-kb-delete p { margin: 4px 0 0; color: #6b7280; font-size: 10px; line-height: 16px; }
.visual-kb-delete footer { grid-column: 1 / -1; margin-top: 10px; display: flex; justify-content: flex-end; gap: 6px; }
.visual-kb-delete footer button,.visual-shared-detail footer button { min-height: 30px; padding: 5px 9px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #4b5563; font: inherit; font-size: 10px; cursor: pointer; }
.visual-kb-delete footer button.is-danger { border-color: #dc2626; background: #dc2626; color: #fff; }
.visual-shared-detail__overlay { position: fixed; inset: 0; z-index: 3100; display: flex; justify-content: flex-end; background: rgb(15 23 42 / 18%); }
.visual-shared-detail { width: min(380px, 100vw); height: 100%; display: flex; flex-direction: column; border-left: 1px solid #e5e7eb; background: #fff; box-shadow: -18px 0 50px rgb(15 23 42 / 12%); }
.visual-shared-detail > header { min-height: 58px; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
.visual-shared-detail > header h3 { margin: 0; color: #111827; font-size: 13px; }
.visual-shared-detail > header button { width: 28px; height: 28px; padding: 6px; border: 0; border-radius: 8px; background: transparent; color: #9ca3af; cursor: pointer; }
.visual-shared-detail__body { min-height: 0; flex: 1; overflow-y: auto; padding: 16px; }
.visual-shared-detail dl { margin: 0; display: flex; flex-direction: column; gap: 14px; }
.visual-shared-detail dl > div { display: flex; flex-direction: column; gap: 3px; }
.visual-shared-detail dt { color: #9ca3af; font-size: 9px; }
.visual-shared-detail dd { margin: 0; color: #374151; font-size: 11px; line-height: 17px; word-break: break-word; }
.visual-shared-detail > footer { flex: 0 0 58px; padding: 11px 16px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.visual-shared-detail footer button.is-primary { border-color: #111827; background: #111827; color: #fff; }
.visual-shared-detail-enter-active,.visual-shared-detail-leave-active { transition: opacity 160ms ease; }
.visual-shared-detail-enter-from,.visual-shared-detail-leave-to { opacity: 0; }
@keyframes visual-kb-spin { to { transform: rotate(360deg); } }
@media (min-width: 1480px) { .visual-kb-grid { grid-template-columns: repeat(4,minmax(0,1fr)); } }
@media (max-width: 1000px) { .visual-kb-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 640px) { .visual-kb-list { padding: 22px 16px 14px; } .visual-kb-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .visual-kb-card,.visual-kb-upload-status__bar span,.visual-shared-detail-enter-active,.visual-shared-detail-leave-active { transition: none !important; } .visual-kb-card__spinner { animation: none; } }
</style>

<style>
.visual-kb-delete-dialog .t-dialog__header { display: none !important; }
.visual-kb-delete-dialog .t-dialog__body { padding: 14px !important; }
</style>
