## 1. Entitlement core

- [x] 1.1 Add failing policy and repository tests for the four-plan matrix and provider-managed child-key lifecycle
- [x] 1.2 Keep the additive PostgreSQL/SQLite plan fields and implement encrypted first-use child-key persistence on the existing tenant row

## 2. Server enforcement

- [x] 2.1 Add failing service tests and enforce Free knowledge-base, document, video, and model limits
- [x] 2.2 Use the official OpenRouter SDK for monthly-limited child keys, inject tenant keys/user attribution across existing model clients, and make 402 terminal
- [x] 2.3 Add the authenticated entitlement endpoint and optional signature-verified Paddle webhook

## 3. Consumer UI

- [x] 3.1 Show plan/storage/credit state in General settings and align storefront's four plans with enforced limits

## 4. Verification and release

- [x] 4.1 Run focused and full backend/frontend/storefront checks plus strict OpenSpec validation
- [x] 4.2 Verify Free and paid catalog/limits in the local browser and retain the earlier bounded production evidence; defer the combined release at the user's request because GitHub Actions minutes are exhausted
