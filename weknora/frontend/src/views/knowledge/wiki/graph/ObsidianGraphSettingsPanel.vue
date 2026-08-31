<template>
  <div
    class="obsidian-graph-controls-wrap"
    :class="{ 'is-shifted': shifted, 'is-open': !modelValue.close }"
  >
    <button
      v-if="modelValue.close"
      type="button"
      class="graph-settings-trigger"
      :title="t('knowledgeEditor.wikiBrowser.obsidianGraph.open')"
      :aria-label="t('knowledgeEditor.wikiBrowser.obsidianGraph.open')"
      @click="update('close', false)"
    >
      <t-icon name="setting" />
    </button>

    <div v-else class="graph-controls">
      <div class="graph-controls-actions">
        <button
          type="button"
          class="clickable-icon"
          :title="t('knowledgeEditor.wikiBrowser.obsidianGraph.reset')"
          :aria-label="t('knowledgeEditor.wikiBrowser.obsidianGraph.reset')"
          @click="emit('reset')"
        >
          <t-icon name="rollback" />
        </button>
        <button
          type="button"
          class="clickable-icon"
          :title="t('knowledgeEditor.wikiBrowser.obsidianGraph.close')"
          :aria-label="t('knowledgeEditor.wikiBrowser.obsidianGraph.close')"
          @click="update('close', true)"
        >
          <t-icon name="close" />
        </button>
      </div>

      <section class="graph-control-section">
        <button type="button" class="tree-item-self" @click="toggleCollapse('collapse-display')">
          <t-icon :name="modelValue['collapse-display'] ? 'chevron-right' : 'chevron-down'" />
          <span>{{ t('knowledgeEditor.wikiBrowser.obsidianGraph.display') }}</span>
        </button>
        <div v-if="!modelValue['collapse-display']" class="tree-item-children">
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.textFade')"
            :value="modelValue.textFadeMultiplier"
            :min="-3"
            :max="3"
            :step="0.1"
            @change="update('textFadeMultiplier', $event)"
          />
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.nodeSize')"
            :value="modelValue.nodeSizeMultiplier"
            :min="0.1"
            :max="5"
            :step="0.1"
            @change="update('nodeSizeMultiplier', $event)"
          />
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.linkThickness')"
            :value="modelValue.lineSizeMultiplier"
            :min="0.1"
            :max="5"
            :step="0.1"
            @change="update('lineSizeMultiplier', $event)"
          />
        </div>
      </section>

      <section class="graph-control-section">
        <button type="button" class="tree-item-self" @click="toggleCollapse('collapse-forces')">
          <t-icon :name="modelValue['collapse-forces'] ? 'chevron-right' : 'chevron-down'" />
          <span>{{ t('knowledgeEditor.wikiBrowser.obsidianGraph.forces') }}</span>
        </button>
        <div v-if="!modelValue['collapse-forces']" class="tree-item-children">
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.center')"
            :value="modelValue.centerStrength"
            :min="0"
            :max="1"
            :step="0.01"
            @change="update('centerStrength', $event)"
          />
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.repel')"
            :value="modelValue.repelStrength"
            :min="0"
            :max="20"
            :step="0.1"
            @change="update('repelStrength', $event)"
          />
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.link')"
            :value="modelValue.linkStrength"
            :min="0"
            :max="1"
            :step="0.01"
            @change="update('linkStrength', $event)"
          />
          <GraphSlider
            :label="t('knowledgeEditor.wikiBrowser.obsidianGraph.linkDistance')"
            :value="modelValue.linkDistance"
            :min="30"
            :max="500"
            :step="1"
            @change="update('linkDistance', $event)"
          />
          <button type="button" class="restart-button" @click="emit('animate')">
            <t-icon name="refresh" />
            {{ t('knowledgeEditor.wikiBrowser.obsidianGraph.animate') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ObsidianGraphSettings } from './obsidianGraphSettings.ts'

const GraphSlider = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, required: true },
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('label', { class: 'setting-item' }, [
      h('span', { class: 'setting-item-name' }, props.label),
      h('input', {
        class: 'graph-slider',
        type: 'range',
        min: props.min,
        max: props.max,
        step: props.step,
        value: props.value,
        'aria-label': props.label,
        style: { '--slider-fill-ratio': (props.value - props.min) / (props.max - props.min) },
        onInput: (event: Event) => emit('change', Number((event.target as HTMLInputElement).value)),
      }),
    ])
  },
})

