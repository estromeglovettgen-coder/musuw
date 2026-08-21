## Context

Musuw already has tenant storage quotas, tenant-scoped repositories, native model factories, and one OpenRouter-backed provider path. It lacks a consumer plan source of truth, per-tenant model/spend enforcement, and a real relationship between the storefront's four price cards and product behavior. Production currently has no Paddle credentials, so payment setup must be optional and must not weaken enforcement.

## Goals / Non-Goals

**Goals:**

- Make Free, Plus, Pro, and Max limits authoritative on existing server paths.
- Make OpenRouter's managed key limit and usage the spend authority per tenant while each tenant keeps its own monthly credit boundary.
- Keep consumer-facing state visible and testable with two accounts.
- Keep account and usage settings compact, place plan comparison on a dedicated page, and add the smallest secure Paddle-hosted checkout, self-service portal, and subscription synchronization seam for configured environments.

**Non-Goals:**

- A general billing, local usage ledger, invoicing, analytics, or per-provider metering platform.
- User-supplied API keys, request-price estimates, distributed reservations, queues, or historical usage events.
- Restoring the video feature skipped in Task 2.
- Building admin subscription management, a custom checkout UI, or custom invoice/payment-method/cancellation screens.

## Decisions

### Keep durable product state on the existing tenant row

Keep plan/status and optional Paddle identifiers on `tenants`; storage remains in the existing `storage_quota`/`storage_used` fields. Store only the OpenRouter-managed child key and key hash in the existing tenant credentials JSONB, encrypted by the existing secret-value path. OpenRouter, not a Musuw usage table or counter, owns monthly spend state. This avoids a second ledger, aggregate, join, and reconciliation service.

### Put the complete plan matrix in one pure Go definition

One `PlanLimits` function owns plan names, storage, monthly credits, Free content gates, and the least-cost built-in IDs. Services and the response DTO consume it. Pro and Max storage follow the same four-GiB-per-listed-dollar rule as Plus: 40 and 80 GiB. Database values identify the plan; limits are not duplicated in rows.

### Enforce at existing service boundaries

Knowledge-base creation, all upload entry points, model listing/resolution, and provider construction call a small entitlement service. UI filtering is only presentation. This reuses WeKnora's repository counts and storage pipeline and prevents direct API bypasses.

### Use OpenRouter's official managed-key boundary

On first inference, the entitlement service uses OpenRouter's official Go SDK to create one child key named for the tenant with `limit_reset: null`. Its absolute limit is lifetime usage plus the current period allowance. The existing tenant-row transaction installs the first winner and the first credit-period end together; a concurrent loser is deleted at OpenRouter. No shared inference key or BYOK fallback exists. The stored key is encrypted at rest and never serialized to consumers.

A small transport wrapper obtains that tenant key, replaces the outbound authorization header, and injects the documented stable `user` identifier into JSON requests. Existing chat, embedding, rerank, vision, and speech clients receive this HTTP client; provider behavior and response parsing otherwise remain unchanged. OpenRouter HTTP/SSE credit exhaustion is converted into one typed terminal error so chat closes cleanly and ingestion uses WeKnora's native failed/reparse lifecycle without futile retries.

### Query usage and synchronize plan changes at the provider

Usage & billing settings queries the child key through the official SDK and displays the plan allowance plus the provider's remaining value. The tenant row stores only one generic credit-period end, not a usage counter. Free is anchored to tenant registration. Annual paid plans are already paid for the year, so their monthly allowance advances lazily on the first entitlement read or inference after the boundary. Skipped inactive periods grant only the current allowance and never stack. Monthly paid plans do not advance lazily: a verified `transaction.completed` whose origin is `subscription_recurring`, subscription/customer/price/binding all match, and billing period is newer sets the absolute limit to lifetime usage plus one plan allowance. Initial paid activation grants one full allowance, and a same-period tier upgrade preserves usage and adds only the allowance difference. Duplicate period advances are ignored. Provider failure leaves the durable plan or period unchanged; database failure restores the prior provider limit. Tenant deletion removes the provider key before deleting local state. These short fail-closed operations replace a local accounting/reconciliation subsystem, prevent a late-month purchase from receiving a second allowance on the next UTC month boundary, and ensure a Free account registered on the 28th refreshes on its own monthly anniversary rather than the 1st.

### Make Paddle an optional signed adapter

