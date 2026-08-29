import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const editor = readFileSync(new URL('./KnowledgeBaseEditorModal.vue', import.meta.url), 'utf8')
const card = readFileSync(new URL('./components/KnowledgeBaseListReferenceCard.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en-US.ts', import.meta.url), 'utf8')
const zh = readFileSync(new URL('../../i18n/locales/zh-CN.ts', import.meta.url), 'utf8')

test('Lite cannot submit a document library without visible RAG or Wiki indexing', () => {
  assert.match(
    editor,
    /:disabled="saving \|\| \(authStore\.isLiteMode && !isFAQ && !formData\.indexingStrategy\.vectorEnabled && !formData\.indexingStrategy\.keywordEnabled && !formData\.indexingStrategy\.wikiEnabled\)"/,
  )
  assert.match(
    editor,
    /if \(authStore\.isLiteMode && formData\.value\.type !== 'faq'\) \{[\s\S]*?knowledgeEditor\.indexing\.atLeastOne[\s\S]*?if \(editorMode\.value === 'create'\) return true/,
  )
})

test('duplicate wording states the native settings-only contract', () => {
  assert.match(zh, /duplicate: '创建配置副本'/)
  assert.match(zh, /duplicateSuccess: '已创建配置副本（不含文档、FAQ、Wiki 页面和索引）'/)
  assert.match(en, /duplicate: 'Duplicate settings'/)
  assert.match(en, /duplicateSuccess: 'Settings duplicate created \(documents, FAQs, Wiki pages, and indexes were not copied\)'/)
})

test('knowledge-base cards identify RAG and legacy unconfigured Lite rows', () => {
  assert.match(card, /data-indexing-strategy="rag"/)
  assert.match(card, /data-indexing-strategy="unconfigured"/)
  assert.match(card, /authStore\.isLiteMode/)
})
