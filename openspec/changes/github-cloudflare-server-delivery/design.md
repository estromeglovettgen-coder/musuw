## Context

The working tree is a Musuw product composition rather than a single upstream
checkout. The active product source is split into `weknora/` (Go API, document
processing, workspace UI, and product runtime), `auth/` (the Google/email-OTP
entry shell), `storefront/` (the public `musuw-site` Worker),
`integration/` (runtime composition), and `scripts/` (local, release, and
verification entry points). The current Git remote is named `knowledge`, while
the desired product repository is the private
`estromeglovettgen-coder/musuw` repository.

There are already two different production boundaries:

1. `storefront/wrangler.jsonc` owns the static `musuw-site` Worker for
   `musuw.com` and `www.musuw.com`.
2. The authenticated app/auth/backend stack is served from the existing server
   through a Docker release, loopback staging ports, an explicit edge cutover,
   and an idempotent rollback seam under `scripts/weknora-production/`.

The delivery design must preserve those boundaries. It must not turn the
storefront Worker into an account, payment, or product API, and it must not
move server-owned databases, volumes, or credentials into GitHub.

## Goals / Non-Goals

**Goals:**

- Make the private `estromeglovettgen-coder/musuw` monorepo the only source of
  truth for the clean active source and release metadata.
- Make every merge auditable through deterministic PR checks and make every
  production artifact addressable by an immutable commit SHA and release tag.
- Automatically deploy the existing storefront Worker from the verified
  GitHub source after the agreed CI gate, with an observable health check and a
  documented previous-version rollback.
- Deliver app/auth/backend releases to the existing server from a selected SHA
  through a restricted workflow seam, staged health checks, a serialized edge
  cutover, and the existing rollback procedure.
- Keep runtime secrets server-owned and scoped Cloudflare credentials in the
  GitHub environment; prevent secrets, generated output, binaries, and local
  state from entering the source repository or artifacts.
- Preserve upstream licenses and Musuw/WeKnora source provenance records.

**Non-Goals:**

- Migrating the authenticated app or auth shell to a Cloudflare Worker. That is
  a separate Phase 2 change with its own runtime, OIDC, SSRF, and rollback
  review.
- Changing product behavior, authentication contracts, knowledge-base logic,
  billing, data schemas, or graph behavior.
- Replacing the existing server cutover/rollback seam, Docker topology, or
  server-owned data volumes.
- Giving CI a general-purpose remote shell, copying `.env`/secret files, or
  making local dirty-tree deployment an accepted release path.
- Automatically running destructive migrations or deleting the previous
  release as part of a normal publish.

## Decisions

### 1. GitHub private monorepo is the authority

The implementation SHALL create/use the private
`estromeglovettgen-coder/musuw` repository and migrate a clean active-source
baseline. The baseline keeps source, lockfiles, deployment scripts, test
fixtures that are intentionally part of the product, documentation, license
notices, and provenance records. It excludes `.env` values, credentials and
keys, `node_modules`, generated `dist`/build output, runtime directories,
database/object-store dumps, local logs, and generated/binary artifacts.

The root workflow is the only supported product CI entry point. Existing
vendored upstream workflow files must be disabled, relocated, or otherwise
prevented from creating duplicate product releases; their upstream provenance
is retained as documentation rather than becoming a second delivery authority.

### 2. Pull request gates and release identity

Every pull request and every push to the release branch runs the same checks:

- frontend, auth, and storefront tests plus production builds;
- Go/backend and document-reader tests appropriate to the changed paths;
- Compose/static topology rendering and existing source/provenance checks;
- secret and tracked-file boundary scans; and
- a release-manifest dry run that records the candidate commit SHA.

Merges are permitted only after the checks succeed. A product release is an
annotated `vMAJOR.MINOR.PATCH` tag pointing at a reviewed commit; the workflow
also records the full SHA because a tag name alone can be moved. The first
server workflow remains `workflow_dispatch` with an explicit SHA/tag input and
one concurrency group. GitHub Free private-repository environments cannot be
assumed to enforce an approval gate, so that limitation is documented and
compensated with required CI, an immutable SHA input, an operator runbook, and
the existing serialized cutover/rollback checks.

### 3. Cloudflare storefront delivery

The existing `storefront/` package is built with its lockfile and deployed by a
GitHub Actions workflow using the existing `storefront/wrangler.jsonc` project
name `musuw-site`. The automatic production trigger is a `workflow_run` for the
`CI` workflow after it completes on `main`; the workflow guards the canonical
repository and `success` conclusion before selecting `workflow_run.head_sha`.
A manual dispatch remains available for a full SHA and independently queries
the Actions API for a successful `CI` run with that exact SHA. No
workstation `wrangler deploy` is part of the supported path. This explicit
completion edge means an initial push into an empty repository runs CI before
the storefront follow-up can mutate Cloudflare.

The Cloudflare credential is a Worker-scoped API token stored in the GitHub
environment. The workflow does not receive server runtime secrets, Supabase
service keys, model keys, Paddle secrets, or an SSH key. The Worker smoke test
checks both custom domains, the static entry, expected product handoff, and a
locale signal without exercising account or payment operations. The previous
Worker version remains available for an explicit rollback.

