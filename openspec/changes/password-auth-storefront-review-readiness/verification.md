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
  The authoritative exact-SHA CI run passed the complete configured matrix;
  this local network gate is retained as a reproducibility note, not a release
  failure.

## 2026-08-23 consumer capability smoke

- Using the canonical TEST reviewer native OIDC session and the real consumer
  endpoints, Flash and Pro each returned a bounded non-empty English SSE
  answer with HTTP 200 and a completed stream.
- A high-reasoning request returned HTTP 200 with `thinking`, retrieval-tool,
  answer, and completion events. A KB-scoped retrieval request returned three
  evidence chunks and a non-empty answer through the supported consumer tool
  path.
- The temporary English knowledge base and all four smoke sessions were removed
  through the product API after the checks. The reviewer account and active
  Paddle Sandbox Max entitlement were retained.

## Release and public smoke baseline

- Exact source release SHA:
  `42395dbf9df923bc75d841d694531102d7adc06c`.
- Exact-SHA CI: `32625412806`; Cloudflare storefront: `32625936901`;
  immutable-GHCR server: `32625936888`. Each workflow reached terminal
  success, and the public `/health` revision matched the release.
- Public English smoke returned 200 for the storefront root/contact and the
  app auth/platform/plans entry routes. The four active product image URLs
  returned 200 `image/jpeg` at 3024x1898 source scale; metadata probes found
  OG, Twitter, icon, and manifest references with no Musnow text.
- This evidence-sync revision is itself sent through the same release path
  after commit; its exact SHA and workflow run IDs are recorded by the release
  monitor rather than guessed in advance.

## Deferred gate

The current TEST video fixture reached the terminal provider-classified HTTP
402 / `DOCREADER_PARSE_FAILED` state even though the root wallet and tenant
allowance were not exhausted. The supported Qwen fallback is configured and
catalog-advertised for video, but no successful current video parse/retrieval
is claimed. OpenRouter/Gemini task 4.3, reviewer fixture task 5.4, and
paid-video task 5.6 remain unchecked until an approved provider route succeeds
without adding services or purchasing credits. The zero-config consumer model,
reasoning, and retrieval checks are complete and recorded in its dedicated
verification file.

The next exact-SHA CI, Cloudflare storefront, immutable GHCR server release,
and public revision/health checks are the gate for the evidence-sync commit;
the preceding release evidence above is complete and non-sensitive.

## Final video gate (2026-08-23)

- Qwen original-fixture and tiny-video provider smokes both classified as HTTP
  402 while the observed wallet and tenant allowance were non-exhausted.
- Approved Gemini direct-route probes classified as HTTP 403 with temporary
  provider-management credentials; this did not establish a canonical app
  failure or success.
- One canonical TEST Max upload using the supported per-upload
  `builtin-openrouter-gemini-flash` override returned HTTP 200, then moved
  from `processing` to normalized `provider_error` failure at roughly two
  minutes. No video retrieval or citation success is claimed.
- The documented Japan transport was unavailable. No recharge, new service,
  DNS/server change, fake event, or manual entitlement mutation was used, and
  all temporary video fixtures and conversations were cleaned up.

Reviewer tasks 5.4 and 5.6 and video task 4.3 remain unchecked pending a
successful approved provider route.

## 2026-08-23 Contact layout revision

- The live ClientHub reference was inspected at 3024x1898, 1291x782,
  1080x900, 767x1000, and 430x932. The implementation retains the Musuw
  header and uses the reference's centered max-width, two-column desktop
  composition, double-layer form shell, visible field labels, and single-column
  mobile breakpoint without copying reference branding or proprietary code.
- The rendered English Contact page now exposes a Contact Us pill, a Musuw
  product-specific headline, two grounded support reasons, and a keyboard-safe
  First name / Last name / Email / Message form. The form performs native
  required and email validation and opens an honest mail draft; it does not
  claim that Musuw sent a message. Operator, support, billing, privacy,
  security, and merchant-review details remain available in a lower-weight
  legal strip below the hero.
- No contact submission endpoint exists in the storefront contract, so no
  endpoint, database, mail provider, dependency, or fabricated delivery state
  was added. Real-render checks found no horizontal overflow, Chinese text, or
  obsolete route-card composition at the required viewports. Storefront
  `npm test` passed 52 tests and `npm run build` passed.
