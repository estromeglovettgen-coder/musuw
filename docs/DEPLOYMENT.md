# Musuw delivery workflow

This repository is the delivery source of truth for `estromeglovettgen-coder/musuw`.
The active product is split into three browser-facing shells and the active
WeKnora application under `weknora/`:

- `storefront/` is the public Musuw site and is deployed to the Cloudflare
  Worker configured by `storefront/wrangler.jsonc`.
- `auth/` is the same-origin login shell. It is built with public browser
  configuration and is released together with the application bundle.
- `weknora/frontend/` is the authenticated product UI. The Go server and
  DocReader remain under `weknora/`; the historical `backend/` tree is not an
  active deployment authority.

## Normal path

1. Create a branch and open a pull request.
2. `CI` runs on the pull request and again on `main`. It covers the active
   frontend (tests, TypeScript, locale-key audit and build), auth shell
   (tests, type-check and build), storefront (tests, build and Wrangler
   dry-run), active Go/DocReader suites, release simulation, source
   provenance and credential scanning.
3. A push to `main` first runs `CI`. Only after that workflow completes with
   `success` does the canonical repository receive the `workflow_run` event
   that starts `Deploy storefront`; a failed, cancelled, or non-canonical CI
   run cannot reach the build or Cloudflare mutation jobs. The workflow checks
   out and deploys `workflow_run.head_sha` (never `github.sha` for this event),
   uploads the tested `storefront/dist` artifact, and deploys only the Worker
   in `storefront/wrangler.jsonc`. The Worker version is annotated with the
   selected full SHA in both its message and tag. This ordering also applies to
   the first push into an empty repository: CI must finish before the automatic
   storefront follow-up is eligible.
4. A manual `Deploy storefront` dispatch remains available from `main` for an
   operator-supplied full SHA. It verifies that the SHA is on `main` and that
   the Actions API reports a successful `CI` run for that exact SHA before any
   storefront build or Cloudflare credential-bearing step starts.
5. The application production release is intentionally a second gate. Run
   `Deploy production` manually from the protected `main` branch with a full
   commit SHA or annotated `v*` tag as the only release-selection input. It
   resolves the ref to a full SHA, checks that SHA is an ancestor of
   `origin/main`, and requires a successful `CI` run for that exact SHA. It then
   invokes only the restricted `preflight`, `promote`, and `run` protocol; the
   caller cannot select a runtime role or partial release. `run` owns the
   internal `prepare` → `web` → `worker` orchestration described below.
   A production tag or cutover is not authorized until the transaction has
   complete predecessor snapshots, the capacity/ledger gates pass, and two
   successive reviewed-SHA transactions have produced independent evidence.
   The workflow never edits databases, volumes or runtime secrets directly.

   This is the target release contract. The currently published workflow's
   absence of a role input is intentional, not an implementation gap. The
   dynamic transaction and its live evidence are still incomplete, so the
   production path remains NO-GO until the unchecked transaction tasks and
   their live evidence are complete.

