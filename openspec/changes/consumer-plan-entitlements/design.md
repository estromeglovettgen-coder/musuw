## Context

Musuw already has tenant storage quotas, tenant-scoped repositories, native model factories, one OpenRouter-backed provider path, and an Asynq/Redis worker topology. It lacks a consumer plan source of truth, per-tenant model/spend enforcement, and a real relationship between the storefront's four price cards and product behavior. Paddle Live has not been authorized for launch; the current checked deployment stage therefore uses Sandbox as one complete environment unit, while payment setup remains optional outside Musuw's fixed production overlay and must not weaken enforcement. This delta adds the smallest reliable handoff for signed webhooks, stateless signed checkout input, a durable paid-upgrade operation identity, and the exact one-item subscription invariant without introducing a financial reconciliation subsystem or general billing ledger.

## Goals / Non-Goals

**Goals:**

- Make Free, Plus, Pro, and Max limits authoritative on existing server paths.
- Make OpenRouter's managed key limit and usage the spend authority per tenant while each tenant keeps its own monthly credit boundary.
- Keep consumer-facing state visible and testable with two accounts.
- Keep account and usage settings compact, place plan comparison on a dedicated page, and add the smallest secure Paddle-hosted checkout, self-service portal, and subscription synchronization seam for configured environments.
- Acknowledge verified webhooks within Paddle's five-second callback contract after durable, retryable handoff; leave tenant database event markers as the final entitlement idempotency guard.
- Delegate initial self-service transaction creation to Paddle.js and serialize only the paid subscription-update mutation; never blindly repeat that provider mutation after an uncertain response.

**Non-Goals:**

- A general billing, local usage ledger, invoicing, analytics, or per-provider metering platform.
- User-supplied API keys, request-price estimates, a general-purpose queue, or historical usage events; the existing Asynq queue is used only for bounded billing handoff and retry.
- Restoring the video feature skipped in Task 2.
- Building admin subscription management, a custom checkout UI, or custom invoice/payment-method/cancellation screens.
- Paddle Live cutover or Retain feature activation; both require a later reviewed change after the Sandbox launch stage.

## Decisions

### Keep durable product state on the existing tenant row

Keep plan/status, optional Paddle identifiers, and the last Paddle-confirmed entitled-period end on `tenants`; storage remains in the existing `storage_quota`/`storage_used` fields. Store only the OpenRouter-managed child key and key hash in the existing tenant credentials JSONB, encrypted by the existing secret-value path. OpenRouter, not a Musuw usage table or counter, owns monthly spend state. The one paid-through timestamp is an access boundary, not a usage ledger, and prevents an annual subscription in payment recovery from opening allowance periods beyond the year already paid. Initial checkout has no local operation record: Paddle.js creates the transaction and Paddle owns its incomplete lifecycle. Keep only the narrow billing-operation record required to serialize a paid subscription update whose official API has no general idempotency key; the tenant's Paddle event ID/time markers remain the final entitlement idempotency guard. This avoids a second usage ledger, aggregate, join, or broad reconciliation service.

### Put the complete plan matrix in one pure Go definition

One `PlanLimits` function owns plan names, storage, monthly credits, Free content gates, and the least-cost built-in IDs. Services and the response DTO consume it. The later `adjust-consumer-plan-limits` change updates storage to 1/10/30/100 GiB and Free monthly credit to USD 0.40 while retaining the paid credit allowances. Database values identify the plan; limits are not duplicated in rows.

### Enforce at existing service boundaries

Knowledge-base creation, all upload entry points, model listing/resolution, and provider construction call a small entitlement service. UI filtering is only presentation. This reuses WeKnora's repository counts and storage pipeline and prevents direct API bypasses.

### Use OpenRouter's official managed-key boundary

