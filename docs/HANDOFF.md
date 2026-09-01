# Musuw / WeKnora main upgrade handoff

**Audience:** a fresh, no-context reviewer or acceptance operator.

**Snapshot:** 2026-09-01 (America/Phoenix). The fixed WeKnora-main source,
Musuw product curation, structural settings-UI correction, full local/CI gate,
automatic staging-only release, remote infrastructure gate and ordinary
Lite-user browser acceptance are complete. The current deployed staging source
and resolution-ledger commit is `09b1bc0b`; the structural UI behavior is in
ancestor `f092dfee`, and the Memory draft-race correction remains in ancestor
`cd52965f`. CI run `33509979358` and automatic staging-only run `33510660189`
completed successfully. The earlier independent review at `553f7bac` found one
visual mismatch; `f092dfee` corrected it by reusing the Musuw settings shell,
left navigation, row grammar and footer, and the deployed corrective browser
pass found no functional, infrastructure or visual blocker. Paddle Sandbox
acceptance remains **PARTIAL**. Production application traffic remains on the
old release. Do not run a `promote` dispatch from this document.

This is the current project handoff. It is intentionally a single, stable
document rather than a dated second source of truth. Code, checked-in release
scripts, and the documents linked below remain authoritative if this snapshot
is stale.

## 1. Start here

Read these files in order:

1. [`AGENTS.md`](../AGENTS.md) - repository rules and source ownership.
2. [`README.md`](../README.md) - product/source map and release overview.
3. [`DEPLOYMENT.md`](DEPLOYMENT.md) - immutable build and production boundary.
4. [`STAGING_OPERATIONS.md`](STAGING_OPERATIONS.md) - staging runbook and
   Sandbox acceptance gate.
5. [`SECRETS_AND_INTEGRATIONS.md`](SECRETS_AND_INTEGRATIONS.md) - secret and
   provider boundaries; never print or copy values.
6. [`third_party/weknora/upgrades/81142df/README.md`](../third_party/weknora/upgrades/81142df/README.md)
   and [`verification.md`](../third_party/weknora/upgrades/81142df/verification.md)
   - source audit, per-path ledger, and historical verification evidence.
7. The active OpenSpec changes under
   [`openspec/changes/`](../openspec/changes/), especially
   `upgrade-weknora-main-81142df`, `curate-main-consumer-surface`,
   `enable-agent-capabilities-by-default`,
   `expose-native-agents-mcp-kb-settings`, and `deploy-isolated-staging`.

Do not treat screenshots, old task messages, or the historical first-version
section in `third_party/.../verification.md` as current deployment status. The
historical section records the earlier `0746755` source checkpoint; this file
records the current branch, completed staging gate and remaining Paddle
Sandbox partial acceptance.

## 2. Identity and non-negotiable boundaries

| Item | Current value / rule |
| --- | --- |
| Repository | `estromeglovettgen-coder/musuw` |
| Working branch | `codex/upgrade-weknora-main-81142df` |
| Historical independent-review HEAD | `553f7bac6e467d02051e37fa03f5cad483d47b2b`; it reproduced the pre-correction visual mismatch and is retained as historical evidence |
| Current deployed source commit | `09b1bc0b544fd0a6c59a4c75166526c8b6554410` (resolution-ledger refresh; structural UI behavior is `f092dfee721bc6062c3fbcb573dcb68b2b19b7e4`; Memory behavior is `cd52965f76d5d30f4849b89f73371230069dfe1e`) |
| `origin/main` | Same SHA as current source at this snapshot |
| Deployed staging release | SHA `09b1bc0b544fd0a6c59a4c75166526c8b6554410`; app/frontend digests are recorded in §6.3 and run artifact `musuw-staging-release-09b1bc0b544fd0a6c59a4c75166526c8b6554410` |
| Corrective release status | **PASS**: `f092dfee` is locally/CI/adversarially verified; the resulting `09b1bc0b` immutable staging release passed visual, Memory, chat, AnyDoc/retrieval and hidden-route browser acceptance |
| Fixed upstream | WeKnora `main` commit `81142dfd17b2778087e95d3a317483a2fd909b91` |
| Upstream tree | `37eaafdd6c276d2d1ddffffe1f39f8b38fd7cc03` |
| Upstream version label | `main-81142df`; application `VERSION` remains `0.7.2` compatibility metadata |
| PostgreSQL latest | `104` (Musuw `80`-`93` meanings preserved; upstream changes appended as `94`-`104`) |
| SQLite latest | `23` (Musuw `3`-`12` meanings preserved; upstream changes appended after `12`) |
| Product default | Musuw **Lite** is the managed consumer surface; Standard is retained for internal/full-main acceptance |
| Production rule | Production app stays on its current old release until a separately approved exact-digest promote |
| Current user request | Deploy/accept staging only; production application is explicitly out of scope for this turn |

The product is not a prompt-sized whitelist. The audit started from every
source-relevant tracked and untracked Musuw worktree difference from official
v0.7.2. Every intentional business rule, persisted-data meaning, background
job, route/permission, operations feature, SaaS/billing rule, independent
frontend surface, visual treatment, interaction, and default remains
authoritative unless the resolution ledger records evidence for a bug, dead
duplicate, or semantically equivalent upstream replacement.

The audit inventory was:

- 708 Musuw paths changed from v0.7.2 (including local-only paths and current
  worktree additions);
- 1,051 official target paths changed from v0.7.2;
- 158 overlapping paths reviewed with three-way semantics;
- 893 target-only paths imported mechanically;
- 1,601 paths in the final resolution union, with a generated per-path
  `resolution-ledger.tsv` and no unexplained disposition.

