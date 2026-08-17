## Why

Musuw currently advertises four consumer plans but every signed-in tenant receives the same storage, document, and model access, and OpenRouter spend is not bounded per user. The first paid release needs one enforceable source of truth so the advertised limits match real upload and model behavior.

## What Changes

- Add tenant-scoped Free, Plus, Pro, and Max entitlements with storage and monthly OpenRouter credit limits.
- Enforce Free's one-knowledge-base, ten-documents-per-knowledge-base, no-video, and cheapest-chat-model limits in existing service paths.
- Attribute OpenRouter calls to a stable non-PII user identifier, preflight parse cost, and record authoritative OpenRouter response cost against the current month.
- Expose current plan, storage, and credit usage in the existing General settings page.
- Accept optional, signature-verified Paddle subscription events when Paddle is configured; remain explicitly disabled when credentials are absent.
- Route every built-in DeepSeek model through the existing OpenRouter integration.

## Capabilities

### New Capabilities

- `consumer-plan-entitlements`: Defines consumer plan limits, enforcement, OpenRouter attribution/accounting, and optional subscription synchronization.

### Modified Capabilities

None.

## Impact

- PostgreSQL and SQLite tenant schema and tenant repository.
- Existing knowledge-base, knowledge-upload, model-construction, and OpenRouter request paths.
- Existing authenticated API/router and General settings UI.
- Storefront plan naming/copy and deployment environment documentation.
- Optional Paddle webhook endpoint and environment variables; no new service or queue.