On first inference, the entitlement service uses OpenRouter's official Go SDK to create one child key named for the tenant with `limit_reset: null`. Its absolute limit is lifetime usage plus the current period allowance. The existing tenant-row transaction installs the first winner and the first credit-period end together; a concurrent loser is deleted at OpenRouter. No shared inference key or BYOK fallback exists. The stored key is encrypted at rest and never serialized to consumers.

A small transport wrapper obtains that tenant key, replaces the outbound authorization header, and injects the documented stable `user` identifier into JSON requests. Existing chat, embedding, rerank, vision, and speech clients receive this HTTP client; provider behavior and response parsing otherwise remain unchanged. OpenRouter HTTP/SSE credit exhaustion is converted into one typed terminal error so chat closes cleanly and ingestion uses WeKnora's native failed/reparse lifecycle without futile retries.

### Query usage and synchronize plan changes at the provider

Usage & billing settings queries the child key through the official SDK and displays the plan allowance plus the provider's remaining value. The tenant row stores one generic credit-period end and Paddle's last confirmed entitled-period end, not a usage counter. Free is anchored to tenant registration. Annual paid plans advance their monthly allowance lazily on the first entitlement read or inference after the boundary, but only while that stored annual period end is still in the future. Paddle sends `subscription.updated` at the start of renewal before collecting payment, and a later `past_due` payload points `current_billing_period` at that unpaid window, so neither event advances this boundary. Initial creation/activation may seed it; a matching successful recurring `transaction.completed` advances it on renewal. The advance rechecks plan, customer, subscription, and cadence under the existing tenant row lock, and period ends only move forward, so reordered webhooks or multiple replicas cannot extend the wrong subscription or roll a confirmed term back. Pausing blocks access but retains the already-verified term, credit boundary, and provider limit; Paddle's `continue_existing_billing_period` resume path therefore restores the same remaining allowance only until the original boundary rather than granting a new month. Cancellation clears the paid term. A `past_due` annual subscription therefore keeps its already-paid term but cannot spend or open another allowance after that term expires. Missing paid cadence or period data fails closed. Skipped inactive periods grant only the current allowance and never stack. Monthly paid plans do not advance lazily: the same verified recurring completion, whose subscription/customer/price/binding all match and whose billing period is newer, sets the absolute limit to lifetime usage plus one plan allowance. Initial paid activation grants one full allowance, and a same-period tier upgrade preserves usage and adds only the allowance difference. Duplicate period advances are ignored. Provider failure leaves the durable plan or period unchanged; database failure restores the prior provider limit. Tenant deletion removes the provider key before deleting local state. These short fail-closed operations replace a local accounting/reconciliation subsystem, prevent a late-month purchase from receiving a second allowance on the next UTC month boundary, and ensure a Free account registered on the 28th refreshes on its own monthly anniversary rather than the 1st.

### Hand off verified webhooks before mutating entitlement

The HTTP handler keeps raw-body signature, tenant, price, binding, and event-shape validation synchronous, then enqueues a canonical event envelope to the existing Asynq/Redis worker path. The envelope contains no webhook secret or request credentials. A deterministic event ID is the Asynq `TaskID`; bounded retry, timeout, and the existing dead-letter middleware make delivery durable and observable. The handler returns success only after enqueue acceptance (including an idempotent task-ID conflict) and is bounded by Paddle's five-second callback contract. The worker invokes the existing entitlement service, whose tenant-row transaction and `paddle_last_event_id`/`paddle_last_event_at` markers remain the final business idempotency and ordering guard. `Unique` is not used as the only guard.

This deliberately reuses the mature queue and repository conventions rather than adding a second queue library or a local billing ledger. Redis durability and retry are operational prerequisites, while the database event markers remain authoritative if a task is delivered more than once.

### Make Paddle an optional signed adapter

