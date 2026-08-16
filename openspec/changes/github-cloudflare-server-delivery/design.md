## Context

Musuw is a product composition rather than a single upstream checkout. The
active source is split across `weknora/` (Go API, document processing,
workspace UI, and runtime), `auth/` (the Google/email-OTP entry shell),
`storefront/` (the public `musuw-site` Worker), `integration/` (runtime
composition), and `scripts/` (release and verification entry points). The
private `estromeglovettgen-coder/musuw` repository is now the only source and
release identity.

There are two intentionally separate delivery boundaries:

1. `storefront/wrangler.jsonc` owns the static `musuw-site` Worker for
   `musuw.com` and `www.musuw.com`.
2. The authenticated app/auth/backend stack remains on the existing server,
   with server-owned volumes and secrets, a loopback staging boundary, and an
   explicit edge cutover.

The old M35-era one-shot handoff is not a production protocol. It did not
provide a repeatable source/config/image snapshot for a new SHA, did not make
background-worker state part of the rollback unit, and depended on a current
edge identity that is no longer reliably recoverable. The replacement is a
dynamic, per-SHA Docker Compose transaction with explicit runtime roles and a
single transaction manifest.

The latest external evidence is deliberately recorded separately from the
design: commit
`2d9091b98b90cb0e4ce6bde081027a0f61af7949` (B) passed CI run
`31933653091`, and the dependent storefront run `31933748281` attempt 2
published Worker version `20d7ad96-2a01-4437-93d7-3ba7d0995d14` at 100%
traffic (artifact `9260177059`). No production tag or server release exists.

## Goals / Non-Goals

**Goals:**

- Keep GitHub as the immutable source of truth and bind every server artifact
  to one full SHA, rendered Compose/config digest, and image digests.
- Replace the one-shot M35 handoff with a dynamic per-SHA Compose transaction
  invoked through only the fixed restricted `preflight`, `promote`, and `run`
  verbs.
- Keep runtime-role selection inside the transaction: every `run` internally
  orchestrates `prepare` → `web` → `worker`; neither the workflow nor the SSH
  caller can request a role-specific or partial release.
- Ensure no two full release transactions overlap. Stage and verify each
  internal role before its ownership change, then make rollback restore source,
  rendered configuration, images, background-worker ownership, and the public
  edge as one release unit.
- Permit only forward-only additive migrations, and separately gate one
  idempotent native live-ledger normalization before the first production
  transaction.
- Require two successive release transactions with complete manifests and
  health evidence before calling the server delivery path production-ready.
- Keep the fixed capacity reserve and bounded unused-Docker cleanup as a
  fail-closed preflight; never delete volumes, secrets, the current release, or
  user data to make room.
- Preserve the existing storefront Worker boundary and keep the Cloudflare
  product app-edge migration in the separate `cloudflare-product-edge` change.

**Non-Goals:**

- Migrating the authenticated app or auth shell to a Cloudflare Worker. That
  remains a separate Phase 2 change with its own OIDC, SSRF, streaming, and
  rollback review.
- Changing product behavior, billing, graph behavior, or business data
  semantics. A schema change is permitted only when it is additive,
  compatibility-reviewed, and explicitly recorded in the release manifest.
- Replacing server-owned databases, object/object-store volumes, Redis/Neo4j
  state, runtime secrets, or tunnel credentials.
- Treating historical M35 files, a mutable branch, a dirty checkout, or a
  direct `docker compose` command as a production release authority.
- Exposing `prepare`, `all`, `web`, or `worker` as a workflow input, SSH verb,
  or independently publishable production transaction.
- Silently claiming production readiness from local simulations or a
  successful storefront deployment; the new server transaction and its
  evidence gates are not yet complete.

## Decisions

### 1. GitHub identity and target separation

The root workflows remain the only product CI/release authority. Every server
transaction starts from a full SHA that is present on `main` and has a
successful CI run. The storefront workflow continues to select
`workflow_run.head_sha` only after CI completes successfully; it never receives
server SSH credentials. The app-edge Worker design and its staging/OIDC
requirements remain in `cloudflare-product-edge` and are not folded into this
server transaction.

### 2. Per-SHA Compose transaction

The workflow resolves its immutable ref to a full SHA and the server adapter
receives an immutable transaction tuple:

| Field | Contract |
| --- | --- |
| `revision` | 40-character Git SHA selected by the workflow |
| `release_id` | safe identifier derived from the SHA and transaction attempt |
| `source_bundle_sha256` | checksum of the transferred allowlisted source |
| `compose_digest` | digest of the rendered base/overlay Compose configuration |
| `image_digests` | immutable digest for every image used by the full transaction |
| `runtime_snapshot` | references (not values) to server-owned env, secrets, and volumes |

