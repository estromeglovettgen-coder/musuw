import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const pageFiles = [
  'GeneralSettings.vue',
  'UsageBillingSettings.vue',
  'ModelSettings.vue',
  'UserProfile.vue',
]

const readPage = (file) => readFileSync(join(root, 'src/views/settings', file), 'utf8')

test('all four consumer settings pages share one title-strip DOM contract', () => {
  for (const file of pageFiles) {
    const source = readPage(file)
    assert.match(source, /<(?:header|div) class="[^"]*visual-settings-page-header[^"]*">/)
    assert.match(source, /class="visual-settings-page-header__copy"/)
    assert.match(source, /<h2 class="visual-settings-page-header__title">/)
    assert.match(source, /<p class="visual-settings-page-header__description[^"]*">/)
  }
})

test('the shared title strip keeps the reference cadence and borders', () => {
  const closure = readFileSync(join(root, 'src/assets/musuw-final-theme-closure.css'), 'utf8')
  const titleRule = closure.match(/\.visual-settings-content \.visual-settings-page-header\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(titleRule, /margin:\s*0 0 8px !important/)
  assert.match(titleRule, /padding:\s*0 0 12px !important/)
  assert.match(titleRule, /border-bottom:\s*1px solid #f3f4f6 !important/)
  assert.match(closure, /:root\[theme-mode="dark"\] \.visual-settings-content \.visual-settings-page-header\s*\{[\s\S]*border-bottom-color: var\(--mvc-line\)/)
})

test('usage title is mounted before plan cards and models title is not Lite-gated', () => {
  const usage = readPage('UsageBillingSettings.vue')
  assert.ok(usage.indexOf('visual-settings-page-header__title') < usage.indexOf('usage-plan-title'))

  const models = readPage('ModelSettings.vue')
  const headerStart = models.indexOf('<header class="visual-settings-page-header')
  const firstHeaderClose = models.indexOf('</header>', headerStart)
  assert.ok(headerStart >= 0 && firstHeaderClose > headerStart)
  assert.ok(!models.slice(0, headerStart).includes('v-if="!authStore.isLiteMode"'))
})

test('the rag boundary is presented as the agent model in every shipped locale', () => {
  const localeFiles = ['zh-CN.ts', 'en-US.ts', 'ko-KR.ts', 'ru-RU.ts']
  const expectedLabels = ['智能体模型', 'Agent model', '에이전트 모델', 'Модель агента']
  for (const [index, file] of localeFiles.entries()) {
    const source = readFileSync(join(root, 'src/i18n/locales', file), 'utf8')
    assert.match(source, new RegExp(`rag: \\{ label: '${expectedLabels[index]}'`))
  }
})
