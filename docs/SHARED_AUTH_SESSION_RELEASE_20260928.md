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

The combined candidate must pass actual built-bundle navigation (list → documents → Wiki → graph), visible route-load failure feedback, exact-candidate CI, a new immutable staging acceptance and production promotion. This record does not authorize a generic release or assert real-phone acceptance.

## Knowledge navigation correction

Fresh production builds isolated the existing failure: the broad `id.includes('/dagre')` rule moved AntV layout modules into `vendor-mermaid`, creating a graph → Mermaid → graph static cycle. The unchanged browser fixture failed after clicking a knowledge card with `Cannot access 'qI' before initialization`, while all required scripts loaded. Removing only that broad match passed documents, Wiki content and an actually rendered graph. Explicit manual chunking remains enabled, so this correction retains the earlier deferred startup dependencies.

The router also now displays a localized refresh-and-retry message on navigation errors while preserving its previous console error output. A separate production-bundle test blocks the lazy detail script: the old build stays silently on the list, and the corrected build must show the message without changing the URL or automatically reloading. CI builds the real application before both browser checks; API fixtures are synthetic and external requests are blocked.

Both browser cases passed against the final production build. The positive route had zero console/page errors or missing resources; the negative case displayed the message and retained the list. All 1,294 frontend tests, type checking, the 15-case locale audit, workflow/source/provenance checks and a focused corrective review passed. Deployment verification remains required.

After release, verify the delivered auth bundle and synthetic browser handoff against the deployed revision. Real mainland Quark login must then be retested using the ordinary switch-to-mail-and-return interaction. Shared storage denied or cleared by the browser remains an explicit limitation; previous network startup latency is not proven solved by this storage change.
