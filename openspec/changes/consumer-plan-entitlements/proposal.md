## Why

Musuw currently advertises four consumer plans but every signed-in tenant receives the same storage, document, and model access, and OpenRouter spend is not bounded per user. The first paid release needs one enforceable source of truth so the advertised limits match real upload and model behavior.

## What Changes

- Add tenant-scoped Free, Plus, Pro, and Max entitlements with storage and monthly OpenRouter credit limits.
- Enforce Free's one-knowledge-base, ten-documents-per-knowledge-base, no-video, and cheapest-chat-model limits in existing service paths.
- Lazily provision one OpenRouter-managed child key per tenant with no provider calendar reset, refresh Free on its registration anniversary and paid plans only inside their verified paid term, and never stack inactive periods or add a Musuw usage ledger.
- Expose current plan, storage, credit usage, and exact personal-cycle boundary in Usage & billing settings, with a separate GPT-style `/plans` comparison page for Free, Plus, Pro, and Max.
- Link account and Usage & billing upgrade actions to `/plans`, then mount Paddle's official hosted checkout on a dedicated `/checkout` page. Let an authenticated paid tenant preview and apply a higher server-owned tier through Paddle's official subscription API, accept signature-verified subscription events, and link authenticated customers to Paddle's hosted self-service portal when the complete server-owned catalog and credentials are configured; remain explicitly disabled when any required value is absent.
- Hand off every verified Paddle webhook to durable, retryable background work and acknowledge it within Paddle's five-second callback contract; keep the tenant's database event markers as the final entitlement idempotency guard.
- Issue or reuse a server-created checkout transaction intent and serialize or reuse a tenant's upgrade operation. Paddle does not provide a general mutation idempotency key, so an uncertain provider response stays fail-closed for explicit operator reconciliation and is never retried blindly. Accept only one known server-owned subscription base item.
- Keep `past_due` access bounded by the last confirmed paid term. Defer refund/chargeback entitlement policy and adjustment-event handling to the separately reviewed Live cutover instead of adding a Sandbox-only financial reconciliation subsystem.
- Treat Paddle environment selection as one deployment contract: the generic adapter understands Sandbox `test_` + `pdl_sdbx_apikey_` and Live `live_` + `pdl_live_apikey_` shapes, each with one destination secret and six distinct recurring prices, while Musuw's fixed production wrapper currently accepts Sandbox only. Live is not authorized and requires a later reviewed code change rather than an environment-only switch.
- Keep the current release Sandbox-only; Paddle Live cutover and Retain feature activation remain deferred to a later reviewed change.
- Route every built-in DeepSeek model through the existing OpenRouter integration.

## Capabilities

### New Capabilities

- `consumer-plan-entitlements`: Defines consumer plan limits, enforcement, OpenRouter attribution/accounting, and optional subscription synchronization.

### Modified Capabilities

None.

## Impact

- PostgreSQL and SQLite tenant schema and tenant repository.
- Existing knowledge-base, knowledge-upload, model-construction, OpenRouter request, tenant lifecycle, and encrypted tenant-credential paths.
- Existing authenticated API/router, Usage & billing/account settings, and standalone plan/checkout routes.
- Storefront plan naming/copy and deployment environment documentation.
- Optional Paddle.js checkout and price preview, official Go webhook verifier, subscription updater and customer-portal client, a narrow durable webhook queue, server-created checkout intents, serialized upgrade operations, endpoints, and environment variables; no refund/chargeback engine, general billing ledger, custom payment form, or broad reconciliation subsystem.
