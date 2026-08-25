## ADDED Requirements

### Requirement: Native build-only runner routing
The production workflow SHALL run lightweight authorization and deployment on `musuw-release` and SHALL run only its heavy construction job on the exact `musuw-build-x64` label. CI and storefront SHALL retain their existing runner-variable fallback and MUST NOT use the x64 production-builder label. No required job SHALL use a GitHub-hosted-only label, and the Tokyo production host MUST NOT be a runner.

#### Scenario: Production build starts natively
- **WHEN** an authorized production revision reaches the build job
- **THEN** the job verifies X64 runner architecture, x86_64 kernel architecture, and amd64 Docker server architecture before building, without installing QEMU

#### Scenario: Hosted minutes remain exhausted
- **WHEN** no GitHub-hosted private-repository minutes are available
- **THEN** authorize, native build, and deploy can still be scheduled on their explicit self-hosted labels

#### Scenario: General CI is scheduled
- **WHEN** a CI or storefront job is evaluated
- **THEN** it uses `MUSUW_ACTIONS_RUNNER || ubuntu-latest` and cannot consume `musuw-build-x64`

### Requirement: Secret-free immutable build handoff
The production workflow SHALL authorize an exact CI-green SHA, build both images in a distinct x64 job, and deploy only after both image outputs validate. The build job SHALL have only `contents: read` and `packages: write`, MUST NOT attach the production Environment or reference any `secrets.*` value, and SHALL accept only the three documented browser-visible repository variables. Build and deploy SHALL generate auth-public input from those same variables rather than independent secret sources. The deploy job SHALL have only `contents: read` and `packages: read`, SHALL consume the returned immutable refs, and MUST NOT rebuild browser bundles or images.

#### Scenario: Native build succeeds
- **WHEN** both image pushes return lowercase SHA-256 digests
- **THEN** the build job exposes exactly the app/frontend digests and canonical `ghcr.io/...@sha256:...` refs for deploy

#### Scenario: Build output is incomplete or malformed
- **WHEN** either build fails or either digest/ref has an invalid shape
- **THEN** the build job fails and the dependent deploy job does not run

#### Scenario: Deploy receives production credentials
- **WHEN** both immutable refs are available
- **THEN** only the `musuw-release` deploy job receives the restricted SSH/server inputs and passes the refs through the existing exact-SHA forced-command release seam with no server-side build

### Requirement: Bounded persistent local BuildKit cache
The x64 build SHALL use the official `docker/setup-buildx-action@v3` with a fixed Docker-container builder name, the checked-in BuildKit configuration, and `keep-state: true`. Both image builds SHALL select that builder. The action SHALL recreate the container from current repository configuration while retaining the named local cache volume. Docker daemon bootstrap pulls and BuildKit Dockerfile-base pulls SHALL use the checked-in Tencent Cloud regional mirror configuration. BuildKit SHALL run at most two parallel build steps, and GC SHALL use a 10 GB maximum-use threshold while preserving at least 12 GB free space. The workflow MUST NOT import or export a separate registry cache or upload optional BuildKit record artifacts, while immutable release images MUST still be pushed to GHCR and normal workflow/release evidence MUST remain available.

#### Scenario: Warm build reuses local state
- **WHEN** the persistent x64 runner retains the named builder volume
- **THEN** BuildKit can reuse unchanged ordinary layers and Go module/compiler cache mounts without uploading a maximum-mode cache artifact

#### Scenario: Warm cache survives the job
- **WHEN** a trusted production build finishes
- **THEN** the builder container may be removed while its named local state remains available for the next serialized production build

#### Scenario: Builder state is absent
- **WHEN** the builder or its local volume does not exist
- **THEN** the setup action creates it and the workflow performs a correct native cold build whose newly pushed image digests can be deployed

#### Scenario: Direct Docker Hub access is unavailable
- **WHEN** the native host cannot reach Docker Hub directly but its configured Tencent Cloud mirror is reachable
- **THEN** both the BuildKit bootstrap image and Dockerfile base images resolve through that mirror without introducing another build provider

#### Scenario: Regional mirror configuration drifts
- **WHEN** the daemon no longer reports the required regional mirror
- **THEN** native preflight fails before dependency installation, image construction, or Tokyo mutation

#### Scenario: Cache exceeds the host budget
- **WHEN** BuildKit cache crosses its configured thresholds
- **THEN** automatic OCI-worker GC reclaims cache toward the 10 GB maximum-use threshold while maintaining the 12 GB free-space floor according to BuildKit policy

#### Scenario: Build graph contains concurrent work
- **WHEN** BuildKit has more than two executable vertices
- **THEN** the OCI worker executes no more than two concurrently to limit memory pressure on the 4 GB host

#### Scenario: Immutable image layers already exist
- **WHEN** a later image push references content-addressed layers already stored by GHCR
- **THEN** the registry can reuse those blobs without a second `mode=max` cache export

### Requirement: Stable dependency layers and bounded network work
Volatile release metadata MUST NOT invalidate stable apt/tool or runtime-package layers. Debian network operations SHALL use bounded retries and HTTP/HTTPS timeouts, the migrate tool SHALL be pinned to the application dependency version, and Go build steps SHALL use module/compiler cache mounts.

#### Scenario: Release SHA changes
- **WHEN** a new authorized SHA changes release metadata
- **THEN** stable package layers remain cache-eligible while the compiled artifact and OCI revision remain bound to the new SHA

#### Scenario: Debian mirror stalls
- **WHEN** apt cannot make progress
- **THEN** configured retries and per-request timeouts bound the wait and surface failure instead of leaving an unbounded build step

### Requirement: Serialized activation and safe rollback
Production releases SHALL remain serialized in one non-cancelling concurrency group. Browser bundles and both images SHALL be built sequentially in one build job, with the browser V8 old-space ceiling set to 3072 MiB. Activation SHALL require an online `musuw-build-x64` runner and the three public repository variables, but MUST NOT require Actions billing, Docker Build Cloud, another build provider, deletion of existing host services, or production-host mutation.

#### Scenario: Two releases are requested
- **WHEN** a release is already active and another is triggered
- **THEN** the second release cannot build or deploy concurrently

#### Scenario: Native runner is unavailable
- **WHEN** no online runner matches `musuw-build-x64`
- **THEN** build waits and deploy remains unrun without changing GHCR release images or Tokyo

#### Scenario: Local cache reset is required
- **WHEN** the named builder state is removed after operator inspection
- **THEN** the next build is cold while existing immutable images and the running production release remain unchanged
