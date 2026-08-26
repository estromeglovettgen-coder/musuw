## MODIFIED Requirements

### Requirement: Native build-only runner routing
The production workflow SHALL run authorization and native AMD64 image construction on pinned standard `ubuntu-24.04` runners and SHALL run only the final restricted deployment on `musuw-release`. CI and Storefront SHALL also use pinned standard `ubuntu-24.04` runners. No job SHALL require `musuw-build-x64`, repository-variable runner routing, QEMU, or the Tokyo production host as a runner.

#### Scenario: Production build starts natively
- **WHEN** an authorized production revision reaches construction
- **THEN** a fresh hosted job verifies X64 runner, x86_64 kernel, and AMD64 Docker server architecture before building

#### Scenario: General CI is scheduled
- **WHEN** a CI or Storefront job is evaluated
- **THEN** it runs on `ubuntu-24.04` without reading a runner-selection repository variable

### Requirement: Secret-free immutable build handoff
The production workflow SHALL authorize one exact CI-green SHA, build both images in a distinct hosted job, and deploy only after both image outputs validate. The build job SHALL have only `contents: read` and `packages: write`, MUST NOT attach the production Environment or reference a `secrets.*` value, and SHALL accept only the three documented browser-visible repository variables. GHCR authentication SHALL use the job token over stdin and a runner-temporary Docker configuration that always-running cleanup removes. The deploy job SHALL retain only `contents: read` and `packages: read`, consume validated immutable image references, and MUST NOT rebuild them.

#### Scenario: Hosted build succeeds
- **WHEN** both image pushes produce metadata bound to their expected immutable tags and matching remote registry digests
- **THEN** the build exposes only canonical app/frontend digest references to deploy

#### Scenario: Build output is incomplete or malformed
- **WHEN** either image build, metadata check, or remote digest comparison fails
- **THEN** deploy does not run and the current production release remains unchanged

### Requirement: Official same-run exact-SHA source artifact materialization
The authorization job SHALL retain the full checkout needed to prove successful canonical CI and `origin/main` ancestry. The hosted build SHALL use official `actions/checkout` for exactly the emitted full SHA with persisted credentials disabled and SHALL assert `HEAD` matches before dependency installation or construction. It MUST NOT use the retired source projection, Actions Artifact transport, REST/blob downloader, or ranged requests. The deploy job SHALL retain its own exact-SHA checkout for the manifest-backed restricted upload.

#### Scenario: Authorized source is constructed
- **WHEN** authorization emits a CI-green canonical SHA
- **THEN** the hosted build checks out and verifies that SHA directly before using source

#### Scenario: Source identity differs
- **WHEN** the build checkout does not equal the authorized SHA
- **THEN** the job fails before dependencies, image publication, or production mutation

### Requirement: Bounded persistent local BuildKit cache
The hosted build SHALL create a uniquely named job-scoped Docker-container builder from the checked-in BuildKit configuration, select it for both native image builds, and remove it without `--keep-state` during always-running cleanup. GHCR credentials SHALL use a separate runner-temporary `DOCKER_CONFIG`. BuildKit SHALL enable GC and run at most two parallel steps. The workflow MUST NOT retain persistent client state, a fixed cache volume, a regional registry mirror, or a separate registry-cache export.

#### Scenario: Fresh hosted job starts
- **WHEN** construction starts without prior runner state
- **THEN** the job creates and bootstraps its isolated builder from checked-in configuration

#### Scenario: Hosted job finishes or fails
- **WHEN** always-running cleanup executes
- **THEN** it removes the job-scoped builder and temporary Docker credentials without preserving cross-run state

### Requirement: Stable dependency layers and bounded network work
The application Dockerfile SHALL use the official signed Debian sources from its pinned base images with bounded retries and HTTP/HTTPS timeouts, `proxy.golang.org,direct`, and `sum.golang.org`. It MUST NOT require regional mirror arguments, force HTTPS before the slim runtime can install CA certificates, or disable Go checksum verification. The migrate tool SHALL remain pinned to the application dependency version, and Go build steps SHALL retain module/compiler cache mounts within the job-scoped builder.

#### Scenario: Official dependency endpoint stalls
- **WHEN** apt or Go dependency acquisition cannot make progress
- **THEN** bounded retries or request timeouts surface failure and deploy remains unrun

#### Scenario: Release SHA changes
- **WHEN** a later authorized SHA changes release metadata
- **THEN** the compiled application and OCI revision remain bound to that exact SHA

### Requirement: Serialized activation and safe rollback
Production releases SHALL remain serialized in one non-cancelling concurrency group. Browser bundles and both images SHALL be built sequentially in one hosted build job with the browser V8 old-space ceiling set to 3072 MiB. Official Node setup SHALL install the exact `.nvmrc` version. The final restricted deploy SHALL remain on `musuw-release`. During hosted acceptance and its rollback window, the former Beijing runner SHALL remain registered and unchanged but SHALL NOT be required by any job.

#### Scenario: Two releases are requested
- **WHEN** a release is active and another is triggered
- **THEN** the second release cannot construct or deploy concurrently

#### Scenario: Hosted construction fails
- **WHEN** the cold hosted job exceeds its resource budget or otherwise fails
- **THEN** deploy remains unrun and workflow rollback can reuse the retained former runner prerequisites
