import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('./TagEditDialog.vue', import.meta.url), 'utf8')
const zhCN = readFileSync(new URL('../../../i18n/locales/zh-CN.ts', import.meta.url), 'utf8')
const enUS = readFileSync(new URL('../../../i18n/locales/en-US.ts', import.meta.url), 'utf8')
const koKR = readFileSync(new URL('../../../i18n/locales/ko-KR.ts', import.meta.url), 'utf8')
const ruRU = readFileSync(new URL('../../../i18n/locales/ru-RU.ts', import.meta.url), 'utf8')

test('uses the visual-reference native tag modal rather than the legacy TDesign dialog', () => {
  assert.match(component, /class="reference-modal-backdrop"/)
  assert.match(component, /class="reference-tag-dialog"/)
  assert.match(component, /ReferenceIcon name="tag"/)
  assert.match(component, /ReferenceIcon name="search"/)
  assert.match(component, /ReferenceIcon name="plus"/)
  assert.match(component, /tagEditSelectedSection/)
  assert.match(component, /tagEditAvailableSection/)
  assert.match(component, /canManage/)
  assert.match(component, /tagManageLink/)
  assert.match(component, /open-manage/)
  assert.match(component, /selectedTagsList/)
  assert.match(component, /availableTagsList/)
  assert.match(component, /class="reference-tag-chip selected"/)
  assert.match(component, /class="reference-new-tag"/)
  assert.match(component, /class="reference-tag-dialog__footer"/)
  assert.doesNotMatch(component, /<t-dialog/)
  assert.doesNotMatch(component, /<t-button/)
  assert.doesNotMatch(component, /<t-input/)
  assert.doesNotMatch(component, /<t-icon/)
})

test('keeps the existing tag data and mutation behavior', () => {
  assert.match(component, /createKnowledgeBaseTag/)
  assert.match(component, /emit\('confirm', Array\.from\(selectedSet\.value\)\)/)
  assert.match(component, /emit\('tag-created'\)/)
  assert.match(component, /emit\('open-manage'\)/)
})

test('defines the short dialog heading in every supported locale', () => {
  for (const locale of [zhCN, enUS, koKR, ruRU]) {
    assert.match(locale, /tagEditDialogHeading:/)
    assert.match(locale, /tagEditSelectedSection:/)
    assert.match(locale, /tagEditAvailableSection:/)
  }
})
