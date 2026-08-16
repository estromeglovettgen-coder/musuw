## Local implementation

- [x] Add isolated `app-edge/` Worker source with static and transparent
  proxy routing.
- [x] Stage frontend/auth build output without tracking generated `public/`.
- [x] Add staging/prod Wrangler environments; keep production route dormant.
- [x] Add unit/security/streaming tests and configuration contract checks.
- [x] Add independent staging workflow with dry-run gate and explicit deploy
  input; no automatic production job.
- [x] Require canonical staging dispatches to prove a successful `CI` run for
  the exact requested full SHA before exposing Cloudflare credentials.
- [x] Require an exact build-time auth public origin for production, staging,
  and local callback trust, with strict four-key environment parsing.
- [x] Document route audit, acceptance matrix, rollback, and external steps.

## Fresh local evidence (2026-08-15)

- `npm --prefix app-edge test` — 14 Worker routing/streaming/security tests
  passed.
- `npm --prefix app-edge run assets:stage` — failed closed unless real
  frontend/auth `dist/index.html` exists and printed non-empty SHA-256/file
  count manifests for both inputs and staged output.
- `npm --prefix app-edge run workflow:check` — verified PR checks never read
  secrets and the secret-bearing job requires manual `workflow_dispatch`,
  `deploy=true`, the canonical repository, `--env staging` only, and a
  same-SHA successful `CI` Actions API gate before Cloudflare credentials.
- Workflow contract additionally requires both checkouts to disable persisted
  credentials, uses a read-only token only for canonical main ancestry fetch,
  and verifies strict `MUSUW_AUTH_STAGING_PUBLIC_ENV` parsing (separate from
  production `MUSUW_AUTH_PUBLIC_ENV`), 0600 temp-file cleanup, auth rebuild,
  and placeholder scan before staging deploy.
- `npm --prefix app-edge run typecheck` — generated Wrangler runtime types and
  TypeScript check passed.
- `npm --prefix app-edge run dry-run` — staged 255 static files and
  `wrangler deploy --env staging --dry-run` exited successfully without an
  account mutation.
- `ruby scripts/ci/validate-workflows.rb` — storefront `workflow_run` ordering,
  dispatch CI recheck, staging same-SHA CI gate, minimal permissions, and the
  existing production/rollback contracts all passed; no workflow invokes
  production.

## External/staging gates (unchecked by design)

- [ ] Build and push the clean staging source baseline; verify the source
  manifest includes `app-edge/` and the new workflow.
- [ ] Configure the staging Worker/account token, `origin-app` protection, and
  paired Access secrets outside Git.
- [ ] Publish `--env staging` to workers.dev and run the full acceptance matrix
  against a fixed server revision.
- [ ] Rehearse staging version rollback and retain probes/manifests.
- [ ] Add staging/production OIDC redirect and cookie settings at the identity
  provider and server.
- [ ] Obtain explicit cutover approval, then separately activate the dormant
  `app.musuw.com/*` production route; retain a previous Worker and server
  rollback target.
