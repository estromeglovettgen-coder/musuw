## ADDED Requirements

### Requirement: Server releases use a dynamic per-SHA Compose transaction

The production server workflow SHALL accept only an immutable ref that resolves
to an exact full Git SHA and SHALL invoke the restricted SSH boundary through
only the fixed `preflight`, `promote`, and `run` verbs. `run` SHALL render one
new Docker Compose transaction for that SHA and SHALL internally orchestrate
`prepare` → `web` → `worker`; the workflow and SSH caller MUST NOT select a
runtime role or partial release. The transaction SHALL record a safe release/
attempt ID, source bundle checksum, rendered Compose/config digest, image
digests, ordered internal phase/role evidence, and references to server-owned
runtime state. Historical M35 one-shot handoffs, mutable refs, dirty checkouts,
implicit current projects, and caller-selected roles MUST be rejected.

#### Scenario: A selected SHA creates an isolated transaction

- **WHEN** an operator dispatches a reviewed immutable ref with no role or
  partial-release input and it resolves to a CI-green full SHA
- **THEN** the workflow invokes the fixed `preflight` → `promote` → `run`
  protocol and the server renders one complete per-SHA Compose project
- **AND** it hashes source and configuration and records immutable image
  references before the internal `web` stage
- **AND** the current release, server-owned secrets, and named data volumes
  remain unchanged before cutover

#### Scenario: An unsafe ref or caller-selected role is rejected

- **WHEN** the workflow receives a branch name, mutable image tag, dirty source,
  unsafe release ID, or unverified SHA, or a caller attempts a role argument,
  partial-release mode, non-fixed SSH verb, or extra command grammar
- **THEN** it fails before source transfer, Compose invocation, or server
  mutation

### Requirement: Runtime roles are internal and full transactions do not overlap

The transaction SHALL assign `prepare` for validation, capacity, rendering,
migration preparation, and rollback snapshot work without public ownership;
`web` for frontend/app HTTP surfaces; and `worker` for background/queue
ownership. `all` MAY remain only as the compatibility/default mode of the
predecessor native process and MUST NOT be a new-transaction phase or caller
input. One production lock SHALL cover the complete internal sequence from
snapshot through commit or rollback and SHALL prevent any two full transactions
from overlapping. Lock and internal phase events SHALL be retained in the
transaction manifest.

#### Scenario: Concurrent full releases are serialized

- **WHEN** a second `run` starts while another full transaction is preparing,
  staging, cutting over, handing off workers, observing, or rolling back
- **THEN** the second transaction is rejected or queued by the single target
  lock
- **AND** it cannot mutate the edge alias, current pointer, containers, images,
  or data volumes

#### Scenario: A caller cannot start a role-specific update

- **WHEN** a workflow or SSH caller requests `prepare`, `all`, `web`, `worker`,
  or any other partial-release mode
- **THEN** the fixed protocol rejects the request before transaction mutation
- **AND** only `run` may assign the internal phase roles under the one target
  lock and one source/config/image manifest

### Requirement: Every transaction is staged and health-gated before cutover

The transaction SHALL internally execute `prepare` → build → `web` stage/
verify → public cutover/probe → `worker` start/verify/background handoff →
observe/commit, or enter rollback. Web staging SHALL use private/loopback
routing and server-owned volumes without attaching the public edge.
Verification SHALL cover app/static/auth health, OIDC construction, worker
queue/processing health, migration compatibility, source and image provenance,
ports, and topology at their assigned internal phases.

#### Scenario: Staged health failure prevents public change

- **WHEN** any build, provenance, migration, role health, or topology check
  fails before cutover
- **THEN** the workflow preserves the current public release, records the
  failing phase and check, and leaves no candidate attached to the public edge
- **AND** it does not report the transaction as successful

#### Scenario: A complete staged transaction may cut over

- **WHEN** all required pre-cutover checks for the selected SHA and internal
  `prepare`/`web` phases pass against the rendered Compose transaction
- **THEN** the workflow records a green staged result and may request the
  serialized edge cutover with the same source/config/image digests
- **AND** it still cannot commit until the internal `worker` handoff and
  post-cutover observation pass

### Requirement: Rollback restores the complete release unit

Before mutation, the transaction SHALL snapshot the predecessor source pointer,
rendered configuration and public env overlay checksums, image digests,
background-worker/queue ownership, and edge alias/cutover state. A failure in
build, stage, verify, cutover, or post-cutover observation SHALL invoke an
idempotent, serialized rollback that restores those predecessor surfaces and
re-probes public health. Missing predecessor identity (including a missing old
edge ID or old image digest) SHALL fail closed before cutover. Rollback MUST
NOT delete or rewrite data volumes, secrets, or forward-applied migrations.

#### Scenario: Cutover or public health failure restores all predecessors

- **WHEN** the candidate fails during edge handoff or its post-cutover public
  probe
- **THEN** rollback stops/disconnects candidate web and worker services,
  restores the exact source/config/image/background/edge predecessors, and
  records the restored health result
- **AND** the workflow reports failure and retains both manifests

#### Scenario: An incomplete snapshot blocks release

