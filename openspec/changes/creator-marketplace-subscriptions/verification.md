# Staging acceptance — 2026-09-22

## Initial marketplace release

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

## Follow-up: complete Taylor, free examples and order navigation

The follow-up supersedes the initial one-document Taylor fixture. It retains the existing Taylor product, subscriptions and Sandbox price bindings, removes product-detail subscription-management actions, and removes the left-sidebar Orders shortcut. The market header still links to Orders, where subscription management remains available.

The complete copy contains 452 enabled documents and original files, 1,745 enabled chunks and existing vectors, 2,318 published Wiki pages, 550 active Wiki folders, 2,153 Wiki revisions, and a graph of 6,851 nodes and 4,610 directed relationships. The 3,711-character persona matches the source, target agent and reviewed product snapshot. Native Flash remains the default.

All copied database rows were reconciled against the transformed source snapshot. Original files were checked byte-for-byte in the independent staging bucket; graph properties and topology were hashed and compared. The copy reused the existing 4,096-dimensional vectors without model reprocessing. Fifty deleted source documents remain deleted; the old staging sample remains readable for historical citations but is disabled for new retrieval. Native tenant storage accounting reconciles exactly.

The importer retained private source and target backups and passed an explicit rollback preflight before the final transaction. Its first oversized vector statement exhausted the existing staging PostgreSQL memory limit without committing; bounded statement batches then passed within the unchanged limit. One staging DocReader restart released swapped memory afterward. The unchanged capacity guard passed, and production container health and startup times remained unchanged.

Free services reuse publication review and native QA. They require login and buyer model credits, have zero monthly/yearly price and no Paddle binding, and create no checkout, payment, order or subscription. Approved free/paid pricing mode cannot be changed in place. Max-only creator submission and paid annual pricing at ten monthly payments are unchanged.

Pre-deployment verification passed 1,250 frontend tests, 27 marketplace browser cases, frontend types/build/locales, targeted backend authorization and lifecycle tests, lint, and real PostgreSQL/SQLite migrations. SQLite checks include foreign keys and a separately cached connection; downgrade refuses to discard free products. The consolidated review and corrective-delta review found no remaining blocker. [CI 35732747269](https://github.com/estromeglovettgen-coder/musuw/actions/runs/35732747269) passed all 14 jobs for `8bda043b8befad5e07ca2d789e4555d747abfe39`.

[Immutable release 35733894496](https://github.com/estromeglovettgen-coder/musuw/actions/runs/35733894496), attempt 2, deployed `8bda043b` successfully. Actual app/frontend digests match the official manifest, both services are healthy, and schema is `107|f`. Native Neo4j has an established application connection and the complete copied graph. Production revision, health and startup times are unchanged. Attempt 1 was canceled after an unexplained silent pre-deployment wait; no remote prepare or deployment occurred. The same static check passed locally in 12.67 seconds, and rerunning only the deployment job succeeded without changing code or rebuilding images. No specific cause is claimed for that first wait.

Three zero-price services were published through normal submission and platform review: meeting notes, reading review and problem framing. Actual anonymous, free-checkout, private-source and foreign-KB denials passed; unpublishing a free service denied new QA and republishing restored it. No model usage resulted from these permission checks.

Exactly four native Flash questions completed: one per free service and one against complete Taylor. Each free response cites its own document; Taylor cites four enabled copied source documents, excluding the disabled old sample. Historical Taylor citations remain readable. Buyer membership and the six subscription/six payment records remain unchanged; only buyer model usage increased, while platform usage remained unchanged. A transient read-only entitlement timeout after the first completed answer was recovered without resending the question. Provider metering is asynchronous, so the final aggregate is recorded separately from immediate per-question observations.

Actual Chrome verification confirms desktop expanded/collapsed and mobile sidebars omit Orders, the market header retains Orders, a hard refresh preserves the Orders route, order subscription controls remain available, and product details omit those controls. At 430×932, Orders and free details have no horizontal overflow. Free detail has no checkout, renewal or expiry controls.

Browser acceptance also exposed a cold-composer race: restoring a previously selected Taylor service could override the newly selected free service. A deterministic browser regression reproduced it. Explicit entry now suppresses old-service restoration and sending until selection completes; failed or denied entry returns to that product's detail page, and late failures cannot redirect a subsequent selection. Draft handling is preserved. The corrective delta passed 31 marketplace browser cases, 25 targeted unit checks, six source-contract checks, frontend types/build, the 1,601-path behavior ledger and independent delta review. The final runtime recheck passed without another model call. Production application and Paddle Live are unchanged.

## Final follow-up release and browser acceptance

[CI 35739796605](https://github.com/estromeglovettgen-coder/musuw/actions/runs/35739796605) passed all 14 jobs for `331c157f3f789464e4f0239cac1d5ec5e3f94f52`. [Immutable staging release 35741408107](https://github.com/estromeglovettgen-coder/musuw/actions/runs/35741408107) succeeded on its first attempt; production was skipped. The active release path, both runtime image digests and revisions match the official manifest, both services are healthy, schema remains `107|f`, and the unchanged capacity guard passes. The copied graph survived deployment with 6,851 nodes, 4,610 relationships and a working native application connection. Production health, revisions and startup times match the pre-release baseline.

Actual Chrome reproduced the original cold-entry setup on this release: with Taylor saved as the old selection, a hard navigation to the free reading service followed by its first Start action selected the correct free agent/knowledge base and Flash immediately. No second click or question was needed. The completed full-Taylor answer remains visible with four document references and restores Taylor/Flash. Desktop expanded/collapsed and mobile drawer navigation omit Orders; the market header still opens Orders, with four existing subscription-management controls. The Taylor detail omits subscription management. All three free examples remain visible. At 430×932 the Orders document width is 430 pixels, and the viewport was reset afterward.

The four actual QA calls were made on `8bda043b`; final `331c157f` changes only the frontend selection correction, its tests/behavior ledger and documentation. Backend, migrations and deployment infrastructure are unchanged between these releases. Final aggregate provider usage is 11,656 micro-USD for the buyer and zero additional platform usage. No model calls were repeated for final browser verification.

Safe evidence: `staging-release-331c157f.json`, `staging-runtime-proof-331c157f.txt`, `final-ci-331c157f.json`, `root-browser-331c157f-final.json`, and `staging-full-free-acceptance-8bda043b.json` under the local acceptance artifact directory. The follow-up documentation commit does not change the deployed revision.
