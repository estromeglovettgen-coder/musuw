# Verification evidence

## 2026-08-23 reviewer lifecycle

- Fresh real Supabase recovery flows completed in both TEST and Production:
  reset email accepted, Gmail recovery message opened, official Supabase
  recovery session established, `updateUser({ password })` succeeded, and a
  subsequent password-token sign-in succeeded in each project. The rotated
  password was written only to the approved macOS Keychain item. No email,
  OTP, recovery token, password, or secret is recorded here.
- TEST Max was activated only through Paddle Sandbox. Official transaction and
  subscription state reported a completed monthly Sandbox purchase and active
  Max entitlement; no Live charge, refund, fake webhook, SQL mutation, or
  manual plan override was used. The active Sandbox entitlement remains for
  reviewer access.
- Production and TEST reviewer fixtures were English-only. Production grounded
  retrieval/citation, source library, Wiki, and graph states were captured
  before cleanup. Four active storefront JPEGs were replaced with real DPR2
  captures at 3024x1898 and visually reviewed for English-only content and
  absence of account or credential data.
- Production Aurora fixture knowledge base and conversation were deleted via
  the authenticated product API. TEST guide/video documents, knowledge base,
  and temporary conversations were deleted via the product UI/API. Reviewer
  accounts and the active Sandbox Max subscription were retained.
- Fresh local checks passed: storefront `npm test` (51 tests), auth `npm test`
  (74 tests), frontend `npm test` (536 tests), frontend
  `npm run build-with-types`, targeted OpenRouter HTTP-402/tenant-key tests,
  `openspec validate --all --strict` (13 changes), and `git diff --check`.
- The full `go test ./...` sweep was also run. Core service, router, OpenRouter,
  VLM, and runtime packages passed; connector/model/security suites that resolve
  public domains failed because this runner maps them to the restricted
  `198.18.0.0/15` test range (plus a pre-existing Feishu summary-log assertion).
  This environment gate is why lifecycle task 6.1 remains unchecked.

## Deferred gate

The current TEST video fixture reached the terminal provider-classified HTTP
402 / `DOCREADER_PARSE_FAILED` state even though the root wallet and tenant
allowance were not exhausted. The supported Qwen fallback is configured and
catalog-advertised for video, but no successful current video parse/retrieval
is claimed. OpenRouter/Gemini task 4.3, zero-config task 4.2, reviewer fixture
task 5.4, and paid-video task 5.6 remain unchecked until an approved provider
route succeeds without adding services or purchasing credits.

Final exact-SHA CI, Cloudflare storefront, immutable GHCR server release, and
public revision/health checks remain release-gate work and are not claimed by
this local evidence.