## 3. What was merged from official `main`

The complete compatible target source is under [`weknora/`](../weknora/), not
just the feature names that appeared in the original request. Major groups
include:

- new memory, artifacts, skills, sandbox, environment-variable, MCP, agent,
  retrieval, Wiki, graph, document, storage, and session capabilities;
- richer agent tools (RAG, Wiki, data analysis, database and web retrieval),
  chat streaming/error states, question navigation, message dates, ordinary
  attachment/preview handling, and native MCP transport/OAuth/approval flows;
- AnyDoc and the target document-reader/parser improvements, including DOCX
  table/merge handling and related fixtures; parser code is shipped even when
  a consumer selector is hidden;
- Wiki revisions/folders/tags and the native Obsidian graph implementation;
- storage/original-file accounting, R2-compatible object access, source usage,
  signed URLs, and existing document lifecycle jobs;
- target CLI and Go SDK wire contracts, DSH plugin/harness, generated client
  contracts, and target tests/docs/assets;
- the target migration/schema additions, reconciled with Musuw's deployed
  history and empty-database initialization.

Upstream nested delivery workflows are deliberately not vendored. Musuw root
CI and the checked-in release workflows are the only build and delivery
authority. The same source manifest, license/provenance records, and generated
resolution ledger prove what was imported or intentionally excluded.

## 4. Final Musuw product contract

### 4.1 Edition and authorization

`MUSUW_PRODUCT_EDITION=lite` selects the managed consumer boundary; `standard`
restores the complete native WeKnora management surface for internal acceptance.
The server-side `liteProductGate` is authoritative. Frontend hiding is only a
usability layer and cannot be bypassed with a deep link, local storage, a
crafted JSON body, or a direct API call. Existing route-level tenant, role,
entitlement, quota, credential-redaction, and storage-ownership checks remain
in force.

### 4.2 What an ordinary Lite user can use

| Surface | Consumer behavior |
| --- | --- |
| Login and identity | Musuw Google/email-OTP shell hands off to native OIDC. Existing login, tenant identity, SaaS lifecycle, and account-erasure behavior remain. Native password registration/change is not a consumer entry. |
| Knowledge bases | Every new Lite KB is `document`; create, rename, upload, organize, query, preview, share and delete use native contracts. The creator has no type selector. At least one visible indexing strategy is required. |
| KB settings | Musuw-styled **Basic** and **Advanced** sections only. RAG/Wiki and the agreed product fields are visible; provider/model/vector/parser/storage/chunking/graph internals, datasource management and activity/management panels stay server-owned or hidden. |
| Parsing | AnyDoc is the managed/default parser. Users get progress, completion, retry, and honest failures; they do not choose an engine. Existing compatible parser rows/configuration remain available to operators. |
| Automatic tags | Available as a product switch in Advanced. The server uses `builtin-deepseek-v4-flash`, caps automatic matches at three, and preserves manual tags. No model selector is exposed. |
| Documents and Wiki/graph | Existing document actions, folders, tags, revisions, Wiki flows and the Musuw Obsidian graph remain available where the current role and KB state allow them. Editing Wiki settings does not promise a nonexistent whole-library rebuild. |
| Memory | Personal memory management is available to the owner (inspect, confirm, add, edit, forget, export, consolidate, clear). Workspace Long-term Memory is visible to every member: common controls are direct and **all remaining fields** (model/vector/extraction/timing/instructions and mode-dependent controls) are inside one expandable Advanced section. Non-admins can read the full policy but only admins can update it. |
| Chat | The existing full-capability smart-reasoning pipeline remains the normal managed path, with plan-filtered platform model choices and supported reasoning effort. Low-cost improvements (memory rows, dates, question navigation, Mermaid streaming and ordinary attachments/previews) remain. Terminal agent failures render a persistent accessible error card. |
| Web retrieval | Lite forces the existing native web-search capability on at router/runtime seams even if an old client omits or sends `false`; the consumer toggle is hidden. New provider-management surfaces and provider credentials are not exposed. |
| Attachments and new agents | New editor-created agents seed image/audio attachment handling and web fetch/search on, and seed the existing Tool Configuration catalog (RAG/Wiki/data/database/reasoning tools, including Wiki writes where authorized). Existing persisted agents are not bulk-rewritten. Runtime dependency, permission, plan and quota checks still decide whether a call can run. |
| Agents | Native agent cards, lifecycle, reduced editor and chat selection are available through the existing Musuw surface. The editor exposes basic information, mode, model, one system prompt, KB scope, and smart-agent MCP selection; expert tuning, raw tool/skill controls, iterations and timeouts remain hidden. The built-in “数据分析师” agent is an inherited v0.7.2 capability, not a newly introduced main feature. |
| MCP | Existing native tenant-admin MCP management/connection/OAuth/approval and smart-agent selection remain governed native capabilities when configured. This is distinct from the excluded sandbox/skill execution chain; credentials stay server-side. |
| Plans and usage | Existing Free/paid plans, quota/entitlement, OpenRouter allowance, R2/storage accounting, billing UI and account lifecycle remain Musuw-owned. Consumer model reads are server-owned built-in OpenRouter rows filtered by plan; no BYOK, arbitrary model IDs, provider CRUD or debug credentials. |

All new visible UI follows Musuw's existing compact settings rows, modal/drawer
geometry, semantic colors, typography, spacing, focus/disabled/error states,
localization and responsive behavior. Upstream visual styling is not a product
authority. Light/dark, desktop and narrow layouts are explicit acceptance modes.

