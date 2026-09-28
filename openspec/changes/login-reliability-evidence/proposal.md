## Why

Real mobile sign-in attempts still sometimes return to the login form after successful OTP verification, and another successful sign-in spent over twenty seconds before application startup. Existing timing events cannot distinguish missing identity state from temporary identity-read failures or partition navigation, resource transfer, and application startup.

## What Changes

- Distinguish an absent identity session from an unavailable identity service; preserve continuation and offer an explicit retry for temporary failures.
- Preserve bounded rate-limit errors instead of reporting every OTP resend rejection as generic failure.
- Extend the existing private diagnostic endpoint with short-lived anonymous cross-document correlation, bounded stage reasons, navigation timings, and slow static-resource timings.
- Add structured OIDC start/callback outcomes without changing authentication validation or storing credentials in logs.
- Verify slow, interrupted, failed and recovered sign-in through real modules and browser navigation fixtures, then release the same tested images through staging and production.

## Capabilities

### New Capabilities

- `login-reliability-evidence`: recoverable identity failures and privacy-bounded end-to-end sign-in evidence.

### Modified Capabilities

None.

## Impact

Auth shell, shared client diagnostics, frontend startup, existing Go diagnostic/OIDC handlers, and release evidence. No database migration, new service, paid tooling, authentication-provider change, persistent identity-token storage change, or payment/model activity. A conditionally reproduced storage-continuity failure is not proof of a specific browser mechanism; new field evidence is required for that attribution.
