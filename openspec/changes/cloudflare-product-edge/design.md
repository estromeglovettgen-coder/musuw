## Context and first-principles boundary

The value of this change is delivery and latency for browser-owned bytes, not
a second application runtime. The minimum sufficient split therefore has two
parts:

1. immutable public build output is served at the edge; and
2. every stateful or user-authorized operation remains a transparent request
   to the existing server origin.

The Worker does not implement auth, API routing, upload handling, SSE parsing,
OIDC exchanges, caching, retries, or data access. This keeps the rollback unit
small: remove the new route or roll back the Worker version while the server
and data volumes continue unchanged.

## Existing Nginx contract audit

The production and candidate templates
(`integration/weknora-production/nginx.conf.template` and
`integration/weknora-candidate/nginx.conf.template`) establish this route
contract:

| Request | Existing behavior | Worker behavior |
| --- | --- | --- |
| `/`, `/workspace`, other SPA navigation | `try_files ... /index.html`; HTML no-cache | asset lookup then `/index.html` fallback; no-cache HTML |
| `/assets/*` | frontend assets; one-year immutable cache | direct assets; `public, max-age=31536000, immutable` |
| `/auth`, `/auth/start`, `/auth/callback`, `/auth/logout`, `/oauth/consent`, `/auth/*` | static `auth/index.html`; no-cache | auth shell fallback under `/auth/index.html`; same cache policy |
| `/auth/assets/*` | auth assets; one-year immutable cache | direct assets; one-year immutable cache |
| `/embed.html`, `/embed/*` | embed shell; no `X-Frame-Options` | embed shell fallback; frameable, no-cache |
| `/weknora-widget.js` | static widget; one-hour cache | direct asset; one-hour cache |
| exact `/files` | proxy to `${APP_SCHEME}://${APP_HOST}:${APP_PORT}/files` | proxy to origin with path/query/method/body unchanged |
| `^~ /r/*` | proxy to app; resource short links | proxy to origin with path/query/method/body unchanged |
| `/api/*` | HTTP/1.1, `Connection ""`, buffering/cache off, 3600s timeouts | direct `fetch` proxy; no body read/buffer, preserving SSE and uploads |
| exact `/health` | proxy to app health | proxy to origin; no edge-generated health claim |

The auth shell performs native OIDC calls at same-origin
`/api/v1/auth/oidc/url` and `/api/v1/auth/oidc/callback`; the Worker therefore
must not rewrite those paths or strip `Cookie`/`Set-Cookie`. The browser's
staging hostname must be added to the provider callback allowlist and the
origin's cookie policy before testing a real login.

## Worker routing and streaming

`assets.run_worker_first` is enabled so the Worker can assign the Nginx cache
and security-header policy before delegating to the static asset binding.
`assets.not_found_handling` stays `none`; the Worker explicitly chooses the
product/auth/embed fallback shell so an auth route never accidentally receives
the product shell.

For a proxy request the Worker constructs the origin URL from the fixed HTTPS
`origin-app.musuw.com` binding, preserves the public path and query, copies all
incoming headers (including `Cookie`, content headers, and `Origin`), and
replaces only the client-spoofable forwarding headers with the public
host/protocol. `CF-Connecting-IP`, `True-Client-IP`, `X-Real-IP`, and
`X-Forwarded-For` are removed from every request; only a request carrying the
Cloudflare runtime `request.cf` marker and a non-empty platform
`CF-Connecting-IP` gets new `X-Real-IP`/`X-Forwarded-For` values. Client-supplied
Cloudflare Access headers are removed; optional paired values are read only
from Worker secrets.
WebSocket upgrades are rejected with `426` because this boundary supports HTTP
streaming/SSE, not WebSocket tunneling. For supported requests it returns the
`fetch()` result directly. No `text()`, `json()`, `arrayBuffer()`, `tee()`,
retry, cache, or SSE parser runs on the body. Origin `Set-Cookie`, `Location`,
and CSP headers therefore remain untouched. Origin redirects are fetched with
`redirect: "manual"` so the browser, not the Worker, follows a public
same-origin `Location`.

