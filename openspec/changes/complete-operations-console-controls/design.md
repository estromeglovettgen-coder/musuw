## Context

The operations console runs on loopback and intentionally creates only one
read-only PostgreSQL pool for its selected environment. The existing launcher
already owns environment-specific runtime files, production unlock handling,
frontend build, old-process shutdown, and startup on port 4186. The browser
previously displayed the alternate environment as a non-actionable hint.
Production PostgreSQL is reached through the repository's existing pinned Tokyo
SSH configuration, so the launcher also owns a temporary loopback tunnel
lifecycle.

Consumer model policy already lives in ten typed system-setting keys for five
fixed boundaries: `rag`, `rerank`, `wiki`, `vision`, and `asr`. Chat is an
internal compatibility path and Embedding is bound to each KB/vector index.
The operations console needs a safe projection of those settings and the real
builtin catalog, not a new policy store or placeholder IDs.

## Goals / Non-Goals

**Goals:**

- Change environments with one menu click while retaining one process and one
  read-only database pool at a time.
- Render and update the five real model policies from existing authorities.
- Offer a broader, cost-conscious catalog without inventing model IDs or
  exposing provider credentials.
- Fix the dark-only popup stacking bug and remaining white KB surfaces.

**Non-Goals:**

- In-browser database URLs, credentials, arbitrary shell commands, two live
  environment pools, arbitrary system-setting access, Chat/Embedding/TTS
  policy rows, provider configuration, or KB behavior changes.

## Decisions

### 1. Restart the existing launcher instead of introducing a supervisor

`POST /admin-api/environment` accepts only the opposite fixed target. The
loopback server reuses its SameSite session, exact Origin/Host, and CSRF token,
performs target configuration and reachability preflight, enforces a single
in-flight switch, and spawns the existing launcher with fixed arguments, no
shell, detached stdio, and a cleaned environment. Production preflight always
invokes the launcher's fixed `prepare-production-tunnel` command before
trusting the local DB port. That command reuses the existing
`musuw-tokyo` restricted SSH alias (or a validated non-secret override), requires
BatchMode and strict host-key checking, uses the restricted account's `sudo -n`
permission to discover the fixed production PostgreSQL container's validated
IPv4, and establishes the ControlMaster loopback forward as that same account.
The browser
polls public `/healthz` until the requested target is ready, then reloads the
current hash route.

Production's existing unlock phrase is supplied by the console implementation
as a fixed confirmation contract; operators do not type a second prompt. The
phrase is not treated as a secret—the SameSite/Origin/CSRF boundary authorizes
the local action. Production runtime values remain authoritative from the
ignored production runtime file and cannot be overridden by TEST parent
variables.

Alternative rejected: keep TEST and PRODUCTION pools in one process. It would
make credential mixing possible and add synchronization, lifecycle, and
recovery mechanisms solely to avoid a bounded restart.

### 2. Expose a narrow model-policy control plane

The backend route returns exactly five scenes in product order and only
`model_id`, display name, and native model type. It reads the model repository
without a tenant plan filter, then admits only active builtin OpenRouter rows
whose type matches the scene. It reads and updates the existing
`consumer_models.<scene>.free_default` and ordered `paid_options` settings.

Each PUT changes exactly one field. The server rejects empty/duplicate lists,
unknown fields, wrong-type or unsafe IDs, and unsupported scenes before
calling the settings service. The loopback server proxies only this exact API;
it does not expose the general SystemAdmin settings family.

### 3. Fix stacking state at the selector root and close theme tokens late

An open selector root receives a higher stacking order than its sibling rows,
so its absolute popup remains above controls rendered later in the document.
The final theme closure provides explicit dark semantic surfaces, text,
borders, hover/active states, and teleported popup colors for the settings
selector and the visible KB Document, Wiki, and Graph structures. Business
templates, data requests, and click behavior remain unchanged.

### 4. Treat OpenRouter discovery and inference as separate acceptance gates

New builtin rows use exact model identifiers returned by OpenRouter's current
model discovery endpoints and retain the existing five native WeKnora model
types. Catalog discovery alone is insufficient evidence: before release, a
representative free and low-cost chat model plus every newly expanded native
role must be exercised through the real provider transport. Verification must
record only non-sensitive response metadata (requested/returned model role and
success), never keys, tenant identifiers, prompts containing user data, or
provider credentials.

## Risks / Trade-offs

- **Target startup can fail after the old server stops.** Static and
  reachability preflight reject missing runtime files, unavailable tunnels, and
  unreachable backends before spawning; the launcher prepares production before
  stopping the current console. If the target still fails its health check, the
  launcher preserves that log and makes one direct attempt to restore the
  previous target without recursive rebuilds. Zero-downtime would require a
  second temporary listener/pool and is intentionally not added.
- **A future catalog row could be unsafe.** Both reads and writes reapply the
  active+builtin+OpenRouter+native-type filter; no provider parameters or
  credentials enter browser DTOs.
- **Late dark CSS can affect adjacent pages.** Selectors are scoped to current
  visual settings/knowledge classes and verified in both themes.
- **Provider catalogs change.** Startup reconciliation and policy filtering
  keep unavailable rows out of selection, while live provider smoke tests catch
  stale or transport-incompatible identifiers before release.

## Migration Plan

1. Deploy the narrow backend route before or with the local console build.
2. Restart the local console in TEST and verify the five-row matrix.
3. Exercise TEST → PRODUCTION → TEST switching and leave the console on TEST.
4. Rollback by removing the local controls/routes; stored policy settings need
   no migration and remain valid for the existing runtime resolver.
