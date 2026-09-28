# Concurrent OIDC callbacks: evidence and release

## Observed failure and limits

After the shared-session release, a real login passed email-code verification and loaded a present identity session at consent. The same diagnostic journey then produced three overlapping native callbacks: one succeeded and two returned an OAuth `invalid_grant` error. Three separate edge request IDs and single origin upstream timings exclude a retry inside the origin Nginx for these requests. The authorization code and state were redacted in existing logs, so their byte equality is not retrospective evidence. Browser or edge duplication remains an inference, not an established implementation detail.

A real-handler regression reproduces the same success/error pattern with three identical validated callbacks and a single-use exchange boundary. Before the fix, all three attempt the exchange, two fail, and one succeeds. Production SDK/React authorization fixtures separately issue exactly one callback per document in both auto-approved and consent-required paths.

## Minimal correction

Use the existing singleflight dependency to merge only currently overlapping callbacks after every original state and browser-binding check. The key covers signed state, the verified PKCE verifier and authorization code. One bounded exchange supplies the unchanged native response to its waiting callers; an abandoned caller does not cancel the other callers. No completed result or token is cached, and a later replay still fails closed. The callback response is not cacheable.

A bounded SHA-256 callback digest is logged only after validation. It is anonymous correlation, never authorization; raw code, state, verifier and tokens remain excluded. This supports a future real-phone check of whether the overlapping callbacks are identical. Current deployment has one application instance; this change does not provide cross-instance deduplication.

## Validation and release

- The original handler failed the three-request regression with two errors and three exchanges. The correction passed the concurrency, binding/key isolation, leader cancellation and completed replay checks, including race detection. Handler, service and middleware suites passed; source/provenance checks and strict change-spec validation passed.
- Real staging reproduction against the previous immutable release passed ordinary password → provider authorization → native callback → `/auth/me`. Repeating one new callback concurrently with its original binding produced one successful native session and two login failures. The successful session belonged to the expected dedicated synthetic account. This used the actual identity provider and backend, with no callback stub; corrected staging acceptance is pending.
- Consolidated adversarial review found no current implementation blocker; independent focused race/privacy checks passed. Exact-candidate CI, immutable staging and production promotion are pending.
- Production real-phone acceptance remains required; no claim is made that this change eliminates all login or mainland-network failures.

No payment, model, real-user account changes, database migration, paid service or new dependency is part of this correction.
