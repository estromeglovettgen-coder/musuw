## Why

The authenticated Musuw product currently uses one server-side Nginx boundary
for the workspace UI, auth shell, API, uploads, resource links, health, SSE,
and OIDC. The desired product boundary is a Cloudflare-served frontend with
the server remaining the backend and data owner. The first safe step is a new,
independent Worker that can be exercised on a staging `workers.dev` endpoint
without changing the existing `app.musuw.com` CNAME/Tunnel.

## What Changes

- Add a small `app-edge/` Workers Static Assets project named `musuw-app`.
- Stage the existing `weknora/frontend/dist` at the asset root and
  `auth/dist` under `/auth/`; do not copy generated output into source control.
- Proxy `/api/*`, exact `/files`, `/r/*`, and `/health` to the fixed HTTPS,
  protected `origin-app.musuw.com` URL with the incoming method, query,
  headers, cookies, redirects, status, and body stream intact.
- Reject WebSocket upgrades explicitly; the edge contract is HTTP streaming/SSE.
- Preserve the current auth-shell and embed route semantics, including
  same-origin `/api/v1/auth/oidc/*`, no-cache HTML, immutable hashed assets,
  and frameable embed pages.
- Add staging/prod Wrangler environments. Staging explicitly enables
  `workers.dev` and has no `app.musuw.com` route; production retains the
  eventual route but is not deployed by the workflow.
- Add a manual/PR-gated staging workflow that builds the two existing UIs,
  runs Worker tests/type checks, and performs a Wrangler dry-run. Only an
  explicit workflow input may publish the staging Worker.
- Keep PR builds on public placeholders, while canonical manual staging
  deploys load the exact four-key staging auth public environment from the
  dedicated `MUSUW_AUTH_STAGING_PUBLIC_ENV` repository secret (production
  keeps `MUSUW_AUTH_PUBLIC_ENV` separate), rebuild auth, and fail closed if
  placeholders remain in the staged bundle.
- Record acceptance, external prerequisites, and rollback steps in this
  change. No Cloudflare, DNS, Supabase, origin, or server mutation is part of
  this local implementation.

## Non-Goals

- Replacing the current `musuw-site` storefront Worker.
- Changing WeKnora API, auth, OIDC, upload, SSE, embed, session, cookie, or
  data behavior.
- Moving credentials, databases, file volumes, model providers, or Supabase
  runtime ownership to Cloudflare.
- Pointing the existing `app.musuw.com` CNAME/Tunnel at this Worker before a
  separately approved origin-protection and end-to-end rehearsal.

## Impact

The new `app-edge/` package and its independent workflow are additive. The
server continues to run the same application on port 8080 behind the existing
Tunnel. Operators will need a protected origin hostname, a Cloudflare Access
service identity (when Access is used), staging OIDC redirect/cookie settings,
and a reviewed cutover/rollback window before production activation.
