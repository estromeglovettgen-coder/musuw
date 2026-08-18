<script lang="ts">
import { defineComponent } from 'vue'
import LegacyManualEditorBusiness from '@/assets/business-baselines/manual-knowledge-editor.pre-view.vue'

const legacy = LegacyManualEditorBusiness as any
const legacySetup = legacy.setup

export default defineComponent({
  ...legacy,
  name: 'ManualKnowledgeEditor',
  setup(props, context) {
    const state = legacySetup?.(props, context)
    if (state && typeof state === 'object' && typeof state.then !== 'function') return { ...state }
    return state
  },
})
</script>

<template>
  <Teleport to="body">
    <Transition name="visual-manual-editor">
      <div v-if="visible" class="visual-manual-editor__overlay" @click.self="handleClose">
        <aside class="visual-manual-editor" role="dialog" aria-modal="true" :aria-label="dialogTitle">
          <header class="visual-manual-editor__header">
            <div class="visual-manual-editor__heading">
              <span class="visual-manual-editor__heading-icon"><t-icon name="edit-1" /></span>
              <div>
                <h3>{{ dialogTitle }}</h3>
                <p>{{ $t('manualEditor.description') }}</p>
              </div>
            </div>
            <button type="button" class="visual-manual-editor__close" :aria-label="$t('common.close')" @click="handleClose">
              <t-icon name="close" />
            </button>
          </header>

          <div class="visual-manual-editor__content">
            <div v-if="!initialLoaded" class="visual-manual-editor__loading">
              <t-loading size="medium" :text="$t('manualEditor.loading.preparing')" />
            </div>

            <template v-else>
              <section class="visual-manual-editor__section">
                <h4>{{ $t('manualEditor.section.basic') }}</h4>
                <div class="visual-manual-editor__field">
                  <label>{{ $t('manualEditor.form.titleLabel') }}</label>
                  <t-input
                    v-model="form.title"
                    maxlength="100"
                    :placeholder="$t('manualEditor.form.titlePlaceholder')"
                    show-limit-number
                  />
                </div>

                <div class="visual-manual-editor__field">
                  <label>{{ $t('manualEditor.form.knowledgeBaseLabel') }}</label>
                  <div class="visual-manual-editor__kb-row">
                    <t-select
                      v-model="form.kbId"
                      :disabled="kbDisabled"
                      :loading="kbLoading"
                      :options="kbOptions"
                      :placeholder="$t('manualEditor.form.knowledgeBasePlaceholder')"
                      :popup-props="{ attach: 'body', zIndex: 3400 }"
                    >
                      <template #empty>
                        <div class="visual-manual-editor__select-empty">{{ $t('manualEditor.noDocumentKnowledgeBases') }}</div>
                      </template>
                    </t-select>
                    <span
                      v-if="mode === 'edit'"
                      class="visual-manual-editor__status"
                      :class="form.status === 'draft' ? 'is-draft' : 'is-published'"
                    >
                      {{ form.status === 'draft' ? $t('manualEditor.status.draftTag') : $t('manualEditor.status.publishedTag') }}
                    </span>
                  </div>
                  <p v-if="lastUpdatedText">{{ lastUpdatedText }}</p>
                </div>
              </section>

              <section class="visual-manual-editor__section is-editor">
                <h4>{{ $t('manualEditor.section.content') }}</h4>
                <div class="visual-manual-editor__editor">
                  <div class="visual-manual-editor__toolbar">
                    <div class="visual-manual-editor__format-tools">
                      <template v-for="(group, groupIndex) in toolbarGroups" :key="group.key">
                        <div class="visual-manual-editor__tool-group">
                          <t-tooltip v-for="btn in group.buttons" :key="btn.key" :content="btn.tooltip" placement="top">
                            <button
                              type="button"
                              class="visual-manual-editor__tool"
                              :aria-label="btn.tooltip"
                              @mousedown.prevent
                              @click="handleToolbarAction(btn.action)"
                            >
                              <t-icon :name="btn.icon" />
                            </button>
                          </t-tooltip>
                        </div>
                        <span v-if="groupIndex < toolbarGroups.length - 1" class="visual-manual-editor__divider" />
                      </template>
                    </div>
                    <button
                      type="button"
                      class="visual-manual-editor__view-toggle"
                      :disabled="saving"
                      @click="toggleEditorView"
                    >
                      <t-icon :name="viewToggleIcon" />
                      <span>{{ viewToggleLabel }}</span>
                    </button>
                  </div>

                  <div v-show="activeTab === 'edit'" class="visual-manual-editor__pane">
                    <t-textarea
                      v-if="!contentLoading"
                      ref="textareaComponent"
                      v-model="form.content"
                      :placeholder="$t('manualEditor.form.contentPlaceholder')"
                      class="visual-manual-editor__textarea"
                    />
                    <div v-else class="visual-manual-editor__pane-loading">
                      <t-loading size="small" :text="$t('manualEditor.loading.content')" />
                    </div>
                  </div>

                  <div v-show="activeTab === 'preview'" class="visual-manual-editor__pane is-preview">
                    <div class="visual-manual-editor__preview" v-html="previewHTML" />
                  </div>
                </div>
              </section>
            </template>
          </div>

          <footer v-if="initialLoaded" class="visual-manual-editor__footer">
            <span
              class="visual-manual-editor__status"
              :class="form.status === 'draft' ? 'is-draft' : 'is-published'"
            >
              {{ form.status === 'draft' ? $t('manualEditor.status.draftTag') : $t('manualEditor.status.publishedTag') }}
            </span>
            <div class="visual-manual-editor__footer-actions">
              <button type="button" class="visual-manual-editor__button" :disabled="saving" @click="handleClose">
                {{ $t('manualEditor.actions.cancel') }}
              </button>
              <button
                type="button"
                class="visual-manual-editor__button"
                :disabled="saving && savingAction !== 'draft'"
                @click="handleSave('draft')"
              >
                <t-loading v-if="saving && savingAction === 'draft'" size="small" />
                <span>{{ $t('manualEditor.actions.saveDraft') }}</span>
              </button>
              <button
                type="button"
                class="visual-manual-editor__button is-primary"
                :disabled="saving && savingAction !== 'publish'"
                @click="handleSave('publish')"
              >
                <t-loading v-if="saving && savingAction === 'publish'" size="small" />
                <span>{{ $t('manualEditor.actions.publish') }}</span>
              </button>
            </div>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="less">
