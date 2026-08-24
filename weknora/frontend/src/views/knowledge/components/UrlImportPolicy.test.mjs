import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const component = readFileSync(new URL('./KbUploadSourceDropdown.vue', import.meta.url), 'utf8')
const locales = {
  en: readFileSync(new URL('../../../i18n/locales/en-US.ts', import.meta.url), 'utf8'),
  zh: readFileSync(new URL('../../../i18n/locales/zh-CN.ts', import.meta.url), 'utf8'),
  ko: readFileSync(new URL('../../../i18n/locales/ko-KR.ts', import.meta.url), 'utf8'),
  ru: readFileSync(new URL('../../../i18n/locales/ru-RU.ts', import.meta.url), 'utf8'),
}

test('URL import shows the ownership, private-indexing, and no-redistribution boundary', () => {
  assert.match(component, /knowledgeBase\.urlUsageNotice/)
  for (const source of Object.values(locales)) assert.match(source, /urlUsageNotice:/)

  assert.match(locales.en, /urlUsageNotice:[^\n]*(?:own|authorized)[^\n]*private knowledge index[^\n]*(?:streaming downloader|redistribution)/i)
  assert.match(locales.zh, /urlUsageNotice:[^\n]*(?:拥有|授权)[^\n]*私人知识索引[^\n]*(?:流媒体下载|再分发)/)
  assert.match(locales.ko, /urlUsageNotice:[^\n]*(?:소유|권한)[^\n]*(?:개인 지식 인덱스|개인 지식 색인)[^\n]*(?:스트리밍|재배포)/)
  assert.match(locales.ru, /urlUsageNotice:[^\n]*(?:владеете|разрешение)[^\n]*(?:частного|личного)[^\n]*(?:индекс)[^\n]*(?:стриминг|распростран)/i)
})

test('the public acceptable-use policy states the same narrow URL-import purpose', async () => {
  const { getPublicDocument } = await import('../../../../../../storefront/src/legalContent.js')
  const english = JSON.stringify(getPublicDocument('en', '/acceptable-use'))
  const chinese = JSON.stringify(getPublicDocument('zh-CN', '/acceptable-use'))

  assert.match(english, /URL imports.*private knowledge indexing.*not.*streaming.*content redistribution/i)
  assert.match(chinese, /网页导入.*私人知识索引.*不是.*流媒体下载.*内容再分发/)
})
