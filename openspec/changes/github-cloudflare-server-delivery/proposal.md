## Why

The active Musuw source is currently coupled to a local checkout and a remote
repository named `knowledge`, while production delivery is split between an
existing Cloudflare Worker and a server-side staged release process. That makes
the source of truth, release identity, rollback point, and secret boundary hard
to see and easy to bypass. A private `estromeglovettgen-coder/musuw` monorepo
with a single CI/release path gives future changes one auditable home and makes
the normal path—merge, verify, publish, health-check—repeatable.

## What Changes

- Establish `estromeglovettgen-coder/musuw` as the private, clean active-source
  monorepo and migrate the current application, auth shell, storefront, runtime
  composition, release scripts, tests, licenses, and provenance records into
  it.
- Exclude credentials, runtime state, generated dependencies/build output,
  local volumes, binaries, and unrelated historical copies from the tracked
  baseline; keep examples and source-license notices.
- Add pull-request CI that checks the frontend, auth shell, storefront,
  backend/docreader, composition, secret boundary, and source provenance before
  a change can merge.
- Connect the existing `musuw-site` Cloudflare Worker to GitHub automation so
  the storefront is built and deployed from an exact verified commit. The
  Worker remains limited to `musuw.com` and `www.musuw.com` static marketing
  routes and hands product actions to `app.musuw.com`.
- Add an explicit production server workflow that accepts only an immutable ref,
  resolves it to an exact Git SHA, and invokes only the fixed restricted
  `preflight`/`promote`/`run` protocol. The
  per-SHA Compose transaction internally orchestrates `prepare` → `web` →
  `worker`; callers cannot select a runtime role or a partial release. The
  transaction is staged, health-gated, serialized, and reversible across
  source/configuration, images, background workers, and the public edge. It
  uses a workflow dispatch trigger and one transaction lock until repository/
  environment approvals are available.
- Require forward-only additive migrations and a separately evidenced,
  one-time native live-ledger normalization before the first production
  transaction. A release is not production-ready until two successive release
  transactions produce complete provenance and health evidence.
- Keep runtime secrets, database/data volumes, and server-owned configuration
  on the server; keep Cloudflare credentials scoped to the Worker; never put
  either class of secret in GitHub source or release artifacts.
- Record release tags, source SHA, artifact checksums, test/build evidence,
  deployment target, and health/rollback events so every running version can be
  traced back to a reviewed commit.
- Keep `app` and `auth` on the existing same-origin server release in this
  change. A separate Cloudflare Worker migration for those surfaces is a
  follow-up, not an implicit part of this rollout.

## Capabilities

### New Capabilities

- `github-source-of-truth`: Private active-source baseline, PR gates, release
  identity, and repository hygiene for the Musuw monorepo.
- `cloudflare-storefront-delivery`: Verified GitHub-to-Cloudflare delivery and
  rollback for the existing `musuw-site` storefront Worker.
- `server-release-delivery`: SHA-pinned, staged, health-gated, reversible
  delivery of the authenticated app/auth/backend stack to the existing server.
- `release-provenance-secrets`: Release manifests, audit evidence, secret
  ownership, and artifact/source boundary guarantees shared by both targets.

### Modified Capabilities

<!-- No existing OpenSpec capability is present; all requirements are new. -->

## Impact

- GitHub: private repository ownership, branch/PR workflow, Actions workflows,
  tags/releases, scoped Actions secrets, and artifact retention.
- Source tree: root CI/release metadata, active-source allowlists, provenance
  and license records, and deployment runbooks; application behavior is not
  changed by this proposal.
- Cloudflare: the existing `musuw-site` Worker and its custom-domain routes;
  no new account, payment, auth, or product API is introduced.
- Server: the existing `/opt/weknora`/production release directories,
  server-owned secrets, Docker volumes, fixed SSH deploy seam, dynamic per-SHA
  Compose transaction, single transaction lock, internal runtime-role
  orchestration, staged verification, edge cutover, and full rollback evidence.
- Operators: production server publishing becomes an explicit SHA-selected
  workflow rather than a local dirty-tree command; storefront publishing is
  automated only after CI succeeds.