The server renders Compose from the selected checkout and protected runtime
configuration at transaction time. The project name, container names, image
references, and release directory are derived from `release_id`; no mutable
`latest`/branch tag or checked-in M35 compose file is accepted. The rendered
configuration is hashed before the first container starts and is retained with
the transaction manifest. A rerun of the same SHA creates a new attempt and
must not silently reuse a stale project or image tag.

The caller-facing protocol is fixed: `preflight` validates the immutable
candidate and fail-closed gates, `promote` moves the verified spool into its
immutable release directory, and `run` starts one complete transaction. Extra
verbs, role arguments, partial-release modes, and command suffixes are rejected
before mutation.

After `run` acquires the one production transaction lock, it executes:

1. **Prepare** — assign the internal `prepare` role; verify SHA, source
   allowlist, secrets boundary, capacity, migration plan, Compose render, image
   set, and complete rollback snapshot without taking traffic;
2. **Build** — build or pull only digest-pinned images and record their digests;
   never build into the current release in place;
3. **Web stage/verify** — assign the internal `web` role, start HTTP surfaces on
   loopback/private networks, and verify app/static/auth, OIDC, migration,
   provenance, port, and topology gates;
4. **Public cutover** — switch the public alias only after the web candidate and
   predecessor snapshot are complete, then probe public health;
5. **Worker stage/verify** — assign the internal `worker` role, start queue and
   document-processing ownership, verify it, and stop the predecessor worker
   only as part of this same transaction;
6. **Observe/commit** — record all internal phase evidence and retain the
   predecessor until the observation window closes; or
7. **Rollback** — execute the idempotent full rollback when any phase after the
   snapshot fails.

### 3. Internal runtime roles and one transaction lock

Runtime roles are an implementation detail owned by the transaction:

| Internal role | Scope | Public edge |
| --- | --- | --- |
| `prepare` | validate/render/snapshot/migration preparation; no serving ownership | untouched |
| `web` | frontend/app/HTTP surfaces using the transaction's SHA/config/images | cut over only after private verification |
| `worker` | document processing, queue consumers, and background ownership | never independently mutates the edge |
| `all` | compatibility/default mode for the predecessor native process | not a new-transaction phase and never caller-selectable |

Every production `run` performs the complete `prepare` → `web` → `worker`
sequence. There is no role-specific production transaction or compatibility
matrix exposed to callers. One exclusive target lock covers the sequence from
the first snapshot through commit or rollback; a second `run` is rejected or
queued and cannot overlap any phase. Every lock acquisition, wait, rejection,
and release is written to the audit manifest.

### 4. Full rollback is one release unit

The prepare phase snapshots the prior release identity and the exact
source/config/image/background/edge owners:

- immutable source bundle and current release pointer;
- rendered Compose/config references and public env overlay checksums (never
  secret values);
- image digests and tags used by each service;
- background worker/queue ownership, scheduler state, and container IDs; and
- the edge alias, public endpoint, and cutover state.

Rollback restores all of those surfaces in dependency order, stops or
disconnects candidate web and worker services, and re-probes the restored
public edge. It is idempotent and serialized by the same transaction lock. A
rollback must not delete or rewrite server-owned data volumes, secrets,
forward-applied migrations, or the predecessor manifest. If a snapshot is
missing (for example, the old edge ID or an old image digest cannot be
captured), the transaction fails before cutover and is a NO-GO rather than
guessing a predecessor.

### 5. Forward-only migrations and one-time native ledger normalization

Every release declares its migration class in the transaction manifest. Only
forward-only additive changes are eligible: new nullable columns/tables,
indexes, or compatibility fields that old and new code can both read. A
destructive, rename-in-place, incompatible constraint, or unbounded backfill
requires a separate reviewed change and cannot be smuggled into a normal
release. Code/config rollback never pretends to undo an applied migration; a
forward repair or compatibility release is required.

Before the first production transaction, the operator must run one dedicated
native live-ledger normalization. It is a one-time, idempotent operation on
the live native stack, preceded by a dry-run count/checksum, backup/restore
proof, maintenance lock, and explicit before/after ledger evidence. It is not
run during every release and is not rolled back by reverting containers; any
failure leaves the transaction NO-GO until a reviewed forward repair is
available. The normalization run ID and ledger evidence are prerequisites for
the first two-successive-release gate.

### 6. Capacity preflight and bounded cleanup

The fixed minimum production reserve is 12 GiB (`12,582,912` KiB). `prepare`
checks free capacity before source transfer, release-directory creation, or
image work. If capacity is below the reserve, the server may perform exactly
one bounded cleanup of unused Docker build cache/dangling images, then
re-check. The cleanup must be recorded and must not touch named volumes,
runtime/secret files, current or predecessor releases, or user data. If the
reserve is still not met or capacity cannot be determined, the transaction
fails closed before mutation.