A public webhook uses Paddle's official Go verifier against the raw body, maps only the six configured recurring price IDs, and hands the validated event to retryable Asynq work before acknowledging. A durable paid tenant, including paused access, ignores lifecycle events for a different subscription; only a durable Free or canceled tenant may replace a stale subscription identifier through a signed active creation or activation with a confirmed period newer than the event time. The authenticated entitlement response gives a Free tenant Paddle's public client token plus one server-mapped price and a stateless HMAC binding for each plan/period choice. The standalone `/plans` page sends one allowed choice to `/checkout`, where Paddle.js creates the standard self-service transaction from exactly one returned item and the signed custom data, then mounts Paddle's official one-page inline Checkout. Musuw neither creates nor mirrors that initial transaction. The webhook verifies the binding before writing the existing tenant plan fields. The last Paddle plan event ID/time and the single allowance-period end provide final idempotency. Missing or partial configuration disables checkout; provider-resolvable or period-confirmed paid tenants are not offered a second subscription checkout. Request parameters, checkout completion callbacks, non-recurring transaction events, unknown prices, tampered bindings, or unsigned bodies never grant a plan or allowance.

The inline Checkout receives Musuw's current supported UI locale using Paddle's documented locale tags. Billing country, currency, tax, and eligible payment methods remain Paddle-owned and are never inferred from UI language; this preserves Paddle's native address and regional eligibility rules without adding a local geo/payment rules engine.

The standalone plan comparison uses Paddle.js `PricePreview()` with exactly the same server-mapped price IDs as checkout. It renders Paddle's formatted unit subtotal directly, leaving tax detail to checkout while visitor IP and Paddle catalog overrides own country/currency formatting. Musuw never reformats a preview amount and never maps language to billing country. The UI follows the public GPT pricing hierarchy—plain equal cards, concise benefits, one primary action—while the dedicated `/checkout` route contains only Musuw's plan summary and Paddle's official inline payment form.

The existing tenant row also keeps Paddle's customer and subscription IDs from verified webhooks. An authenticated, input-free endpoint resolves those hidden IDs from the current tenant and uses Paddle's official Go SDK plus a server-only key to mint a fresh hosted portal session. It returns only the HTTPS overview URL, never caches it, and never exposes Paddle IDs or the SDK response. This lets Paddle own invoices, payment methods, and cancellation UI without a Musuw billing subsystem; checkout stays unavailable until this self-service credential is configured.

The same official SDK fills the one gap in Paddle's hosted portal: changing a paid tier. The client sends only a higher target plan. The server atomically creates or reuses one tenant-scoped upgrade operation, resolves the hidden customer and subscription from the authenticated tenant, fetches the current Paddle subscription to prove ownership and current server-owned price, preserves its monthly/yearly period, and replaces the single known base item with the mapped target price. Paddle previews and applies the change using `prorated_immediately` and `prevent_change`; the UI shows Paddle's localized minor-unit result before confirmation. Paddle does not expose a general idempotency key for this mutation, so a timeout or malformed response leaves the operation `uncertain`, blocks another mutation, and requires explicit provider/operator reconciliation rather than an automatic retry subsystem. The update also rotates the tenant/target-price HMAC in subscription custom data so the existing signed `subscription.updated` webhook remains the sole plan authority. No direct UI callback or update response grants Pro/Max, no subscription with zero/multiple/unknown base items is accepted, and no downgrade, term switch, parallel subscription, usage ledger, or broad reconciliation process is added.

`past_due` remains paid grace through the last confirmed paid-term boundary. It does not create a new allowance or move the boundary until a matching successful recurring payment is verified. The sibling `enable-paddle-live-production` review adds only the minimum signed full-refund/chargeback entitlement decision and authoritative subscription read for reversal. Official Retain receives the non-authoritative, authenticated `pwCustomer` handoff; Paddle, not Musuw, owns dunning and recovery behavior.

