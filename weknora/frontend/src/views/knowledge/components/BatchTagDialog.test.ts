import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('./BatchTagDialog.vue', import.meta.url), 'utf8')
const zhCN = readFileSync(new URL('../../../i18n/locales/zh-CN.ts', import.meta.url), 'utf8')
const enUS = readFileSync(new URL('../../../i18n/locales/en-US.ts', import.meta.url), 'utf8')
const koKR = readFileSync(new URL('../../../i18n/locales/ko-KR.ts', import.meta.url), 'utf8')
const ruRU = readFileSync(new URL('../../../i18n/locales/ru-RU.ts', import.meta.url), 'utf8')

test('uses the visual-reference native batch-tag modal', () => {
  assert.match(component, /class="reference-modal-backdrop"/)
  assert.match(component, /class="reference-batch-tag-dialog"/)
  assert.match(component, /ReferenceIcon name="tag"/)
  assert.match(component, /ReferenceIcon name="search"/)
  assert.match(component, /ReferenceIcon name="plus"/)
  assert.match(component, /batchTagSelectedSection/)
  assert.match(component, /batchTagAvailableSection/)
  assert.match(component, /preSelectedTagIds/)
  assert.match(component, /confirmLoading/)
  assert.match(component, /canManage/)
  assert.match(component, /tagManageLink/)
  assert.match(component, /open-manage/)
  assert.match(component, /selectedTagsList/)
  assert.match(component, /availableTagsList/)
  assert.match(component, /class="reference-batch-tag-chip selected"/)
  assert.match(component, /class="reference-batch-new-tag"/)
  assert.match(component, /class="reference-batch-tag-dialog__footer"/)
  assert.match(component, /function handleConfirm\(\) \{\s*if \(props\.confirmLoading\) return\s*emit\('confirm', Array\.from\(selectedSet\.value\)\)\s*}/)
  assert.doesNotMatch(component, /<t-dialog/)
  assert.doesNotMatch(component, /<t-input/)
  assert.doesNotMatch(component, /<t-button/)
  assert.doesNotMatch(component, /<t-icon/)
})

test('defines batch tag dialog strings in every supported locale', () => {
  for (const locale of [zhCN, enUS, koKR, ruRU]) {
    assert.match(locale, /batchTagDialogHeading:/)
    assert.match(locale, /batchTagSelectedSection:/)
    assert.match(locale, /batchTagAvailableSection:/)
    assert.match(locale, /batchTagSuccess:/)
    assert.match(locale, /batchTagFailed:/)
  }
})
