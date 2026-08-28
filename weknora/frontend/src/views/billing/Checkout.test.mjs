import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const checkout = readFileSync(new URL('./Checkout.vue', import.meta.url), 'utf8')

test('direct checkout navigation is gated to workspace owners and admins', () => {
  assert.match(checkout, /const canManageBilling = computed\(\(\) => authStore\.hasRole\('admin'\)\)/)

  const start = checkout.indexOf('const initializeCheckout = async () =>')
  const end = checkout.indexOf('\nconst confirmUpgrade', start)
  assert.notEqual(start, -1, 'checkout initialization must exist')
  assert.notEqual(end, -1, 'checkout initialization must be bounded')
  const initialize = checkout.slice(start, end)

  assert.match(initialize, /if \(!canManageBilling\.value\) \{[\s\S]*billingAdminOnly[\s\S]*return\n  \}/)
  assert.ok(
    initialize.indexOf("billingAdminOnly") < initialize.indexOf('getCurrentEntitlement()'),
    'a viewer must be rejected before checkout/upgrade provider work starts',
  )
  assert.match(checkout, /createPaddleCheckoutIntent\(/)
  assert.match(checkout, /upgradePaddleSubscription\(/)
})