.visual-manual-editor__overlay { position: fixed; inset: 0; z-index: 3300; display: flex; justify-content: flex-end; background: rgb(15 23 42 / 18%); backdrop-filter: blur(2px); }
.visual-manual-editor { width: min(760px, 100vw); height: 100%; min-width: 0; display: flex; flex-direction: column; border-left: 1px solid #e5e7eb; background: #fff; box-shadow: -18px 0 50px rgb(15 23 42 / 12%); color: #374151; }
.visual-manual-editor__header { flex: 0 0 auto; padding: 18px 20px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.visual-manual-editor__heading { min-width: 0; display: flex; gap: 10px; }
.visual-manual-editor__heading-icon { flex: 0 0 32px; width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f6; color: #6b7280; }
.visual-manual-editor__heading h3 { margin: 0; color: #111827; font-size: 14px; line-height: 20px; font-weight: 700; }
.visual-manual-editor__heading p { margin: 3px 0 0; color: #9ca3af; font-size: 10px; line-height: 16px; }
.visual-manual-editor__close { width: 28px; height: 28px; padding: 6px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #9ca3af; cursor: pointer; }
.visual-manual-editor__close:hover { background: #f3f4f6; color: #374151; }
.visual-manual-editor__content { min-height: 0; flex: 1 1 auto; overflow-y: auto; padding: 0 20px; }
.visual-manual-editor__loading { min-height: 260px; display: flex; align-items: center; justify-content: center; }
.visual-manual-editor__section { padding: 16px 0; border-bottom: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 12px; }
.visual-manual-editor__section.is-editor { border-bottom: 0; }
.visual-manual-editor__section > h4 { margin: 0; color: #374151; font-size: 10px; line-height: 16px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.visual-manual-editor__field { display: flex; flex-direction: column; gap: 6px; }
.visual-manual-editor__field > label { color: #4b5563; font-size: 10px; line-height: 15px; font-weight: 600; }
.visual-manual-editor__field > label::after { content: ' *'; color: #dc2626; }
.visual-manual-editor__field > p { margin: 0; color: #9ca3af; font-size: 9px; line-height: 14px; }
.visual-manual-editor__field :deep(.t-input),.visual-manual-editor__field :deep(.t-select-input) { min-height: 34px; border-color: #e5e7eb; border-radius: 8px; background: #fff; box-shadow: none !important; font-size: 11px; }
.visual-manual-editor__kb-row { display: flex; align-items: center; gap: 8px; }
.visual-manual-editor__kb-row :deep(.t-select) { min-width: 0; flex: 1; }
.visual-manual-editor__select-empty { padding: 18px; color: #9ca3af; font-size: 10px; text-align: center; }
.visual-manual-editor__status { flex: 0 0 auto; padding: 2px 6px; border-radius: 6px; background: #f3f4f6; color: #6b7280; font-size: 9px; line-height: 14px; font-weight: 600; }
.visual-manual-editor__status.is-published { background: #f0fdf4; color: #047857; }
.visual-manual-editor__status.is-draft { background: #fffbeb; color: #b45309; }
.visual-manual-editor__editor { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 11px; background: #fff; }
.visual-manual-editor__editor:focus-within { border-color: #d1d5db; box-shadow: 0 0 0 2px rgb(17 24 39 / 5%); }
.visual-manual-editor__toolbar { min-height: 40px; padding: 5px 7px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #f9fafb; }
.visual-manual-editor__format-tools { min-width: 0; display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.visual-manual-editor__tool-group { display: flex; gap: 2px; }
.visual-manual-editor__divider { flex: 0 0 1px; width: 1px; height: 18px; background: #e5e7eb; }
.visual-manual-editor__tool { width: 28px; height: 28px; padding: 6px; border: 0; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #6b7280; cursor: pointer; }
.visual-manual-editor__tool:hover { background: #eceef1; color: #111827; }
.visual-manual-editor__tool :deep(.t-icon) { font-size: 13px; }
.visual-manual-editor__view-toggle { min-height: 28px; padding: 5px 8px; border: 0; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; background: #2d3138; color: #fff; font: inherit; font-size: 9px; font-weight: 600; cursor: pointer; }
.visual-manual-editor__view-toggle:hover:not(:disabled) { background: #111827; }
.visual-manual-editor__pane { min-height: 390px; }
.visual-manual-editor__textarea :deep(.t-textarea),.visual-manual-editor__textarea :deep(.t-textarea__inner) { border: 0 !important; border-radius: 0 !important; background: #fff !important; box-shadow: none !important; }
.visual-manual-editor__textarea :deep(.t-textarea__inner) { width: 100%; min-height: 390px; max-height: 58vh; padding: 14px; box-sizing: border-box; resize: none; color: #374151; font: 11px/1.7 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; }
.visual-manual-editor__pane-loading { min-height: 390px; display: flex; align-items: center; justify-content: center; }
.visual-manual-editor__pane.is-preview { overflow-y: auto; max-height: 58vh; padding: 16px; box-sizing: border-box; background: #fff; }
.visual-manual-editor__preview { color: #374151; font-size: 12px; line-height: 1.75; word-break: break-word; }
.visual-manual-editor__preview :deep(h1),.visual-manual-editor__preview :deep(h2),.visual-manual-editor__preview :deep(h3) { color: #111827; line-height: 1.35; }
.visual-manual-editor__preview :deep(pre) { overflow-x: auto; padding: 10px; border-radius: 8px; background: #f3f4f6; }
.visual-manual-editor__preview :deep(code) { font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; }
.visual-manual-editor__footer { flex: 0 0 60px; min-height: 60px; padding: 11px 20px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f9fafb; }
.visual-manual-editor__footer-actions { margin-left: auto; display: flex; gap: 7px; }
.visual-manual-editor__button { min-height: 34px; padding: 6px 11px; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #4b5563; font: inherit; font-size: 10px; font-weight: 600; cursor: pointer; }
.visual-manual-editor__button.is-primary { border-color: #111827; background: #111827; color: #fff; }
.visual-manual-editor__button:disabled { opacity: .5; cursor: default; }
.visual-manual-editor-enter-active,.visual-manual-editor-leave-active { transition: opacity 160ms ease; }
.visual-manual-editor-enter-from,.visual-manual-editor-leave-to { opacity: 0; }
@media (max-width: 760px) { .visual-manual-editor { width: 100%; } .visual-manual-editor__content { padding-inline: 14px; } .visual-manual-editor__footer { padding-inline: 14px; } }
@media (prefers-reduced-motion: reduce) { .visual-manual-editor-enter-active,.visual-manual-editor-leave-active { transition: none !important; } }
</style>