The storefront dispatch has the same immutable-ref discipline (full SHA only)
and is restricted to `main`; its Actions API CI check is independent of the
automatic `workflow_run` conclusion gate. Both `musuw.com` and `www.musuw.com` are probed
after the Cloudflare mutation; the response must expose an `en`/`zh-CN`
`Content-Language`, matching HTML `lang`, and `window.__MUSUW_LOCALE__`. The
workflow retains Wrangler version/deployment snapshots, smoke output, a source
manifest reference and SHA-256 release manifest as an artifact.
Before mutation it extracts the 100%-traffic version from the latest Wrangler
deployment snapshot. Wrangler 4's non-interactive `wrangler rollback
<version-id> --yes --message ...` is the only rollback command used; if deploy
or either public smoke fails, the workflow rolls back to that exact version,
re-probes both aliases, records the evidence, and still fails the run. If a
previous 100%-traffic version cannot be resolved, the workflow fails before
calling `wrangler deploy`.

This separation keeps routine public-site changes fast while preventing a
normal UI merge from silently changing the production application or data
plane. The successful B storefront deployment is evidence for the public site
only; it is not evidence that the server transaction or app-edge migration is
production-ready.

The full application path is valid only from a clean Git checkout. The
checkout `HEAD` must equal `WEKNORA_DEPLOY_REVISION`; staged, modified or
untracked allowlisted source fails before any build or upload. Generated
`dist/`, `node_modules/` and `.vite/` output is ignored for this integrity
check, while the source manifest enumerates only tracked files with
`git ls-files`. A dirty local `knowledge` worktree therefore must not be used
as a production release input; use the immutable GitHub checkout instead.

## Server production transaction (current status: NO-GO)

The server release is a dynamic, per-SHA Docker Compose transaction. Historical
M35 compose files and a one-shot handoff are not a supported release authority.
The transaction manifest binds the full SHA to a safe attempt ID, source
bundle checksum, rendered Compose/config digest, immutable image digests,
ordered internal phase/role evidence, and references to server-owned runtime
state.

Runtime roles are internal process modes, not workflow inputs or SSH commands:

| Internal role | Scope | Edge behavior |
| --- | --- | --- |
| `prepare` | validate SHA/source/config, check capacity and migrations, capture rollback state, and prepare the candidate | never owns the public edge |
| `web` | frontend/app/HTTP surfaces from the same source/config/image contract | web-only cutover after web verification |
| `worker` | document processing, queue consumers, and other background ownership | no independent public edge mutation |
| `all` | compatibility/default mode for the predecessor native process | not a new-transaction phase and never caller-selectable |

Every `run` acquires one exclusive lock for the complete release; a second
`run` is rejected or queued, and there is no role-specific production
transaction. Under that lock the adapter performs internal `prepare`, builds
digest-pinned images, stages and verifies `web` privately, cuts over and probes
the public edge, starts/verifies `worker` and hands off background ownership,
then observes and commits—or enters full rollback. Neither GitHub nor the SSH
caller can skip, reorder, or independently request those roles.

Before cutover, the transaction must snapshot and hash the predecessor source,
rendered config/public overlay, image digests, background-worker ownership,
current release pointer, and edge alias. A failure restores all of those
surfaces, stops/disconnects candidate web and worker services, re-probes the
public edge, and retains both manifests. Missing old edge/image identity is a
fail-closed NO-GO; the system must not guess from a mutable tag or container
name. Volumes, secrets, and forward-applied migrations are never deleted or
rewritten by rollback.

Only forward-only additive migrations are eligible for a normal release. The
one-time native live-ledger normalization is a separate prerequisite with
dry-run counts, backup/restore proof, maintenance lock, idempotence evidence,
and before/after checksums; it is not repeated or undone by code rollback.

`prepare` enforces the fixed 12 GiB (`12,582,912` KiB) free-capacity reserve.
If the reserve is low, it may perform exactly one logged cleanup of unused
Docker build cache/dangling images and re-check. It never deletes volumes,
runtime/secret files, current or predecessor releases, or user data.

As of 2026-08-16, the server reports approximately `8,939,456` KiB free,
below the floor. No production tag or server workflow run exists. The current
cutover state lacks the old M35 predecessor ID; native containers/state are
not deterministically repeatable, and new-SHA old-image capture plus complete
source/config/image/background/edge rollback has not been rehearsed. These
facts keep production NO-GO.

The latest successful external evidence is:

- B commit `2d9091b98b90cb0e4ce6bde081027a0f61af7949`;
- [`CI` run 31933653091](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31933653091), all required jobs green;
- [`Deploy storefront` run 31933748281 attempt 2](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31933748281), Worker version `20d7ad96-2a01-4437-93d7-3ba7d0995d14` at 100%, artifact `9260177059`.

This evidence does not satisfy the server's two-successive-release gate. Do
not create a production tag or dispatch until the dynamic transaction,
one-time ledger evidence, capacity floor, predecessor snapshot, full rollback,
and two successive release manifests are all green.

## Required GitHub configuration

Configure the following repository or organization secrets before enabling the
deploy workflows. Secret values are consumed through step environments and are
never printed; no environment-scoped secret or reviewer is required.

### Cloudflare storefront

- `CLOUDFLARE_API_TOKEN`: a narrowly scoped token that can deploy the
  `musuw-site` Worker (do not use a global API key).
- `CLOUDFLARE_ACCOUNT_ID`: the account that owns `musuw.com`.

The storefront workflow does not receive application, database, model or OIDC
credentials. Wrangler uses the checked-in `storefront/wrangler.jsonc` only.
The Worker is route-only in that config: `workers_dev` and `preview_urls` are
both disabled, so an accidental `*.workers.dev` or preview URL is not part of
the supported release surface.

### Production application

- `MUSUW_PRODUCTION_SSH_PRIVATE_KEY`: a dedicated `musuw-deploy` key. The
  server-side public-key entry must use `restrict` and a forced
  `musuw-deploy-ssh-gate` command; an unrestricted root key is not an accepted
  production configuration.
- `MUSUW_PRODUCTION_SSH_KNOWN_HOSTS`: a reviewed, pinned `known_hosts` entry
  (including the exact host key algorithm); the workflow never calls
  `ssh-keyscan`.
- `MUSUW_PRODUCTION_SSH_REMOTE`: the approved `musuw-deploy@host` target. The
  production workflow must not point this secret at `root@host`.
- `MUSUW_PRODUCTION_SSH_PORT`: optional non-default SSH port.
- `MUSUW_PRODUCTION_PUBLIC_ENV`: the public/runtime configuration file expected
  by the production release seam.
- `MUSUW_AUTH_PUBLIC_ENV`: the production auth shell's public browser
  configuration file, including exactly one assignment for each of
  `VITE_AUTH_PUBLIC_ORIGIN`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_WEKNORA_OAUTH_CLIENT_ID`.
  Production must set `VITE_AUTH_PUBLIC_ORIGIN=https://app.musuw.com`.