### 4.3 Intentionally hidden or deferred in Lite

The following target code remains in the repository and Standard build, but is
not a Lite consumer feature:

- Sandbox provider/configuration, shell or command execution, sandbox files,
  generated artifacts, Skills catalog/install/files, Skill environment
  variables, and any crafted chat/deep-link route for that executable chain;
- XMind outline upload/import, GitLab synchronization, Tencent IMA knowledge/
  notes/files synchronization, Metaso, Exa, and new provider/integration
  management surfaces;
- FAQ creation/import/edit/list/search/copy/duplicate/invocation in the Lite
  API and UI. Existing FAQ rows are not silently deleted or converted; startup
  performs a read-only audit for an operator decision. Standard keeps native
  FAQ behavior;
- raw model/provider/embedding/vector-store/parser/multimodal/audio/chunking/
  storage/graph configuration, model debugger and credential panels;
- native password flows, workspace switching/tenant administration, broad
  organization/member/invitation management, and unrelated platform admin
  surfaces. A narrow existing operations console seam remains protected by
  SystemAdmin and capability-scoped keys.

The hidden chain is enforced server-side: Lite rejects executable fields in
chat bodies and blocks sandbox/skill/env/artifact route families. Production
Lite does not require or provision a sandbox provider.

The MCP row is an intentional compatibility exception, not a new integration
marketplace: only the existing tenant-admin path is available when an operator
has configured a service, ordinary members do not gain management controls, and
new provider/integration management remains hidden. Do not infer that this
exception enables Sandbox or Skills.

Where an earlier OpenSpec proposal (for example, the broader native-agent/MCP
surface) differs from the later consumer-surface curation, the latest
`curate-main-consumer-surface` decisions and the user's explicit product
decisions govern Lite. The earlier proposal remains useful historical context
and Standard/full-main coverage; it is not permission to expose a hidden Lite
route or control.

## 5. Defaults and operator-owned configuration

The user-facing defaults are intentionally outcome-oriented; private provider
choices are preconfigured by the operator:

| Configuration | Lite default/visibility | Authority |
| --- | --- | --- |
| Edition | `lite` for managed consumer; `standard` for internal acceptance | `MUSUW_PRODUCT_EDITION` + server gate |
| KB type | `document`; no type selector | KB create service + Lite gate |
| Parser | AnyDoc managed/default; no parser selector | built-in catalog/runtime config |
| Indexing | RAG/Wiki product switches; graph remains platform-owned | native KB config/defaults |
| Auto tags | Opt-in switch; DeepSeek V4 Flash, maximum 3, manual tags preserved | server-owned auto-tag policy |
| Chat model | Built-in OpenRouter catalog filtered by Free/paid policy; supported reasoning only | consumer scene/model resolver |
| Embedding/rerank/VLM/ASR/Wiki models | Existing verified platform presets; no provider credentials or arbitrary IDs | SystemAdmin model policy / scene resolver |
| Web search | Forced on in Lite, toggle hidden; Standard preserves request value | router + service seam |
| Image/audio uploads | Seeded on for newly created custom agents, subject to provider readiness and plan/quota | editor create policy + runtime checks |
| Tool Configuration | New smart agents seed the existing visible catalog; Sandbox/Skills/Memory dynamic execution remain excluded | native catalog + Lite filter |
| Personal/workspace memory | Full settings visible; common direct, all technical fields under one Advanced disclosure | native memory API + role guard |
| Billing | Staging uses Paddle Sandbox; production uses one complete Paddle Live unit | server runtime + provider dashboard |
| Storage | Production R2 and staging `musuw-staging` are separate; credentials never reach browser | server runtime |

Do not bulk-rewrite existing agents or existing memory/KB data merely to make
the new defaults appear. New-agent defaults are applied only in the editor
create path; historical persisted values remain valid. Hidden fields retain
native defaults or stored values. Model/provider settings are never a consumer
BYOK surface.

## 6. Deployment architecture and current release status

### 6.1 Normal path

1. Push/merge the reviewed source to `main`.
2. Root CI validates workflow policy, frontend/auth/storefront, active Go,
   AnyDoc, CLI/SDK, DSH harness, source/provenance/secret contracts and builds.
3. A successful CI `workflow_run` automatically invokes the application
   workflow in `staging-only` mode. It builds app/frontend once on native AMD64,
   records immutable GHCR digests, and deploys those exact digests to staging.
4. The separate storefront workflow may update `musuw.com` independently; a
   green storefront run says nothing about authenticated app deployment.
5. Only after the complete Sandbox/browser gate and account-owner approval may
   an explicit manual `promote` consume the same SHA/digest pair. Promotion
   never rebuilds or resolves a mutable tag and is not part of this handoff.

### 6.2 Isolation

| Boundary | Production | Staging |
| --- | --- | --- |
| Compose project | `weknora-v072-production` | `weknora-v072-staging` |
| Hostname | `app.musuw.com` | `staging.musuw.com` |
| Database/Redis/files | production volumes and namespace | independent PostgreSQL, Redis, files and DocReader temporary volume |
| Object storage | production R2 bucket | dedicated `musuw-staging` R2 bucket |
| Auth | production Supabase project | separate commissioned Supabase test project |
| Paddle | Live unit | Sandbox unit |
| OpenRouter | production workspace/keys | separate test workspace/key and pinned identity |
| Edge | Tunnel `web` alias | same edge network, unique `staging-web` alias |

