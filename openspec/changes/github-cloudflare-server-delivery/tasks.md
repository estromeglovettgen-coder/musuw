## 1. Establish the active-source repository

- [x] 1.1 Confirm `estromeglovettgen-coder/musuw` is private, writable by the
  release identity, and uses `main` as the reviewed release branch; record the
  repository/branch decision.
- [x] 1.2 Inventory the current working tree and publish an allowlisted active
  source manifest covering `weknora/`, `auth/`, `storefront/`, `integration/`,
  `scripts/`, tests, docs, licenses, and provenance records.
- [x] 1.3 Migrate a clean baseline to `musuw` with no credentials, private
  keys, `.env` values, dependency directories, generated output, runtime
  volumes, dumps, logs, unrelated historical copies, or unapproved binaries.
- [x] 1.4 Preserve upstream license notices, Musuw/WeKnora source provenance,
  lockfiles, safe configuration examples, and the baseline commit identity.
- [x] 1.5 Add a tracked-file/archive boundary check and a source manifest check
  that fail closed when a new excluded path or unexpected binary appears.

## 2. Add one pull-request and release CI authority

- [x] 2.1 Create root GitHub Actions workflows and disable, relocate, or scope
  nested upstream workflows so none can publish a Musuw Worker, image, or
  server release.
- [x] 2.2 Add frontend, auth-shell, and storefront dependency-locked tests,
  type checks, and production builds with changed-path coverage.
- [x] 2.3 Add Go backend/document-reader tests and the existing integration or
  conformance checks required by the active source manifest.
- [x] 2.4 Add Compose/static-topology rendering, source-provenance, license,
  secret-sentinel, and release-archive checks to the required CI set.
- [ ] 2.5 Configure required-check/merge policy for the available GitHub plan;
  document the private-Free approval/branch-protection limitation and the
  compensating manual review controls where enforcement is unavailable.
- [ ] 2.6 Define annotated `vMAJOR.MINOR.PATCH` release tags, reject moved or
  unannotated tags, and generate a candidate manifest from the full commit SHA.
- [ ] 2.7 Verify a no-op pull request, a synthetic failing check, and a mutable
  ref all produce the intended block before any target deploy job starts.
- [x] 2.8 Make automatic storefront delivery listen for completed successful
  `CI` `workflow_run` events on `main`, select only `workflow_run.head_sha`,
  and retain a manual full-SHA dispatch with an exact-SHA Actions API gate.

## 3. Connect the existing storefront to Cloudflare

- [x] 3.1 Confirm the Cloudflare account/zone and configure a Worker-scoped
  API token for the existing `musuw-site` project; keep the token out of
  source and logs.
- [x] 3.2 Add a GitHub workflow that builds `storefront/` from the verified
  commit/lockfile and deploys only that package to `musuw-site` after required
  checks succeed; disallow local-only deployment as the production path.
- [x] 3.3 Add post-deploy probes for `musuw.com` and `www.musuw.com`, static
  entry, expected `app.musuw.com/auth/start` handoff, and locale behavior.
- [x] 3.4 Record the Worker version, source SHA, probes, artifact, and previous
  version in the release evidence; document and test explicit previous-version
  rollback.
- [ ] 3.5 Add an artifact allowlist test proving app/auth/backend source and
  product API/payment/auth secrets cannot enter the storefront Worker bundle.

## 4. Replace the one-shot handoff with a per-SHA Compose transaction

- [x] 4.1 Define the server release archive and checksum manifest for the
  selected SHA, reusing the current active-source allowlist and excluding
  server runtime state.
- [x] 4.2 Keep the restricted server-side deploy command/adapter with strict
  `known_hosts`, safe release IDs, only the fixed `preflight`/`promote`/`run`
  verbs, no arbitrary shell, and no dirty-checkout or branch-based deployment.
