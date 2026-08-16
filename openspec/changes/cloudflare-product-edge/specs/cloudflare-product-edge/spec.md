## ADDED Requirements

### Requirement: Edge static assets remain build-owned

The `musuw-app` Worker SHALL serve the existing workspace build at the asset
root and the existing auth build below `/auth/`, without changing application
source behavior or tracking generated output.

#### Scenario: Product navigation misses a concrete asset

- **WHEN** a GET/HEAD navigation path has no matching product asset
- **THEN** the Worker serves the staged workspace `index.html` with
  `Cache-Control: no-cache, must-revalidate` and same-origin security headers

#### Scenario: Auth navigation misses a concrete asset

- **WHEN** a GET/HEAD request targets `/auth/start`, `/auth/callback`,
  `/auth/logout`, `/oauth/consent`, or another auth-shell path
- **THEN** the Worker serves `auth/index.html` with the same no-cache policy
  and does not return the product shell

#### Scenario: Hashed asset is requested

- **WHEN** a product or auth asset under `/assets/` or `/auth/assets/` is
  requested
- **THEN** the Worker serves it with `public, max-age=31536000, immutable`

### Requirement: Stateful routes are transparent origin proxies

The Worker SHALL proxy `/api/*`, exact `/files`, `/r/*`, and exact `/health` to
the fixed HTTPS `origin-app.musuw.com` protected origin without reading,
buffering, retrying, parsing, or caching the request or response body. Client
Cloudflare Access headers SHALL never be forwarded; optional Access headers
come only from paired Worker secrets. Client-supplied client-IP forwarding
headers SHALL be removed; `X-Real-IP` and `X-Forwarded-For` may be rebuilt only
when the Cloudflare runtime marker and platform `CF-Connecting-IP` are present.

#### Scenario: SSE response is streamed

- **WHEN** the origin returns an `text/event-stream` response for an API
  request
- **THEN** the Worker returns the original response stream, status, and
  headers without waiting for the stream to finish or buffering its body

#### Scenario: Multipart upload is forwarded

- **WHEN** a client sends a multipart or other large body to a proxied route
- **THEN** the Worker forwards the original method, content headers, and body
  stream to the origin without calling a body-reading API

#### Scenario: Session cookie is set by the origin

- **WHEN** the origin returns one or more `Set-Cookie` headers from an auth or
  API route
- **THEN** the browser receives those headers unchanged and the Worker does
  not expose origin credentials or replace cookie attributes

#### Scenario: WebSocket upgrade is unsupported

- **WHEN** a client sends an `Upgrade: websocket` request to any Worker path
- **THEN** the Worker returns `426` with `Upgrade: websocket` and does not call
  the origin

### Requirement: OIDC remains same-origin

The Worker SHALL leave native OIDC paths and browser-visible auth redirects on
the public hostname, preserving incoming `Cookie`, `Origin`, and query values.

#### Scenario: OIDC URL is requested

- **WHEN** the auth shell calls `/api/v1/auth/oidc/url` on the public hostname
- **THEN** the Worker proxies the same-origin request to the origin without a
  cross-origin redirect or client-side API base URL rewrite

#### Scenario: OIDC callback returns a session cookie

- **WHEN** the provider redirects to `/api/v1/auth/oidc/callback` and the
  origin responds with a session redirect/cookie
- **THEN** the Worker preserves the callback query, redirect, and all
  `Set-Cookie` values

### Requirement: Auth callback trust is a build-time exact origin

The auth shell SHALL require `VITE_AUTH_PUBLIC_ORIGIN` at build time and
trust only that exact supported public origin for native OIDC callbacks. A
production build SHALL use `https://app.musuw.com`; a staging build SHALL use
`https://staging-app.musuw.com`; local development MAY use
`http://localhost:4190` or `http://127.0.0.1:4190`. The shell SHALL NOT
derive callback trust from request Host, redirect values, or browser location.

#### Scenario: Staging callback is accepted

- **WHEN** the staging auth bundle receives a registered callback at
  `https://staging-app.musuw.com/api/v1/auth/oidc/callback`
- **THEN** it preserves the exact callback path, state, code-or-error query,
  port, userinfo, and hash checks and follows only that staging origin

#### Scenario: Production callback is not accepted by staging

- **WHEN** a staging bundle receives a callback at
  `https://app.musuw.com/api/v1/auth/oidc/callback` or an origin from the
  request Host
- **THEN** it rejects the continuation without approving the OAuth request

#### Scenario: Missing or unsafe build origin fails closed

- **WHEN** the origin is missing, empty, duplicated, unknown, non-HTTPS outside
  local development, or uses an unsupported port such as 4090
- **THEN** auth configuration/build fails closed and does not silently fall back
  to a browser-derived origin

### Requirement: Staging cannot mutate production routing

The staging environment SHALL use a distinct Worker name and an explicit
`workers.dev` endpoint with no `app.musuw.com` route. Production SHALL retain
the eventual route in config but SHALL not be invoked by the staging workflow.
The canonical manual staging deploy SHALL accept a full immutable SHA and
query the Actions API for a successful `CI` run whose `head_sha` exactly
matches that SHA before exposing Cloudflare credentials or deploying.

#### Scenario: Staging workflow runs its deploy input

- **WHEN** an operator runs the staging workflow with `deploy=true`
- **THEN** it builds the exact requested SHA and deploys only
  `musuw-app-staging` with `--env staging`

#### Scenario: Production route is not activated accidentally

- **WHEN** pull-request checks or the staging workflow run
- **THEN** they perform tests/dry-run or staging deploy only and never call
  `wrangler deploy --env production` or alter `app.musuw.com`

#### Scenario: Canonical deploy uses real auth public configuration

- **WHEN** the canonical repository runs the manual staging deploy
- **THEN** the workflow reads dedicated repository secret
  `MUSUW_AUTH_STAGING_PUBLIC_ENV` (never production secret
  `MUSUW_AUTH_PUBLIC_ENV`), accepts exactly one assignment for each of the four required `VITE_*` keys
  (ignoring only blank separator lines),
  writes it only to a 0600 runner-temporary file, rebuilds auth, removes the
  file on exit, and rejects staged output containing CI/example placeholders

#### Scenario: Staging dispatch cannot bypass CI for another SHA

- **WHEN** an operator runs the canonical staging workflow with `deploy=true`
  and an immutable SHA that is on `main`
- **THEN** the workflow fails closed unless the Actions API contains a
  successful `CI` run with the exact same `head_sha`, and the Cloudflare token
  is not exposed before that check passes

### Requirement: Edge failure has a reversible recovery path

An edge deployment SHALL retain a previous Worker version and documented
rollback action; an edge rollback SHALL not delete or revert server data.

#### Scenario: Staging smoke check fails

- **WHEN** a staging publish or acceptance probe fails
- **THEN** the operator can roll back `musuw-app-staging` to its captured
  previous version and re-run health/static/auth probes without changing the
  server release or data volumes

#### Scenario: Production cutover probe fails

- **WHEN** an explicitly approved production cutover fails health, OIDC,
  upload, embed, or SSE probes
- **THEN** the operator restores the previous Worker version or removes the
  new route, re-runs probes, and preserves the server's current data and
  rollback state