Staging app, database, search and data-service ports are loopback/internal;
only the frontend is reached through the exact Cloudflare staging hostname.
Staging responses must carry `X-Robots-Tag: noindex, nofollow`.

### 6.3 Last known status (refresh before relying on it)

| Check | Last known result |
| --- | --- |
| CI for `a965a85...` | **PASS**, run `33482477646` (all required jobs green) |
| Automatic app release | **PASS**, run `33483876914`; immutable images built, staging-only deploy and digest verification completed; production promote job skipped |
| Automatic storefront release | **PASS/independent**, run `33483876892` |
| Staging after this run | **PASS remote infrastructure gate**: SHA `a965a85...`; app `ghcr.io/estromeglovettgen-coder/musuw-app@sha256:d5d918c23477658b493fb47206b962c1fe656071e45a613e40865f087b2adbff`; frontend `ghcr.io/estromeglovettgen-coder/musuw-frontend@sha256:c61eac6fce5214a5d59ba64e603a930b44f94f18cfb5dc9401ff4b1c3897725e`; 7 services healthy, migration `000104`, PostgreSQL `104|f`, limits/restarts/OOM/noindex/Sandbox/isolated resources verified |
| CI for `72716632` | **PASS**, run `33498204284`; every required job, including full Go/AnyDoc, frontend, plugin E2E, release contracts, ledger and secret scan, is green |
| Automatic `72716632` app release | **PASS**, run `33498781725`; staging-only deployment/digest verification passed and the production promote job was skipped |
| Automatic `72716632` storefront release | **PASS/independent**, run `33498781752` |
| Staging after `72716632` | **PASS remote gate**: app `ghcr.io/estromeglovettgen-coder/musuw-app@sha256:9c851f4e84368b5f2bee1468a1a1cb4ef68e49ca565b288bde082c1aeb5bf40f`; frontend `ghcr.io/estromeglovettgen-coder/musuw-frontend@sha256:56fc7fe2c4fba097816a73ebc1626fee058a80311e7d5635d181ad8bcb8afe42`; OCI revision `72716632`; init exited 0 and all services are healthy/running, restart 0, no OOM, resource limits present, DB `104|f`, noindex, Paddle Sandbox, SearXNG, AnyDoc/R2 and environment isolation verified |
| Memory draft-race correction | **PASS local/CI/browser**, source `cd52965f`; the first-click/no-feedback and late-response-overwrites-new-draft paths are covered by concurrent-create tests. On deployed `72716632`, one click created exactly one `ORCHID CLOCK 5942` item (count 1 -> 2); a second unsaved `SILVER LANTERN 8461` draft remained intact for 3.5 seconds with no stale toast, tab switch or clear. |
| Browser acceptance of `a965a85...` | **PASS for Lite S4-S10**: fresh ordinary Viewer login, document KB/AnyDoc upload and query, auto-tag policy, full Memory settings and cross-session recall, chat/model/agent defaults, web retrieval, image OCR, audio ASR, hidden Sandbox/Skills/Env surfaces, and Musuw UI states were exercised. `72716632` received the corrective smoke described next. |
| Browser corrective smoke on `72716632` | **PASS**: authenticated owner Memory create/race path passed; existing accepted KB still exposed two parsed DOCX/Markdown documents; a real DeepSeek V4 Flash chat completed and reported one recalled memory. This is a corrective-delta rerun, not a claim that every a965 upload fixture was recreated. |
| Historical independent acceptance at `553f7bac` | **PASS for source/function/runtime; historical FAIL for visual convergence**: exact detached-source ledger regenerated 1,601 paths with 0 blockers and no diff; frontend 994/994, type/i18n/build, full Go/vet/build, AnyDoc native archive + tagged vet/test/build, Auth 100/100, Storefront 63/63, DocReader 192 tests, CLI/SDK/DSH contracts, static release/isolation gates, five OpenSpec strict validations, and PostgreSQL 93 -> 104/fresh/retry scenarios passed. It reproduced the pre-`f092dfee` KB-editor mismatch. |
| Structural visual correction | **PASS local/browser/adversarial**, source `f092dfee`: KB Basic/Advanced, personal/workspace Memory and Lite/Standard Agent settings reuse `VisualSettingsShell`, its 192px left navigation, unboxed `setting-row` grammar, shared header/dividers/footer/scroll behavior and neutral switches. Focused visual contracts plus the full 1017/1017 frontend suite, 11/11 i18n checks, type-check and build pass. Consolidated review reported P0/P1=0. |
| CI for `09b1bc0b` | **PASS**, run `33509979358`; full Go/AnyDoc, frontend, DocReader, Auth, Storefront, CLI/SDK, plugin E2E, provenance, secret and release-contract jobs are green |
| Automatic `09b1bc0b` app release | **PASS**, run `33510660189`; immutable staging-only deployment and digest verification passed; restricted production deploy job was skipped |
| Automatic `09b1bc0b` storefront release | **PASS/independent**, run `33510660226` |
| Staging after `09b1bc0b` | **PASS remote gate**: app `ghcr.io/estromeglovettgen-coder/musuw-app@sha256:6682abc73f912cd7629f7980ad446fca029d4b32da17414bdeb289a0bcfd6f12`; frontend `ghcr.io/estromeglovettgen-coder/musuw-frontend@sha256:3a021ce6729673c50658f85cec58a148fde24743344a2413e08a8baf065c5864`; six-service health plus init, SearXNG search, noindex, Sandbox public config, isolated volumes/network and exact digest record passed |
| Browser acceptance on `09b1bc0b` | **PASS corrective/full-path smoke**: an authenticated Lite user inspected KB Basic/Advanced and neutral auto-tag, complete Memory basic/Advanced, reduced Agent navigation, light/dark settings and hidden Sandbox/Skills/Env deep links; a fresh DeepSeek V4 Flash answer completed; a fresh AnyDoc-backed document query returned `ORBITAL SAGE 4826` with the source citation and web results; a single-click manual Memory create produced exactly one item and the disposable item was deleted. No visual or functional blocker reproduced. |
| Paddle Sandbox acceptance | **PARTIAL**: Sandbox public config/test token, three products/six recurring prices, exact 11-event destination, official transaction/cancellation simulations, portal-session/history API and related tests are green. Real checkout success/decline, upgrade, period-end/resume/recovery/dunning, entitlement/allowance and full hosted-portal browser actions remain untested; tenant `10002` has a stale in-flight checkout operation as a follow-up. |
| Production app | **UNCHANGED/OLD** release `ea614b077dc0b9fb7fbe742c8defee2e24bc8461`, PostgreSQL `93|f`; this is the required screen-share state |
| Production promotion | **NOT RUN** and must remain not run for this task |
| Backups | Read-only verified staging/production database dumps were created before deployment; they are recovery evidence, not a runtime mutation |

