import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const component = readFileSync(new URL('./KbUploadSourceDropdown.vue', import.meta.url), 'utf8')
const localeFiles = [
  '../../../i18n/locales/en-US.ts',
  '../../../i18n/locales/zh-CN.ts',
  '../../../i18n/locales/ko-KR.ts',
  '../../../i18n/locales/ru-RU.ts',
]

test('URL import modal accepts share text in a fixed three-row field', () => {
  assert.match(component, /<t-textarea[\s\S]*?v-model="urlInputValue"[\s\S]*?:autosize="\{ minRows: 3, maxRows: 3 \}"/)
  assert.match(component, /class="visual-url-modal__textarea-wrap"/)
  assert.match(component, /v-if="urlInputValue"[\s\S]*?class="visual-url-modal__clear"/)
  assert.match(component, /position: absolute/)
  assert.match(component, /background: #f9fafb/)
  assert.match(component, /border: 1px solid #f0f1f3/)
  assert.match(component, /urlInputValue\.value = ''/)
  assert.match(component, /logo-instagram/)
  assert.match(component, /logo-twitter/)
  assert.match(component, /logo-youtube/)
  for (const label of ['Instagram', 'X', '小红书', 'YouTube']) {
    assert.match(component, new RegExp(label))
  }
  assert.match(component, /douyinTikTok/)
  assert.match(component, /data-platform-label="抖音·TikTok"/)
  assert.match(component, /visual-url-modal__platform-list/)
  assert.strictEqual((component.match(/class="visual-url-modal__platform"/g) || []).length, 5)
  assert.doesNotMatch(component, /@enter=/)
  assert.match(component, /urlSupportedPlatforms/)
  assert.match(component, /urlInputHint/)
})

test('URL import confirmation only enforces presence and the 4 KiB input limit', () => {
  assert.match(component, /const url = urlInputValue\.value\.trim\(\)/)
  assert.match(component, /new TextEncoder\(\)\.encode\(url\)\.length > 4096/)
  assert.match(component, /urlTooLong/)
  assert.doesNotMatch(component, /new URL\(url\)/)
  assert.doesNotMatch(component, /t\('knowledgeBase\.invalidURL'\)/)
  assert.match(component, /emit\('url', url\)/)
})

test('Add Document and link-share panels use explicit dark semantic surfaces', () => {
  assert.match(
    component,
    /:root\[theme-mode="dark"\] \.visual-upload-menu\s*\{[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/,
  )
  assert.match(
    component,
    /:root\[theme-mode="dark"\] \.visual-url-modal\s*\{[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/,
  )
  assert.match(
    component,
    /:root\[theme-mode="dark"\] \.visual-url-modal__footer\s*\{[\s\S]*?background:\s*var\(--mvc-surface-raised\)\s*!important;/,
  )
  assert.match(
    component,
    /:root\[theme-mode="dark"\] \.visual-url-modal__body :deep\(\.t-textarea__inner\)[\s\S]*?background:\s*var\(--mvc-surface-raised\)\s*!important;/,
  )
})

test('all shipped locales describe share text input and the fixed platform row', () => {
  for (const path of localeFiles) {
    const locale = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(locale, /urlSupportedPlatforms:/)
    assert.match(locale, /urlInputHint:/)
    assert.match(locale, /urlClear:/)
    assert.match(locale, /urlTooLong:/)
    assert.match(locale, /douyinTikTok:/)
  }
})
