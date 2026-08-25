# Musuw delivery workflow

GitHub is the only source of production code. The repository is
`estromeglovettgen-coder/musuw` and `main` is the release branch.

The two delivery targets are deliberately small:

- `storefront/` is the public marketing site and is deployed to the existing
  Cloudflare Worker `musuw-site` (`musuw.com` and `www.musuw.com`).
- GitHub Actions builds the `weknora/frontend/` and `auth/` browser bundles,
  builds the Go application and frontend runtime images, pushes those two
  images to GHCR, and records their immutable digests. The production server
  only pulls those digests and runs the checked-in Compose file.

## Runtime topology

- `musuw.com` and `www.musuw.com` → Cloudflare Worker `musuw-site` (the
  `storefront/` static site built by GitHub).
- `app.musuw.com` → Cloudflare Tunnel → the server's Nginx → the GitHub-built
  GHCR `frontend` and `app` images. This keeps API, login, uploads, and
  streaming responses on the existing server path instead of adding a Worker
  proxy.

The current production Lighthouse is the Tokyo host (`musuw-tokyo`). The
Cloudflare tunnel has one active connector at a time; keep the former Hong
Kong runtime intact as a stopped recovery copy and never run both connectors
for the same production hostname during a cutover.

The single credential inventory is [`external-credentials-registry.yaml`](external-credentials-registry.yaml),
with the operator playbook in [`SECRETS_AND_INTEGRATIONS.md`](SECRETS_AND_INTEGRATIONS.md).
The current launch boundary is Paddle Sandbox only: Live onboarding is under
review and has not been authorized, so a Live-shaped runtime input is a
configuration mismatch.

## Normal path

1. Push a change to a branch and open a pull request. CI runs the required
   frontend, auth, storefront, Go, DocReader, source-boundary and secret checks.
2. Merge the reviewed change to `main`. The successful CI run identifies the
   resulting full 40-character SHA; branch names and dirty checkouts are never
   release identities.
3. The storefront workflow receives that successful CI result, checks the
   exact SHA,
   builds only `storefront/`, and deploys it to `musuw-site`. It then checks
   both public domains and the documented product handoff.
4. The production workflow receives the same successful CI result. The trusted
   `musuw-release` runner performs the lightweight exact-SHA authorization, then
   a separate native x86_64 Linux runner with the exact `musuw-build-x64` label
   verifies runner and Docker daemon architecture plus the required regional
   Docker Hub mirror. The authorization job packages that already-proven SHA as
   one deterministic `musuw-source.tar.gz`, validates it, and uploads it through
   GitHub's existing immutable Actions Artifact service with a seven-day
   retention window. The build job intentionally contains no `uses:` step, so
   the regional runner does not pre-download Action bundles before its first
   command. It reads the same-run artifact through GitHub's official REST/blob
   path, validates its run/id/name/size plus both the outer ZIP and inner source
   digests, then safely stages the one source tree without Git or codeload. It
   selects the exact `.nvmrc` Node release already in the runner toolcache, then
   builds the static bundles and app/frontend images, pushes them to GHCR, and
   exports their validated immutable digests. The build runner receives no
   production secret or SSH input. Only after it succeeds does `musuw-release`
   upload the allowlisted server source bundle and those exact refs through the
   restricted SSH gate. A manual full-SHA dispatch is retained for an exact
   rerun; tag and branch-name releases are rejected.
5. The server receives a short-lived GitHub token over the restricted stdin
   channel, logs in to GHCR using a temporary Docker config, pulls the exact
   digests, recreates only `app` and `frontend` with `--no-build`, and checks
   `/health`. The token and temporary config are removed at exit.
   A short maintenance window is expected. A failed command is reported as a
   failed release; correct the source and run the normal path again.

There is one server Compose project and one source path. Do not add parallel
projects, temporary runtime modes, extra release state, or a second deployment
protocol.

The delivery intentionally has no release-transaction ledger, backup
choreography, blue/green stack, secondary edge/readiness path, or server-side
build. A failed release is reported as failed; recovery is a manual dispatch
of the exact full SHA that passed CI. The server keeps its existing data,
runtime secrets, and named volumes in place.

## Source and upload boundary