The `a965a85...` identity above is the checkout used for the earlier exhaustive
browser matrix; `72716632` added the Memory correction. The current
`09b1bc0b` release adds the structural UI correction in `f092dfee` and a fresh
resolution-ledger refresh. Always use the explicit deployed SHA/digests when
comparing remote staging. The exact
production SHA/DB values above are an audit snapshot, not a substitute for a
fresh probe. A read-only remote audit already confirmed the old production
release and database after staging deployment; the reviewer must still re-probe
production and stop immediately if a staging action targets
`app.musuw.com`, `weknora-v072-production`, a Live Paddle endpoint, or the
production R2 bucket.

## 7. Migration and resource-safety fixes

- PostgreSQL and SQLite history is append-only and collision-free. Existing
  Musuw versions are not renumbered or reinterpreted. Existing v93/v12 and
  empty/retry paths were exercised; representative tenant/session/message data
  survived and new memory/skills/env/artifact/sandbox schema was present.
- Release helpers now fail closed when the running app image does not report a
  non-empty newest migration or when the database is not exactly `${latest}|f`.
  They inspect `/app/migrations/versioned` inside the same immutable app image,
  not a repo path that may be absent from a runtime bundle.
- Artifact collection uses the `SessionBoundedFileReader` seam. The sandbox
  provider executes `head -c max+1` as the non-root sandbox user; collector
  code no longer materializes an unbounded session file before checking its
  length. Tests cover falsely advertised small files, stale sizes, cap+1,
  oversize rejection and sources without bounded capability.
- Staging has explicit CPU/memory/PID limits, production-capacity preflight,
  immutable image/revision checks, isolated volumes/networks and no-build
  server behavior. A partial staging mutation is stopped while test data is
  retained for review; production is not repaired with SQL or deleted volumes.

## 8. Verification evidence already available

The following are fresh local, CI, remote-gate and browser evidence for the
current source release:

- Independent acceptance on 2026-09-01 used `docs/HANDOFF.md` only as an index,
  then re-read the source, migrations, tests, workflows and deploy scripts. To
  avoid mixing in the parent task's concurrent frontend rebuild, exact-commit
  verification ran from a detached `553f7bac` checkout. The generated
  1,601-path resolution ledger was byte-identical and reported 0 blockers.
- The independent browser pass reused a disposable authenticated staging
  owner. It directly observed Lite navigation and reduced settings, Agents/MCP,
  both Memory pages, the existing two-document KB, DeepSeek V4 Flash, memory
  recall (`EMBER COMPASS 7319`), image OCR, audio ASR, web/document citations,
  and the DOCX vertical-merge answer for Q0104. Opening the citation exposed
  the correct `issue_2634_vertical_merge.docx` source and summary.
- The manual-Memory race was independently re-read at source and rerun through
  the exact 994-test frontend suite: one request guard and draft-version
  ownership tests pass, and staging still contains the single persisted
  `ORCHID CLOCK 5942` result from the deployed live regression. This pass did
  not create another remote Memory item, so the previously recorded live
  timing remains the write-side browser evidence rather than being silently
  presented as a new write.
- A disposable local ParadeDB/PostgreSQL instance independently exercised
  `93|false -> 104|false` with tenant/session/message sentinels, asserted 11
  new columns and 11 new tables, initialized an empty database to `104|false`,
  and verified repeated `up` is idempotent. The first harness attempt exposed
  only a Docker published-port readiness race; waiting for a host SQL handshake
  made the original scenario green. No application migration was changed.
- Read-only probes at 2026-09-01 04:29 MST reconfirmed staging `72716632`, app
  digest `sha256:9c851f...`, frontend digest `sha256:56fc7f...`, DB `104|f`,
  healthy/running services, restart 0, no OOM, noindex and Paddle Sandbox.
  Production remained `ea614b...`, DB `93|f`, restart 0/no OOM and Paddle Live.
- Historical visual blocker and correction: `553f7bac` reproduced a blue
  auto-tag switch and a separate boxed/top-tab KB layout. `f092dfee` replaced
  that structure with the shared Musuw settings shell, left navigation,
  unboxed rows, neutral switch and common footer; local light/dark browser
  inspection and the deployed `09b1bc0b` Lite-user pass both match Memory and
  General Settings. The consolidated corrective review reported P0/P1=0.