The static route mutates headers only after the asset binding responds. If an
asset carries `Content-Encoding`, the response is rebuilt with Workers'
`encodeBody: "manual"` behavior so changing cache/security headers does not
double-encode it.

## Environments and safety

- `staging` is `musuw-app-staging`, `workers_dev: true`, and has no custom
  route. The included workflow deploys only `--env staging` and only when a
  manual `deploy=true` input is supplied.
- `production` is `musuw-app` with the eventual `app.musuw.com/*` route in
  config. No current workflow invokes `--env production`; a separate approved
  cutover must add the route/DNS decision and run the full acceptance matrix.
- `ORIGIN_APP_URL` is a checked-in non-secret hostname. If the origin is
  Cloudflare Access-protected, `ORIGIN_ACCESS_CLIENT_ID` and
  `ORIGIN_ACCESS_CLIENT_SECRET` are Worker secrets set outside Git. A partial
  pair fails closed.
- PR verification builds auth with public CI placeholders but never has
  deployment secrets. The canonical manual staging deploy reads the dedicated
  repository secret `MUSUW_AUTH_STAGING_PUBLIC_ENV`, while production retains
  `MUSUW_AUTH_PUBLIC_ENV`; each strictly accepts exactly the four required
  `VITE_*` assignments (including the exact `VITE_AUTH_PUBLIC_ORIGIN`), writes
  them to a 0600 `RUNNER_TEMP` file, rebuilds auth, scans the staged bundle for
  `ci-placeholder`/`example.supabase`, and removes the file with an exit trap.
  The secrets are never committed or written to the repository.
- The staging dispatch also validates that its full `immutable_ref` is on
  `main` and that the Actions API reports a successful `CI` run with the same
  `head_sha` before the deploy job reaches any Cloudflare credential-bearing
  step. This is a manual gate; staging does not subscribe to storefront's
  automatic `workflow_run` path.

## Acceptance and rollback

Staging acceptance must prove, with the same origin release held constant:

1. product root and a client-side route return the workspace shell and
   no-cache headers;
2. auth routes return the auth shell and same-origin OIDC URL/callback traffic
   retains cookies and redirects;
3. hashed product/auth assets are immutable and embed routes remain frameable;
4. `/health`, `/files`, `/r/*`, a multipart upload, and an SSE API request
   reach the origin with path/query/method/body/headers unchanged;
5. an origin `Set-Cookie`, `Location`, and CSP response reaches the browser
   unchanged (including multiple cookies); and
6. a WebSocket upgrade is rejected without contacting the origin;
7. malformed origin configuration and origin connection failure return a
   generic 5xx without disclosing secrets or internal text.

If a staging deploy or smoke check fails, first use `wrangler rollback` for
`musuw-app-staging` to the captured previous version, then disable/remove the
staging route only if needed. Production rollback is a route/version action:
restore the previous Worker version or remove the new `app.musuw.com/*` route,
then re-run `/health`, `/auth/start`, an OIDC callback rehearsal, upload, and
SSE probes. Never roll back database volumes or server application code as a
consequence of an edge-only failure. Preserve the Worker version ID, origin
release SHA, probe output, and rollback event for the release record.

## External steps before production

These are intentionally not executed by this change:

- create/verify the protected `origin-app.musuw.com` DNS/Access/Tunnel path;
- provision staging and production Worker-scoped Cloudflare credentials;
- set paired origin Access service-token secrets in the Worker secret store;
- allow staging and eventual production OIDC redirect URIs and align cookie
  Domain/SameSite/Secure policy with the public hostname;
- deploy the Worker to staging `workers.dev`, run the acceptance matrix against
  a known server revision, capture rollback evidence, and obtain approval;
- schedule the production route/CNAME cutover without changing the existing
  `app.musuw.com` CNAME/Tunnel until all checks pass.
- provision `MUSUW_AUTH_STAGING_PUBLIC_ENV` and `MUSUW_AUTH_PUBLIC_ENV` as
  separate repository secrets, each with exactly the four auth public Vite
  keys before an approved deploy; set
  `VITE_AUTH_PUBLIC_ORIGIN=https://staging-app.musuw.com` in the staging secret
  and `https://app.musuw.com` in the production secret. Keep the staging OAuth
  client ID independent from production.
