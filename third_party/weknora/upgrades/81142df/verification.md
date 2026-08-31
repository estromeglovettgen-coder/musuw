# Upgrade verification record

This record separates inherited-worktree evidence from post-upgrade evidence so
pre-existing failures are not misclassified as vendor-update regressions.

## Pre-upgrade baseline

Source state: prefixed current-worktree audit tree
`fb468c34a8ed49142aee7f1aeaa0e81db2daa561`, before importing official target
`81142dfd17b2778087e95d3a317483a2fd909b91`.

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Upgrade contract red phase | Expected failure | `npm run upgrade:contract`: 3/3 tests failed for the intended reasons: provenance still v0.7.2, appended migrations absent, and representative target modules absent. |
| Go route and Wiki handler focus | Pass | `cd weknora && go test ./internal/router ./internal/handler`; both packages passed, including inherited Lite gate and untracked Wiki graph handler tests. |
| Auth shell | Pass | `cd auth && npm test`; 6 files and 100 tests passed. |
| Workspace router + Obsidian graph focus | Pass | `cd weknora/frontend && npm test -- src/router/index.test.mjs src/views/knowledge/wiki/graph/*.test.ts`; 41 tests passed. |
| Storefront production build | Pass with size warning | Vite built the inherited storefront successfully. |
| Storefront tests | Pre-existing failure | 62 tests passed; `tests/responsiveLayout.test.js` failed because its required `max-width: 1080px` media block is absent from the inherited CSS. `tests/storefrontStructure.test.js` then retained a pending promise and the run was interrupted after 104 seconds. This state predates the kernel import and must be repaired before final acceptance. |
| Dependency installation | Completed | `npm ci` completed in `auth/`, `storefront/`, and `weknora/frontend/`. npm reported no auth vulnerabilities, four storefront advisories, and eight workspace-frontend advisories; dependency reconciliation and final audit remain pending. |

## Post-upgrade verification

The entries below are fresh runs against the composed working tree. Final
whole-product reruns and the committed-tree identity are appended during the
release gate; diagnostic failures are recorded instead of being hidden.

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Fixed-source and migration contract | Pass | `npm run upgrade:contract` passes 4/4, including fixed commit/tree provenance, unique appended migration meanings, representative target capabilities, and high-risk Musuw auth/SaaS/storage/model-policy contracts. |
| Active source manifest | Pass | Final `node scripts/ci/source-manifest.mjs` reports 3,608 active source files and satisfies the fixed target floor of 3,284 files. `tracked-source-scan.mjs` reviews 4,056 tracked files and 96 approved binary assets. |
| Resolution ledger (final run) | Pass, zero blockers | Final `npm run upgrade:ledger` classifies the complete 1,601-path union (708 Musuw, 1,051 target, 158 overlap) with no missing, invalid, or unexplained exact-target replacement. |
| PostgreSQL existing database | Pass | Disposable `paradedb/paradedb:v0.22.2-pg17`: Musuw v93 migrated to v104 cleanly; tenant/session/message sentinel values survived and new artifacts/sandbox/memory/skills/env schema was present. |
| PostgreSQL fresh/retry path | Pass | Empty database reached clean v104; representative target and Musuw schema objects existed; v104 down then up returned to clean v104. |
| SQLite existing/fresh path | Pass | `go test ./internal/database` exercises a Musuw-v12 fixture and fresh history through v23, including `tenant_sandbox_configs`, `messages.artifacts`, and `sessions.sandbox_config_id`. |
| Backend focused security/data suites | Pass | Fresh `go test` runs pass for `internal/container`, `internal/sandbox`, `internal/types`, `internal/database`, `internal/router`, `internal/handler`, and the complete `internal/application/service` package. |
| Go full suite, vet and builds | Pass | Final `env -u LOG_FORMAT go test ./...`, `go vet ./...`, and `go build ./...` pass for the main module. The same test/vet/build sequence passes for CLI and Go SDK modules. AnyDoc-tagged test, vet and full build also pass. The first diagnostic run found and repaired a stale AES fixture, VPN synthetic-DNS assumptions, inherited log-capture behavior, and legacy skill-installer branding without weakening production encryption, SSRF, or logging policy. |
| CLI module | Pass | `go test ./...`, `go vet ./...`, and `go build ./...` pass after preserving the Musuw client's variadic resource-URL search contract in the target CLI interfaces. |
| Docreader | Pass | Python 3.12/uv CI runner passes 192 tests with 12 intentional tool/fixture skips. Port validation was moved ahead of DNS so an invalid port remains an invalid-port error under synthetic DNS. |
| Auth shell | Pass | `npm test` passes 100/100; production Vite build passes with explicit CI placeholder public/OAuth variables. Missing production variables still fail closed. |
| Storefront | Pass | `npm test` passes 63/63 and production Vite build passes. The inherited responsive assertion was aligned to the intentional 1023px breakpoint; the SSR fixture runs in a child process so Vite cannot retain the Node test runner. |
| Musuw WeKnora frontend | Pass | Final frontend baseline passes 955/955 tests, 11/11 i18n checks, type checking, and production build. The corrective Lite/Standard editor audit passes 98 focused tests: Lite deep links and validation redirects cannot expose hidden tabs, while Standard exposes the fixed-target settings. |
| DSH integration package | Pass | `npm ci`, typecheck, build, and 58/58 tests pass. A cold install of pinned `@deepseek-ai/dsh@0.1.0-rc.8` then passed all three real-harness scenarios: shipped env defaults, renamed profile override, and automatic visible-KB scope; each exercised search/read tool calls through mock WeKnora and produced a grounded answer. |
| AnyDoc native parser | Pass | Pinned source checksum/build, cargo audit, and `go test -tags anydoc ./internal/infrastructure/docparser/anydoc` pass. Audit reports only the pinned upstream warnings for unmaintained `ttf-parser` and yanked `chacha20`. |
| CI and production wiring | Pass | Workflow validator, root CI simulation, secret/credential scans, production and staging static verifiers, source manifest, and Dockerfile BuildKit checks pass. No nested WeKnora delivery workflow or parallel publisher is tracked. |
| Candidate image and existing-data runtime | Pass | BuildKit produced `weknora-v072-candidate-app:81142df` from the composed source with AnyDoc and the exact upstream revision label, plus the Musuw frontend/auth image. The isolated native stack started against the existing v0.7.2 PostgreSQL volume; direct and frontend-proxied health, UI/auth shell, OIDC PKCE binding cookie, clean migration 104, and absence of legacy services all passed `verify-runtime.sh`. A first module download ended on a transient proxy EOF and the cached retry completed. Real startup also found and fixed two candidate-only wiring defects: inherited production Langfuse enablement without local production keys, and missing public browser identity coordinates. Candidate tracing now stays disabled and its public identity uses the same fail-closed runtime seam as staging/production. |
| Artifact resource safety | Pass | Artifact collection now requires `SessionBoundedFileReader`; `SessionBoundManager` executes provider-side `head -c max+1` as the sandbox user and never falls back to an unbounded read. Tests cover a falsely advertised small file, provider argv/cap, oversize rejection, and sources without bounded capability. |
| Consolidated adversarial review | Pass, zero blockers | Corrective review verified Lite editor allow-list/deep-link behavior, mixed global/named sandbox leases, account-erasure transient-error handling, and provider-side artifact bounds. The only observation is inherited quick-answer `EventError` terminal behavior, unchanged from the checkpoint. |

