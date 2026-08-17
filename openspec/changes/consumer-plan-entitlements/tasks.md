## 1. Entitlement core

- [x] 1.1 Add failing policy and repository tests for the four-plan matrix, UTC rollover, and atomic cost recording
- [x] 1.2 Add additive PostgreSQL/SQLite tenant migrations and implement the minimal entitlement service/repository methods

## 2. Server enforcement

- [x] 2.1 Add failing service tests and enforce Free knowledge-base, document, video, and model limits
- [x] 2.2 Add parse preflight plus OpenRouter user attribution and authoritative `usage.cost` recording across existing model clients
- [x] 2.3 Add the authenticated entitlement endpoint and optional signature-verified Paddle webhook

## 3. Consumer UI

- [x] 3.1 Show plan/storage/credit state in General settings and align storefront's four plans with enforced limits

## 4. Verification and release

- [ ] 4.1 Run focused and full backend/frontend/storefront checks plus strict OpenSpec validation
- [ ] 4.2 Commit and push Task 5, wait for CI and production deployment, then browser-verify separate Free and paid Google accounts and bounded live OpenRouter usage
