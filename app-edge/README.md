# Musuw app edge (staging-first)

`musuw-app` is a deliberately small Workers Static Assets + origin proxy
boundary. It serves the already-built WeKnora workspace and Musuw auth shell
from `weknora/frontend/dist` and `auth/dist`, while the protected
`origin-app.musuw.com` remains the owner of API, files, resource, health,
authentication, cookies, sessions, databases, and model credentials.

The Worker never reads, buffers, rewrites, caches, or logs a proxied request or
response body. `/api/*`, `/files`, `/r/*`, and `/health` are sent to the fixed
HTTPS origin `origin-app.musuw.com` with the incoming method, query, Cookie,
content headers, and body stream.
The upstream `Response` is returned directly so status, streaming bodies,
`Set-Cookie`, redirects, and OIDC headers remain same-origin to the browser.
WebSocket upgrades are rejected with `426`; the supported realtime contract is
HTTP streaming/SSE only.

## Local checks

From this directory, after the frontend and auth builds have produced their
`dist` directories:

```sh
npm ci
npm run assets:stage
npm test
npm run typecheck
npm run dry-run
```

`assets:stage` is intentionally build output, not source. `public/` is ignored
and is regenerated in CI and before every deploy. It fails if either real dist
is empty and prints a SHA-256/file-count manifest for frontend, auth, and the
staged output.

## Staging then production

The `staging` environment is the only environment used by the included
workflow. It explicitly enables a `workers.dev` endpoint and has no route for
`app.musuw.com`. The production environment retains the eventual
`app.musuw.com/*` route for a separately approved cutover, but no workflow
automatically deploys it.

Before staging traffic is useful, an operator must provision the protected
origin hostname and, when Cloudflare Access protects it, set the paired
`ORIGIN_ACCESS_CLIENT_ID` and `ORIGIN_ACCESS_CLIENT_SECRET` Worker secrets.
Those values are never committed. The canonical staging deploy also requires
the dedicated repository secret `MUSUW_AUTH_STAGING_PUBLIC_ENV`, containing exactly the four
`VITE_AUTH_PUBLIC_ORIGIN`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_WEKNORA_OAUTH_CLIENT_ID`
assignments. Staging must set `VITE_AUTH_PUBLIC_ORIGIN=https://staging-app.musuw.com`.
The workflow writes that staging-only secret
only to a `RUNNER_TEMP` file (0600), rebuilds auth, scans the staged bundle for
CI/example placeholders, and removes the file on exit. The origin must also recognize the staging
public hostname in its OIDC redirect allowlist and cookie policy. Do not point
the existing `app.musuw.com` CNAME/Tunnel at this Worker until origin
protection, OIDC, upload, embed, SSE, and rollback checks have passed.
