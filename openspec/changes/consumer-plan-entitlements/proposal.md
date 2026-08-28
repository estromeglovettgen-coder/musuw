## Why

Musuw currently advertises four consumer plans but every signed-in tenant receives the same storage, document, and model access, and OpenRouter spend is not bounded per user. The first paid release needs one enforceable source of truth so the advertised limits match real upload and model behavior.

## What Changes

- Add tenant-scoped Free, Plus, Pro, and Max entitlements with storage and monthly OpenRouter credit limits.
- Enforce Free's one-knowledge-base, ten-documents-per-knowledge-base, no-video, and cheapest-chat-model limits in existing service paths.
- Lazily provision one OpenRouter-managed child key per tenant with no provider calendar reset, refresh Free on its registration anniversary and paid plans only inside their verified paid term, and never stack inactive periods or add a Musuw usage ledger.
- Expose current plan, storage, credit usage, and exact personal-cycle boundary in Usage & billing settings, with a separate GPT-style `/plans` comparison page for Free, Plus, Pro, and Max.
- Link account and Usage & billing upgrade actions to `/plans`, then mount Paddle's official hosted checkout on a dedicated `/checkout` page. Let an authenticated paid tenant preview and apply a higher server-owned tier through Paddle's official subscription API, accept signature-verified subscription events, and link authenticated customers to Paddle's hosted self-service portal when the complete server-owned catalog and credentials are configured; remain explicitly disabled when any required value is absent.
- Hand off every verified Paddle webhook to durable, retryable background work and acknowledge it within Paddle's five-second callback contract; keep the tenant's database event markers as the final entitlement idempotency guard.
- Let Paddle.js create the standard self-service checkout transaction from one server-mapped price and tenant-bound custom data; Musuw does not create, mirror, or serialize an initial checkout transaction. Serialize or reuse only a tenant's paid upgrade operation because Paddle's subscription update API has no general mutation idempotency key; an uncertain upgrade response stays fail-closed for explicit operator reconciliation and is never retried blindly. Accept only one known server-owned subscription base item.
- Keep `past_due` access bounded by the last confirmed paid term. The separately reviewed `enable-paddle-live-production` change adds only signed full-refund/chargeback decisions and an authoritative subscription read for reversal; it does not add a financial ledger or payment operation.
- Treat Paddle environment selection as one deployment contract: the generic adapter understands Sandbox `test_` + `pdl_sdbx_apikey_` and Live `live_` + `pdl_live_apikey_` shapes, each with one destination secret and six distinct recurring prices. The reviewed fixed production wrapper now accepts only the complete Live unit; Sandbox remains development/test-only.
- Initialize the same official Live Paddle.js client for Retain and pass only the authenticated entitlement-derived provider customer ID. Paddle owns dunning, recovery links, payment-method recovery UI, tax, currency, and payment execution.
- Add one operations-only consumer-account erasure path that immediately fences the selected account, revokes every session, reuses the existing tenant/knowledge/provider cleanup paths, and removes the Supabase identity through a server-only official Admin API adapter before the local user is hard-deleted. Active Paddle billing is never canceled or mutated by this path: it fails closed until billing is resolved through Paddle's official hosted management surface.
- Route every built-in DeepSeek model through the existing OpenRouter integration.

## Capabilities

### New Capabilities

- `consumer-plan-entitlements`: Defines consumer plan limits, enforcement, OpenRouter attribution/accounting, and optional subscription synchronization.
- `account-erasure`: Defines the bounded, operations-only deletion contract for a Musuw consumer account and its personal workspace.

### Modified Capabilities

None.

## Impact

- PostgreSQL and SQLite tenant schema and tenant repository.
- Existing knowledge-base, knowledge-upload, model-construction, OpenRouter request, tenant lifecycle, and encrypted tenant-credential paths.
- Existing authenticated API/router, Usage & billing/account settings, and standalone plan/checkout routes.
- Existing identity, session, personal-workspace, queue, object-storage, vector/graph cleanup, and Supabase Admin integration boundaries.
- Storefront plan naming/copy and deployment environment documentation.
- Optional Paddle.js checkout and price preview, official Go webhook verifier, subscription updater and customer-portal client, a narrow durable webhook queue, stateless signed checkout input, serialized upgrade operations, endpoints, and environment variables; no server-created initial transaction, financial refund/chargeback engine, general billing ledger, custom payment form, or broad reconciliation subsystem.
