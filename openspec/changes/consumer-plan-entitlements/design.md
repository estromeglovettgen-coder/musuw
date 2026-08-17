## Context

Musuw already has tenant storage quotas, tenant-scoped repositories, native model factories, and one OpenRouter-backed provider path. It lacks a consumer plan source of truth, per-tenant model/spend enforcement, and a real relationship between the storefront's four price cards and product behavior. Production currently has no Paddle credentials, so payment setup must be optional and must not weaken enforcement.

## Goals / Non-Goals

**Goals:**

- Make Free, Plus, Pro, and Max limits authoritative on existing server paths.
- Count OpenRouter's own reported cost per tenant and UTC month.
- Keep consumer-facing state visible and testable with two accounts.
- Add the smallest secure Paddle synchronization seam for later credential configuration.

**Non-Goals:**

- A general billing, ledger, invoicing, analytics, or per-provider metering platform.
- Per-user OpenRouter API keys, distributed reservations, queues, or historical usage events.
- Restoring the video feature skipped in Task 2.
- Building admin subscription management or a custom checkout UI.

## Decisions

### Keep entitlement state on the existing tenant row

Add only plan/status, current usage month/amount, and optional Paddle identifiers to `tenants`. Storage remains in the existing `storage_quota`/`storage_used` fields. This avoids a new aggregate, join, repository family, and cross-table transaction. A separate entitlement table was rejected because there is exactly one current entitlement per tenant and no current consumer for history.

### Put the complete plan matrix in one pure Go definition

One `PlanLimits` function owns plan names, storage, monthly credits, Free content gates, and the least-cost built-in IDs. Services and the response DTO consume it. Pro and Max storage follow the same four-GiB-per-listed-dollar rule as Plus: 40 and 80 GiB. Database values identify the plan; limits are not duplicated in rows.

### Enforce at existing service boundaries

Knowledge-base creation, all upload entry points, model listing/resolution, and provider construction call a small entitlement service. UI filtering is only presentation. This reuses WeKnora's repository counts and storage pipeline and prevents direct API bypasses.

### Use an OpenRouter-aware HTTP transport

A small transport wrapper injects the documented stable `user` identifier into JSON requests, performs a conservative credit preflight, and reads `usage.cost` from normal JSON or the terminal streaming payload before recording it. Existing chat, embedding, rerank, vision, and speech clients receive this HTTP client; provider behavior and response parsing otherwise remain unchanged. Direct DeepSeek credentials are not used by built-in models.

### Keep accounting current-state only

Usage is an integer number of micro-US dollars plus a `YYYY-MM` UTC key on the tenant. Repository updates perform the month rollover and increment atomically. The preflight estimate is an admission guard; OpenRouter's reported cost is authoritative. This intentionally does not create an event ledger.

### Make Paddle an optional signed adapter

A public webhook verifies Paddle's documented HMAC signature and replay window against the raw body, maps only configured price IDs, and uses signed `custom_data.tenant_id`. It writes the same tenant plan fields and stores the last event ID for idempotency. Missing credentials disable billing configuration; request parameters, checkout returns, and unsigned bodies never grant a plan. The standard Paddle-hosted checkout remains the future client when credentials are supplied.

## Risks / Trade-offs

- [OpenRouter pricing changes can make an estimate imperfect] → Use a conservative byte/token estimate and charge only authoritative `usage.cost`; expose remaining credit clearly.
- [Concurrent calls can exceed a quota by a small in-flight amount] → Use atomic month rollover/increment and preflight every call; do not introduce distributed reservations for the current single-server consumer load.
- [A provider response omits `usage.cost`] → Do not invent a charge; log the omission and keep the official response value as the only accounting source.
- [Paddle delivery order varies] → Use event occurrence time and event ID so an older or duplicate event cannot overwrite newer state.
- [Existing tenants currently have larger storage quotas] → Migration assigns Free and 5 GiB unless an explicit paid plan is set; files are never deleted when usage exceeds the new quota, but new uploads remain blocked.

## Migration Plan

1. Add tenant entitlement columns with Free defaults in PostgreSQL and SQLite; update existing rows to Free/5 GiB without deleting data.
2. Deploy backend enforcement and the read-only entitlement UI with Paddle disabled by default.
3. Configure Paddle values later as one deployment unit, then register its webhook endpoint.
4. Validate Free and paid behavior with separate Google-owned tenants and minimal OpenRouter calls.

Rollback is code rollback plus leaving additive columns in place; no user objects or usage records are deleted.

## Open Questions

None for the first release. Paddle credentials and catalog IDs are an operational input, not an implementation decision.
