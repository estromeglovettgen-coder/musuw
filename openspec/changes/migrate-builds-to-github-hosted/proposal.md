## Why

The public repository can use standard GitHub-hosted runners without consuming the private-repository minutes allowance, while the Beijing self-hosted path is slow and requires regional download and cache machinery. Move ordinary builds to the existing hosted fallback and move production image construction off the Beijing runner without changing release authority or the restricted server deployment seam.

## What Changes

- Remove repository-variable runner routing, pin CI and Storefront to standard `ubuntu-24.04`, and use official Actions caches.
- Run the production image build on standard GitHub-hosted AMD64 Linux instead of `musuw-build-x64`.
- Replace Beijing-only Docker, APT, Go proxy, persistent BuildKit, and preinstalled Node assumptions with the official hosted toolchain and global upstream endpoints.
- Preserve exact-SHA authorization, immutable GHCR tags and digest validation, serialized releases, production environment isolation, and the restricted SSH deployment job.
- Retire the Beijing build runner from required production infrastructure; do not change application behavior or the Tokyo runtime.

## Capabilities

### New Capabilities

- `github-hosted-delivery`: Run CI, Storefront, and production image construction on standard GitHub-hosted runners while preserving the existing release security and deployment contracts.

### Modified Capabilities

- `native-production-delivery`: Replace the superseded self-hosted Beijing construction and source-transport requirements with standard hosted construction while retaining immutable image proof and the restricted deploy seam.

## Impact

Affected areas are GitHub Actions runner selection, production BuildKit and Dockerfile network configuration, workflow validation, and deployment documentation. No application API, data model, product feature, runtime secret, or server topology changes.