- Follow-up, not a deployed-app blocker: a fresh root `npm audit --omit=dev`
  reports current advisories in the unused root Next/tooling dependency graph.
  There is no root Next application source and those packages are not part of
  the app/frontend release images, but the stale unused dependencies should be
  removed or upgraded in a separate dependency-maintenance change.

- `npm run upgrade:contract` and `npm run upgrade:ledger`: pass; fixed source,
  provenance, representative target capabilities, high-risk Musuw contracts,
  and the complete 1,601-path ledger are accounted for. The ledger-only
  refresh is commit `09b1bc0b`.
- `ruby scripts/ci/validate-workflows.rb`, source-manifest checks, production/
  staging static contracts, release simulations, OpenSpec strict validation
  and secret scans: pass.
- Frontend: latest current-tree `npm test` is 1017/1017, with 11/11 i18n
  checks, type-check and production build passing. The corrective structural
  visual contracts cover shared shell/navigation/rows/footer, Lite/Standard
  Agent editor behavior and Memory ownership/concurrent creation.
- Auth shell: 100/100 tests, type-check and production build pass.
- Storefront: 63/63 tests and production build pass.
- Go: full `go test ./...`, `go vet ./...`, native build, CLI/SDK tests/vet/build,
  AnyDoc-tagged tests/vet/build and focused router/handler/service/sandbox/
  session/artifact tests pass.
- Database: existing PostgreSQL 93 -> 104, fresh/retry PostgreSQL, existing
  SQLite 12 -> 23 and fresh SQLite paths pass with data/schema assertions.
- DSH pinned harness E2E: all three mock WeKnora scenarios pass.
- Memory draft creation race: root cause was a missing pending/re-entry guard;
  a slow first create could leave the button apparently inert, allow a second
  submit, then let the first response clear a newer draft and show a stale
  success toast. Source commit `cd52965f` now serializes the request, disables
  the draft controls while it is pending, and applies completion/error UI only
  to the still-owned draft version/content/kind. Focused concurrent-create
  tests, type-check and build pass; independent adversarial review found no
  blocker. The `72716632` race regression and `09b1bc0b` one-click
  create/cleanup regression described in §6.3 passed.
- Remote staging browser evidence for `a965a85...`: a fresh ordinary Viewer
  logged in and exercised a document-only KB with AnyDoc parsing, DOCX/Markdown
  query/citations and automatic tags; Memory full basic/Advanced visibility,
  owner save/reload and cross-session recall; real chat/model/agent defaults;
  web retrieval; image OCR; audio ASR; and the Lite-hidden Sandbox/Skills/Env
  surfaces. The Musuw compact UI remained intact. `72716632` received a
  corrective Memory, existing-KB and real-chat smoke rerun rather than
  recreating every accepted fixture.
- Remote staging browser evidence for `09b1bc0b`: the deployed Basic/Advanced
  KB editor, workspace/personal Memory, Lite Agent editor and General Settings
  share the Musuw layout grammar in light and dark modes; Sandbox, Skills and
  env deep links redirect to General Settings. A fresh DeepSeek V4 Flash answer
  completed, and a fresh query against the previously accepted AnyDoc corpus
  returned the expected `ORBITAL SAGE 4826` value with document citation and
  web results. The earlier image OCR/audio ASR fixtures remain visible and were
  not re-uploaded for this presentation-focused delta.
- Local-candidate chat diagnosis: its provider request fails before inference
  because the isolated local candidate intentionally has no dedicated TEST
  `OPENROUTER_MANAGEMENT_API_KEY`. This is the strict Musuw tenant-spend guard,
  not a model-binding or upstream-source regression. Staging uses its own test
  secret and completed fresh inference; no production/Default Workspace key
  was copied and the guard was not bypassed.
- Paddle Sandbox: public config, test token, three products/six recurring
  prices, exact 11-event destination, signed transaction/cancellation
  simulations, portal-session/history API and related tests pass. S11 remains
  **PARTIAL** because real checkout success/decline, upgrade, period-end,
  resume/recovery/dunning, entitlement/allowance and full hosted-portal browser
  actions were not performed; tenant `10002`'s stale checkout operation is a
  follow-up. Production Paddle Live was not touched.
- Production preservation: read-only post-deploy audit confirmed the old
  production revision `ea614b...`, PostgreSQL `93|f`, Live Paddle unit and
  isolated production resources remained unchanged. All nine container
  identities/start times remain old, with restart 0 and no OOM; production
  promotion is explicitly not authorized.
- Pre-deploy corrective adversarial review: no source blockers after the
  corrective delta; Lite allow-list/deep-link behavior, mixed sandbox lease
  resolver, and bounded artifact read were rechecked. Inherited quick-answer
  `EventError` terminal semantics are an observation, not a new blocker. The
  independent Memory-race review is also blocker-free. The post-deploy remote
  audit is recorded separately in §6.3.
- Candidate/local browser and native stack evidence exists in the historical
  upgrade verification record, but it does not replace the new remote staging
  acceptance below.

## 9. Acceptance matrix for the fresh reviewer

The remote infrastructure items below retain the exhaustive `a965a85...` and
`72716632` evidence and add the current `09b1bc0b` structural-corrective
release and browser pass. Functional, infrastructure and visual blockers are
0; Paddle Sandbox is only **PARTIAL**. A
reviewer may create disposable staging data and Sandbox entities, but must not
change production or source code as part of the first pass.

