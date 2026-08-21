## Why

Musuw currently advertises four consumer plans but every signed-in tenant receives the same storage, document, and model access, and OpenRouter spend is not bounded per user. The first paid release needs one enforceable source of truth so the advertised limits match real upload and model behavior.

## What Changes

- Add tenant-scoped Free, Plus, Pro, and Max entitlements with storage and monthly OpenRouter credit limits.
- Enforce Free's one-knowledge-base, ten-documents-per-knowledge-base, no-video, and cheapest-chat-model limits in existing service paths.
- Lazily provision one OpenRouter-managed child key per tenant with no provider calendar reset, refresh Free on its registration anniversary and paid plans on their subscription cycle, and never stack inactive periods or add a Musuw usage ledger.
- Expose current plan, storage, credit usage, and exact personal-cycle boundary in Usage & billing settings, with a separate GPT-style `/plans` comparison page for Free, Plus, Pro, and Max.
- Link account and Usage & billing upgrade actions to `/plans`, then mount Paddle's official hosted checkout on a dedicated `/checkout` page. Let an authenticated paid tenant preview and apply a higher server-owned tier through Paddle's official subscription API, accept signature-verified subscription events, and link authenticated customers to Paddle's hosted self-service portal when the complete server-owned catalog and credentials are configured; remain explicitly disabled when any required value is absent.
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
- Optional Paddle.js checkout and price preview, official Go webhook verifier, subscription updater and customer-portal client, endpoints, and environment variables; no new service, usage ledger, custom payment form, scheduler, or queue.