A public webhook uses Paddle's official Go verifier against the raw body, maps only the six configured recurring price IDs, and accepts subscription lifecycle events for plan state plus successful recurring `transaction.completed` events only for paid-period allowance refresh. The authenticated entitlement response gives a Free tenant Paddle's public client token plus one server-mapped price and a stateless HMAC binding for each plan/period choice. The standalone `/plans` page sends one allowed choice to `/checkout`, where Paddle.js mounts the official one-page inline Checkout and copies the tenant ID and binding into subscription `custom_data`; the webhook verifies both before writing the existing tenant plan fields. The last Paddle plan event ID/time and the single allowance-period end provide idempotency. Missing or partial configuration disables checkout, paid tenants are not offered a second subscription checkout, and request parameters, checkout completion callbacks, non-recurring transaction events, unknown prices, tampered bindings, or unsigned bodies never grant a plan or allowance.

The inline Checkout receives Musuw's current supported UI locale using Paddle's documented locale tags. Billing country, currency, tax, and eligible payment methods remain Paddle-owned and are never inferred from UI language; this preserves Paddle's native address and regional eligibility rules without adding a local geo/payment rules engine.

The standalone plan comparison uses Paddle.js `PricePreview()` with exactly the same server-mapped price IDs as checkout. It renders Paddle's formatted unit subtotal directly, leaving tax detail to checkout while visitor IP and Paddle catalog overrides own country/currency formatting. Musuw never reformats a preview amount and never maps language to billing country. The UI follows the public GPT pricing hierarchy—plain equal cards, concise benefits, one primary action—while the dedicated `/checkout` route contains only Musuw's plan summary and Paddle's official inline payment form.

The existing tenant row also keeps Paddle's customer and subscription IDs from verified webhooks. An authenticated, input-free endpoint resolves those hidden IDs from the current tenant and uses Paddle's official Go SDK plus a server-only key to mint a fresh hosted portal session. It returns only the HTTPS overview URL, never caches it, and never exposes Paddle IDs or the SDK response. This lets Paddle own invoices, payment methods, and cancellation UI without a Musuw billing subsystem; checkout stays unavailable until this self-service credential is configured.

The same official SDK fills the one gap in Paddle's hosted portal: changing a paid tier. The client sends only a higher target plan. The server resolves the hidden customer and subscription from the authenticated tenant, fetches the live subscription to prove ownership and current server-owned price, preserves its monthly/yearly period, and replaces the single item with the mapped target price. Paddle previews and applies the change using `prorated_immediately` and `prevent_change`; the UI shows Paddle's localized minor-unit result before confirmation. The update also rotates the tenant/target-price HMAC in subscription custom data so the existing signed `subscription.updated` webhook remains the sole plan authority. No direct UI callback or update response grants Pro/Max, and no downgrade, term switch, second subscription, ledger, or reconciliation process is added.

## Risks / Trade-offs

- [The management key or required AES key is absent] → Do not provision or fall back to a shared key; expose the plan limit with provider usage marked unavailable/unprovisioned and log a reason code.
- [Concurrent first requests create multiple child keys] → Persist one winner under the existing tenant row lock and delete each provider-side loser.
- [A plan update reaches OpenRouter but not the database] → Restore the provider limit from the durable database plan immediately; do not add a background reconciler for the current single-server product.
- [OpenRouter returns HTTP 402 or a terminal SSE credit error] → Treat it as non-retryable, preserve any already-streamed answer, and leave uploaded source data available for WeKnora's existing reparse flow.
- [Paddle delivery order varies] → Use event occurrence time and event ID for plan state, and the paid billing-period end for allowance idempotency so unrelated newer events cannot suppress a successful renewal.
- [A prorated upgrade payment fails or the live subscription no longer matches the tenant] → Use Paddle's `prevent_change`, fail closed, and leave both the durable plan and existing OpenRouter key limit unchanged.
- [Existing tenants currently have larger storage quotas] → Migration assigns Free and 5 GiB unless an explicit paid plan is set; files are never deleted when usage exceeds the new quota, but new uploads remain blocked.

## Migration Plan

1. Keep tenant entitlement columns with Free defaults in PostgreSQL and SQLite; update existing rows to Free/5 GiB without deleting data.
2. Deploy backend enforcement, tenant child-key provisioning, and the read-only entitlement UI with Paddle disabled by default.
3. Configure `OPENROUTER_MANAGEMENT_API_KEY` and the existing 32-byte `SYSTEM_AES_KEY`; child keys are created lazily, so there is no bulk migration or provider-side scan.
4. Configure Paddle environment, a least-privilege server API key with customer-portal-session and subscription read/write permissions, public client token, webhook secret, and all six recurring price IDs as one deployment unit, then register `/api/v1/billing/paddle/webhook` for subscription lifecycle events.
5. Validate Free and paid behavior with separate tenants and one bounded OpenRouter request after the management key is available.

Rollback is code rollback plus leaving additive columns in place; no user objects or usage records are deleted.

## Open Questions

None for the first release. Paddle credentials and catalog IDs are an operational input, not an implementation decision.
