import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const paddle = readFileSync(new URL('./paddleCheckout.ts', import.meta.url), 'utf8')
const entitlementApi = readFileSync(new URL('../api/entitlement.ts', import.meta.url), 'utf8')
const plans = readFileSync(new URL('../views/billing/Plans.vue', import.meta.url), 'utf8')
const checkout = readFileSync(new URL('../views/billing/Checkout.vue', import.meta.url), 'utf8')

test('authenticated Paddle customer identity is tenant-derived and passed to Retain', () => {
  assert.match(entitlementApi, /pw_customer_id\?: string/)
  assert.match(plans, /pwCustomerId:\s*config\.pw_customer_id/)
  assert.match(checkout, /pwCustomerId:\s*config\.pw_customer_id/g)
  assert.match(paddle, /pwCustomer:\s*pwCustomerId\s*\?\s*\{\s*id:\s*pwCustomerId\s*\}\s*:\s*\{\}/)
})

test('the Paddle singleton updates Retain when an SPA session identifies a customer later', () => {
  assert.match(paddle, /paddle\.Update\(\{\s*pwCustomer:/)
  assert.doesNotMatch(paddle, /pwCustomer:\s*\{\s*(?:email|id):\s*input\.(?:email|tenantId)/)
})