The release bundle is materialized from tracked files at the selected SHA. It
contains application source, lockfiles, the production Compose files, scripts,
safe examples and documentation only. It must not contain `.env` values,
private keys, dependency directories, generated output, logs, databases,
volumes or server runtime files.

The restricted SSH key and pinned `known_hosts` entry are supplied only to the
deploy job, never to the native image-build job. The gate must reject a mutable ref, an unsafe path, an
unallowlisted file or an arbitrary shell command. Runtime secrets, database and
object-store data, Redis/Neo4j data and tunnel credentials stay on the server;
the upload never copies or prints their values.

## Cloudflare storefront

The Worker-scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are
secrets of the `storefront-production` GitHub Environment. The storefront job
receives no server, database, model, auth or billing credentials.
`storefront/wrangler.jsonc` is the deployment
configuration and the Worker serves only the public static site. Product
actions hand off to `https://app.musuw.com/auth/start`.

After deployment, check both domains, the HTML language signal and the auth
handoff. A Cloudflare command succeeding without these probes is not enough.

## Production server

The native build job receives the selected full SHA, three browser-visible
repository variables required by the auth shell, and a job-only `GITHUB_TOKEN`
with `actions: read`, `contents: read`, and `packages: write`. Artifact read is
needed only to obtain the source bundle created by the authorization job in the
same workflow run. It is not attached to the `server-production`
Environment. The deploy job receives the restricted `musuw-deploy` SSH key,
pinned host keys, the existing public server environment file, the same three
repository variables used to generate `auth-public.env`, the validated image
refs, and a separate job-only token with `packages: read`. The server owns all
private configuration and never stores that token.

The fixed production Compose file is the only runtime definition. The update
sequence is GitHub build/push → upload/verify SHA and manifest → GHCR login →
pull exact digests → `docker compose up -d --no-build --force-recreate app
frontend` → health checks. Keep named volumes and server-owned runtime files
in place; the server never builds images or prunes its build cache.

On a fresh host, install the tunnel token with
`scripts/weknora-production/install-tunnel-token.sh` (the token file is
server-owned, not tracked). The installer rejects symlinks and requires the
cloudflared runtime UID (65532) to own the file with mode `0600`; it reports
only numeric ownership and mode. During a cutover, quiesce the current writers,
seal and verify the data snapshot, stop the old connector, restore and
health-check the target, and only then start the target connector. The current
rollback posture is stop-and-retain-disk: stop Tokyo public traffic and keep
the Hong Kong runtime, releases, volumes, and Tunnel inputs stopped for an
operator-led recovery. After the migration observation window the Hong Kong
guest was powered off only after a zero-public-service precheck; its disk and
volumes remain retained. This migration does not promise a hot reverse-sync or
safe traffic flip without a separately verified data restore.

Useful checks after a release are:

```text
curl -fsS https://musuw.com/
curl -fsS https://www.musuw.com/
curl -fsS https://app.musuw.com/
curl -fsS https://app.musuw.com/health
curl -fsS https://app.musuw.com/auth/start
```

The public storefront and the server release are independent: a green
storefront job does not imply a green server job, and a server upload never
changes the Cloudflare Worker.

## Required repository settings

Production authorization and deploy remain on the trusted `musuw-release`
runner. Only the heavy image-build job uses the exact `musuw-build-x64` label.
That runner must be a persistent native x86_64 Linux host with Docker and
Buildx, and the job fails closed unless `runner.arch`, `uname`, and the Docker
daemon all report x64/AMD64. It never installs QEMU. The Tokyo production host
must never be registered as a GitHub Actions runner.

This path does not require GitHub-hosted minutes, Docker Build Cloud, or another
build provider. CI and storefront keep the existing
`MUSUW_ACTIONS_RUNNER || ubuntu-latest` routing and MUST NOT use
`musuw-build-x64`; the new 4 GB builder is reserved for production construction.
The build runner must not store or receive the production SSH key, host data,
server environment secrets, or Tokyo credentials.

