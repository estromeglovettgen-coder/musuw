import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const plans = readFileSync(new URL('./Plans.vue', import.meta.url), 'utf8')

test('localized Paddle preview prices are rendered without reformatting', () => {
  const start = plans.indexOf('const planPrice =')
  const end = plans.indexOf('\nconst planFeatures =', start)

  assert.notEqual(start, -1, 'planPrice must exist')
  assert.notEqual(end, -1, 'planPrice must be bounded')

  const planPrice = plans.slice(start, end)
  assert.match(planPrice, /return localizedPrices\.value\[priceId\]/)
  assert.doesNotMatch(planPrice, /\.replace\(|Intl\.NumberFormat|parseFloat|parseInt|Number\s*\(/)
})
