import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const usageSettings = await readFile(new URL('./UsageBillingSettings.vue', import.meta.url), 'utf8')
const settingsShell = await readFile(new URL('./Settings.vue', import.meta.url), 'utf8')
const userMenu = await readFile(new URL('../../components/UserMenu.vue', import.meta.url), 'utf8')
const entitlementApi = await readFile(new URL('../../api/entitlement.ts', import.meta.url), 'utf8')
const router = await readFile(new URL('../../router/index.ts', import.meta.url), 'utf8')
const plansPage = await readFile(new URL('../billing/Plans.vue', import.meta.url), 'utf8')
const referenceIcons = await readFile(new URL('../../assets/musuw-reference-lucide-precision.css', import.meta.url), 'utf8')

test('entitlement API types the official OpenRouter credit availability state', () => {
  assert.match(entitlementApi, /OpenRouterCreditsStatus\s*=\s*'available'\s*\|\s*'unavailable'\s*\|\s*'unprovisioned'\s*\|\s*'pending'/)
  assert.match(entitlementApi, /openrouter_credits_status:\s*OpenRouterCreditsStatus/)
})

test('usage settings shows only remaining percentages without provider or dollar fields', () => {
  assert.match(usageSettings, /openrouter_credits_status === 'unavailable'/)
  assert.match(usageSettings, /openrouter_credits_status === 'pending'/)
  assert.match(usageSettings, /openrouter_credits_status === 'unprovisioned'\) return 100/)
  assert.match(usageSettings, /clampPercent\(\(remaining \/ total\) \* 100\)/)
  assert.match(usageSettings, /creditsRemainingPercent \}\}%/)
  assert.match(usageSettings, /storageRemainingPercent \}\}%/)
  assert.doesNotMatch(usageSettings, /creditsUsedPercent|storageUsedPercent|entitlement\.usedPercent/)
  assert.doesNotMatch(usageSettings, /formatCredits|monthlyCredits|OpenRouter|\$\d/)
})

test('opening the account menu refreshes the quota before it is shown', () => {
  assert.match(
    userMenu,
    /const handleTriggerClick = \(\) => \{[\s\S]*menuVisible\.value = !menuVisible\.value[\s\S]*if \(menuVisible\.value\) void loadEntitlement\(\)/,
  )
  assert.match(userMenu, /clampPercent\(\(remaining \/ total\) \* 100\)/)
  assert.match(userMenu, /const requestSequence = \+\+entitlementRequestSequence/)
  assert.match(userMenu, /if \(requestSequence !== entitlementRequestSequence\) return/)
})

test('the free-plan upgrade affordance keeps a valid visible icon mask', () => {
  assert.match(userMenu, /visual-user-menu__billing-item[\s\S]*class="\{ 'is-free': billingIsFree \}"/)
  assert.match(referenceIcons, /--mvp-sparkles:[^\n]*1\.594-1\.594z%22%2F%3E/)
  assert.match(referenceIcons, /\.visual-user-menu__billing-item\.is-free::before[\s\S]*mask-image: var\(--mvp-sparkles\)/)
})

test('credit period copy uses the tenant personal-cycle boundary', () => {
  assert.match(entitlementApi, /openrouter_resets_at\?:\s*string/)
  assert.match(usageSettings, /const raw = entitlement\.value\?\.openrouter_resets_at/)
  assert.match(usageSettings, /v-if="formattedResetAt"/)
})

test('plans live on a standalone authenticated route instead of inside Settings', () => {
  assert.match(router, /path: "\/plans"[\s\S]*views\/billing\/Plans\.vue/)
  assert.match(router, /return \{ path: '\/plans', query: \{ plan, period \} \}/)
  assert.match(usageSettings, /router\.push\('\/plans'\)/)
  assert.doesNotMatch(usageSettings, /usage-billing__pricing|openPaddleCheckout|previewPaddleSubscriptionUpgrade/)
  assert.doesNotMatch(settingsShell, /is-usage|hasCheckoutIntent/)
  assert.match(plansPage, /class="plans-page__grid"/)
})

test('Paddle customer portal stays server-authenticated and redirects with a fresh session URL', () => {
  assert.match(entitlementApi, /portal_available:\s*boolean/)
  assert.match(entitlementApi, /post\('\/api\/v1\/billing\/paddle\/portal-session'\)/)
  assert.match(usageSettings, /billing\.value\?\.portal_available\s*===\s*true/)
  assert.match(usageSettings, /window\.location\.assign\(response\.authorization_url\)/)
  assert.match(usageSettings, /router\.push\('\/plans'\)/)
  const start = entitlementApi.indexOf('export async function createPaddlePortalSession')
  const end = entitlementApi.indexOf('\nexport async function', start + 1)
  const portalMethod = entitlementApi.slice(start, end)
  assert.doesNotMatch(portalMethod, /customer_id|pw_customer|payload/)
  assert.match(entitlementApi, /pw_customer_id\?:\s*string/)
})
