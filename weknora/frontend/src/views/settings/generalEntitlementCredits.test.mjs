import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const usageSettings = await readFile(new URL('./UsageBillingSettings.vue', import.meta.url), 'utf8')
const settingsShell = await readFile(new URL('./Settings.vue', import.meta.url), 'utf8')
const entitlementApi = await readFile(new URL('../../api/entitlement.ts', import.meta.url), 'utf8')

test('entitlement API types the official OpenRouter credit availability state', () => {
  assert.match(entitlementApi, /OpenRouterCreditsStatus\s*=\s*'available'\s*\|\s*'unavailable'\s*\|\s*'unprovisioned'/)
  assert.match(entitlementApi, /openrouter_credits_status:\s*OpenRouterCreditsStatus/)
})

test('usage settings shows remaining percentages without provider or dollar fields', () => {
  assert.match(usageSettings, /openrouter_credits_status === 'unavailable'/)
  assert.match(usageSettings, /openrouter_credits_status === 'unprovisioned'\) return 100/)
  assert.match(usageSettings, /clampPercent\(\(remaining \/ total\) \* 100\)/)
  assert.match(usageSettings, /creditsRemainingPercent \}\}%/)
  assert.match(usageSettings, /storageRemainingPercent \}\}%/)
  assert.doesNotMatch(usageSettings, /formatCredits|monthlyCredits|OpenRouter|\$\d/)
})

test('credit period copy uses the tenant personal-cycle boundary', () => {
  assert.match(entitlementApi, /openrouter_resets_at\?:\s*string/)
  assert.match(usageSettings, /const raw = entitlement\.value\?\.openrouter_resets_at/)
  assert.match(usageSettings, /v-if="formattedResetAt"/)
})

test('closing a checkout-intent settings route returns to the product instead of reopening checkout', () => {
  assert.match(settingsShell, /const hasCheckoutIntent = computed/)
  assert.match(settingsShell, /hasCheckoutIntent\.value[\s\S]*router\.push\('\/platform\/knowledge-bases'\)/)
})

test('Paddle customer portal stays server-authenticated and redirects with a fresh session URL', () => {
  assert.match(entitlementApi, /portal_available:\s*boolean/)
  assert.match(entitlementApi, /post\('\/api\/v1\/billing\/paddle\/portal-session'\)/)
  assert.match(usageSettings, /billing\.value\?\.portal_available\s*===\s*true/)
  assert.match(usageSettings, /window\.location\.assign\(response\.authorization_url\)/)
  assert.doesNotMatch(entitlementApi, /customer_id/)
})
