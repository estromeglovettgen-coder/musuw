import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const en = readFileSync(new URL('../../i18n/locales/en-US.ts', import.meta.url), 'utf8')
const zh = readFileSync(new URL('../../i18n/locales/zh-CN.ts', import.meta.url), 'utf8')
const plans = readFileSync(new URL('./Plans.vue', import.meta.url), 'utf8')
const checkout = readFileSync(new URL('./Checkout.vue', import.meta.url), 'utf8')

test('consumer plan copy states the enforced storage, allowance, and model catalog contract', () => {
  assert.match(en, /allowanceLevels:\s*\{\s*free: '\$1\.00', plus: '\$1\.25', pro: '\$2\.50', max: '\$5\.00'\s*\}/)
  assert.match(en, /featureStorage:\s*'\{amount\} GiB storage'/)
  assert.match(en, /featureAllowance:\s*'\{level\} monthly AI credit allowance'/)
  assert.match(en, /featureBudgetModel:\s*'One least-cost model per capability'/)
  assert.match(en, /featureAllModels:\s*'Expanded platform-approved catalog'/)

  assert.match(zh, /allowanceLevels:\s*\{\s*free: '\$1\.00', plus: '\$1\.25', pro: '\$2\.50', max: '\$5\.00'\s*\}/)
  assert.match(zh, /featureStorage:\s*'\{amount\} GiB 存储空间'/)
  assert.match(zh, /featureAllowance:\s*'\{level\} 每月 AI 额度'/)
  assert.match(zh, /featureBudgetModel:\s*'每项能力一个最低成本模型'/)
  assert.match(zh, /featureAllModels:\s*'扩展的平台批准模型目录'/)
})

test('plans and checkout keep the four enforced storage tiers and shared feature keys', () => {
  assert.match(plans, /const storage = \{ free: 5, plus: 20, pro: 40, max: 80 \}\[plan\]/)
  assert.match(plans, /featureAllowance/)
  assert.match(plans, /featureBudgetModel/)
  assert.match(plans, /featureAllModels/)
  assert.match(checkout, /const storage = \{ plus: 20, pro: 40, max: 80 \}\[plan\]/)
  assert.match(checkout, /featureAllowance/)
  assert.match(checkout, /featureAllModels/)
})
