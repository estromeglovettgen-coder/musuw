## Why

Production images are currently built as `linux/amd64` on an Apple Silicon Docker Desktop runner, so expensive QEMU emulation, intermittent emulation crashes, and disposable builder state make releases slow and unreliable. An already-paid, otherwise idle native x86_64 Linux host can remove that failure mode without consuming exhausted GitHub-hosted minutes or turning the Tokyo production server into a runner.

## What Changes

- Keep CI and storefront on their existing `MUSUW_ACTIONS_RUNNER || ubuntu-latest` route, and keep lightweight production authorization plus deployment on the trusted `musuw-release` Mac runner.
- Route only the heavy production build job to the exact `musuw-build-x64` label and fail closed unless the runner, kernel, and Docker server are native AMD64.
- Materialize the already-authorized full SHA on that runner through GitHub's official REST tar-archive endpoint and credential-free `codeload.github.com` download, rather than fetching unused Git history over the regionally unstable Git smart-HTTP route.
- Give the build job only package-write access and three browser-visible repository variables; do not attach the production Environment or reference any production/SSH secret.
- Pass only validated immutable app/frontend digest references from build to the existing Mac deploy job, which continues the forced-command SHA-only Tokyo release seam without rebuilding.
- Use the official Buildx setup action with one fixed Docker-container builder and `keep-state: true` so ordinary layers and Go cache mounts survive jobs while each container is recreated from the current checked-in configuration; bound automatic BuildKit GC to a 10 GB maximum-use threshold and a 12 GB free-space floor.
- Route Docker Hub bootstrap and base-image pulls through Tencent Cloud's official regional mirror at both the Docker daemon and BuildKit layers, and fail the native preflight if the daemon-side mirror is missing.
- Route Debian and Go dependency downloads through Tencent Cloud's documented regional mirrors while retaining Go's authenticated mainland checksum endpoint, so cold builds do not depend on unreachable global defaults.
- Avoid a separate `mode=max` registry cache over the roughly 3 Mbps uplink. Push only the immutable release images and rely on registry blob deduplication plus local BuildKit state.
- Preserve Dockerfile stable-layer ordering, bounded apt network behavior, and the pinned Go migrate tool.

## Capabilities

### New Capabilities

- `native-production-delivery`: Defines native build-only runner routing, immutable build-to-deploy handoff, secret isolation, bounded persistent local cache, and cold-cache recovery.

### Modified Capabilities

None.

## Impact

The change affects the production workflow, app Dockerfile, workflow/Dockerfile contracts, actionlint configuration, deployment documentation, and the checked-in Docker daemon and BuildKit configurations. CI and storefront runner routing, application APIs, databases, runtime topology, Tokyo, and the restricted release protocol do not change. Activation requires registering the x86_64 runner with the `musuw-build-x64` custom label, installing the checked-in daemon configuration, and configuring three public repository variables; it does not require Actions billing or another build provider.
