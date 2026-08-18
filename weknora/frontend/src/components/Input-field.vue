<script lang="ts">
import { defineComponent } from 'vue'
import LegacyInputFieldBusiness from '@/assets/business-baselines/Input-field.pre-view.vue'
import AttachmentUpload from './AttachmentUpload.vue'
import KnowledgeBaseSelector from './KnowledgeBaseSelector.vue'
import MentionSelector from './MentionSelector.vue'

const legacy = LegacyInputFieldBusiness as any
const legacySetup = legacy.setup

export default defineComponent({
  ...legacy,
  name: 'InputField',
  components: {
    ...(legacy.components || {}),
    AttachmentUpload,
    KnowledgeBaseSelector,
    MentionSelector,
  },
  setup(props, context) {
    const state = legacySetup?.(props, context)
    // <script setup> marks its return object with non-enumerable __isScriptSetup.
    // The rebuilt template is compiled as an Options-template, so return a shallow
    // copy to remove that compiler marker while preserving every ref/function.
    if (state && typeof state === 'object' && typeof state.then !== 'function') {
      return { ...state }
    }
    return state
  },
})
</script>

<template>
  <div
    class="visual-chat-composer"
    :class="{ 'is-embedded': embeddedMode }"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <input
      ref="imageInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      multiple
      class="visual-chat-composer__native-file"
      @change="handleImageSelect"
    />

    <div class="visual-chat-composer__surface" data-guide="chat-input" @click.stop>
      <div v-if="uploadedImages.length > 0" class="visual-chat-composer__images">
        <div v-for="(img, idx) in uploadedImages" :key="idx" class="visual-chat-composer__image">
          <img :src="img.preview" alt="" />
          <button type="button" :aria-label="$t('common.remove')" @click.stop="removeImage(idx)">
            <t-icon name="close" />
          </button>
        </div>
      </div>

      <AttachmentUpload
        ref="attachmentUploadRef"
        :max-files="5"
        :session-id="sessionId"
        :agent-id="selectedAgentId"
        :agent-source-tenant-id="settingsStore.selectedAgentSourceTenantId ?? undefined"
        @update:files="uploadedAttachments = $event"
      />

      <div v-if="allSelectedItems.length > 0" class="visual-chat-composer__resources">
        <span
          v-for="item in allSelectedItems"
          :key="`${item.type}:${item.id}`"
          class="visual-chat-resource"
          :class="{ 'is-agent-configured': item.isAgentConfigured }"
          :data-resource-type="item.type"
        >
          <span class="visual-chat-resource__icon-wrap" :class="{ 'has-org': item.org_name }">
            <span class="visual-chat-resource__icon">
              <t-icon
                v-if="item.type === 'kb'"
                :name="item.kbType === 'faq' ? 'chat-bubble-help' : 'folder'"
              />
              <t-icon v-else :name="getMentionIcon(item)" />
            </span>
            <span v-if="item.org_name" class="visual-chat-resource__org" aria-hidden="true">
              <img :src="getOrganizationBadgeSrc(item.type)" alt="" />
            </span>
          </span>
          <span class="visual-chat-resource__name" :title="item.name">{{ item.name }}</span>
          <button
            type="button"
            class="visual-chat-resource__remove"
            :aria-label="$t('common.remove')"
            @click.stop="removeSelectedItem(item)"
          >
            <t-icon name="close" />
          </button>
        </span>
      </div>

      <t-textarea
        ref="textareaRef"
        v-model="query"
        class="visual-chat-composer__textarea"
        :placeholder="inputPlaceholder"
        name="description"
        :autosize="true"
        @keydown="onKeydown"
        @input="onInput"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
        @paste="onPaste"
      />

      <div class="visual-chat-composer__toolbar" :class="{ 'is-embedded': embeddedMode }">
        <div v-if="!embeddedMode" class="visual-chat-composer__tools">
          <t-tooltip v-if="showImageUploadButton" placement="top" theme="light">
            <template #content>{{ $t('chat.imageUploadTooltip') }}</template>
            <button
              type="button"
              class="visual-chat-composer__tool"
              :class="{ 'is-active': uploadedImages.length > 0 }"
              @click.stop="triggerImageUpload"
            >
              <t-icon name="image" />
              <span v-if="uploadedImages.length > 0" class="visual-chat-composer__count">{{ uploadedImages.length }}</span>
            </button>
          </t-tooltip>

          <t-tooltip placement="top" theme="light">
            <template #content>
              {{ uploadedAttachments.length > 0
                ? $t('chat.attachmentWithCount', { count: uploadedAttachments.length })
                : $t('chat.attachmentUploadTooltip') }}
            </template>
            <button
              type="button"
              class="visual-chat-composer__tool"
              :class="{ 'is-active': uploadedAttachments.length > 0 }"
              @click.stop="attachmentUploadRef?.triggerFileSelect()"
            >
              <t-icon name="attach" />
              <span v-if="uploadedAttachments.length > 0" class="visual-chat-composer__count">{{ uploadedAttachments.length }}</span>
            </button>
          </t-tooltip>

          <t-tooltip placement="top" theme="light">
            <template #content>
              <span v-if="isMentionDisabled && isKnowledgeBaseDisabledByAgent" class="visual-chat-composer__disabled-hint">
                <span>{{ $t('input.kbDisabledByAgent') }}</span>
                <button type="button" @click.stop.prevent="handleGoToAgentSettings('knowledge')">
                  {{ $t('input.goToAgentSettings') }}
                </button>
              </span>
              <span v-else>
                {{ allSelectedItems.length > 0
                  ? $t('input.knowledgeBaseWithCount', { count: allSelectedItems.length })
                  : $t('input.knowledgeBase') }}
              </span>
            </template>
            <button
              ref="atButtonRef"
              type="button"
              class="visual-chat-composer__tool is-at"
              :class="{ 'is-active': allSelectedItems.length > 0, 'is-disabled': isMentionDisabled }"
              data-guide="chat-kb-mention"
              :aria-disabled="isMentionDisabled"
              @mousedown.prevent="triggerMention"
            >
              <span class="visual-chat-composer__at">@</span>
              <span v-if="allSelectedItems.length > 0" class="visual-chat-composer__count">{{ allSelectedItems.length }}</span>
            </button>
          </t-tooltip>

          <t-tooltip v-if="showWebSearchButton" placement="top" theme="light">
            <template #content>
              {{ isWebSearchEnabled ? $t('input.messages.webSearchEnabled') : $t('input.messages.webSearchDisabled') }}
            </template>
            <button
              type="button"
              class="visual-chat-composer__tool"
              :class="{ 'is-active': isWebSearchEnabled }"
              @click.stop="toggleWebSearch"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" />
                <path d="M3.5 12h17M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21M12 3C9.7 5.5 8.5 8.5 8.5 12s1.2 6.5 3.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </t-tooltip>

          <button
            ref="agentModeButtonRef"
            type="button"
            class="visual-chat-composer__select"
            :aria-expanded="showAgentModeSelector"
            @click.stop="toggleAgentModeSelector"
          >
            <span>{{ isProMode ? 'V4 Pro' : 'V4 Flash' }}</span>
            <t-icon name="chevron-down" :class="{ 'is-open': showAgentModeSelector }" />
          </button>

          <label v-if="isProMode" class="visual-chat-composer__thinking" @click.stop>
            <span>{{ $t('agent.editor.thinking') }}</span>
            <t-switch v-model="thinkingEnabled" size="small" />
          </label>

          <button
            ref="modelButtonRef"
            type="button"
            class="visual-chat-composer__model"
            :aria-expanded="showModelSelector"
            @click.stop="toggleModelSelector"
          >
            <span :title="selectedModelDisplayName">{{ selectedModelDisplayName }}</span>
            <t-loading v-if="modelsLoading" size="small" />
            <t-icon v-else name="chevron-down" :class="{ 'is-open': showModelSelector }" />
          </button>
        </div>

        <div class="visual-chat-composer__submit">
          <t-tooltip v-if="isReplying" :content="$t('input.stopGeneration')" placement="top">
            <button type="button" class="visual-chat-composer__send is-stop" @click="handleStop">
              <span class="visual-chat-composer__stop-square" />
            </button>
          </t-tooltip>
          <button
            v-else
            type="button"
            class="visual-chat-composer__send"
            :class="{ 'is-disabled': !query.length }"
            :disabled="!query.length"
            data-guide="chat-send"
            :aria-label="$t('input.send')"
            @click="createSession(query)"
          >
            <t-icon name="arrow-up" />
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAgentModeSelector" class="visual-chat-composer__overlay" @click="closeAgentModeSelector">
        <div class="visual-chat-composer__mode-menu" :style="agentModeDropdownStyle" @click.stop>
          <button type="button" :class="{ 'is-selected': !isProMode }" @click="selectAgentMode('quick-answer')">
            <span><strong>V4 Flash</strong><small>快速模式</small></span>
            <t-icon v-if="!isProMode" name="check" />
          </button>
          <button type="button" :class="{ 'is-selected': isProMode }" @click="selectAgentMode('smart-reasoning')">
            <span><strong>V4 Pro</strong><small>全功能模式</small></span>
            <t-icon v-if="isProMode" name="check" />
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showModelSelector" class="visual-chat-composer__overlay" @click="closeModelSelector">
        <div class="visual-chat-composer__model-menu" :style="modelDropdownStyle" @click.stop>
          <header>
            <span>{{ $t('conversationSettings.models.chatGroupLabel') }}</span>
            <button type="button" @click="handleModelChange('__add_model__')">
              <t-icon name="add" />
              <span>{{ $t('input.addModel') }}</span>
            </button>
          </header>
          <div class="visual-chat-composer__model-options">
            <button
              v-for="model in availableModels"
              :key="model.id"
              type="button"
              :class="{ 'is-selected': model.id === selectedModelId }"
              @click="handleModelChange(model.id || '')"
            >
              <span class="visual-chat-composer__model-copy">
                <strong>{{ modelDisplayName(model) }}</strong>
                <small v-if="model.display_name">{{ model.name }}</small>
              </span>
              <t-icon v-if="model.id === selectedModelId" name="check" />
            </button>
            <div v-if="availableModels.length === 0" class="visual-chat-composer__menu-empty">{{ $t('input.noModel') }}</div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <MentionSelector
        ref="mentionSelectorRef"
        :visible="showMention"
        :style="mentionStyle"
        :items="mentionItems"
        :has-more="mentionHasMore"
        :loading="mentionLoading"
        :empty-hint="mentionEmptyHint"
        :query="mentionQuery"
        :group-counts="mentionGroupCounts"
        v-model:active-index="mentionActiveIndex"
        @select="onMentionSelect"
        @load-more="loadMoreMentionItems"
      />
    </Teleport>

    <KnowledgeBaseSelector
      v-model:visible="showKbSelector"
      :anchor-el="atButtonRef"
      @close="showKbSelector = false"
    />
  </div>
