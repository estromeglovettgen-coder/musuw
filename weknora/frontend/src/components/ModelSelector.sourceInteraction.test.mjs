import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const selector = readFileSync(new URL('./ModelSelector.vue', import.meta.url), 'utf8')
const composer = readFileSync(new URL('./Input-field.vue', import.meta.url), 'utf8')
const finalClosure = readFileSync(new URL('../assets/musuw-final-contract-closure.css', import.meta.url), 'utf8')
const lucide = readFileSync(new URL('../assets/musuw-reference-lucide-precision.css', import.meta.url), 'utf8')

test('chat selector preserves the source hover flyout and viewport placement contract', () => {
  for (const token of [
    "@mouseenter=\"hoverOpen('models')\"",
    "hoverOpen('reasoning')",
    'visual-model-selector__chat-flyout',
    'submenuPlacement',
    'window.innerWidth - panelRect.right',
    'is-right',
    'is-left',
  ]) {
    assert.ok(selector.includes(token), `source flyout contract lost ${token}`)
  }
})

test('chat model capsule expands to the source width while open', () => {
  assert.match(composer, /:class="\{[^}]*'is-open': showModelSelector/)
  assert.match(composer, /visual-chat-composer__model-picker\.is-open[^}]*width:/)
  assert.match(composer, /visual-chat-composer__model-picker\.is-open[^}]*gap:\s*0/)
  for (const token of [
    'background: #f0f1f4',
    'background: #e5e7eb',
    'width: min(224px',
    'padding: 6px 14px',
    'box-shadow: 0 1px rgb(0 0 0 / 5%)',
    'box-shadow: 0 0 0 1px rgb(209 213 219 / 80%), 0 1px 2px 0 rgb(0 0 0 / 5%)',
    'gap: 6px',
    'border: 1px solid transparent',
    'border-radius: 999px',
    'cubic-bezier(.16,1,.3,1)',
    'overflow: hidden',
  ]) {
    assert.ok(composer.includes(token), `capsule source token lost ${token}`)
  }
})

test('chat popup uses the source right-aligned fixed anchor without legacy 280px overrides', () => {
  for (const token of [
    'button.getBoundingClientRect()',
    'window.innerHeight - rect.top + 6',
    'window.innerWidth - rect.right',
    "right: `${rightInset}px`",
    "bottom: `${bottomInset}px`",
  ]) assert.ok(composer.includes(token), `source anchor contract lost ${token}`)
  assert.equal(finalClosure.includes('width: 280px !important'), false, 'legacy closure still overrides the 224px source card')
  assert.equal(finalClosure.includes('border-radius: 17px !important'), false, 'legacy closure still overrides the source radius')
})

test('chat submenu cards retain source dimensions, timing, placement, and locked-plan affordance', () => {
  const source = `${selector}\n${composer}`
  for (const token of [
    'width: 224px',
    'width: 192px',
    'max-height: 256px',
    'gap: 2px',
    'left: 100%',
    'right: 100%',
    'margin-left: 6px',
    'margin-right: 6px',
    'transform-origin: left bottom',
    'transform-origin: right bottom',
    'translateX(var(--chat-flyout-enter-x)) scale(.96)',
    'translateX(var(--chat-flyout-exit-x)) scale(.97)',
    'transition: opacity 160ms cubic-bezier(.16,1,.3,1)',
    "right: `${rightInset}px`",
    "bottom: `${bottomInset}px`",
    'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 10%), 0 8px 10px -6px rgb(0 0 0 / 10%)',
    'color: #9ca3af',
    "router.push('/plans')",
  ]) {
    assert.ok(source.includes(token), `submenu source token lost ${token}`)
  }
})

test('source row and option typography stays literal without changing catalog surfaces', () => {
  for (const token of [
    'padding: 8px 12px',
    'gap: 4px',
    'max-width: 90px',
    'padding-right: 2px',
    'font-weight: 400',
    'font-weight: 500',
    'font-size: 14px',
    'margin-left: 8px',
    'padding: 4px 10px',
    'font-size: 11px',
    'showModelSelector',
    "reasoningEffort !== 'none'",
  ]) assert.ok(`${selector}\n${composer}`.includes(token), `source row token lost ${token}`)
  assert.ok(selector.includes('.visual-model-selector__option.is-locked { color: #6b7280; }'), 'catalog lock color changed')
})

