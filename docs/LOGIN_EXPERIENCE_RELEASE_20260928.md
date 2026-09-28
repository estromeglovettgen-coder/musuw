# Login experience: browser evidence and minimal correction

## Delivered baseline

Production and staging were both verified on application revision `cce10cdce69731a9b2142e9176a3dcaffafab948`. Anonymous production Chromium at 430 × 932 showed the credential form in 890 ms, with first content at 396 ms. With explicitly simulated 250 ms latency, 200 kB/s download and 4× CPU slowdown, the form was visible in 2649 ms and initial content at 800 ms. Neither run had horizontal overflow or page script errors. These are one-run browser measurements on the operator's network/proxy, not a mainland China benchmark or percentile guarantee.

Dedicated-account staging browser measurements used the real provider, native callback, app identity and knowledge-base list, while explicitly isolating ancillary business data and payments. Password submit to knowledge-base visibility took 3771 ms in Chromium and 4614 ms in WebKit; immediate pending feedback appeared in 46/83 ms. Authenticated refresh took 1476/1544 ms. No real-user credentials, email delivery, model or payment operations were used.

## Reproduced defects

1. After a successful identity exchange, a single failed native OIDC-start request restored a credential form. In real-provider staging, refreshing could continue from the retained identity without another password exchange. In controlled browser tests using the real AuthApp, runtime and SDK, OTP verification succeeded, the native start returned 503, and the UI offered the same verification button. A second click submitted the already consumed OTP and produced an invalid-code error. The error was in the continuation UI, not the first verification.
2. Browser Back after login reopened the consumed provider authorization. Both engines made a new authorization-details request that returned 404, then showed a credential error despite retaining the native session. Automatic authorization transitions used history-pushing navigation.
3. A controlled real-SDK browser test returned a single 503 from authorization details while a valid shared identity existed. The UI restored a password form; refreshing the same page could complete authorization. A temporary provider error must be distinguished from a definite invalid authorization so the existing retry can recover without clearing valid continuation state.
4. Consolidated adversarial review caught a regression in the first retry implementation before release: one tab retained account A's native session while another verified account B and encountered the handoff failure. Reusing the ordinary native-first startup path silently entered A on retry. The verified-identity retry must recheck the current SDK identity and continue its normal authorization rather than use a previous native account; the ordinary startup fast path remains unchanged.

## Scope and acceptance

Reuse the existing verified session and retry screen only for a known post-verification handoff failure or transient authorization-service failure. Distinguish permanent authorization errors from transient transport/server failures. Do not retry credentials automatically, relax callback validation or add a new identity/session mechanism. Replace automatic one-time authorization hops in browser history; keep intentional Google navigation distinct. Successful ordinary login must gain no extra wait or network round trip. Validate normal login, invalid credentials, the single-failure recovery, and Back through the actual UI before release.

The implementation reuses the existing identity continuation and retry UI. A verified-identity retry explicitly rechecks the SDK session, bypassing the older native-account fast path. Missing identity returns to sign-in; temporarily unavailable identity remains retryable. Automatic authorization navigation replaces its history entry; the user's deliberate Google departure retains normal navigation.

Local auth unit tests (153), typecheck and the build with non-secret CI configuration passed. Chromium, WebKit and Firefox passed 66 browser cases: 57 continuation cases and nine document-history cases. An initial WebKit history fixture used its restricted port 4190; switching only the fully intercepted test origin resolved the fixture failure. Consolidated adversarial review and its corrective delta passed: independent two-tab tests with the new identity present, missing and unavailable never reused the old native account or resubmitted the password.

Immutable staging acceptance and production promotion are pending. Physical Quark, external mail-app suspension and actual mainland network conditions remain separate acceptance limits.
