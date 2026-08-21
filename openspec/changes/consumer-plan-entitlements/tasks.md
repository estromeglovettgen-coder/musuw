## 1. Entitlement core

- [x] 1.1 Add failing policy and repository tests for the four-plan matrix and provider-managed child-key lifecycle
- [x] 1.2 Keep the additive PostgreSQL/SQLite plan fields and implement encrypted first-use child-key persistence on the existing tenant row

## 2. Server enforcement

- [x] 2.1 Add failing service tests and enforce Free knowledge-base, document, video, and model limits
- [x] 2.2 Use the official OpenRouter SDK for monthly-limited child keys, inject tenant keys/user attribution across existing model clients, and make 402 terminal
- [x] 2.3 Add the authenticated entitlement endpoint and optional signature-verified Paddle webhook
- [x] 2.4 Use Paddle's official Go verifier, tenant-bound checkout data, server-owned price mappings, subscription-only state changes, and idempotent observable event handling
- [x] 2.5 Move all child keys off the UTC natural-month reset, refresh Free on its registration anniversary, and replenish monthly-paid plans exactly once from a verified successful Paddle recurring period

## 3. Consumer UI

- [x] 3.1 Show plan/storage/credit state in General settings and align storefront's four plans with enforced limits
- [x] 3.2 Preserve storefront plan intent through authentication and open the official Paddle.js overlay from General settings without a custom payment form
- [x] 3.3 Add an authenticated, tenant-owned Paddle Customer Portal button using the official Go SDK and expose only a fresh one-time overview URL
- [x] 3.4 Add official Paddle preview/update for paid upgrades while preserving the current term and keeping the signed webhook authoritative
- [x] 3.5 Replace the compact upgrade controls with a GPT-style four-plan comparison and Paddle.js localized `PricePreview()` values

## 4. Verification and release

- [x] 4.1 Run focused and full backend/frontend/storefront checks plus strict OpenSpec validation
- [x] 4.2 Verify Free and paid catalog/limits in the local browser and retain the earlier bounded production evidence; defer the combined release at the user's request because GitHub Actions minutes are exhausted
- [x] 4.3 Verify the six-price Sandbox catalog, real Paddle-signed activation/cancellation/duplicate deliveries, database state, audit logs, and browser entitlement refresh through the local Cloudflare tunnel
- [x] 4.4 Verify the authenticated Customer Portal, anonymous/no-customer rejection, token-redacted logs, and final local browser lifecycle regression
- [x] 4.5 Upgrade a real non-admin Sandbox subscription in Chrome and verify the signed event updates the existing OpenRouter child-key limit before the durable plan
- [x] 4.6 Verify Free anniversary refresh without stacking, paid-cycle renewal idempotency, same-cycle upgrade preservation, localized plan prices, and the final local browser lifecycle