const props = defineProps<{
  modelValue: ObsidianGraphSettings
  shifted?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: ObsidianGraphSettings): void
  (event: 'reset'): void
  (event: 'animate'): void
}>()

const { t } = useI18n()

function update<K extends keyof ObsidianGraphSettings>(
  key: K,
  value: ObsidianGraphSettings[K],
): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function toggleCollapse(key: 'collapse-display' | 'collapse-forces'): void {
  update(key, !props.modelValue[key])
}
</script>

<style scoped lang="less">
.obsidian-graph-controls-wrap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 14;
  color: var(--td-text-color-primary);
  font: var(--td-font-body-small, 12px/20px var(--td-font-family));
  transition: right 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.obsidian-graph-controls-wrap.is-shifted {
  right: 496px;
}

.obsidian-graph-controls-wrap.is-open {
  right: 164px;
}

.obsidian-graph-controls-wrap.is-open.is-shifted {
  right: 644px;
}

button {
  font: inherit;
}

.graph-settings-trigger,
.clickable-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--td-component-stroke);
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-container);
  cursor: pointer;
}

.graph-settings-trigger {
  width: 36px;
  height: 36px;
  border-radius: var(--td-radius-medium, 6px);
  box-shadow: var(--td-shadow-1);
}

.graph-settings-trigger:hover,
.clickable-icon:hover {
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-container-hover);
}

.graph-controls {
  position: relative;
  width: 236px;
  max-height: min(620px, calc(100vh - 150px));
  overflow: auto;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium, 6px);
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-container);
  box-shadow: var(--td-shadow-2);
  scrollbar-width: thin;
}

.graph-controls-actions {
  position: absolute;
  top: 7px;
  right: 8px;
  z-index: 2;
  display: flex;
  gap: 4px;
}

.clickable-icon {
  width: 26px;
  height: 26px;
  padding: 0;
  border-color: transparent;
  border-radius: var(--td-radius-default, 3px);
}

.graph-control-section {
  padding: 7px 12px;
  border-bottom: 1px solid var(--td-component-stroke);
}

.graph-control-section:last-child {
  border-bottom: 0;
}

.tree-item-self {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 26px;
  padding: 0 64px 0 0;
  border: 0;
  color: var(--td-text-color-primary);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.tree-item-self :deep(.t-icon) {
  width: 14px;
  margin-right: 3px;
  color: var(--td-text-color-secondary);
}

.tree-item-children {
  padding: 5px 0 2px;
}

.setting-item {
  display: block;
  padding: 5px 0 8px;
}

.setting-item-name {
  display: block;
  margin-bottom: 7px;
  color: var(--td-text-color-secondary);
}

.graph-slider {
  --slider-fill-position: calc(7px + (100% - 14px) * var(--slider-fill-ratio, 0));
  width: 100%;
  height: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  outline: none;
  appearance: none;
  background-color: var(--td-bg-color-component);
  background-image: linear-gradient(
    to right,
    var(--td-brand-color) var(--slider-fill-position),
    transparent var(--slider-fill-position)
  );
}

.graph-slider::-webkit-slider-runnable-track {
  height: 6px;
  appearance: none;
}

.graph-slider::-webkit-slider-thumb {
  position: relative;
  top: -4px;
  width: 14px;
  height: 14px;
  border: 1px solid var(--td-component-border);
  border-radius: 50%;
  appearance: none;
  background: var(--td-bg-color-container);
  box-shadow: var(--td-shadow-1);
  cursor: pointer;
}

.graph-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--td-brand-color-focus);
}

.restart-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  margin: 6px 0 2px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default, 3px);
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-container);
  cursor: pointer;
}

.restart-button:hover {
  border-color: var(--td-brand-color);
  color: var(--td-brand-color);
  background: var(--td-bg-color-container-hover);
}
</style>
