## Context

Musuw already has tenant storage quotas, tenant-scoped repositories, native model factories, and one OpenRouter-backed provider path. It lacks a consumer plan source of truth, per-tenant model/spend enforcement, and a real relationship between the storefront's four price cards and product behavior. Production currently has no Paddle credentials, so payment setup must be optional and must not weaken enforcement.

## Goals / Non-Goals

**Goals:**

- Make Free, Plus, Pro, and Max limits authoritative on existing server paths.
- Make OpenRouter's managed key limit and usage the spend authority per tenant and UTC month.
- Keep consumer-facing state visible and testable with two accounts.
- Add the smallest secure Paddle synchronization seam for later credential configuration.

**Non-Goals:**

- A general billing, local usage ledger, invoicing, analytics, or per-provider metering platform.
- User-supplied API keys, request-price estimates, distributed reservations, queues, or historical usage events.
- Restoring the video feature skipped in Task 2.
- Building admin subscription management or a custom checkout UI.

## Decisions

### Keep durable product state on the existing tenant row

Keep plan/status and optional Paddle identifiers on `tenants`; storage remains in the existing `storage_quota`/`storage_used` fields. Store only the OpenRouter-managed child key and key hash in the existing tenant credentials JSONB, encrypted by the existing secret-value path. OpenRouter, not a Musuw usage table or counter, owns monthly spend state. This avoids a second ledger, aggregate, join, and reconciliation service.

### Put the complete plan matrix in one pure Go definition

One `PlanLimits` function owns plan names, storage, monthly credits, Free content gates, and the least-cost built-in IDs. Services and the response DTO consume it. Pro and Max storage follow the same four-GiB-per-listed-dollar rule as Plus: 40 and 80 GiB. Database values identify the plan; limits are not duplicated in rows.

### Enforce at existing service boundaries

Knowledge-base creation, all upload entry points, model listing/resolution, and provider construction call a small entitlement service. UI filtering is only presentation. This reuses WeKnora's repository counts and storage pipeline and prevents direct API bypasses.

### Use OpenRouter's official managed-key boundary

On first inference, the entitlement service uses OpenRouter's official Go SDK to create one child key named for the tenant with the plan's monthly-reset limit. The existing tenant-row transaction installs the first winner; a concurrent loser is deleted at OpenRouter. No shared inference key or BYOK fallback exists. The stored key is encrypted at rest and never serialized to consumers.

A small transport wrapper obtains that tenant key, replaces the outbound authorization header, and injects the documented stable `user` identifier into JSON requests. Existing chat, embedding, rerank, vision, and speech clients receive this HTTP client; provider behavior and response parsing otherwise remain unchanged. OpenRouter HTTP/SSE credit exhaustion is converted into one typed terminal error so chat closes cleanly and ingestion uses WeKnora's native failed/reparse lifecycle without futile retries.

### Query usage and synchronize plan changes at the provider

General settings queries the child key through the official SDK and displays OpenRouter's limit, monthly usage, and remaining value. Before a paid-plan change is committed, the same SDK updates the child's monthly limit; failure leaves the durable plan unchanged. If the database write loses to a newer event or fails, the service restores the provider limit from the durable tenant plan. Tenant deletion removes the provider key before deleting local state. These short fail-closed operations replace a local accounting/reconciliation subsystem.

### Make Paddle an optional signed adapter

A public webhook verifies Paddle's documented HMAC signature and replay window against the raw body, maps only configured price IDs, and uses signed `custom_data.tenant_id`. It writes the same tenant plan fields and stores the last event ID for idempotency. Missing credentials disable billing configuration; request parameters, checkout returns, and unsigned bodies never grant a plan. The standard Paddle-hosted checkout remains the future client when credentials are supplied.

## Risks / Trade-offs

- [The management key or required AES key is absent] → Do not provision or fall back to a shared key; expose the plan limit with provider usage marked unavailable/unprovisioned and log a reason code.
- [Concurrent first requests create multiple child keys] → Persist one winner under the existing tenant row lock and delete each provider-side loser.
- [A plan update reaches OpenRouter but not the database] → Restore the provider limit from the durable database plan immediately; do not add a background reconciler for the current single-server product.
- [OpenRouter returns HTTP 402 or a terminal SSE credit error] → Treat it as non-retryable, preserve any already-streamed answer, and leave uploaded source data available for WeKnora's existing reparse flow.
- [Paddle delivery order varies] → Use event occurrence time and event ID so an older or duplicate event cannot overwrite newer state.
- [Existing tenants currently have larger storage quotas] → Migration assigns Free and 5 GiB unless an explicit paid plan is set; files are never deleted when usage exceeds the new quota, but new uploads remain blocked.

## Migration Plan

1. Keep tenant entitlement columns with Free defaults in PostgreSQL and SQLite; update existing rows to Free/5 GiB without deleting data.
2. Deploy backend enforcement, tenant child-key provisioning, and the read-only entitlement UI with Paddle disabled by default.
3. Configure `OPENROUTER_MANAGEMENT_API_KEY` and the existing 32-byte `SYSTEM_AES_KEY`; child keys are created lazily, so there is no bulk migration or provider-side scan.
4. Configure Paddle values later as one deployment unit, then register its webhook endpoint.
5. Validate Free and paid behavior with separate tenants and one bounded OpenRouter request after the management key is available.

Rollback is code rollback plus leaving additive columns in place; no user objects or usage records are deleted.

## Open Questions

None for the first release. Paddle credentials and catalog IDs are an operational input, not an implementation decision.