- `MUSUW_AUTH_STAGING_PUBLIC_ENV`: the staging-only auth shell configuration
  with the same four assignments. It must set
  `VITE_AUTH_PUBLIC_ORIGIN=https://staging-app.musuw.com` and may carry a
  staging-specific OAuth client ID; never reuse the production secret here.
  Local development uses `http://localhost:4190` or
  `http://127.0.0.1:4190` directly in the auth build environment.

The workflow writes these values into a `0700` runner directory and removes
the key, known-hosts file and env files in an `always()` cleanup step. Server
credentials, model keys, database passwords and OIDC client secrets stay on
the server; they do not belong in `MUSUW_*_PUBLIC_ENV` or in Git history.

The production workflow passes the following formal seam variables to
`scripts/weknora-deploy.sh`:

| Variable | Purpose |
| --- | --- |
| `WEKNORA_DEPLOY_RUNTIME_DIR` | Runner directory containing the two public env files |
| `WEKNORA_DEPLOY_KNOWN_HOSTS_FILE` | Pinned SSH host keys |
| `WEKNORA_DEPLOY_SSH_KEY` | Temporary restricted `musuw-deploy` private-key path (required) |
| `WEKNORA_DEPLOY_REMOTE` / `WEKNORA_DEPLOY_SSH_PORT` | Approved restricted SSH target (remote required) |
| `WEKNORA_DEPLOY_REVISION` | Immutable full commit SHA being released |

These names are the contract between GitHub Actions and the existing release
seam. Do not replace them with a PATH wrapper or an ad-hoc SSH command. The
full update fails closed unless both `WEKNORA_DEPLOY_SSH_KEY` and
`WEKNORA_DEPLOY_REMOTE` are explicitly supplied; it has no workstation-key or
implicit root-target fallback.

### App edge staging

`Deploy app edge staging` keeps pull-request verification secret-free. A
canonical manual dispatch with `deploy=true` must run from `main`, accept a
full immutable `immutable_ref`, and query the Actions API for a successful
`CI` run whose `head_sha` is exactly that requested SHA. The check happens
before the staging job exposes Cloudflare credentials. It rebuilds the staged
frontend/auth assets and deploys only `app-edge` with `--env staging`; it never
invokes the dormant production environment. A first empty-repository push is
therefore ordered as `CI` → automatic storefront follow-up, while staging
remains an explicit operator dispatch.

## Restricted production SSH seam

