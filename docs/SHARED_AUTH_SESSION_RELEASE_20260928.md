# Shared identity session: release evidence

## Scope and evidence boundary

A production email verification succeeded, but the following consent document reported an absent identity session and newly created tab correlation while same-origin cookie correlation remained. A real SDK/browser fixture reproduced this condition by losing tab storage after verification. This establishes a sufficient failure mechanism, not a claim about the browser's internal implementation or whether shared storage always survives.

The auth shell now uses one shared same-origin SDK identity session. It never imports old tab credentials. Short-lived PKCE and standard OIDC callback, state, nonce and client checks remain. Logout uses captured-bearer SDK revocation with immediate conditional local cleanup; password recovery is bound to its verified session and cannot overwrite a newly selected shared identity.

No database, native business logic, dependency, paid service or authentication protocol change. No real OTP, model or payment request was used in verification. Existing logged-in native sessions are unchanged; unfinished legacy identity-only flows may require one fresh login.

## Local verification

- Auth unit/integration: 123 tests passed, including real SDK with mocked provider transport.
- Browser: 30 tests passed across Chromium, WebKit and Firefox, including mobile 430 × 932 continuity cases and existing background stability cases.
- Failing reproductions were observed before correction for tab-state loss, unbound recovery, and late logout deleting a newer login. Corresponding corrections passed.
- Auth typecheck and production build passed with public synthetic configuration. Existing external runtime assets and bundle-size warnings remain.
- Fixed-target provenance contract, source manifest, tracked-source scan and strict change-spec validation passed.
- Consolidated auth adversarial review identified a late-logout race; its corrective delta was reviewed and independently rerun (69 SDK/runtime tests). No remaining known auth blocker at that review.

## Release status

Auth candidate `31ee85cc9294212b7810f6c8363bb849593ebdf5` passed all 14 CI jobs (run `36475724503`) and immutable staging deployment `36477354465`. Four acceptance cases using delivered auth assets passed on Chromium and WebKit: shared identity survives tab-state loss, and missing shared identity returns to login without authorization. Provider and business transport was synthetic; no real OTP or model was used.

Production promotion was held after a newly reported knowledge-card navigation failure. An existing manual chunk condition matches both Mermaid Dagre dependencies and AntV graph layout modules. Together with explicit manual chunks, it produces a static graph/Mermaid cycle and initialization failure. The current production baseline `43fe545b1b222e034f66a36b4d63f02d8b5afe41` also contains this regression; returning to it would not repair knowledge navigation.

The combined promotion required actual built-bundle navigation (list → documents → Wiki → graph), visible route-load failure feedback, exact-candidate CI and a new immutable staging acceptance. Completed release evidence follows below. This record does not authorize a generic release or assert real-phone acceptance.

## Knowledge navigation correction

Fresh production builds isolated the existing failure: the broad `id.includes('/dagre')` rule moved AntV layout modules into `vendor-mermaid`, creating a graph → Mermaid → graph static cycle. The unchanged browser fixture failed after clicking a knowledge card with `Cannot access 'qI' before initialization`, while all required scripts loaded. Removing only that broad match passed documents, Wiki content and an actually rendered graph. Explicit manual chunking remains enabled, so this correction retains the earlier deferred startup dependencies.

The router also now displays a localized refresh-and-retry message on navigation errors while preserving its previous console error output. A separate production-bundle test blocks the lazy detail script: the old build stays silently on the list, and the corrected build must show the message without changing the URL or automatically reloading. CI builds the real application before both browser checks; API fixtures are synthetic and external requests are blocked.

Both browser cases passed against the final production build. The positive route had zero console/page errors or missing resources; the negative case displayed the message and retained the list. All 1,294 frontend tests, type checking, the 15-case locale audit, workflow/source/provenance checks and a focused corrective review passed. Deployment verification is recorded below.

## Reviewed combined staging release

- Candidate: `7d18cc0d321718985200dd67ab0525127253e18e`, merged through PR #111; all 14 CI jobs passed in run `36479544804`.
- Immutable staging deployment: `36481536038`, successful. Container revision, digest and healthy status matched the release manifest.
- App image digest: `sha256:0ce70025e490b77b62fa924feb23a7ef51f8adb60490fbaca9028e3caa594208`.
- Frontend image digest: `sha256:d94f7e1c67f58aca49d96fa002982b1b2b6e9ba86600db910f411b144968f841`.
- Delivered-asset acceptance: all seven cases passed. Four auth cases cover continuity and missing shared identity in Chromium/WebKit at 430 × 932; three knowledge navigation cases cover those mobile engines and desktop Chromium at 1440 × 1000, with documents, Wiki and rendered graph. HTML, scripts, styles and the graph worker are the actual deployed files; business/provider/diagnostic transport is synthetic or blocked.
- No page or route errors remained. The private acceptance harness required awaiting cancelled decorative-asset handling and allowing the existing static graph worker; application code was unchanged during staging acceptance.
- Production baseline was freshly verified as `43fe545b1b222e034f66a36b4d63f02d8b5afe41`, both containers healthy. Its known graph defect remains a rollback limitation.

The reviewed release guard authorizes only this candidate, baseline and staging-run tuple. Existing CI, ancestry, image digest, capacity and protected production-review gates remain. This is targeted auth/navigation acceptance, not full payment-lifecycle acceptance.

## Production result

Production run `36482773545` successfully promoted the same images at `2026-09-28T20:59:03Z`. The manifest, running app/frontend containers and current release pointer all identify candidate `7d18cc0d321718985200dd67ab0525127253e18e`; both containers are healthy. The separate evidence/guard commit does not change the tested application candidate.

All seven delivered-asset cases passed again on production, including bounded completion of browser teardown. Production auth scripts/styles and 115 app script/style resources matched their accepted staging hashes. Provider and business responses remained synthetic: these cases verify the delivered application behavior without using real accounts or consuming model, payment or OTP services.

Four additional browser checks exercised ordinary login entry and recovery from a simulated unavailable native-session check on Chromium/WebKit. Their bounded anonymous diagnostic payloads reached the real production endpoint with HTTP 204. All 28 corresponding records were independently found in the persistent application log volume, including document and resource timings. Private correlation IDs and traces are not published.

Real mainland mobile Quark acceptance remains with the user: start a fresh login, switch to the mail app, return to the original browser tab and enter the code. Automated browser engines are not a physical Quark device. Shared storage denied or cleared by that browser and wider mainland network latency remain explicit limits; this release does not establish that all network stalls are eliminated.

After release, verify the delivered auth bundle and synthetic browser handoff against the deployed revision. Real mainland Quark login must then be retested using the ordinary switch-to-mail-and-return interaction. Shared storage denied or cleared by the browser remains an explicit limitation; previous network startup latency is not proven solved by this storage change.
