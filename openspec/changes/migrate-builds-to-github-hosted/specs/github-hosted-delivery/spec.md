## ADDED Requirements

### Requirement: Standard hosted build execution
CI, Storefront build and deployment, production authorization, and production image construction SHALL run on pinned standard GitHub-hosted AMD64 Linux. The repository MUST NOT route those jobs through a repository variable or require the Beijing build runner.

#### Scenario: Canonical CI starts
- **WHEN** a pull request or main push matches the CI paths
- **THEN** every CI job runs on `ubuntu-24.04` with official Actions caches enabled

#### Scenario: Production construction starts
- **WHEN** an authorized CI-green main revision enters production construction
- **THEN** authorization and native AMD64 image construction run on `ubuntu-24.04` without a `musuw-build-x64` dependency

### Requirement: Exact authorized source on hosted construction
Production authorization SHALL continue to prove the selected full SHA belongs to canonical `origin/main` and has successful CI. The build SHALL use official checkout for exactly that authorized SHA, disable persisted checkout credentials, and fail before construction when `HEAD` differs.

#### Scenario: Authorized source is built
- **WHEN** authorization emits a CI-green main SHA
- **THEN** the build checks out and verifies that exact SHA without a custom source artifact or ranged blob downloader

#### Scenario: Source identity differs
- **WHEN** the hosted build checkout does not equal the authorized SHA
- **THEN** the job fails before installing dependencies or pushing an image

### Requirement: Hosted-native toolchain and network path
The production build SHALL validate native AMD64 Docker execution, install the exact `.nvmrc` Node version with the official setup action, use global Debian and Go endpoints, and use only job-scoped BuildKit state. It MUST NOT require Tencent daemon, BuildKit, APT, or Go mirrors or persistent self-hosted toolcache state.

#### Scenario: Cold hosted build
- **WHEN** a new standard runner begins production construction with no prior workspace or cache
- **THEN** it obtains the required Node and Buildx toolchain and can build both images from official sources

### Requirement: Immutable release contract remains unchanged
Production releases SHALL remain serialized and SHALL retain immutable GHCR tags, remote digest validation, provenance, least-privilege package permissions, isolated production environments, and the restricted exact-SHA server release seam. Only the final SSH deploy job SHALL remain on `musuw-release`.

#### Scenario: Hosted images pass validation
- **WHEN** both hosted builds push their immutable tags and their remote digests match build metadata
- **THEN** the restricted deploy job receives only the approved digest references and releases them through the existing server gate

#### Scenario: Hosted construction fails
- **WHEN** checkout, dependency acquisition, image construction, push, or digest validation fails
- **THEN** the deploy job does not run and the current production release remains unchanged
