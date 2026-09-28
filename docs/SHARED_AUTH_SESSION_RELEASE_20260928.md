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
- Consolidated adversarial review identified a late-logout race; its corrective delta was reviewed and independently rerun (69 SDK/runtime tests). No remaining known current blocker.

## Release status

Exact-candidate CI, staging deployment and production promotion are pending. This record does not authorize a generic release or assert real-phone acceptance. Current production/rollback baseline is `43fe545b1b222e034f66a36b4d63f02d8b5afe41`.

After release, verify the delivered auth bundle and synthetic browser handoff against the deployed revision. Real mainland Quark login must then be retested using the ordinary switch-to-mail-and-return interaction. Shared storage denied or cleared by the browser remains an explicit limitation; previous network startup latency is not proven solved by this storage change.
