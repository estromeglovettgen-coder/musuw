## Context

The repository is public, so standard GitHub-hosted runners are free for this project. CI and Storefront previously allowed repository-variable routing that forced them onto one self-hosted runner. Production authorization and deployment used `musuw-release`, while image construction used a Beijing `musuw-build-x64` runner plus regional mirrors, persistent BuildKit state, a custom ranged artifact downloader, and a preinstalled Node toolcache.

## Goals / Non-Goals

**Goals:**

- Run CI, Storefront, authorization, and native AMD64 image construction on a pinned standard GitHub-hosted image.
- Remove the Beijing-only source transport, regional mirror, persistent cache, and toolchain assumptions.
- Preserve the existing CI-green exact-SHA authority, immutable GHCR digest checks, and restricted deployment protocol.
- Keep the model-selection task and all application behavior untouched.

**Non-Goals:**

- Moving the final SSH deployment off `musuw-release` or changing the server firewall.
- Unregistering, stopping, or reconfiguring the Beijing runner during this migration and rollback window.
- Adding larger runners, Docker Build Cloud, a proxy, a second build service, or a new cache backend.
- Changing production topology, runtime secrets, images, APIs, or data.

## Decisions

### Pin standard hosted jobs to `ubuntu-24.04`

CI, Storefront, production authorization, and production construction use the explicit standard label. This removes hidden repository-variable routing and avoids mutable self-hosted host state. The final deploy remains on `musuw-release` because its stable outbound path already reaches the restricted server and moving it would require a new networking or allowlist design.

### Replace the regional source artifact transport with exact-SHA checkout

Authorization still proves a full SHA belongs to `origin/main` and has successful canonical CI. The build job then uses official `actions/checkout` with that output SHA and asserts `HEAD` matches it before executing source. The custom projection, ranged Azure Blob downloader, and source artifact exist only for the slow Beijing route and are removed rather than adapted.

### Use the hosted toolchain and global upstream endpoints

Official `actions/setup-node` installs the `.nvmrc` version. Docker and native AMD64 checks remain, but Tencent daemon, BuildKit, APT, and Go proxy requirements are removed. BuildKit stays job-scoped and is deleted during cleanup; no cross-run cache is introduced.

### Preserve the existing image and release proof

The two raw Buildx pushes, immutable tags, provenance, remote digest comparison, production environment, non-cancelling concurrency group, and exact-SHA restricted deploy script remain unchanged. This limits the migration to execution location and obsolete regional transport.

## Risks / Trade-offs

- [A cold hosted builder can be slower than a warm persistent cache] → Keep sequential native builds and rely on GitHub/Docker/GHCR network performance; add no cache until a real hosted-run bottleneck is measured.
- [Standard runners have finite ephemeral disk] → Remove persistent cache reservations, keep BuildKit parallelism bounded, and retain the existing 90-minute job limit and cleanup.
- [GitHub-hosted runner IPs are not stable for SSH allowlisting] → Keep only the short final deployment on the existing restricted release runner.
- [The other model-selection task shares the repository] → Implement and commit from an isolated worktree with no overlapping application files.

## Migration Plan

1. Remove `MUSUW_ACTIONS_RUNNER`, then pin CI and Storefront to `ubuntu-24.04` with official Actions caches.
2. Commit the durable hosted labels, simplified production build, validator, and documentation changes from an isolated worktree.
3. Push and require a fresh CI, Storefront, production build, immutable image validation, deploy, and public health success.
4. Leave both self-hosted runners registered and unchanged during acceptance and the rollback window. Retiring the Beijing runner is a separate later operation; `musuw-release` remains required for deploy.

While the retained runner remains available, rollback is one workflow revert plus restoring `MUSUW_ACTIONS_RUNNER=musuw-release`; no production data or image needs to be changed. If an operator later retires that runner, rollback additionally requires re-registering `musuw-build-x64` and restoring its documented daemon, mirror, Node toolcache, and persistent-builder prerequisites.

## Open Questions

None.
