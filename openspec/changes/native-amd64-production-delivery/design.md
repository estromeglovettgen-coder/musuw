## Context

The current production image build targets `linux/amd64` from an ARM64 GitHub runner container inside Docker Desktop on an Apple Silicon Mac. A failed run stopped advancing during Debian package retrieval for more than fifty minutes; a retry crashed inside amd64 Go runtime code with `SIGSEGV`. Successful historical app builds still spent about 348 seconds compiling Go, 136 seconds installing runtime packages, and 136 seconds exporting/pushing. The Mac listener itself remained online and idle after cancellation. A zero BuildKit-container count was the expected post-job cleanup from `setup-buildx-action`, not a stopped runner.

GitHub-hosted private-repository minutes are exhausted. A separate Tencent lightweight-cloud Linux host is already paid and idle enough for construction: native x86_64, 4 vCPU, 4 GB RAM, 40 GB disk with roughly 24 GB free, Docker 28, and Buildx 0.19. Its inbound bandwidth is adequate but outbound throughput is roughly 2.8 Mbps. Existing BaoTa/nginx/MySQL/PHP/Node services have uncertain ownership and must not be deleted or repurposed. The Tokyo production host, forced-command SSH gate, immutable GHCR digest contract, and server runtime remain unchanged.

## Goals / Non-Goals

**Goals:**

- Remove ARM-to-amd64 emulation from every heavy production build.
- Avoid any required GitHub-hosted job and additional Actions billing.
- Make the x64 host build-only: no production Environment, SSH key, Tokyo credential, or untrusted pull-request job.
- Keep authorization/deploy on the trusted release runner and pass only validated immutable image refs across the boundary.
- Persist ordinary BuildKit layers and Go cache mounts locally without adding large registry-cache uploads.
- Bound BuildKit cache pressure so the builder coexists with unknown pre-existing host services.
- Preserve exact-SHA provenance, serialized release behavior, server health checks, and cold-cache correctness.

**Non-Goals:**

- Moving CI or storefront to the 4 GB x64 build runner.
- Deleting, reconfiguring, or depending on the host's pre-existing BaoTa/web/database services.
- Making Tokyo a runner or building images on Tokyo.
- Adding Docker Build Cloud, Depot, another vendor, or a custom builder service.
- Skipping builds merely because a mutable tag exists, or promising a duration before cold/warm native runs are measured.

## Decisions

### Route only production construction to `musuw-build-x64`

CI and storefront retain `${{ vars.MUSUW_ACTIONS_RUNNER || 'ubuntu-latest' }}`. Production authorization and deploy use `musuw-release`; only the `build` job uses the exact `musuw-build-x64` label. Authorization is lightweight and remains on the trusted Mac so the release has no GitHub-hosted dependency. The x64 build checks `runner.arch == X64`, `uname -m == x86_64`, and Docker server architecture before any build. No QEMU action is installed.

The x64 runner must be registered only to the canonical repository and used only by the trusted CI-green production workflow. Docker socket access is effectively host-privileged, so routing pull-request or general CI jobs to it would violate the isolation boundary. The runner polls GitHub outbound and does not require a new inbound service.

### Use the official setup action with fixed persistent state

`docker/setup-buildx-action@v3` currently declares both `name` and `keep-state` in its official action metadata. The workflow uses a fixed `musuw-production-native-amd64-v1` Docker-container builder, the checked-in BuildKit config, and `keep-state: true`. The action's documented cleanup preserves the builder volume, and recreating the same named builder reattaches that state on the persistent self-hosted runner. Both build-push steps explicitly select the action's builder output.

This is smaller and less error-prone than a custom CLI bootstrap wrapper. Actionlint 1.7.12 understands the current action metadata; the older 1.7.7 unknown-input report is treated as a stale-metadata false positive rather than a reason to remove a supported input.

### Prefer bounded local cache over maximum-mode registry export

The Docker-container builder volume retains normal layers and BuildKit cache mounts, including `/go/pkg/mod` and `/root/.cache/go-build`, across jobs. `.github/buildkitd.production.toml` enables OCI-worker GC with `reservedSpace = "2GB"`, `maxUsedSpace = "10GB"`, and `minFreeSpace = "12GB"`. These are BuildKit GC thresholds, not a filesystem quota; disk-free monitoring remains an operator responsibility.

