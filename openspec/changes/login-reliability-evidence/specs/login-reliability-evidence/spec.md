## ADDED Requirements

### Requirement: Temporary identity-read failures preserve authorization

The auth shell SHALL distinguish an absent identity session from an unavailable identity read. It MUST preserve pending continuation on temporary failure and offer an explicit retry without automatically sending another OTP or weakening authorization validation.

#### Scenario: Temporary failure followed by recovery
- **WHEN** a consent identity read fails or times out and a later explicit retry succeeds
- **THEN** the page first presents a recoverable failure, then completes the same authorization instead of requiring another OTP

#### Scenario: Session genuinely absent
- **WHEN** an identity read successfully establishes that no session exists
- **THEN** the login form is shown and the pending authorization is retained

#### Scenario: Completed operation is replayed
- **WHEN** a completed callback or authorization operation is invoked again by the UI lifecycle
- **THEN** the successful one-time operation is not consumed again

### Requirement: OTP rate limits are presented truthfully

The auth shell MUST distinguish provider rate limits from generic send failures and SHALL retain its bounded resend cooldown without automatically retrying a send.

#### Scenario: Provider rejects a repeated send
- **WHEN** the provider reports a rate-limit result
- **THEN** the UI explains that sending is too frequent and does not represent the result as an invalid password or disabled account

### Requirement: Login evidence survives document transitions without credentials

The existing diagnostics endpoint SHALL support expiring anonymous journey correlation, per-document and per-tab identifiers, fixed stage reasons, and validated browser hints. Diagnostics MUST have no authentication authority and MUST NOT record credentials, user content, emails, arbitrary URLs or raw error strings.

#### Scenario: New document with missing tab storage
- **WHEN** a same-origin document cannot restore the previous tab correlation but the short-lived journey cookie remains
- **THEN** its evidence retains the journey identifier and distinguishes the new document/tab state from a restored or expired one

#### Scenario: Diagnostic storage or network unavailable
- **WHEN** cookies, storage, performance APIs or diagnostic transport fail
- **THEN** authentication continues with its ordinary behavior and diagnostic failure does not trigger a login redirect

#### Scenario: Untrusted diagnostic payload
- **WHEN** a request contains unknown fields, arbitrary strings, invalid identifiers, over-limit resource names or out-of-range timings
- **THEN** the endpoint rejects it without retaining the supplied content

### Requirement: Startup evidence separates stages

The browser SHALL report navigation response timings, module entry, application route/mount timing and a bounded set of slow same-origin build-resource timings. The server SHALL report bounded OIDC start/callback outcomes. Neither system SHALL equate a fast backend callback with completed browser login.

#### Scenario: Slow static resource
- **WHEN** an initial build resource is intentionally delayed and login otherwise succeeds
- **THEN** collected evidence identifies its bounded resource name and separates its response/transfer timing from application startup and backend processing

#### Scenario: Invalid callback
- **WHEN** native callback validation fails
- **THEN** the structured event records the bounded failure category without exposing the state, code, nonce, binding or payload

#### Scenario: Mixed release payloads
- **WHEN** an older client sends the existing diagnostic payload to the new server
- **THEN** the server continues accepting that payload under the original limits