Generic WeKnora deployments may leave Paddle unconfigured. The shared shape validator understands Sandbox `test_` + `pdl_sdbx_apikey_` and Live `live_` + `pdl_live_apikey_`, each with one destination-specific notification secret and six distinct price IDs. Musuw's fixed production Compose wrapper is stricter: the reviewed Live cutover makes both preflight and app entrypoint require one complete Live unit and reject Sandbox or mixed inputs. Server secrets never enter the generated environment or browser bundle. Because `pri_` IDs and `pdl_ntfset_` secrets do not encode environment, official Live catalog reads plus a signed event from the exact Live destination remain required before billing is declared operational; prefix checks alone are insufficient.

## Risks / Trade-offs

- [The management key or required AES key is absent] → Do not provision or fall back to a shared key; expose the plan limit with provider usage marked unavailable/unprovisioned and log a reason code.
- [Concurrent first requests create multiple child keys] → Persist one winner under the existing tenant row lock and delete each provider-side loser.
- [A plan update reaches OpenRouter but not the database] → Restore the provider limit from the durable database plan immediately; do not add a background reconciler for the current single-server product.
- [A verified webhook arrives while the provider is slow or a worker restarts] → Acknowledge only after the durable Asynq enqueue, retry with the event ID, and leave the tenant event markers authoritative; dead-letter exhausted work for operator review.
- [An initial checkout is opened or abandoned] → Paddle.js and Paddle Checkout own the provider transaction lifecycle; Musuw keeps no checkout mutation slot and grants nothing until a signed active subscription event passes every binding check.
- [A paid upgrade request times out after the provider may have accepted it] → Mark the upgrade operation uncertain, keep the tenant mutation slot occupied, and require explicit provider/operator reconciliation; never issue a blind second subscription mutation or build an automatic reconciler.
- [OpenRouter returns HTTP 402 or a terminal SSE credit error] → Treat it as non-retryable, preserve any already-streamed answer, and leave uploaded source data available for WeKnora's existing reparse flow.
- [Paddle delivery order varies] → Use event occurrence time and event ID for plan state, and the paid billing-period end for allowance idempotency so unrelated newer events cannot suppress a successful renewal.
- [A prorated upgrade payment fails or the current Paddle subscription no longer matches the tenant] → Use Paddle's `prevent_change`, fail closed, and leave both the durable plan and existing OpenRouter key limit unchanged.
- [Disposable Sandbox data contains stale provider IDs] → Delete the test account through the existing product lifecycle and validate a fresh Sandbox checkout; do not add a cross-environment subscription-recovery subsystem.
- [Existing tenants have a prior storage matrix] → The superseding limit migration maps persisted Free/Plus/Pro/Max plans to 1/10/30/100 GiB; files are never deleted when usage exceeds the new quota, but new uploads remain blocked.

## Migration Plan

1. Keep tenant entitlement columns with Free defaults in PostgreSQL and SQLite; the superseding limit migration updates existing rows to 1/10/30/100 GiB by persisted plan without deleting data.
2. Deploy backend enforcement, tenant child-key provisioning, and the read-only entitlement UI with Paddle disabled by default.
3. Configure `OPENROUTER_MANAGEMENT_API_KEY` and the existing 32-byte `SYSTEM_AES_KEY`; child keys are created lazily, so there is no bulk migration or provider-side scan.
4. Add stateless signed checkout input, the narrow upgrade-operation state, the retryable verified-webhook handoff, and the exactly-one-known-base-item check. Keep the existing tenant event markers as final idempotency and do not add an initial checkout operation, refund/chargeback engine, reconciliation subsystem, or usage ledger.
5. Keep the verified Sandbox unit for development/test. For production, apply the sibling Live change as one unit: matching Live API key and `live_` client token, exact Live destination secret, and all six Live recurring price IDs; resolve the catalog through Live and prove the exact destination with a signed no-charge simulation before calling billing operational.
6. Validate Free and paid behavior with separate tenants and one bounded OpenRouter request after the management key is available.

Rollback is code rollback plus leaving additive columns in place; no user objects or usage records are deleted.

## Open Questions

None for the first release. Paddle credentials and catalog IDs are an operational input, not an implementation decision.