The full `scripts/weknora-deploy.sh update` path uploads through a dedicated
incoming spool (`/var/lib/musuw-deploy/incoming/<release-id>/source`) and then
uses three fixed SSH verbs: `musuw-gate preflight`, `musuw-gate promote` and
`musuw-gate run`. The forced command rejects shells, environment assignments,
rsync sender/read mode, deletion flags, command hooks and paths outside the
allowlisted source component directories. The root-owned gate verifies the
source manifest, rejects symlinks and runtime/secret paths, promotes the spool
to an immutable release, and invokes only the fixed staged release adapter. It
runs with a fixed system `PATH`; the sudo rule pins the same `secure_path` and
permits only the wrapper. The caller-supplied capacity hint cannot be lower
than the fixed 12 GiB (`12582912` KiB) reserve.

This restricted SSH gate is the transport boundary, not by itself proof of a
safe production release. Its staged adapter must implement the dynamic
per-SHA Compose transaction, one full-transaction lock, and internally assigned
`prepare` → `web` → `worker` sequence above. The gate rejects any extra role,
mode, verb, or command suffix; `all` remains only a native-process compatibility
mode and is not part of the caller grammar. Until the adapter captures the
predecessor source/config/image/background/edge state and passes fresh
rehearsals, the existing `update` path remains a transport-capable but
production-NO-GO seam; do not treat its historical static or M35-era
simulations as current rollback evidence.

Bootstrap is a one-time operator action over the existing root channel:

```text
bootstrap-musuw-deploy.sh <new-public-key>
verify-musuw-deploy-gate.sh
```

The bootstrap creates `musuw-deploy`, installs the root-owned gate and a
`sudoers` rule for that single wrapper, and retains the previous root key until
the new key passes the negative parser tests and a rehearsal. Remove/revoke
the old root key only after that evidence is recorded. If bootstrap or a gate
upgrade fails, restore the root-owned authorized-keys/gate/sudoers backup; a
release failure remains reversible through `release-ci.sh` and its existing
cutover rollback. The local `update-ui` command remains a legacy, root-only
compatibility path for operator rehearsals and therefore requires the separate
`WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE` and
`WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY` inputs. It never falls back to the
restricted production inputs; GitHub production never invokes it and uses only
the restricted full update seam.

The auth shell has a checked-in `auth/package-lock.json`; CI and the production
rebuild use `npm ci` for `auth/`, `weknora/frontend/` and `storefront/`. If a
dependency changes, regenerate the lockfile in the same pull request and let
the CI cache key change with it.

## Approval and rollback

For a private repository on GitHub Free, use repository or organization secrets
only. Environment reviewer approvals and environment branch-protection rules
are not available as a dependable gate on that plan, so this repository does
not claim to have them. Every release gate is encoded in workflow code:
dispatch must run from `main`, the selected immutable SHA must be on
`origin/main`, and a successful `CI` run for that exact SHA is required. If an
external human approval is required, put it in front of `workflow_dispatch`
or move to a plan that supports the needed control.

Protect `main` against direct pushes and require the `CI` workflow to pass
before merging. Keep the production workflow available only to the small set of
maintainers who can create approved tags or run the manual dispatch.

For a failed production update, the future dynamic transaction must keep the
prior immutable release and perform a health-gated rollback across source,
config, images, background ownership, and edge. The workflow must record the
rollback evidence as an artifact; a missing predecessor identity is a
fail-closed NO-GO, not a reason to guess. An operator can use the existing
server-side `scripts/weknora-production/rollback.sh` procedure over the
approved SSH path only after the new snapshot contract is verified. Do not
delete `/opt/weknora/runtime`, named volumes, forward-applied migration state,
or the previous release while diagnosing an incident. For the storefront, the
workflow records Wrangler's previous/current deployment snapshots and smoke
results in a checksum'd release manifest; select the prior Worker version in
Cloudflare's deployment/version history and redeploy it through the normal
Cloudflare control plane if recovery is needed.

The production release seam emits `source_bundle_sha256`, the sorted allowlist
hash of the uploaded server source, and the workflow copies that value into
the production release manifest beside the immutable commit SHA and release
ID. A missing value is represented as `null` and is treated as an evidence
gap, not a fabricated checksum.

## Local checks

Before opening a PR, the same contracts can be checked without credentials:

```bash
ruby scripts/ci/validate-workflows.rb
bash scripts/ci/secret-scan.sh
node scripts/ci/source-manifest.mjs
bash scripts/weknora-workflow-simulation.test.sh
```

Production and Cloudflare deployment commands are deliberately not part of
local verification. They require the protected GitHub secrets and the normal
release approval path.