test('chat overview and flyout rows retain the source DOM geometry and compact height', () => {
  assert.match(selector, /visual-model-selector__chat-row-label[\s\S]*<div class="visual-model-selector__chat-row-trailing">[\s\S]*visual-model-selector__chat-row-value[\s\S]*chevron-right[\s\S]*<\/div>/)
  assert.match(selector, /\.visual-model-selector__chat-row-trailing\s*\{[\s\S]*margin-left: auto;[\s\S]*padding-right: 2px;/)
  assert.match(selector, /\.visual-model-selector__chat-row-value\s*\{[\s\S]*color: #4b5563;/)
  const optionRule = selector.match(/\.visual-model-selector__chat-option\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  assert.doesNotMatch(optionRule, /min-height:/)
  assert.match(optionRule, /padding: 6px 10px;/)
  assert.match(selector, /\.visual-model-selector__chat-option-copy strong\s*\{[\s\S]*line-height: 16px;/)
  assert.match(selector, /\.visual-model-selector__chat-option\.is-reasoning[\s\S]*color: var\(--chat-picker-title\);[\s\S]*line-height: 15px;/)
  assert.match(selector, /\.visual-model-selector__chat-check\s*\{[\s\S]*color: var\(--chat-picker-title\);/)
  assert.match(lucide, /\.visual-model-selector__chat-row-trailing::after\s*\{[\s\S]*color: #9ca3af;/)
})

test('chat overview keyboard follows the same source flyout path and Lucide glyphs as pointer input', () => {
  assert.match(selector, /@keydown\.enter\.stop\.prevent="toggleHover\('models'\)"/)
  assert.match(selector, /@keydown\.space\.stop\.prevent="toggleHover\('models'\)"/)
  assert.match(selector, /@keydown\.enter\.stop\.prevent="reasoningOptions\.length && toggleHover\('reasoning'\)"/)
  for (const token of [
    '.visual-model-selector__chat-row-trailing > .t-icon',
    '.visual-model-selector__chat-check > .t-icon',
    '.visual-model-selector__chat-lock > .t-icon',
    '--mvp-chevron-right',
    '--mvp-check',
    '--mvp-lock',
  ]) assert.ok(lucide.includes(token), `source Lucide mapping lost ${token}`)
})

test('catalog add-model affordance is unavailable in Lite and rejects forged events', () => {
  assert.match(selector, /showAddModel && !authStore\.isLiteMode/)
  assert.match(selector, /if \(authStore\.isLiteMode\) return/)
  assert.match(selector, /import \{ useAuthStore \} from '@\/stores\/auth'/)
})

test('consumer scene catalog uses the reference CustomSelect surface', () => {
  for (const token of [
    'isConsumerSceneSelector',
    'visual-model-selector__consumer-control',
    'visual-model-selector__consumer-dropdown',
    'top: calc(100% + 6px);',
    'width: 288px;',
    'max-height: 256px;',
    'padding: 6px;',
    'border-radius: 16px;',
    'visual-model-selector__consumer-option',
    'padding: 8px 12px;',
    'visual-model-selector__consumer-lock',
    "router.push('/plans')",
  ]) assert.ok(selector.includes(token), `consumer CustomSelect token lost ${token}`)
  assert.match(selector, /props\.mode === 'catalog' && !props\.showAddModel/)
  assert.match(selector, /type: option\.model_type/)
  assert.match(selector, /isConsumerSceneSelector\.value\)/)
  assert.doesNotMatch(selector, /type: 'KnowledgeQA' as const/)
  assert.match(selector, /<Transition name="visual-model-selector__consumer-fade">/)
  assert.match(selector, /transition: opacity 100ms ease, transform 100ms ease;/)
  assert.match(selector, /\.visual-model-selector__consumer-option\s*\{[\s\S]*transition: background-color 150ms ease, color 150ms ease;/)
  assert.match(selector, /@media \(min-width: 640px\)[\s\S]*\.visual-model-selector__consumer-state \{ font-size: 14px; line-height: 20px; \}/)
  assert.match(selector, /\.visual-model-selector__consumer-lock\s*\{[\s\S]*color: #6b7280;/)
  assert.doesNotMatch(selector, /consumer-pro|PRO/)
  const lockedRule = selector.match(/\.visual-model-selector__consumer-option\.is-locked\s*\{([^}]*)\}/)?.[1] || ''
  assert.doesNotMatch(lockedRule, /opacity:/)
})