</template>

<style scoped lang="less">
.visual-chat-composer { width: 100%; min-width: 0; position: relative; color: #374151; }
.visual-chat-composer__native-file { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.visual-chat-composer__surface { width: 100%; min-width: 0; box-sizing: border-box; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 18px; background: #f4f5f7; box-shadow: 0 1px 2px rgb(15 23 42 / 4%); transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease; }
.visual-chat-composer__surface:focus-within { border-color: #d1d5db; background: #fff; box-shadow: 0 6px 18px rgb(15 23 42 / 7%); }
.visual-chat-composer__images { padding: 10px 12px 2px; display: flex; flex-wrap: wrap; gap: 7px; }
.visual-chat-composer__image { position: relative; width: 62px; height: 62px; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.visual-chat-composer__image img { width: 100%; height: 100%; display: block; object-fit: cover; }
.visual-chat-composer__image button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; padding: 4px; border: 0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: rgb(17 24 39 / 72%); color: #fff; cursor: pointer; }
.visual-chat-composer__resources { padding: 8px 12px 0; display: flex; flex-wrap: wrap; gap: 5px; }
.visual-chat-resource { max-width: 220px; min-height: 26px; padding: 3px 5px 3px 7px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: #fff; color: #6b7280; font-size: 10px; line-height: 16px; }
.visual-chat-resource.is-agent-configured { border-style: dashed; }
.visual-chat-resource__icon-wrap { position: relative; flex: 0 0 14px; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; }
.visual-chat-resource__icon { display: inline-flex; color: #9ca3af; }
.visual-chat-resource__icon :deep(.t-icon) { font-size: 12px; }
.visual-chat-resource__org { position: absolute; right: -3px; bottom: -2px; width: 8px; height: 8px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #fff; box-shadow: 0 0 0 1px #e5e7eb; }
.visual-chat-resource__org img { width: 5px; height: 5px; object-fit: contain; }
.visual-chat-resource__name { min-width: 0; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-chat-resource__remove { flex: 0 0 18px; width: 18px; height: 18px; padding: 4px; border: 0; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #c1c5cc; cursor: pointer; }
.visual-chat-resource__remove:hover { background: #f3f4f6; color: #6b7280; }
.visual-chat-resource__remove :deep(.t-icon) { font-size: 10px; }
.visual-chat-composer__textarea :deep(.t-textarea), .visual-chat-composer__textarea :deep(.t-textarea__inner) { border: 0 !important; background: transparent !important; box-shadow: none !important; }
.visual-chat-composer__textarea :deep(.t-textarea__inner) { width: 100%; min-height: 56px !important; max-height: 180px !important; padding: 15px 16px 7px !important; box-sizing: border-box; resize: none; color: #1f2937; font-family: var(--app-font-family); font-size: 15px; line-height: 1.625; }
.visual-chat-composer__textarea :deep(.t-textarea__inner::placeholder) { color: #9ca3af; }
.visual-chat-composer__toolbar { min-height: 48px; padding: 5px 10px 9px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.visual-chat-composer__toolbar.is-embedded { justify-content: flex-end; }
.visual-chat-composer__tools { min-width: 0; flex: 1 1 auto; display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.visual-chat-composer__submit { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; }
.visual-chat-composer__tool { position: relative; flex: 0 0 30px; width: 30px; height: 30px; padding: 6px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #858b95; cursor: pointer; }
.visual-chat-composer__tool:hover, .visual-chat-composer__tool.is-active { background: #e9eaec; color: #374151; }
.visual-chat-composer__tool.is-disabled { opacity: .38; cursor: default; }
.visual-chat-composer__tool :deep(.t-icon) { font-size: 15px; }
.visual-chat-composer__tool svg { width: 16px; height: 16px; }
.visual-chat-composer__at { font-size: 17px; line-height: 1; font-weight: 500; }
.visual-chat-composer__count { position: absolute; top: -3px; right: -3px; min-width: 14px; height: 14px; padding: 0 3px; box-sizing: border-box; border: 1px solid #fff; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #6b7280; color: #fff; font-size: 8px; line-height: 12px; font-variant-numeric: tabular-nums; }
.visual-chat-composer__disabled-hint { display: inline-flex; align-items: center; gap: 8px; }
.visual-chat-composer__disabled-hint button { padding: 0; border: 0; background: transparent; color: #2563eb; font: inherit; text-decoration: underline; cursor: pointer; }
.visual-chat-composer__select, .visual-chat-composer__model { min-height: 30px; max-width: 170px; padding: 5px 8px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: transparent; color: #6b7280; font: inherit; font-size: 10px; line-height: 18px; font-weight: 550; cursor: pointer; }
.visual-chat-composer__select:hover, .visual-chat-composer__model:hover { background: #e9eaec; color: #374151; }
.visual-chat-composer__select :deep(.t-icon), .visual-chat-composer__model :deep(.t-icon) { flex: 0 0 11px; font-size: 11px; color: #9ca3af; transition: transform 120ms ease; }
.visual-chat-composer__select :deep(.t-icon.is-open), .visual-chat-composer__model :deep(.t-icon.is-open) { transform: rotate(180deg); }
.visual-chat-composer__model > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-chat-composer__thinking { min-height: 30px; padding: 4px 6px; display: inline-flex; align-items: center; gap: 6px; color: #6b7280; font-size: 10px; cursor: pointer; }
.visual-chat-composer__send { flex: 0 0 32px; width: 32px; height: 32px; padding: 7px; border: 0; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #2d3138; color: #fff; cursor: pointer; transition: transform 120ms ease, background-color 120ms ease, opacity 120ms ease; }
.visual-chat-composer__send:hover:not(:disabled) { background: #111827; transform: translateY(-1px); }
.visual-chat-composer__send.is-disabled, .visual-chat-composer__send:disabled { background: #d9dce1; color: #fff; cursor: default; }
.visual-chat-composer__send.is-stop { background: #eceef1; color: #4b5563; }
.visual-chat-composer__send :deep(.t-icon) { font-size: 15px; }
.visual-chat-composer__stop-square { width: 9px; height: 9px; border-radius: 2px; background: currentColor; }
.visual-chat-composer__overlay { position: fixed; inset: 0; z-index: 9998; background: transparent; }
.visual-chat-composer__mode-menu, .visual-chat-composer__model-menu { position: fixed; z-index: 9999; box-sizing: border-box; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; box-shadow: 0 14px 34px rgb(15 23 42 / 14%); }
.visual-chat-composer__mode-menu { width: 200px; padding: 5px !important; }
.visual-chat-composer__mode-menu > button { width: 100%; min-height: 42px; padding: 7px 8px; border: 0; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: transparent; color: #4b5563; font: inherit; text-align: left; cursor: pointer; }
.visual-chat-composer__mode-menu > button:hover, .visual-chat-composer__mode-menu > button.is-selected { background: #f3f4f6; color: #111827; }
.visual-chat-composer__mode-menu > button > span { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.visual-chat-composer__mode-menu strong { font-size: 10px; line-height: 16px; font-weight: 650; }
.visual-chat-composer__mode-menu small { color: #9ca3af; font-size: 9px; line-height: 14px; }
.visual-chat-composer__mode-menu :deep(.t-icon) { font-size: 11px; }
.visual-chat-composer__model-menu { width: 280px; max-height: 360px; display: flex; flex-direction: column; }
.visual-chat-composer__model-menu header { flex: 0 0 36px; min-height: 36px; padding: 5px 7px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #9ca3af; font-size: 9px; }
.visual-chat-composer__model-menu header button { min-height: 26px; padding: 4px 6px; border: 0; border-radius: 7px; display: inline-flex; align-items: center; gap: 4px; background: transparent; color: #6b7280; font: inherit; font-size: 9px; cursor: pointer; }
.visual-chat-composer__model-menu header button:hover { background: #f3f4f6; color: #374151; }
.visual-chat-composer__model-options { min-height: 0; overflow-y: auto; padding: 5px; }
.visual-chat-composer__model-options > button { width: 100%; min-height: 38px; padding: 6px 8px; border: 0; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: transparent; color: #4b5563; font: inherit; text-align: left; cursor: pointer; }
.visual-chat-composer__model-options > button:hover, .visual-chat-composer__model-options > button.is-selected { background: #f3f4f6; color: #111827; }
.visual-chat-composer__model-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
.visual-chat-composer__model-copy strong, .visual-chat-composer__model-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visual-chat-composer__model-copy strong { font-size: 10px; line-height: 16px; font-weight: 600; }
.visual-chat-composer__model-copy small { color: #9ca3af; font-size: 9px; line-height: 13px; }
.visual-chat-composer__model-options :deep(.t-icon) { flex: 0 0 11px; font-size: 11px; }
.visual-chat-composer__menu-empty { padding: 18px 8px; color: #9ca3af; font-size: 10px; text-align: center; }
.visual-chat-composer.is-embedded .visual-chat-composer__surface { border-radius: 14px; }
@media (max-width: 620px) { .visual-chat-composer__toolbar { align-items: flex-end; } .visual-chat-composer__tools { gap: 2px; } .visual-chat-composer__select, .visual-chat-composer__model { max-width: 120px; } }
@media (max-width: 420px) { .visual-chat-composer__toolbar { align-items: flex-start; flex-wrap: wrap; } .visual-chat-composer__tools { flex: 1 1 100%; } .visual-chat-composer__submit { margin-left: auto; } .visual-chat-composer__model { max-width: 110px; } }
@media (prefers-reduced-motion: reduce) { .visual-chat-composer__surface, .visual-chat-composer__send, .visual-chat-composer__select :deep(.t-icon), .visual-chat-composer__model :deep(.t-icon) { transition: none !important; } }
</style>