| ID | Acceptance | Evidence to capture | Status |
| --- | --- | --- | --- |
| S1 | Main CI and automatic staging deployment complete for `a965a85...` | `gh run view 33482477646`; `gh run view 33483876914`; final job conclusion and release artifact | **PASS (remote run)** |
| S2 | Staging exact digest/revision/current pointer, app image newest migration `000104`, DB `104|f`, all services healthy, limits/restarts/OOM okay | Release artifact `musuw-staging-release-a965a85cb6f5e6b5cf212ee7e4f5c10a34570e5c` (app digest `sha256:d5d918c23477658b493fb47206b962c1fe656071e45a613e40865f087b2adbff`, frontend digest `sha256:c61eac6fce5214a5d59ba64e603a930b44f94f18cfb5dc9401ff4b1c3897725e`), remote staging gate output, Compose inspect, DB query, no secrets | **PASS (remote infrastructure audit)** |
| S3 | Staging HTTPS/TLS/Tunnel/noindex and public Sandbox config | `curl` probes for `/`, `/auth/start`, `/health`, `/api/v1/billing/paddle/public-config`, asset headers; config reports Sandbox only | **PASS (remote infrastructure audit)** |
| S1-current | Deploy and accept the structural-corrective source (`f092dfee`, deployed ledger `09b1bc0b`) on staging | CI `33509979358`; release `33510660189`; immutable digests above; restricted production job skipped | **PASS** |
| S2-current | Current staging exact revision/digests and isolated runtime | Artifact `musuw-staging-release-09b1bc0b544fd0a6c59a4c75166526c8b6554410`; app `sha256:6682abc...`; frontend `sha256:3a021ce...`; run `33510660189` remote gate | **PASS** |
| S3-current | Current staging public health/noindex/Sandbox boundary | Fresh `/health`, `/`, `/auth/start`, and public billing-config probes; no secret output | **PASS**: health OK, noindex present and Paddle environment is Sandbox; production public config remains Live |
| S4 | Lite ordinary-user login and page load | Fresh browser session at `https://staging.musuw.com/auth/start`; no token/cookie/password capture | **PASS (`a965a85...` full Viewer acceptance; `72716632` Memory smoke; `09b1bc0b` authenticated corrective pass)** |
| S5 | Document KB create/edit/upload/query; no FAQ type; Basic/Advanced Musuw UI; AnyDoc default; auto-tag Advanced | Disposable KB `94dc2ff0-c54b-4a1b-ad9d-bf4f580872ad`; DOCX/Markdown/image/audio fixtures; terminal processing, chunks/citations/tags | **PASS**: existing upload/parsing evidence remains valid; on `09b1bc0b` Basic/Advanced uses the shared shell/rows/footer and neutral auto-tag, and a fresh AnyDoc-backed query returned the expected answer with document citation |
| S6 | Memory full visibility and role behavior | Personal memory operations and cross-session recall; workspace common controls plus every Advanced field; non-admin read-only; save/reload as Admin; concurrent draft-create regression | **PASS**: full role/browser evidence plus `72716632` live race regression, 1017 tests and `09b1bc0b` one-click create/exactly-one/cleanup pass |
| S7 | Chat/model/agent behavior | Real question returns an answer; plan-filtered model and reasoning picker; model readiness/usage/quota; new-agent defaults for image/audio/web/tools; persisted agents unchanged | **PASS**: persisted test agent still binds DeepSeek V4 Flash; Lite editor is reduced; fresh `09b1bc0b` model inference completed |
| S8 | Web retrieval and ordinary attachments | Search query produces expected web result/citation; image OCR and audio ASR show completion or honest provider error; no hidden provider controls | **PASS**: a fresh `09b1bc0b` query returned web/document results; prior accepted image OCR/audio ASR results remain present; hidden provider controls stay absent |
| S9 | Hidden/deferred routes cannot be reached | Lite deep links and direct API attempts for Sandbox, Skills, env vars, shell, artifacts, FAQ, XMind, datasource/provider/password routes return the supported fallback/404; Standard-only code is not exposed | **PASS**: `09b1bc0b` Sandbox/Skills/env settings deep links each redirected to General Settings; full route/API contracts remain green |
| S10 | Agent/MCP surfaces and UI quality | Agent cards/reduced editor/chat capsule; smart-agent MCP only if a test service is configured; light/dark desktop/narrow states; no upstream visual style drift | **PASS**: `f092dfee` corrective review P0/P1=0; deployed KB, Memory, Agent and General settings reuse the same shell/navigation/row/footer grammar; light/dark browser inspection passed |
| S11 | Paddle Sandbox lifecycle | Fresh Sandbox identity: success/decline, upgrade, cancel/period end, resume/recovery, signed duplicate/retry/out-of-order/tamper/unknown-price cases, tenant membership, allowance, portal/history; no Live mutation | **PARTIAL**: Sandbox config/catalog/webhook simulations/portal API green; real checkout, upgrade, period-end/recovery, entitlement/allowance and full hosted-portal browser actions remain pending; tenant `10002` stale checkout is a follow-up |
| S12 | Production preservation after staging | Reprobe production app health/SHA/digests/DB 93|f, Live public config, volumes/R2/tunnel; confirm no production container restart or mutation | **PASS (read-only post-deploy audit; old revision/container start times unchanged, restart 0, Paddle Live)** |
| S13 | One consolidated post-deploy adversarial review | Independently review S1-S12 and classify reproducible blockers vs observations | **COMPLETE source/corrective review: functional/infrastructure/visual blockers=0; Paddle remains PARTIAL; production unchanged. A fresh no-context handoff reviewer must independently confirm the final staging delta before project close.** |