The workflow creates the fixed Docker CLI builder
`musuw-production-native-amd64-v1`. Its Docker-container volume preserves
ordinary layers plus Go module/compiler cache mounts across releases. Every job
uses the preinstalled official Buildx CLI and a private, persistent
`$RUNNER_WORKSPACE/.musuw-production-buildx-config` client-state directory. If
an interrupted prior job left the fixed builder registered, setup first removes
that exact builder with `--keep-state`; it then recreates the container from the
current checked-in config. Normal cleanup removes it the same way while keeping
both the client-state directory and same-name cache volume.
The checked-in BuildKit
configuration enables GC with a 10 GB `maxUsedSpace` threshold and a 12 GB
`minFreeSpace` floor, and caps BuildKit at two parallel steps. The browser build
runs before the image builds with a 3072 MiB Node heap ceiling so
the 4 GB host retains headroom for Docker. If the builder or cache is absent,
the same workflow performs a correct cold build.

The dedicated Tencent build host must install
`.github/docker-daemon.production-builder.json` as `/etc/docker/daemon.json`
after `dockerd --validate`, then restart Docker while the runner is idle. The
daemon uses Tencent Cloud's official regional mirror for the BuildKit bootstrap
image; `.github/buildkitd.production.toml` uses the same mirror for Dockerfile
base images. The native preflight rejects a host that lacks the daemon mirror.
This regional mirror is an infrastructure prerequisite for this Tencent-hosted
builder, not a new application dependency or a fallback build provider.

The application build also consumes Tencent Cloud's documented regional
dependency endpoints instead of reaching globally routed defaults from the
Beijing host. The workflow passes the Dockerfile's existing `APT_MIRROR_ARG`
seam as `mirrors.cloud.tencent.com`; the builder stage uses
`https://mirrors.tencent.com/go/` for all Go module fetches and
`sum.golang.google.cn` for Go's authenticated checksum database endpoint in
mainland China. Checksum verification remains enabled. This covers the pinned
`migrate` tool and the application's complete module graph without adding a
custom proxy, copying an older prebuilt tool binary, or changing the module
versions recorded by `go.mod` and `go.sum`.

The Beijing build job deliberately does not run Git smart HTTP or reference a
GitHub Action. GitHub Runner prepares every referenced Action before executing
the first inline command, and the regional Action-archive failure therefore
cannot be fixed by replacing checkout alone. Authorization
and the `origin/main` ancestry proof remain on `musuw-release`, where the full
checkout is required and available. It packages only that exact approved tree
with `git archive`, deterministic gzip, a fixed root, a 256 MiB cap, safe member
types, required build inputs, executable-mode proof, and an inner SHA-256. The
single-file bundle is uploaded once with the official `upload-artifact@v4`
action, compression disabled, and seven-day retention; it is a bounded transport
record, not a permanent source backup or a second release authority.

The build job uses `actions: read` to query that exact artifact's metadata from
the fixed `api.github.com` repository endpoint. It binds artifact id and name to
the current workflow run, rejects expired or oversized metadata, and requires
the REST digest to match the upload output. Each bounded attempt obtains a fresh
short-lived download redirect, accepts only an HTTPS `*.blob.core.windows.net`
authority, and sends no GitHub Authorization header to that blob host. The
downloaded ZIP size and outer SHA-256 must match metadata, the ZIP must contain
exactly `musuw-source.tar.gz`, and that inner file must match the authorization
job's SHA-256 before extraction. Extraction occurs in an isolated
runner-temporary directory with ambient tar options disabled, rejects an unsafe
tree and special members, preserves executable modes, validates required build
inputs, and replaces only the exact repository workspace while retaining the
prior tree until post-move checks pass. This avoids Git, codeload, third-party
mirrors, custom proxies, new storage services, and a second source authority on
the regional build path. GitHub's documented self-hosted-runner and Artifact
domains must remain allowed for runner operation.

Node is not installed during a release. The job reads `.nvmrc`, requires the
matching x64 Node and npm executables under `RUNNER_TOOL_CACHE`, validates their
versions and architecture, and adds that existing directory to `GITHUB_PATH`.
Docker and Buildx are likewise persistent host prerequisites; feature checks
for checked-in daemon configuration, metadata output, attestations, and
keep-state cleanup fail before dependency work when the host drifts.

