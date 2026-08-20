import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const generalSettings = await readFile(new URL('./GeneralSettings.vue', import.meta.url), 'utf8')
const settingsShell = await readFile(new URL('./Settings.vue', import.meta.url), 'utf8')
const entitlementApi = await readFile(new URL('../../api/entitlement.ts', import.meta.url), 'utf8')

test('entitlement API types the official OpenRouter credit availability state', () => {
  assert.match(entitlementApi, /OpenRouterCreditsStatus\s*=\s*'available'\s*\|\s*'unavailable'\s*\|\s*'unprovisioned'/)
  assert.match(entitlementApi, /openrouter_credits_status:\s*OpenRouterCreditsStatus/)
})

test('general settings shows the plan limit without inventing unavailable provider usage', () => {
  assert.match(generalSettings, /openrouter_credits_status\s*===\s*'available'/)
  assert.match(generalSettings, /if \(!entitlement\.value\) return '—'/)
  assert.match(generalSettings, /if \(!creditsAvailable\.value\) return formatCredits\(entitlement\.value\.monthly_openrouter_microusd\)/)
  assert.match(generalSettings, /<strong>\{\{ creditsDisplay \}\}<\/strong>/)
  assert.doesNotMatch(generalSettings, /<strong>\{\{ formatCredits\(entitlement\.openrouter_used_microusd\)/)
})

test('credit period copy is shown only when provider metadata is available', () => {
  assert.match(generalSettings, /<template v-if="creditsAvailable">[\s\S]*entitlement\.renewsMonthly/)
})

test('closing a checkout-intent settings route returns to the product instead of reopening checkout', () => {
  assert.match(settingsShell, /const hasCheckoutIntent = computed/)
  assert.match(settingsShell, /hasCheckoutIntent\.value[\s\S]*router\.push\('\/platform\/knowledge-bases'\)/)
})

test('Paddle customer portal stays server-authenticated and redirects with a fresh session URL', () => {
  assert.match(entitlementApi, /portal_available:\s*boolean/)
  assert.match(entitlementApi, /post\('\/api\/v1\/billing\/paddle\/portal-session'\)/)
  assert.match(generalSettings, /billing\.value\?\.portal_available\s*===\s*true/)
  assert.match(generalSettings, /window\.location\.assign\(response\.authorization_url\)/)
  assert.doesNotMatch(entitlementApi, /customer_id/)
})
