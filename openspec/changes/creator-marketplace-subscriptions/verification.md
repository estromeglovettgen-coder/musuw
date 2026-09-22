# Staging acceptance — 2026-09-22

Runtime release: `e92a2299585518456ae2c58b6848e493125a3fb4` at `https://staging.musuw.com`.
The follow-up acceptance-record commit changes documentation only.

- [CI 35689018547](https://github.com/estromeglovettgen-coder/musuw/actions/runs/35689018547): all 14 jobs passed.
- [Immutable release 35689834458](https://github.com/estromeglovettgen-coder/musuw/actions/runs/35689834458): staging succeeded; production skipped.
- App and frontend runtime revisions and image digests match the release manifest; both healthy. Database schema is 106 with dirty=false.

## Automated and adversarial verification

- 1,249 frontend tests and 19 marketplace browser scenarios passed; frontend type check and production build passed.
- Targeted marketplace backend tests passed, corrective incremental Go lint reported zero issues, and the behavior ledger checked 1,601 paths with zero blockers.
- PostgreSQL/SQLite migration checks and the consolidated adversarial review passed. Actual deployment confirmed the additive schema.
- Final native staging smoke passed role gates, 29 resource checks including nine paid-scope injection denials, private-source controls, and effective Max versus Free eligibility. No model calls were made by this final smoke.

## Actual Paddle Sandbox and native application checks

- Four initial purchases completed through browser checkout and native verified callbacks; annual charges equal ten monthly prices and cover twelve months.
- An initial declined payment recovered within the same checkout/invoice.
- A real recurring invoice completed and advanced only its original subscription.
- A real recurring authentication failure became past_due, then the same overdue invoice was paid through the customer portal and restored the same subscription.
- Period-end cancellation preserved paid access. An approved full current-period refund revoked only the refunded product. Official notification replay neither duplicated payment records nor restored access.
- Refunded but still-bound provider subscriptions display management without another purchase action. After the refunded subscription was actually canceled, a legitimate new checkout accepted a test-card attempt, displayed the bank decline, retained retry, and did not show a native initialization error or grant access.
- Final native records contain six settled payment records (including the refunded record). Three paid test services remain usable with future renewal canceled; the notes service is inaccessible, its old provider subscription canceled, and its new unpaid declined intent retained for retry testing. Membership stayed Free.

## Native chat and actual UI

- A real Taylor Flash answer on the preceding `8c6da969` release returned 1,133 characters and two authorized citations, using 2,310 tokens. Buyer provider usage increased by 2,000 micro-USD; the platform usage did not increase. Final `e92a2299` preserves that history and passed the follow-up permission checks without another model call.
- On final `e92a2299`, both historical inline citations and retrieval-timeline citations render authorized snippets without a raw-document detail link. Service and Flash selection restore from history.
- Go-use retains an unsent draft, selects the approved agent/knowledge scope and Flash, and never auto-sends.
- Actual Chrome checks covered desktop and 430×932 mobile. Status badges remain one line, product navigation starts below the mobile header, and the outer route has no extra scroll. Light/dark Musuw button colors and mobile selection notice were checked; the test browser was restored to normal viewport and light theme.
- Final admin UI shows four published services with correct monthly/yearly prices. Creator submission/rejection/resubmission, platform-copy approval, and unpublished access behavior passed through native endpoints.

## Scope and retained evidence

Only staging and Paddle Sandbox were changed. Taylor contains one clearly labeled authentic text sample, not the full historical library; three other services contain small self-written test documents. Purchases grant question-answer access and necessary citations, not ownership of source files or additional model credits.

Safe evidence is retained locally in `artifacts/creator-marketplace-20260922/`, including `acceptance-summary.json`, `root-browser-e92a2299-final.json`, `staging-access-e92a2299-final.json`, `staging-lifecycle-final-e92-decline.json`, and the exact CI/runtime/release manifests. Credentials, source bodies and full answer bodies are excluded. Provider-localized currency handling was traced in code; no claim is made that a real JPY checkout was captured.