## Preservation decisions recorded during reconciliation

- Named workspace sandbox configurations are authoritative for provider
  identity, credentials, template, TTL, and private-network policy. Existing
  env-only deployments retain the deployment-wide Docker manager, image and
  timeout contract when no named config is selected. The old `local` host
  process mode is intentionally rejected because it executes model-authored
  code outside an isolation boundary.
- Session pinning uses the stable `-` global-default sentinel so old sessions
  remain bound to the compatible Docker backend across instances and restarts.
- Secret writes for tenant, API-key, sandbox, skill and user environment data
  fail closed without an exact 32-byte `SYSTEM_AES_KEY`; legacy reads remain
  tolerant so operators can migrate existing rows.
- Musuw lifecycle fences, PKCE/OIDC identity binding, Lite product gates,
  Paddle/account-erasure queues, entitlements, OpenRouter metering, R2/storage
  accounting, TikHub ingestion, hidden platform defaults, consumer model
  policy, reasoning/error fields, and redacted logging remain authoritative.
  Target memory, artifacts, skills, sandbox configs, auto-tagging and env-var
  capabilities are composed at those existing owners.
- The final product tree contains no nested delivery workflows: twelve
  official workflow paths remain absent (eight inherited Musuw deletions,
  including four target-modified paths, plus four target-only additions).
  Musuw root CI directly validates the CLI, Go SDK, AnyDoc, DSH package and
  pinned harness E2E, and runs the target lint policy without introducing a
  second publisher. No runtime source is excluded.
- The local candidate intentionally disables Langfuse because it never copies
  production tracing credentials. Production remains enabled and reads both
  keys from protected files. Candidate browser identity values remain public,
  are generated from the existing root-only auth input, and pass through the
  same strict frontend serializer used by staging and production.

## First-version handoff

- Branch: `codex/upgrade-weknora-main-81142df`.
- Implementation commit: `0746755d5300bf5c38df0dba6ddbb435a49646a7`;
  recoverable pre-import checkpoint: `4749954d26b1b113252b7be2183fdca396279076`.
- Fixed upstream: `81142dfd17b2778087e95d3a317483a2fd909b91`, tree
  `37eaafdd6c276d2d1ddffffe1f39f8b38fd7cc03`.
- Completion: 59/59 OpenSpec tasks (100%), every mandatory gate passed,
  consolidated current blockers 0. The implementation commit was verified
  from a clean working tree and `git fsck --full --no-dangling --no-reflogs`
  passed before this handoff record was added.
