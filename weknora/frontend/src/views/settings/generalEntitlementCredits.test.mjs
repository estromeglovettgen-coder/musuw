import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const generalSettings = await readFile(new URL('./GeneralSettings.vue', import.meta.url), 'utf8')
const entitlementApi = await readFile(new URL('../../api/entitlement.ts', import.meta.url), 'utf8')

test('entitlement API types the official OpenRouter credit availability state', () => {
  assert.match(entitlementApi, /OpenRouterCreditsStatus\s*=\s*'available'\s*\|\s*'unavailable'\s*\|\s*'unprovisioned'/)
  assert.match(entitlementApi, /openrouter_credits_status:\s*OpenRouterCreditsStatus/)
})

test('general settings never renders unavailable OpenRouter credits as a fake zero balance', () => {
  assert.match(generalSettings, /openrouter_credits_status\s*===\s*'available'/)
  assert.match(generalSettings, /if \(!entitlement\.value \|\| !creditsAvailable\.value\) return '—'/)
  assert.match(generalSettings, /<strong>\{\{ creditsDisplay \}\}<\/strong>/)
  assert.doesNotMatch(generalSettings, /<strong>\{\{ formatCredits\(entitlement\.openrouter_used_microusd\)/)
})

test('credit period copy is shown only when provider metadata is available', () => {
  assert.match(generalSettings, /<template v-if="creditsAvailable">[\s\S]*entitlement\.renewsMonthly/)
})
