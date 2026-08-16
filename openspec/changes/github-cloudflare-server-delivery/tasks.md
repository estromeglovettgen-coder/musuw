## 1. Establish the active-source repository

- [ ] 1.1 Confirm `estromeglovettgen-coder/musuw` is private, writable by the
  release identity, and uses `main` as the reviewed release branch; record the
  repository/branch decision.
- [x] 1.2 Inventory the current working tree and publish an allowlisted active
  source manifest covering `weknora/`, `auth/`, `storefront/`, `integration/`,
  `scripts/`, tests, docs, licenses, and provenance records.
- [ ] 1.3 Migrate a clean baseline to `musuw` with no credentials, private
  keys, `.env` values, dependency directories, generated output, runtime
  volumes, dumps, logs, unrelated historical copies, or unapproved binaries.
- [ ] 1.4 Preserve upstream license notices, Musuw/WeKnora source provenance,
  lockfiles, safe configuration examples, and the baseline commit identity.
- [x] 1.5 Add a tracked-file/archive boundary check and a source manifest check
  that fail closed when a new excluded path or unexpected binary appears.

## 2. Add one pull-request and release CI authority

- [x] 2.1 Create root GitHub Actions workflows and disable, relocate, or scope
  nested upstream workflows so none can publish a Musuw Worker, image, or
  server release.
- [x] 2.2 Add frontend, auth-shell, and storefront dependency-locked tests,
  type checks, and production builds with changed-path coverage.
- [ ] 2.3 Add Go backend/document-reader tests and the existing integration or
  conformance checks required by the active source manifest.
- [ ] 2.4 Add Compose/static-topology rendering, source-provenance, license,
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

- [ ] 3.1 Confirm the Cloudflare account/zone and configure a Worker-scoped
  API token for the existing `musuw-site` project; keep the token out of source
  and logs.
- [ ] 3.2 Add a GitHub workflow that builds `storefront/` from the verified
  commit/lockfile and deploys only that package to `musuw-site` after required
  checks succeed; disallow local-only deployment as the production path.
- [x] 3.3 Add post-deploy probes for `musuw.com` and `www.musuw.com`, static
  entry, expected `app.musuw.com/auth/start` handoff, and locale behavior.
- [ ] 3.4 Record the Worker version, source SHA, probes, and previous version in
  the release manifest; document and test explicit previous-version rollback.
- [ ] 3.5 Add an artifact allowlist test proving app/auth/backend source and
  product API/payment/auth secrets cannot enter the storefront Worker bundle.

## 4. Automate the existing server release seam

- [x] 4.1 Define the server release archive and checksum manifest for the
  selected SHA, reusing the current active-source allowlist and excluding
  server runtime state.
- [x] 4.2 Implement the restricted server-side deploy command/adapter with
  strict `known_hosts`, safe release IDs, allowlisted modes, no arbitrary shell,
  and no dirty-checkout or branch-based deployment.
- [ ] 4.3 Add a manual `workflow_dispatch` accepting the exact SHA/tag and
  target/mode, with one production concurrency lock and visible Free-plan
  approval limitations.
- [x] 4.4 Invoke the existing staged build and loopback `verify-runtime.sh`
  checks for static/auth entry, app health, OIDC S256, migration cleanliness,
  image/source provenance, ports, and topology before cutover.
- [x] 4.5 Invoke the existing serialized cutover lock and retain the old edge
  alias/container/release until post-cutover probes pass.
- [x] 4.6 Exercise the idempotent rollback path for staging failure, alias
  handoff failure, and post-cutover health failure; verify data volumes and
  current secrets remain untouched.
- [x] 4.7 Verify server-owned runtime secrets, databases, object storage,
  Redis/Neo4j volumes, and tunnel credentials are never transferred, printed,
  overwritten, or deleted by the workflow.

## 5. Add provenance, security, and retention controls

- [ ] 5.1 Generate one machine-readable manifest schema for both targets with
  repository, SHA/tag, source/provenance version, lockfile/artifact hashes,
  workflow run, target/version, health result, and rollback predecessor.
- [ ] 5.2 Store only the Worker token in the Cloudflare job and only the
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
- [ ] 6.3 Dispatch the baseline server SHA to a staged/rehearsal target, run the
  complete health contract, and rehearse rollback without changing production
  data or public routing.
- [ ] 6.4 Execute one reviewed production SHA through the manual server
  workflow, observe the post-cutover window, and retain the previous release
  until acceptance is signed off.
- [x] 6.5 Publish the developer/release runbook covering branch→PR→merge→tag,
  Cloudflare auto-deploy, server dispatch, health gates, rollback, secret
  ownership, and the no-local-dirty-deploy rule.
- [ ] 6.6 Attach fresh acceptance evidence, record residual Free-plan and
  forward-migration risks, and open the separate Phase 2 app/auth Worker change
  only after this delivery chain is stable.

## Verification evidence (2026-08-15)

Only tasks with implementation evidence and passing local checks are marked
`[x]`. External repository setup, credentials, target mutations, and live
workflow runs remain `[ ]` until they are actually observed.

### Completed tasks

- **1.2** — `SOURCE_MANIFEST.json` and `SOURCE_MANIFEST.md` now describe the
  reviewed active roots, root control/provenance files, dynamic metadata count
  scope, exclusions, approved archive, and A-stage publication state without
  machine-local paths. The staged index contains 3,069 reviewed paths (3,068
  regular files in the manifest count scope).
