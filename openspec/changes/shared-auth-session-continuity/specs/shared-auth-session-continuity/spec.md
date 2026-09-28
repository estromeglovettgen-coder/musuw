## ADDED Requirements

### Requirement: Identical concurrent callbacks share one exchange
The native callback SHALL preserve signed-state, browser-binding and PKCE verification for every request and SHALL exchange identical overlapping authorization attempts only once per application instance.

#### Scenario: Duplicate requests arrive during exchange
- **WHEN** concurrently arriving callbacks pass all existing checks with identical signed state, verified PKCE verifier and authorization code
- **THEN** they SHALL share the existing exchange result and successful requests SHALL receive the same native session instead of a duplicate-code error.

#### Scenario: Initiating request is abandoned
- **WHEN** one callback disconnects while a valid identical callback is still waiting
- **THEN** its cancellation SHALL NOT abort the shared exchange; the operation SHALL retain a finite deadline.

#### Scenario: Validation differs or a completed attempt is replayed
- **WHEN** a callback lacks a valid binding, has different exchange material, or arrives after the shared exchange has completed
- **THEN** it SHALL NOT obtain a cached successful result or bypass the existing checks.

### Requirement: Identity continuity across documents
The auth shell SHALL use one shared same-origin SDK identity session while retaining standard OAuth validation and short-lived PKCE state.

#### Scenario: Tab state disappears after verification
- **WHEN** email verification succeeds and tab storage is lost before consent while shared storage survives
- **THEN** consent SHALL continue to the trusted native callback without requesting another code.

#### Scenario: Shared identity is missing or inaccessible
- **WHEN** the shared session is absent or its storage cannot be read
- **THEN** the shell SHALL distinguish login required from recoverable storage failure, and SHALL NOT restore old tab credentials or bypass authorization.

### Requirement: Shared logout is final locally
Logout SHALL attempt provider revocation with the current session and SHALL clean only relevant identity keys even when the provider fails or exceeds the request deadline.

#### Scenario: Provider logout fails
- **WHEN** revocation fails or times out
- **THEN** both shared and legacy tab identity sessions SHALL be removed, unrelated storage SHALL remain, and old tab tokens SHALL NOT restore login.

### Requirement: Recovery remains bound to the verified session
A password reset SHALL require an unexpired recovery marker bound to the exchanged identity session and SHALL never modify an account selected by a later cross-tab switch.

#### Scenario: Account changes before reset submission
- **WHEN** another tab changes the shared session after recovery verification
- **THEN** the old recovery page SHALL refuse to update a password.

#### Scenario: Account changes while reset is in flight
- **WHEN** the shared account changes during a password update
- **THEN** the outbound mutation SHALL retain the original verified target and SHALL NOT overwrite or revive shared credentials on completion.

#### Scenario: Recovery refresh remains valid
- **WHEN** the recovery page reloads with the same session and an unexpired marker
- **THEN** the user SHALL be able to finish that reset; a missing or expired marker SHALL fail closed.