S11 is intentionally the full gate from `deploy-isolated-staging` tasks 6.2-6.8.
Dashboard-owned Retain, payment-method eligibility, portal/history settings and
the complete Sandbox catalog are not inferred from static config; task 5.4 and
the corresponding E2E rows must be explicitly verified.

## 10. Reproducible commands

Run from the repository root. These commands are read-only/static unless the
command is explicitly marked as a staging deployment action.

### Source and local contracts

```sh
git status --short
git rev-parse HEAD
git show -s --format='%H %s' HEAD
git show -s --format='%H %s' cd52965f 72716632 f092dfee 09b1bc0b
ruby scripts/ci/validate-workflows.rb
npm run upgrade:contract
npm run upgrade:ledger
node scripts/ci/source-manifest.mjs
bash scripts/weknora-staging/contract.test.sh
bash scripts/weknora-staging/verify-static.sh
bash scripts/weknora-staging/gate-simulation.test.sh
bash scripts/weknora-production/deploy-ci-seams-contract.test.sh
bash scripts/weknora-production/verify-static.sh
```

Module verification (use the exact checkout's declared dependencies):

```sh
npm --prefix weknora/frontend test
npm --prefix weknora/frontend run type-check
npm --prefix weknora/frontend run check-i18n
npm --prefix weknora/frontend run build
npm --prefix auth test
npm --prefix auth run typecheck
npm --prefix auth run build
npm --prefix storefront test
(cd weknora && env -u LOG_FORMAT go test ./... && go vet ./... && go build ./cmd/server)
(cd weknora/cli && go test ./... && go vet ./... && go build ./...)
(cd weknora/client && go test ./... && go vet ./... && go build ./...)
```

### CI and staging run status

```sh
gh run view 33482477646 --json status,conclusion,jobs
gh run view 33483876914 --json status,conclusion,jobs
gh run view 33483876892 --json status,conclusion,jobs
gh run view 33498204284 --json status,conclusion,jobs
gh run view 33498781725 --json status,conclusion,jobs
gh run view 33509979358 --json status,conclusion,jobs
gh run view 33510660189 --json status,conclusion,jobs
gh run download 33483876914 \
  --name musuw-staging-release-a965a85cb6f5e6b5cf212ee7e4f5c10a34570e5c
gh run download 33498781725 \
  --name musuw-staging-release-72716632e4ab35b0b18e5db2bf1f0db5df945723
gh run download 33510660189 \
  --name musuw-staging-release-09b1bc0b544fd0a6c59a4c75166526c8b6554410
```

The `a965a85...` commands preserve the earlier exhaustive browser matrix and
`72716632` preserves the Memory corrective evidence. `09b1bc0b` is the current
completed structural-corrective release. Use the workflow's recorded release
artifact and staging remote gate. Do not run `release_mode=promote`.

### Public staging probes

```sh
curl -fsS https://staging.musuw.com/health
curl -fsSI https://staging.musuw.com/ | grep -i '^x-robots-tag:.*noindex'
curl -fsSI https://staging.musuw.com/auth/start | grep -i '^x-robots-tag:.*noindex'
curl -fsS https://staging.musuw.com/api/v1/billing/paddle/public-config
```

The public config must show the Sandbox mode and public coordinates only; never
print, save, or paste any server key, webhook secret, customer ID or session
token. Use the documented browser skill/client for UI acceptance and reuse an
already authenticated staging session only if its identity is known to be a
disposable test user.

### Production no-change probe

```sh
curl -fsS https://app.musuw.com/health
curl -fsS https://app.musuw.com/api/v1/billing/paddle/public-config
```

The production probe must remain on the old app and Live public contract. A
production mutation, unexpected restart, Live/Sandbox mix, or cross-environment
R2/Supabase identity is an immediate blocker: stop staging acceptance and report
it before making any further change.

## 11. Safe reviewer protocol

1. Read this document and the linked runbooks completely.
2. Independently verify the completed `09b1bc0b` staging identity, digest,
   migration and isolation. The `a965a85...` release preserves the exhaustive
   browser matrix, `72716632` adds the Memory correction and `09b1bc0b` adds the
   structural settings-UI correction.
3. Re-exercise S4-S10 as an ordinary Lite user in a browser when a full fresh
   release sign-off is required.
   Do not reveal or record credentials, tokens, cookies, full webhook bodies,
   payment details or customer PII. Sandbox cards are test-only and never
   belong in Live.
4. Exercise S11 only against Paddle Sandbox and only with a fresh disposable
   identity. Provider-owned catalog, Retain, tax, payment-method, portal and
   history behavior must be observed, not guessed from source; the current
   record is partial and must not be upgraded to pass without the missing flows.
5. Reprobe S12 after every write-heavy staging scenario. If production changes,
   stop and escalate.
6. Perform S13 once, after the normal flows, and classify each finding as a
   reproducible blocker, non-reproducible, or follow-up. Do not turn an
   observation into a source change during the first pass.
7. Only after the parent task explicitly accepts the complete staging gate may
   the deployment OpenSpec tasks be updated. Promotion is a separate explicit
   action and is not authorized by this handoff.

The goal of this handoff is honest continuity: a no-context reviewer should be
able to distinguish code that is merged, behavior intentionally hidden by the
Musuw product policy, local/CI evidence, the completed staging checks, and the
Paddle financial flows that remain intentionally partial.