GHCR login uses the job token only over stdin and writes it to a
runner-temporary `DOCKER_CONFIG`; Buildx configuration, state, and logs instead
use the separate owner-only `BUILDX_CONFIG`, which never stores the registry
credential. Activation confirmed that the former action left no same-name
builder registration or container and retained exactly the same-name state
volume expected by Buildx. Always-running cleanup logs out, removes the current
fixed builder container while preserving that named volume, and only then
deletes the temporary Docker configuration. Each of the two explicit Buildx pushes
retains the previous tags, labels, arguments, native platform, and
private-repository `mode=min,inline-only=true` provenance with the exact Actions
run-attempt URL as builder identity. Build metadata must name the expected
immutable tag and yield matching descriptor and registry digests; the canonical
digest and its remote tag are both resolved from GHCR and must match before
deploy receives it. The digest validator returns failures explicitly at every
check because Bash `errexit` is not a safe failure boundary inside a function
invoked through command substitution.

Do not export a separate `mode=max` registry cache on this host: its constrained
uplink would upload intermediate cache records in addition to the release. The
two immutable GHCR images are still pushed normally, and GHCR skips blobs it
already has by content digest. The CLI path creates no optional Docker Action
build-record artifact, while job logs, image digests, provenance, and the
release manifest stay available. The app Dockerfile keeps stable apt/tool and runtime-package layers
ahead of the release SHA. Public npm downloads use the self-hosted runner's
ordinary persistent npm cache instead of uploading a duplicate Actions cache.

Keep the following values in GitHub settings or on the server, never in checked-in
files:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- workflow `GITHUB_TOKEN` package-write permission for the native build job
  and package-read permission for the deploy job
- repository variable `MUSUW_ACTIONS_RUNNER=musuw-release` while CI/storefront
  must avoid the exhausted GitHub-hosted allowance
- repository variables `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_WEKNORA_OAUTH_CLIENT_ID`; these are
  browser-visible public-client values, never server/admin credentials
- the restricted production SSH key and pinned `known_hosts`
- the public server environment file; `auth-public.env` is generated from the
  same three repository variables used by the browser build
- all database, object-store, model, OIDC, Supabase service and tunnel secrets

The target-specific split is intentionally narrow:

| Settings location | Allowed production inputs |
| --- | --- |
| `storefront-production` | Cloudflare account ID and Worker-scoped API token only. |
| Repository variables | Three browser-visible `VITE_*` values shared by native build and deploy. |
| `server-production` | Restricted SSH key/host settings and the public server input file consumed only by deploy; least-privilege package-read token. |

Private runtime credentials remain on the server; they are not copied into the
repository, Cloudflare Worker, or browser bundles.

The protected production secret directory must include the file-backed
OpenRouter Management key plus the Sandbox Paddle API key and secret for the
exact Sandbox notification destination. The non-secret production public
environment carries only `sandbox`, its matching `test_` client token, and six
approved Sandbox Plus/Pro/Max monthly/yearly price IDs. The preflight and app
entrypoint both require `test_` with `pdl_sdbx_apikey_` and reject Live even
when its prefixes are internally consistent. They also reject mixed pairs, an
invalid destination-secret shape, missing or duplicate prices, and any server
secret placed in the generated environment.

The current checked launch stage is **Paddle Sandbox** because Live has not
been authorized. Keep `production.env.example`, the protected API key, all six
prices, and the exact notification destination on Sandbox as one unit. Price
IDs and destination secrets do not encode their environment, so prefix checks
are necessary but not sufficient: before enabling checkout, resolve all six
recurring prices through the Sandbox Paddle API and accept one correctly
signed event from that exact destination. Live cannot be enabled with an env
edit. After authorization, a future cutover requires a reviewed code change
that replaces the entire unit together; never rotate one field in isolation.

Sandbox launch data is disposable and is not migrated across Paddle
environments. Remove stale test accounts through the existing product account
deletion lifecycle and validate a fresh checkout; do not add a parallel
subscription-recovery path or repair billing state with SQL. Only a correctly
signed active `subscription.created` or `subscription.activated` event with the
tenant binding and a confirmed current period grants an initial paid period.
Later allowance renewals still require a correctly signed
`transaction.completed` event with `subscription_recurring` origin. Browser
callbacks never grant either state.

The checked-in lockfiles are used by CI (`npm ci`). When a dependency changes,
regenerate its lockfile in the same change.
