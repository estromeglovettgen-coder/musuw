import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const main = read('./musuw-visual.less')
const css = read('./musuw-model-editor-inner-final.css')

test('model editor inner bridge loads after the common SettingDrawer visual layer', () => {
  const i = main.indexOf('musuw-model-editor-inner-final.css')
  assert.ok(i > main.indexOf('musuw-reference-precision-fixes.css'))
  assert.ok(i > main.indexOf('musuw-kb-editor-inner-final.css'))
})

test('model type/source/provider controls use reference ink/gray instead of brand blue', () => {
  for (const token of [
    '.setting-drawer .model-type-option.is-active',
    'background: #111827 !important',
    '.setting-drawer .source-option.is-active',
    '.setting-drawer .t-input.t-is-focused',
    '.setting-drawer .status-icon.available',
    'body .provider-select-popup .t-popup__content',
  ]) assert.ok(css.includes(token), `model editor visual token missing: ${token}`)
})

test('semantic success/warning/error states remain distinct while business stays untouched', () => {
  assert.ok(css.includes('#047857'))
  assert.ok(css.includes('#dc2626'))
  assert.ok(css.includes('#f59e0b'))
  for (const forbidden of ['@click', 'checkRemoteAPI', 'downloadOllamaModel', 'emit(', 'router.', 'store.', 'api/']) {
    assert.equal(css.includes(forbidden), false, `business behavior leaked into model editor CSS: ${forbidden}`)
  }
})