- **WHEN** the old edge owner, source/config digest, image digest, or background
  owner cannot be captured deterministically
- **THEN** the transaction stops before cutover and reports a production NO-GO
- **AND** it does not guess from a mutable tag, container name, or current
  symlink

### Requirement: Server migrations are forward-only and ledger normalization is one-time

The transaction SHALL accept only separately reviewed forward-only additive
migrations that preserve a compatibility window for the predecessor code.
Destructive, rename-in-place, incompatible-constraint, or unbounded backfill
work MUST be handled by a separate migration plan. The release workflow MUST
NOT claim that code rollback reverses an applied migration.

Before the first production transaction, a dedicated native live-ledger
normalization SHALL run exactly once under a maintenance lock with dry-run
counts, checksum/backup evidence, restore proof, and an idempotent run ID. Its
evidence SHALL be referenced by the first release manifest and it SHALL NOT be
silently repeated during ordinary releases.

#### Scenario: Additive migration is eligible

- **WHEN** a reviewed release declares nullable columns, new tables, indexes,
  or compatibility fields and supplies rollback/forward-repair notes
- **THEN** `prepare` records the migration class and allows staging to proceed
- **AND** rollback restores code/config/edge only while preserving the new
  schema

#### Scenario: Non-additive migration or missing ledger evidence blocks release

- **WHEN** a release declares destructive/incompatible migration work or the
  one-time native-ledger evidence is absent, incomplete, or already reused
- **THEN** the workflow fails before cutover
- **AND** it requires a separately reviewed forward repair or normalization
  evidence rather than silently mutating production

### Requirement: Capacity preflight is fixed-floor and bounded

Before source transfer, release-directory creation, or image work, `prepare`
SHALL verify at least 12 GiB (`12,582,912` KiB) of production free capacity.
When below the floor, the server MAY perform exactly one logged cleanup of
unused Docker build cache/dangling images, then SHALL re-check. The cleanup
MUST NOT delete named volumes, runtime/secret files, current or predecessor
releases, or user data. Indeterminate or persistently low capacity SHALL fail
closed.

#### Scenario: Capacity remains below the floor

- **WHEN** free capacity is below `12,582,912` KiB after the single bounded
  cleanup, or cannot be determined
- **THEN** the transaction exits before source upload, Compose build, or edge
  mutation
- **AND** the workflow records the measured value and cleanup result

#### Scenario: Capacity meets the floor

- **WHEN** the preflight measures at least `12,582,912` KiB without destructive
  cleanup
- **THEN** the transaction may continue to source verification and staging
- **AND** the predecessor release and data volumes remain retained

### Requirement: Runtime secrets and data remain server-owned

The server workflow MUST NOT upload, overwrite, print, or delete server-owned
runtime secret files, databases, object storage, Redis/Neo4j volumes, or tunnel
credentials. The Compose transaction SHALL reference protected server paths and
record only non-secret path identities/checksums in manifests and logs.

#### Scenario: A full release updates code without replacing state

- **WHEN** the full transaction stages its internal `web` and `worker` roles
- **THEN** the candidate uses the existing protected secret mounts and named
  volumes without copying their values into the release bundle
- **AND** rollback leaves those mounts and volumes intact

### Requirement: Production readiness requires two successive release evidences

The server delivery path SHALL remain NO-GO until two successive transactions
for distinct reviewed SHAs complete the same prepare/stage/verify/cutover/
observe protocol with complete manifests, public health evidence, predecessor
links, and recorded lock/capacity/migration/image data. A storefront Worker
success SHALL NOT count as server evidence.

#### Scenario: Two complete transactions unlock readiness

- **WHEN** two successive reviewed-SHA transactions complete with independent
  manifests and public health probes
- **THEN** the operator may mark the server delivery path production-ready and
  create an annotated release tag
- **AND** each transaction remains independently traceable and rollbackable

#### Scenario: Missing successive evidence keeps production blocked

- **WHEN** no production transaction has run, only one transaction is green, or
  either manifest lacks predecessor/image/internal-phase/capacity/migration
  evidence
- **THEN** no production tag or cutover is authorized
- **AND** the workflow reports the missing evidence instead of claiming
  completion

### Requirement: Production publishing is explicit and SHA-pinned

Until enforceable repository/environment approvals are available, production
server delivery SHALL require a manual `workflow_dispatch` selecting only an
exact immutable SHA/tag that resolves to one full SHA and one target concurrency
group. Pull requests, ordinary pushes, and
storefront workflow success MUST NOT expose server credentials or start a
production transaction.

#### Scenario: Operator selects only a reviewed immutable ref

- **WHEN** an operator dispatches from `main` with a full SHA or annotated tag
- **THEN** the workflow verifies the exact SHA's successful CI run, records the
  selected identity, and begins the fixed complete transaction
- **AND** the dispatch exposes no runtime-role or partial-release input
- **AND** it refuses a mutable ref or missing CI evidence before credentials
  reach the server job

#### Scenario: Ordinary source activity cannot publish the server

- **WHEN** a pull request, branch push, or storefront-only workflow completes
- **THEN** no server production transaction starts and no server credential is
  available to that job