### 4. Server delivery from an exact SHA

The server workflow packages only the active source and approved release
configuration from the selected Git SHA, computes a checksum manifest, and
transfers it to a new immutable release directory. It invokes a restricted
server-side command that accepts the release identity and an allowlisted mode;
it cannot execute arbitrary commands or replace `/opt/.../secrets`, database
volumes, or the current symlink directly.

The existing sequence remains authoritative:

1. validate the SHA, manifest, known-host fingerprint, release ID, capacity,
   and source allowlist;
2. build the staged app/frontend/auth images and static assets;
3. run loopback-only health, static entry, OIDC-PKCE, migration, and topology
   checks using the existing `verify-runtime.sh` seam;
4. acquire the existing cutover lock and hand the public edge alias to the
   verified stack; and
5. retain the previous release and state file until post-cutover checks pass.

Any failed handoff runs the idempotent rollback seam, restoring the prior edge
alias without touching data volumes. A rollback is itself serialized and
logged. Database migrations remain forward-only and require a separately
reviewed migration plan; the delivery workflow never assumes that reverting
application code reverts data.

### 5. Secret ownership and provenance

GitHub Actions stores only the minimum deployment credentials: a Worker-scoped
Cloudflare token, a restricted deployment SSH key, and the exact server
`known_hosts` entry. The server owns runtime secret files and public runtime
configuration under its existing protected directories. Public build variables
are generated from non-secret repository/environment variables and are never
used as a channel for private runtime credentials.

Every release produces a machine-readable manifest containing repository,
commit SHA, release tag (when present), source allowlist/version, lockfile
hashes, artifact SHA-256 values, workflow run, test/build results, target,
deployment time, and resulting health status. The manifest and logs are
retained with the GitHub release and a copy is retained with the server release
directory. A scanner fails a run if a tracked file or release artifact contains
an excluded credential, private key, local runtime volume, or unexpected binary.

## Risks / Trade-offs

- **Private GitHub Free does not guarantee environment approvals or branch
  protection.** → Keep production server publishing manual and SHA-pinned,
  require the full PR CI gate, serialize the workflow, document the human
  two-person review convention, and schedule a repository-plan upgrade before
  removing the compensating controls.
- **A Cloudflare deploy can succeed while a route or asset is wrong.** → Run
  post-deploy checks against both custom domains and retain the previous Worker
  version for immediate rollback; do not report success from `wrangler` alone.
- **Server transfer or cutover can fail after files arrive.** → Use resumable
  checksum-verified transfer into a new release directory, never mutate the
  current source, stage on loopback, acquire the existing lock, and invoke the
  idempotent rollback path on any failed handoff.
- **A secret or generated artifact can leak through the monorepo migration.** →
  Start with an allowlisted active-source baseline, run secret/tracked-file
  scans before the first push and on every PR, and keep runtime values only in
  server/Cloudflare secret stores.
- **Duplicated upstream workflows can publish an unintended image or Worker.**
  → Consolidate product automation at the repository root, disable nested
  product release workflows, and make the target/name/commit checks mandatory.
- **Forward-only schema migrations limit code rollback.** → Require an
  explicit migration compatibility review and data backup before a release
  that changes schema; rollback restores code and edge routing only.
- **This change leaves app/auth on the server.** → Keep the boundary explicit in
  workflow names, manifests, and docs; track a separate Phase 2 change before
  any Worker migration is attempted.

## Migration Plan

1. Inventory the current working tree and produce a clean active-source
   baseline in the private `musuw` repository, preserving license/provenance
   records and recording the baseline SHA.
2. Add root PR CI and run it against the baseline and a no-op change. Verify
   that no nested workflow can publish a product artifact and that scans reject
   synthetic secrets/binaries.
3. Configure the scoped Cloudflare token, connect `musuw-site`, deploy the
   baseline commit, and verify both custom domains and rollback to the previous
   Worker version.
4. Configure the restricted server deploy seam, known-host pin, and server
   environment. Dispatch a baseline SHA to staging only, verify the complete
   health contract, and rehearse rollback without changing production data.
5. Dispatch one reviewed release SHA through staged health and cutover. Retain
   the previous release, manifest, and cutover state until the observation
   window closes; then adopt annotated tags for subsequent releases.
6. If a gate fails, stop before cutover. If a post-cutover health check fails,
   run the target-specific rollback (previous Worker version or server edge
   alias) and attach the manifest/logs to the release record.

## Open Questions

- Confirm the GitHub repository is private, writable by the automation identity,
  and that the desired default/release branch is `main`.
- Confirm the Cloudflare account/zone and the exact Worker-scoped API token
  permissions for `musuw-site`; no token value belongs in the repository.
- Confirm the production SSH user, host, port, and immutable `known_hosts`
  fingerprint for the restricted deploy seam.
- Decide whether release tags are created by a maintainer or by a successful
  release workflow; the workflow must reject unannotated/moved tags either way.
- Decide how long release artifacts/manifests and Cloudflare/server rollback
  versions are retained; the first implementation should choose a bounded
  default and document it.
