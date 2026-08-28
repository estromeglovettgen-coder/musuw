import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const paddle = readFileSync(new URL('./paddleCheckout.ts', import.meta.url), 'utf8')
const entitlementApi = readFileSync(new URL('../api/entitlement.ts', import.meta.url), 'utf8')
const plans = readFileSync(new URL('../views/billing/Plans.vue', import.meta.url), 'utf8')
const checkout = readFileSync(new URL('../views/billing/Checkout.vue', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')

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

test('an initialized Paddle singleton fails closed if the runtime environment changes', () => {
  assert.match(paddle, /activeEnvironment/)
  assert.match(paddle, /activeClientToken/)
  assert.match(paddle, /Paddle\.js configuration changed; reload required/)
})

test('the app initializes official Paddle.js on public and authenticated pages for Retain', () => {
  assert.match(app, /getPaddlePublicConfig/)
  assert.match(app, /getCurrentEntitlement/)
  assert.match(app, /initializePaddlePaymentLink/)
  assert.match(app, /authStore\.effectiveTenantId/)
  assert.match(app, /pwCustomerId:\s*entitlement\.billing\.pw_customer_id/)
  assert.match(app, /pwCustomerId:\s*undefined/)
})

test('self-service checkout lets official Paddle.js create the transaction from server-signed items', () => {
  assert.match(entitlementApi, /createPaddleCheckoutIntent/)
  assert.match(entitlementApi, /\/api\/v1\/billing\/paddle\/checkout-intent/)
  assert.match(entitlementApi, /billing_period: input\.billingPeriod/)
  assert.doesNotMatch(entitlementApi, /createPaddleCheckoutIntent[\s\S]*operation_key: input\.operationKey/)
  assert.match(entitlementApi, /subscription-upgrade[\s\S]*operation_key: operationKey/)
  assert.match(checkout, /createPaddleCheckoutIntent\(/)
  assert.match(checkout, /upgradeOperationKey/)
  assert.match(checkout, /upgradePaddleSubscription\(plan, getUpgradeOperationKey\(\)\)/)
  assert.match(checkout, /priceId: intent\.price_id/)
  assert.match(checkout, /customData: intent\.custom_data/)
  assert.match(checkout, /config\.catalog\?\./)
  assert.doesNotMatch(checkout, /checkoutBinding:|tenantId:|config\.tenant_id/)
  assert.match(paddle, /items:\s*\[\{\s*priceId:\s*input\.priceId,\s*quantity:\s*1\s*\}\]/)
  assert.match(paddle, /customData:\s*input\.customData/)
  assert.doesNotMatch(paddle, /transactionId:\s*input\.transactionId/)
})

test('localized price preview uses Paddle final totals, not pre-tax subtotals', () => {
  assert.match(paddle, /formattedSubtotal:\s*item\.formattedUnitTotals\.subtotal/)
  assert.match(paddle, /formattedTotal:\s*item\.formattedTotals\.total/)
  assert.doesNotMatch(paddle, /formattedUnitSubtotal/)
  assert.match(plans, /preview\.formattedTotal/)
  assert.match(checkout, /previewSubtotal\.value = preview\?\.formattedSubtotal/)
  assert.match(checkout, /preview\?\.formattedTotal/)
})
