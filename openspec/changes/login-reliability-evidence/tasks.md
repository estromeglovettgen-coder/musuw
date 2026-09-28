## 1. Contracts and regressions

- [x] 1.1 Record real incident boundaries and conditionally reproduce storage-continuity failure without asserting browser-specific causation.
- [x] 1.2 Add failing runtime/UI tests for unavailable identity reads, explicit recovery, and OTP rate-limit presentation.
- [x] 1.3 Add failing privacy/correlation and startup-stage tests through existing diagnostic interfaces.

## 2. Implementation

- [x] 2.1 Preserve authorization across temporary identity-read failures and provide bounded explicit retry.
- [x] 2.2 Extend existing client and server diagnostics with short-lived correlation and strictly bounded reasons/timings.
- [x] 2.3 Record native OIDC outcomes and browser startup/resource stages without credential leakage or authentication behavior changes.

## 3. Verification and delivery

- [x] 3.1 Verify normal, interrupted, slow, unavailable and recovered login with real modules and browser navigation fixtures; test privacy rejection and backward compatibility.
- [x] 3.2 Run affected frontend/auth/backend tests, typechecks/builds, strict specification validation and one consolidated adversarial review.
- [ ] 3.3 Build in GitHub, verify exact staged images and live diagnostic consumption, record scoped release evidence and promote the same digests.
- [ ] 3.4 Verify production health, login UI, diagnostic acceptance/persistence and give the user a precise mobile recheck path; state the remaining real-browser evidence requirement honestly.
