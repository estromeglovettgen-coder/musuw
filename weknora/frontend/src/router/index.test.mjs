import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routerSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

function oidcErrorGuard() {
  const start = routerSource.indexOf('if (hasOIDCErrorCallback(window.location.hash || \'\'))')
  const end = routerSource.indexOf("if (hasPendingOIDCCallback(window.location.hash || ''))", start)

  assert.notEqual(start, -1, 'OIDC error guard must exist')
  assert.notEqual(end, -1, 'OIDC error guard must run before the generic callback bypass')
  return routerSource.slice(start, end)
}

test('an OIDC error stops routing before a protected route can start auth again', () => {
  const guard = oidcErrorGuard()

  assert.match(guard, /handoffToExternalAuth\('error'\)/)
  assert.match(guard, /next\(false\)/)
})

function nativeAuthEntryGuard() {
  const start = routerSource.indexOf("if (to.path === '/login' || to.path === '/register')")
  const end = routerSource.indexOf('// Tenantless onboarding', start)

  assert.notEqual(start, -1, 'native /login and /register guard must exist')
  assert.notEqual(end, -1, 'native auth guard must remain bounded before tenant onboarding')
  return routerSource.slice(start, end)
}

test('a cold authenticated /login load restores the native session before auth handoff', () => {
  const guard = nativeAuthEntryGuard()
  const hydrate = guard.indexOf('await hydrateSessionFromToken(authStore)')
  const handoff = guard.indexOf("handoffToExternalAuth('start')")

  assert.notEqual(hydrate, -1, 'cold native session must be hydrated in the login branch')
  assert.notEqual(handoff, -1, 'signed-out entry must still hand off to the auth shell')
  assert.ok(hydrate < handoff, 'session hydration must happen before signed-out handoff')
  assert.match(guard, /if \(!restored\)\s*\{[\s\S]*handoffToExternalAuth\('start'\)[\s\S]*next\(false\)/)
  assert.match(
    guard,
    /next\(authStore\.hasValidTenant \? AUTHENTICATED_HOME_PATH : '\/onboarding\/workspace'\)/,
  )
})

test('only generic Lite entry routes restore the last page', () => {
  assert.match(
    routerSource,
    /localStorage\.getItem\('weknora_lite_mode'\) === 'true'[\s\S]*sessionStorage\.getItem\(LITE_LAST_PATH_KEY\)/,
  )
  assert.match(routerSource, /path: "\/platform",[\s\S]*redirect: authenticatedEntryPath/)
  assert.doesNotMatch(routerSource, /isLiteSpaDefaultEntry/)
})