The app and frontend build actions do not use `cache-from` or `cache-to`. A `mode=max` registry export would upload intermediate records over the constrained uplink after each build. Optional BuildKit record-artifact upload is also disabled; GitHub job summaries/logs and the repository's release evidence remain. Immutable image push remains mandatory; GHCR's content-addressed registry skips already-present blobs, so unchanged release layers are not uploaded twice. If the local builder state disappears, BuildKit performs a correct cold build and produces new validated image digests. BuildKit is capped at two parallel steps, matching the 4 GB host's memory constraint while retaining limited concurrency.

### Keep volatile metadata after stable dependency work

The app Dockerfile installs apt/tool dependencies before source and release metadata, pins `migrate` to the application dependency version, applies bounded apt retries/timeouts in both stages, and uses Go module/compiler cache mounts. The release SHA reaches the first layer that consumes it, so stable runtime package work remains cache-eligible while the binary and OCI provenance stay bound to the selected revision.

### Keep production secrets on the deploy side

The build job is not attached to `server-production` and contains no `secrets.*` reference. Its only configuration inputs are three browser-visible repository variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_WEKNORA_OAUTH_CLIENT_ID`; the fixed public origin is written directly. The build token has only `contents: read` and `packages: write`.

The deploy job waits for authorization and both image digests, has `contents: read` and `packages: read`, and alone receives the restricted SSH/server inputs. It generates `auth-public.env` from the same three repository variables, eliminating a second configuration source that could drift from the browser bundle. It validates the two canonical `repository@sha256` refs before calling the unchanged release seam with `--no-build` behavior on Tokyo.

### Retain serialized work and bounded timeouts

The constant `production-release` concurrency group with `cancel-in-progress: false` prevents overlapping image pushes and production mutations. Static bundles and both images stay sequential in one build job, avoiding simultaneous builders on a 4 GB host. The browser step caps V8 old space at 3072 MiB rather than the host's full physical memory. The cold build gets a 90-minute fail-safe; apt operations retain shorter per-request timeouts and bounded retries. CI keeps its existing same-ref cancellation behavior. A lower 2048 MiB ceiling is deferred until a real production build proves it sufficient.

## Risks / Trade-offs

- [The x64 runner is offline or mislabeled] → Authorization may finish, but build remains queued and deploy cannot start; runner service health is an activation prerequisite.
- [The host's old services consume memory or disk] → Do not delete them; keep builds sequential, enforce the 10 GB/12 GB GC thresholds, and observe available memory/disk during the first cold run.
- [A 3 Mbps uplink makes the first image push slow] → Avoid separate registry-cache export; record actual push bytes/time and rely on content-addressed blob reuse in later pushes.
- [Persistent self-hosted execution expands trust] → Route only trusted production build code, inject no production secrets, and never point general CI or pull requests at `musuw-build-x64`.
- [Local builder state is lost or GC is aggressive] → A cold build remains correct; only performance is lost, while immutable GHCR releases and production state are unaffected.
- [Four GB RAM is insufficient for a future build] → Treat an observed OOM as capacity evidence; do not delete unrelated services or add swap/resource changes implicitly from this repository change.

## Migration Plan

1. Register the native x86_64 runner to the canonical repository with the exact custom label `musuw-build-x64`; verify Docker 28/Buildx 0.19 access and do not install production credentials.
2. Configure the three browser-visible `VITE_*` repository variables by copying their current public-client values; never use a service-role/admin key.
3. Merge the workflow, BuildKit configuration, Dockerfile, contracts, and documentation after the separate auth bridge is complete. Do not dispatch from this repository-only change.
4. Run one CI-green release as the cold native baseline. Record runner architecture, BuildKit disk use, per-stage duration, pushed bytes, and both immutable digests.
5. Run a later ordinary change and record local cache hits, cache size, remaining disk, and push duration before making a quantitative speed claim.

Rollback is fail-closed: remove or disable the `musuw-build-x64` runner label to stop construction, or revert the workflow change before another release. Removing the named builder state forces the next job to build cold but does not delete immutable GHCR images or alter production. Never roll back by restoring ARM/QEMU construction or registering Tokyo as a runner.

## Open Questions

No provider or billing decision remains. Host capacity should be revisited only if measured native cold/warm runs show sustained memory pressure, insufficient disk margin, or unacceptable immutable-image upload time.
