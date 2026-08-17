# Verification Report: consumer-plan-entitlements

Verified on 2026-08-16 (America/Phoenix) against revision `e372c02f6183b2977cbdb9ecc3dc0d2d86ac1b08`.

## Summary

| Dimension | Status |
|---|---|
| Completeness | 8/8 tasks complete; 7/7 requirements implemented |
| Correctness | 17/17 specified scenarios covered by code, automated checks, or bounded production acceptance |
| Coherence | Follows the tenant-row, single plan-matrix, existing service-boundary, OpenRouter transport, and optional Paddle decisions |

## Requirement mapping

- Four plans and UTC-month rules: `weknora/internal/types/entitlement.go:43`, `weknora/internal/types/entitlement.go:52`, `weknora/internal/types/entitlement.go:76`, and additive PostgreSQL/SQLite migrations.
- Free knowledge-base, document, video, parse-estimate, and model gates: `weknora/internal/application/service/consumer_plan.go:19` and `weknora/internal/types/entitlement.go:87`.
- Atomic current-month accounting and idempotent plan application: `weknora/internal/application/repository/entitlement.go:29` and `weknora/internal/application/repository/entitlement.go:58`.
- Stable OpenRouter user attribution, preflight, and JSON/SSE `usage.cost` recording: `weknora/internal/models/openrouter/transport.go:49`, `weknora/internal/models/openrouter/transport.go:108`, and `weknora/internal/models/openrouter/transport.go:180`.
- Existing chat, embedding, rerank, vision, and speech constructors consume the same meter: `weknora/internal/application/service/model.go:479` through `weknora/internal/application/service/model.go:712`. Built-in DeepSeek models use OpenRouter in `weknora/config/builtin_models.yaml`.
- Authenticated entitlement state and fail-closed Paddle adapter: `weknora/internal/router/router.go:253`, `weknora/internal/handler/entitlement.go:87`, `weknora/internal/handler/entitlement.go:122`, and `weknora/internal/handler/entitlement.go:220`.
- Consumer UI and storefront use server-aligned values: `weknora/frontend/src/views/settings/GeneralSettings.vue:8` and `storefront/src/data/homeContent.js:157`.

## Automated verification

- Focused Go entitlement, repository, service, handler, and OpenRouter transport tests passed; native server build passed.
- Frontend: 383/383 tests, 11/11 locale audits, type-check, and production build passed.
- Storefront: 38/38 tests and production build passed.
- GitHub [CI run 31990816896](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31990816896) passed all seven jobs, including the full Go suite/native build, frontend, storefront, auth, DocReader, workflow, release, provenance, and secret checks.
- Strict OpenSpec validation passed after this report and checklist were finalized.

## Release and production acceptance

- [Storefront deployment 31991036493](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31991036493) and [application deployment 31991036451](https://github.com/estromeglovettgen-coder/musuw/actions/runs/31991036451) completed successfully for the exact revision.
- Production migration is `83`, clean. App, frontend, and PostgreSQL containers are healthy and the app/frontend run by fixed GHCR digests.
- `musuw.com`, `www.musuw.com`, and `app.musuw.com/health` returned HTTP 200.
- Browser acceptance with a Plus Google tenant showed 20 GB, USD 1.25 monthly credit, unlimited plan knowledge/document limits, all configured models, and truthful Paddle-unavailable state. A bounded DeepSeek V4 Flash request returned `OK`; authoritative usage persisted as 11 micro-USD for `2026-08`.
- Browser acceptance with a separate Free Google tenant showed 5 GB, USD 1 monthly credit, one knowledge base, ten documents per knowledge base, no video, and exactly five least-cost capability models. A third knowledge-base creation was rejected with the actionable Free-plan limit message. A bounded Qwen Flash request returned `OK`; authoritative usage persisted as 17 micro-USD for `2026-08`.
- The production storefront showed Free/Plus/Pro/Max at USD 0/5/10/20 with 5/20/40/80 GB and USD 1/1.25/2.50/5 monthly OpenRouter credits.
- Paddle credentials are intentionally absent in production, so the specified unconfigured path was accepted: checkout is unavailable and cannot grant a plan. Signature, known-price, replay/idempotency, and signed tenant mapping are covered by automated tests.
- Task 2 video support remains skipped; this change only enforces Free's no-video entitlement and does not claim that paid video upload currently exists.

## Issues

- CRITICAL: none.
- WARNING: none.
- SUGGESTION: none.

All checks passed. Ready for archive.