At the time of this revision the server reports approximately `8,939,456` KiB
free, below the required `12,582,912` KiB. This is a current production NO-GO,
not permission to lower the floor.

### 7. Provenance, secrets, and evidence

The transaction manifest records repository/SHA/tag, release and attempt IDs,
the ordered internal phase/role evidence, source/config/image digests, runtime snapshot references,
migration class, ledger-normalization evidence, capacity/cleanup result,
lock/cutover phases, health probes, rollback predecessor, and workflow run.
Secrets remain server-owned; logs contain names and checksums only. A
successful server release requires two successive transactions on distinct
reviewed SHAs under this protocol, each with complete manifests and public
health evidence. The second success must not rely on an unrecorded mutable
current state from the first.

### 8. Storefront and app-edge boundaries

The storefront Worker continues to deploy only `storefront/` and its static
marketing routes. Its B success is evidence for the Cloudflare storefront
target only; it is not evidence that the server transaction or app-edge
migration is complete. Any future `app.musuw.com` Worker cutover remains gated
by the separate `cloudflare-product-edge` change, independent staging origin,
Access/OIDC setup, streaming/upload tests, cookie isolation, and edge rollback.

## Risks / Trade-offs

- **A dynamic Compose render can drift from the tested source.** → Hash the
  rendered config, source allowlist, and every image digest before staging and
  bind all later phases to the same transaction manifest.
- **A caller-selected partial release could split web and worker versions.** →
  Reject role/mode arguments at the workflow and restricted SSH boundaries and
  serialize every complete internal `prepare` → `web` → `worker` transaction.
- **Rollback can be incomplete when the predecessor is not observable.** →
  Snapshot source/config/images/background/edge before mutation and fail closed
  when any predecessor identity is missing; never infer the old state from
  container names or a mutable tag.
- **Forward-only migrations limit an immediate code rollback.** → Require
  additive compatibility, backup/restore evidence, and a forward repair plan;
  keep migration state in the manifest and never delete data during rollback.
- **Native ledger normalization can alter live state.** → Run it once under a
  maintenance lock with dry-run, counts, checksums, backup, and idempotence
  evidence; block all production releases until its evidence is complete.
- **Low disk capacity can recur during image builds.** → Keep the 12 GiB
  reserve, allow one bounded unused-cache cleanup, re-check before build, and
  retain the old release/volumes even when cleanup is attempted.
- **GitHub Free does not provide dependable environment approvals.** → Keep
  production dispatch manual and SHA-pinned, require CI, serialize the server
  lock, and require two-successive-release evidence before declaring the path
  ready.
- **The app-edge Worker may be mistaken for a server release.** → Keep the
  app-edge change and its staging/prod decisions separate in manifests,
  workflows, and runbooks.

## Migration Plan

1. Keep the B GitHub/Cloudflare evidence recorded, but do not create a
   production tag or dispatch while the server is below the capacity floor and
   predecessor/image snapshots are incomplete.
2. Implement the per-SHA transaction adapter behind only `preflight`, `promote`,
   and `run`. Add internal `prepare` → `web` → `worker` orchestration, dynamic
   Compose rendering, one full-transaction lock, digest manifests, and negative
   tests for role/mode injection, extra command grammar, stale refs, and
   overlapping `run` transactions.
3. Add the full rollback snapshot/restore path and rehearse source,
   config, image, background, and edge failures with server-owned volumes and
   secrets unchanged. Previous static/M35-era rollback simulations do not
   satisfy this step.
4. Restore capacity above 12,582,912 KiB using only the bounded unused-Docker
   cleanup; if it remains low, stop without upload/build/cutover.
5. Run the one-time native live-ledger normalization with the required
   backup/restore and idempotence evidence. Keep it outside ordinary release
   migrations and record its run ID in the manifest.
6. Rehearse a selected SHA through the fixed `preflight`/`promote`/`run`
   protocol and internal `prepare` → `web` → `worker` sequence through rollback,
   then run two successive reviewed-SHA transactions through commit and public
   health. Retain both manifests, predecessor links, image digests, and rollback
   evidence.
7. Only after those gates pass may a maintainer create an annotated release
   tag and dispatch production. A failed gate stops before cutover; a
   post-cutover failure restores the complete predecessor unit and records a
   linked audit event.

## Open Questions

- Which concrete service names and dependencies belong to the internally
  assigned `prepare`, `web`, and `worker` phases in the production Compose
  topology?
- What server path and lock owner will hold the transaction lock across SSH
  reconnects and operator retries?
- What exact native ledger rows/fields and backup checksum constitute the
  one-time normalization acceptance evidence?
- What observation-window duration and retention period will be used for the
  two successive release manifests and their rollback predecessors?
- Which independent origin and Cloudflare Access/OIDC setup will be used by
  the separate `cloudflare-product-edge` change? That decision is intentionally
  not made here.