- **1.5** — `scripts/ci/tracked-source-scan.mjs` and
  `scripts/ci/source-manifest.mjs` fail closed on excluded paths, unsupported
  modes, symlinks/submodules, unexpected binaries, oversized assets, and
  upstream/provenance drift. Fresh checks passed: 3,069 files and 114 reviewed
  binary assets; upstream floor 2,798 files retained.
- **2.1** — Root `.github/workflows/{ci,deploy-storefront,deploy-production}.yml`
  are present; no nested tracked workflow is present; `ruby
  scripts/ci/validate-workflows.rb` passed (`workflow contract green`).
- **2.2** — The root CI jobs invoke locked frontend/auth/storefront tests,
  type checks, and builds. Fresh local evidence: auth 30 tests/typecheck/build
  passed with CI public placeholders; storefront 38 tests/build passed;
  frontend 382 tests/typecheck/i18n/build passed.
- **3.3** — `deploy-storefront.yml:160-180` probes both custom domains,
  locale metadata, and `https://app.musuw.com/auth/start`; live Cloudflare
  execution remains pending under 6.2.
- **2.8** — `deploy-storefront.yml` now listens for `CI` `workflow_run` /
  `completed` / `main`, guards the canonical repository and successful
  conclusion, checks out `workflow_run.head_sha` without `github.sha`, and
  preserves the manual full-SHA + exact-SHA Actions API gate. The staging
  Worker dispatch applies the same-SHA successful-CI gate before exposing its
  Cloudflare token; local workflow-event/YAML checks passed.
- **4.1** — `scripts/weknora-production/source-manifest.sh` generates a
  SHA-256 allowlisted source manifest and release metadata; the workflow
  simulation and deployment CI seam contract passed.
- **4.2** — `scripts/weknora-deploy.sh` enforces fixed modes, full-SHA
  revisions, pinned `known_hosts`, safe IDs, and restricted SSH/rsync paths;
  `deploy-ci-seams-contract.test.sh` and workflow simulation passed.
- **4.4** — `start-staged.sh` invokes loopback `verify-runtime.sh` before
  cutover; static topology, build/release seam, and update simulations passed.
- **4.5** — `cutover.sh` serializes the edge lock, records the old endpoint,
  and retains it through health-gated handoff; cutover simulation passed.
- **4.6** — Cutover/update simulations exercise staged failure, edge handoff
  failure, post-cutover health failure, repeatable rollback, and state recovery;
  all passed.
- **4.7** — Workflow/update simulations assert source-only transfer, no secret
  path transfer, no volume deletion, and preserved runtime state; static and
  simulation checks passed.
- **6.5** — `docs/DEPLOYMENT.md` documents branch→PR→merge→tag, storefront
  deploy, manual server dispatch, health gates, rollback, secret ownership,
  Free-plan limitations, and the no-dirty-local-deploy rule.

### Remaining tasks and blockers

- **1.1, 1.3, 1.4** — Staging has no commit (`git rev-parse HEAD` fails), no
  remote, and `SOURCE_MANIFEST.json` records `commit: null, pushed: false`;
  private/writable GitHub repository and `main` policy are unconfirmed.
- **2.3** — DocReader suite passed under Python 3.12 (123 tests), but fresh
  `go test ./...` is not green in this environment (restricted DNS fixtures and
  related existing connector/model tests fail); retain unchecked pending a
  clean CI run.
- **2.4** — CI references `tests/architecture/m35-*.test.ts`, but `tests/` is
  absent from staging, so the repository-contracts job cannot pass as written.
- **2.5, 2.6, 2.7** — GitHub branch protection/required checks and mutable-ref
  rehearsal are not observable without a pushed repository; no moved-tag,
  no-op-PR, or synthetic-failure run has been recorded.
- **3.1, 3.2** — Cloudflare account/token are not configured and no GitHub run
  proves live target mutation; the local storefront workflow now explicitly
  depends on completed successful root CI, and manual/staging dispatches
  recheck the exact SHA through the Actions API.
- **3.4, 3.5** — Storefront manifest lacks explicit probe/lockfile/artifact
  fields, and no dedicated Worker bundle allowlist test proves app/auth/backend
  exclusion.
- **4.3** — Production workflow has no target/mode inputs and also exposes a
  `v*` tag-push trigger; manual dispatch/Free-plan controls are not verified in
  GitHub.
- **5.1-5.4** — A single complete cross-target manifest schema, target-scoped
  secret assertions, GitHub-release/server-directory retention chain, and
  reviewed-SHA/rollback audit check are not implemented or observed.
- **6.1-6.4, 6.6** — No pushed baseline/UI PR, Cloudflare deploy/rollback,
  staged server dispatch, production SHA run, or fresh acceptance evidence has
  occurred; Phase 2 remains unopened.

### Fresh local verification

- PASS: workflow contract, source manifest, secret scan, release workflow
  simulation, production static contract, deployment CI seam, image reuse,
  cutover, full update, and UI-only update simulations.
- PASS: auth/storefront/frontend test/type/build suites and DocReader (Python
  3.12).
- BLOCKED: full Go suite due this environment's restricted DNS mapping of
  public fixture hosts to `198.18.0.0/15`, plus dependent existing tests.
- NOT RUN BY DESIGN: GitHub API/settings, first push, Cloudflare mutation,
  SSH/server workflow, production cutover, and live rollback.

### Priority review

- **P1:** no initial commit/remote, CI missing referenced architecture tests,
  no GitHub required-check proof, incomplete release manifests/audit chain, and
  no real Cloudflare/server workflow evidence.
- **P2:** add a negative duplicate-environment-key case to
  `verify-static.sh`/its contract suite (the positive static contract is green).
