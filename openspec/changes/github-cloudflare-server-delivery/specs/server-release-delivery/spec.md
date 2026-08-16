## ADDED Requirements

### Requirement: Server releases are SHA-pinned and transferred through a restricted seam

The production server workflow SHALL accept an exact full Git SHA (and optional
verified release tag), package only the approved active source/configuration,
verify a checksum manifest, and transfer it into a new immutable release
directory. The remote operation MUST use the restricted deploy seam and
strictly pinned `known_hosts`; it MUST NOT execute arbitrary operator shell
input, deploy a dirty checkout, or mutate the current release in place.

#### Scenario: Approved SHA creates an isolated release

- **WHEN** an operator dispatches the server workflow for a commit that passed
  required CI and whose tag/manifest resolves to that SHA
- **THEN** the workflow transfers a checksum-verified source bundle to a new
  release directory and invokes only the allowlisted release mode
- **AND** the existing current release, runtime secrets, and data volumes remain
  unchanged before staging

#### Scenario: Unsafe server invocation is rejected

- **WHEN** the workflow is given a mutable ref, unsafe release ID, unknown host
  fingerprint, dirty source, or arbitrary remote command argument
- **THEN** it fails before transfer or server mutation

### Requirement: Every server release is staged and health-gated before cutover

The release workflow SHALL build the selected app, auth, and frontend release
and run the existing loopback-only staged verification before public routing
changes. The health gate MUST cover app health, static root/auth entry points,
OIDC S256 URL construction, migration cleanliness, image/source provenance,
approved ports, and the production topology.

#### Scenario: Staged health failure prevents public change

- **WHEN** any staged build or health check fails
- **THEN** the workflow stops before edge cutover, preserves the current public
  release, records the failing check, and leaves the new release available only
  for diagnosis or removal by the server runbook

#### Scenario: Staged release passes the complete gate

- **WHEN** the loopback stack passes every required check for the selected SHA
- **THEN** the workflow records a green staged result and is allowed to request
  the serialized cutover

### Requirement: Cutover is serialized and rollback is idempotent

The public edge handoff SHALL acquire the existing cutover lock, preserve the
old edge alias/container/release identity, and switch routing only after the
new stack is healthy. Any failed handoff or post-cutover health check SHALL
invoke the idempotent rollback seam, restore the previous edge alias, and retain
both release manifests until the incident is closed.

#### Scenario: Concurrent production releases are serialized

- **WHEN** a second server deployment starts while staging, cutover, or
  rollback already holds the release lock
- **THEN** the second deployment is rejected or queued by the workflow
- **AND** it cannot mutate the edge alias, current symlink, or data volumes

#### Scenario: Failed cutover restores the previous service

- **WHEN** the new container fails during alias handoff or its post-cutover
  probe fails
- **THEN** rollback disconnects the new edge endpoint, restores the exact old
  alias/edge owner, records the rollback phase, and leaves the old service
  serving
- **AND** the workflow reports failure rather than success

### Requirement: Runtime secrets and data are server-owned

The server release workflow MUST NOT upload, overwrite, print, or delete
server-owned runtime secret files, databases, object-store data, Redis/Neo4j
volumes, or tunnel credentials. Release configuration SHALL reference those
values through the existing protected server runtime directory and file-backed
secret mounts.

#### Scenario: Release updates code without replacing runtime state

- **WHEN** a new application release is staged or cut over
- **THEN** the server continues using the pre-existing protected secret files
  and named data volumes
- **AND** checksums/logs contain paths and identities but never secret values

### Requirement: Production server publishing starts as explicit workflow dispatch

Until a repository plan with enforceable environment approvals is available,
production server delivery SHALL require a manual `workflow_dispatch` selecting
the exact SHA/tag and SHALL use one concurrency group per production target.
The workflow MUST expose the GitHub Free private-repository approval limitation
and the compensating review/runbook controls rather than implying that an
approval gate exists.

#### Scenario: Operator selects a reviewed SHA

- **WHEN** an operator dispatches a production release with a full SHA/tag and
  confirms the target and release mode
- **THEN** the workflow displays the selected identity, runs required checks,
  stages it, and requests cutover only after the explicit gates pass

#### Scenario: Unapproved automatic production trigger is absent

- **WHEN** a normal pull request or ordinary branch push occurs
- **THEN** no server production workflow starts and no server credential is
  exposed to that CI job
