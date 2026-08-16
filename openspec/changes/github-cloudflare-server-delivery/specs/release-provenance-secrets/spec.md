## ADDED Requirements

### Requirement: Every target has a verifiable release manifest

Each Cloudflare and server release SHALL produce a machine-readable manifest
that records the private repository, full source SHA, release tag when present,
active-source/provenance version, lockfile hashes, artifact SHA-256 values,
workflow run, target, deployment time, test/build results, health result, and
rollback predecessor. A server transaction manifest SHALL additionally record
the transaction/attempt ID, ordered internal `prepare`/`web`/`worker` phase and
role evidence, source-bundle checksum, rendered Compose/config digest, image
digests, capacity/cleanup result, migration class, native-ledger normalization
run ID, lock/cutover phases, and background-worker predecessor/owner. `all` MAY
appear only when describing the predecessor native process's compatibility/
default runtime mode; it MUST NOT identify a caller-selected transaction. The
manifest SHALL be retained with the GitHub release and with the target release/
version record.

#### Scenario: Running version can be traced to a reviewed commit

- **WHEN** an operator inspects a currently serving Worker version or server
  release
- **THEN** the target record resolves to one manifest, the manifest resolves to
  one full Git SHA in `estromeglovettgen-coder/musuw`, and the recorded checks
  and artifact hashes match the published release

#### Scenario: Server transaction provenance is complete

- **WHEN** an operator inspects a complete server transaction
- **THEN** its manifest resolves the ordered internal phase/role results,
  rendered Compose/config digest, image digests, source bundle, capacity check,
  migration class, lock phases, background owner, and exact rollback
  predecessor
- **AND** a missing predecessor or digest prevents the transaction from being
  reported healthy

#### Scenario: Incomplete provenance blocks release

- **WHEN** a candidate lacks a full SHA, artifact hash, required check result,
  target identity, or predecessor/rollback identity
- **THEN** publication stops before target mutation and reports the missing
  provenance field

### Requirement: Deployment credentials are least-privilege and secret-free in source

The GitHub environment SHALL contain only credentials required by the target:
a Worker-scoped Cloudflare token for the storefront job and a restricted SSH
credential plus exact `known_hosts` entry for the server job. Runtime, model,
OIDC, Supabase service, billing, database, object-store, Redis, Neo4j, and
tunnel secrets SHALL remain in their target-owned secret stores and MUST NOT be
committed, embedded in bundles, or written to logs.

#### Scenario: Source and artifact secret sentinel passes

- **WHEN** the secret sentinel scans the Git index, build output, release
  archive, manifest, and workflow logs
- **THEN** it finds no credential value, private key, server secret path
  contents, or unmasked token
- **AND** the scan fails closed if an excluded file or unexpected secret-like
  material is introduced

#### Scenario: Target job receives only its credential class

- **WHEN** the storefront or server job starts
- **THEN** the storefront job can read only its Worker deploy credential and the
  server job can read only its restricted deploy credential/host pin
- **AND** neither job can read the other target's credentials or server runtime
  secret files

### Requirement: Release and rollback evidence is retained

The release system SHALL retain workflow logs, manifests, health probes,
deployment target/version, and rollback events for a bounded documented period.
Rollback SHALL create a new audit event that links the failed version to the
restored predecessor; deleting or overwriting the previous evidence MUST NOT be
part of normal cleanup.

#### Scenario: Rollback is auditable

- **WHEN** a Cloudflare Worker or server release is rolled back
- **THEN** the record contains the failed version, restored version, reason,
  operator/workflow run, timestamp, and health result after restoration
- **AND** the restored version remains independently deployable

#### Scenario: Retention cleanup preserves the active chain

- **WHEN** the bounded retention job removes old artifacts
- **THEN** it preserves the currently serving manifest, its immediate rollback
  predecessor, release tags, and all provenance needed to reproduce either
  version

### Requirement: Two successive server transactions are required for readiness

The server delivery authority SHALL retain evidence for two successive
distinct-SHA transactions before declaring the path production-ready. Each
transaction SHALL have an independent manifest, public health result,
predecessor link, and complete internal-phase/config/image/migration/capacity
evidence;
the second transaction MUST NOT rely on an unrecorded mutable current state
from the first.

#### Scenario: Successive evidence unlocks a production tag

- **WHEN** two successive reviewed-SHA server transactions satisfy the complete
  manifest and health contract
- **THEN** the operator may mark the delivery path ready for an annotated
  production tag
- **AND** both manifests and rollback predecessors remain retained

#### Scenario: A single or incomplete run remains NO-GO

- **WHEN** no server transaction has run, only one is green, or either manifest
  lacks internal-phase/config/image/rollback/capacity/migration evidence
- **THEN** production readiness and server cutover remain blocked
- **AND** a storefront Worker success cannot substitute for the missing server
  evidence