- [ ] 4.3 Keep the manual production dispatch immutable-ref-only and invoke the
  restricted server seam through fixed `preflight`, `promote`, and `run`
  operations. Expose no runtime-role or partial-release input; reject any such
  extra grammar, mutable ref, or missing successful CI run before exposing
  server credentials.
- [ ] 4.4 Render a fresh per-SHA Compose transaction with a derived project,
  source/config digest, immutable image digests, runtime snapshot references,
  and ordered internal phase/role records; historical M35 one-shot handoff
  files are not an authority.
- [ ] 4.5 Implement one exclusive full-transaction lock covering snapshot
  through commit or rollback. Reject or queue a second `run`; do not expose
  role-specific transactions or a role lock matrix to callers.
- [ ] 4.6 Make `run` internally orchestrate `prepare` → `web` → `worker`: stage
  web privately; run app/static/auth, OIDC, migration, image/source, port, and
  topology gates before edge mutation; then verify worker/queue health and
  background handoff before commit.
- [ ] 4.7 Snapshot and restore the complete predecessor unit—source,
  rendered config/public env checksums, image digests, background ownership,
  current pointer, and edge alias—on every failed phase; preserve volumes,
  secrets, and forward-applied migrations.
- [ ] 4.8 Enforce forward-only additive migrations and record compatibility and
  forward-repair notes; run the one-time native live-ledger normalization with
  dry-run, backup/restore, maintenance-lock, idempotence, and before/after
  evidence before the first production transaction.
- [ ] 4.9 Keep the 12 GiB (`12,582,912` KiB) capacity floor. Permit one logged
  unused-Docker-cache/dangling-image cleanup and re-check, but never delete
  named volumes, secrets, current/predecessor releases, or user data.
- [ ] 4.10 Run two successive distinct-SHA transactions through complete
  fixed-protocol `preflight`/`promote`/`run` with internal
  `prepare`/`web`/`worker` phases, independent manifests, predecessor links,
  public health, and phase/config/image/migration/capacity evidence.
- [x] 4.11 Verify server-owned runtime secrets, databases, object storage,
  Redis/Neo4j volumes, and tunnel credentials are never transferred, printed,
  overwritten, or deleted by the workflow.

## 5. Add provenance, security, and retention controls

- [ ] 5.1 Generate one machine-readable manifest schema for both targets with
  repository, SHA/tag, source/provenance version, lockfile/artifact hashes,
  workflow run, target/version, health result, rollback predecessor, and for
  server transactions ordered internal-phase/config/image/background/migration/
  capacity fields.
- [x] 5.2 Store only the Worker token in the Cloudflare job and only the
  restricted SSH key/host pin in the server job; mask values and assert that
  cross-target and runtime secrets are unavailable.
- [ ] 5.3 Retain manifests, health evidence, deploy logs, release tags, and
  rollback events with the GitHub release and target release directory for a
  bounded documented period.
- [ ] 5.4 Add an audit check that every active Worker/server version resolves to
  one reviewed Git SHA and that a rollback creates a linked audit event.

## 6. Rehearse, roll out, and hand off

- [ ] 6.1 Run CI against the migrated baseline and a controlled UI-only change;
  verify all required checks and no target mutation on failure.
- [ ] 6.2 Deploy the baseline storefront commit, verify both custom domains and
  locale/handoff probes, then rehearse and record Cloudflare rollback.
- [ ] 6.3 Dispatch a baseline server SHA through the fixed
  `preflight`/`promote`/`run` protocol, observe the internal
  `prepare` → `web` → `worker` health contract, and rehearse full source/config/
  image/background/edge rollback without changing production data.
- [ ] 6.4 Execute two reviewed production-like SHAs through the new transaction
  protocol, observe both public health windows, and retain both predecessors
  until acceptance is signed off. No production tag exists yet.
