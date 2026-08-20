## Why

Musuw currently advertises four consumer plans but every signed-in tenant receives the same storage, document, and model access, and OpenRouter spend is not bounded per user. The first paid release needs one enforceable source of truth so the advertised limits match real upload and model behavior.

## What Changes

- Add tenant-scoped Free, Plus, Pro, and Max entitlements with storage and monthly OpenRouter credit limits.
- Enforce Free's one-knowledge-base, ten-documents-per-knowledge-base, no-video, and cheapest-chat-model limits in existing service paths.
- Lazily provision one OpenRouter-managed child key per tenant with the plan's native monthly limit, attribute supported calls with a stable non-PII user identifier, and read usage from OpenRouter.
- Expose current plan, storage, and credit usage in the existing General settings page.
- Open Paddle's hosted checkout from General settings, accept signature-verified subscription events, and link authenticated customers to Paddle's hosted self-service portal when the complete server-owned catalog and credentials are configured; remain explicitly disabled when any required value is absent.
- Route every built-in DeepSeek model through the existing OpenRouter integration.

## Capabilities

### New Capabilities

- `consumer-plan-entitlements`: Defines consumer plan limits, enforcement, OpenRouter attribution/accounting, and optional subscription synchronization.

### Modified Capabilities

None.

## Impact

- PostgreSQL and SQLite tenant schema and tenant repository.
- Existing knowledge-base, knowledge-upload, model-construction, OpenRouter request, tenant lifecycle, and encrypted tenant-credential paths.
- Existing authenticated API/router and General settings UI.
- Storefront plan naming/copy and deployment environment documentation.
- Optional Paddle.js checkout, official Go webhook verifier and customer-portal client, endpoints, and environment variables; no new service, billing ledger, custom billing screen, or queue.