- [x] 6.5 Publish the developer/release runbook covering branch→PR→merge→tag,
  Cloudflare auto-deploy, immutable-ref-only server dispatch, fixed SSH verbs,
  internally orchestrated Compose phases, capacity/ledger gates, health gates,
  full rollback, secret ownership, and the no-local-dirty-deploy rule.
- [ ] 6.6 Attach fresh acceptance evidence, record residual Free-plan,
  capacity, predecessor-capture, forward-migration, and ledger risks, and open
  the separate Phase 2 app/auth Worker change only after this delivery chain is
  stable.

## Verification evidence (2026-08-16)

Only tasks with implementation or external evidence are marked `[x]`. The
dynamic server transaction, its live rollback rehearsal, and production
readiness remain unchecked until the new protocol—not the historical M35
handoff—is observed end to end.

### Current B GitHub and Cloudflare evidence

- **1.1–1.5** — The private canonical repository is
  `estromeglovettgen-coder/musuw`; the clean B baseline is
  `2d9091b98b90cb0e4ce6bde081027a0f61af7949` on `main`, with the active-source
  manifest, provenance records, lockfiles, and boundary scans present.
- **2.1–2.4, 2.8** — CI run
  [`31933653091`](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31933653091)
  completed successfully. Workflow contracts, Go, DocReader, release/
  provenance/secret contracts, frontend, auth, and storefront jobs all passed;
  storefront delivery is ordered after the completed CI run and checks the
  exact `workflow_run.head_sha`.
- **3.1–3.4** — Deploy storefront run
  [`31933748281`](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31933748281)
  attempt 2 completed successfully for B. Worker version
  `20d7ad96-2a01-4437-93d7-3ba7d0995d14` serves 100% traffic; artifact
  `9260177059` retains the deployment evidence.

### Server production NO-GO blockers

- **4.3–4.10, 6.3–6.4, 6.6** — No annotated production tag or production server
  workflow run exists. The fixed-protocol dynamic Compose transaction, internal
  `prepare` → `web` → `worker` orchestration, exclusive full-transaction lock,
  full predecessor snapshot/restore, one-time native live-ledger normalization,
  and two-successive-release evidence are not observed.
- The server reports approximately `8,939,456` KiB free versus the fixed
  `12,582,912` KiB (12 GiB) floor. One bounded unused-Docker cleanup may be
  attempted by the future `prepare` phase; the floor must not be lowered.
- The current cutover state lacks the old M35 predecessor ID, native
  containers/state are not deterministically repeatable, and a new-SHA release
  has no proven old-image capture or full source/config/image/background/edge
  rollback. These are fail-closed blockers, not reasons to guess a predecessor.
- The earlier static/M35-era rollback simulations are retained as historical
  local evidence only; tasks **4.6–4.7** and **6.3–6.4** remain unchecked until
  the dynamic protocol passes fresh tests and a live rehearsal.

### Remaining follow-ups

- **2.5–2.7** — GitHub Free branch/approval enforcement, moved-tag rejection,
  no-op PR, and synthetic failure/mutable-ref rehearsals still need observable
  repository evidence.
- **3.5, 5.1, 5.3–5.4** — Cross-target bundle allowlist, final manifest schema,
  bounded retention chain, and linked rollback audit check need implementation
  and evidence.
- **6.1–6.2** — A controlled UI-only change and an explicit storefront rollback
  rehearsal are not yet recorded; the successful B storefront deploy does not
  imply rollback evidence.

### Verification status

- **PASS:** B hosted CI and storefront follow-up listed above; local workflow,
  source-manifest, secret-boundary, and restricted SSH contract checks that
  feed those jobs.
- **BLOCKED/NO-GO:** production server dispatch, fixed-protocol dynamic
  transaction with internal role orchestration, predecessor capture, native
  ledger normalization, two-successive release evidence, and live rollback
  because of the blockers above.
- **NOT YET AFFECTED:** `cloudflare-product-edge` remains a separate staging
  change; no production app-edge route or origin cutover is claimed here.
