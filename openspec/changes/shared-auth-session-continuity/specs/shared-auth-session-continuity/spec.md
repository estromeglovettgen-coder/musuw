## ADDED Requirements

### Requirement: Identical concurrent callbacks share one exchange
The native callback SHALL preserve signed-state, browser-binding and PKCE verification for every request and SHALL exchange identical overlapping authorization attempts only once per application instance.

#### Scenario: Duplicate requests arrive during exchange
- **WHEN** concurrently arriving callbacks pass all existing checks with identical signed state, verified PKCE verifier and authorization code
- **THEN** they SHALL share the existing exchange result and successful requests SHALL receive the same native session instead of a duplicate-code error.

#### Scenario: Initiating request is abandoned
- **WHEN** one callback disconnects while a valid identical callback is still waiting
- **THEN** its cancellation SHALL NOT abort the shared exchange; the operation SHALL retain a finite deadline.

#### Scenario: Identical requests arrive just after successful completion
- **WHEN** an identical callback passes every original check within ten seconds of a successful exchange while its bounded successful result remains retained
- **THEN** it SHALL receive exactly the same encoded native session without another provider exchange, session creation or token lifetime extension.
- **AND** successful encoded results SHALL be retained only in this process for ten seconds, at most 128 entries and 64 KiB per entry; expiry SHALL release retained payload references without requiring another request.
- **AND** oversized responses SHALL complete normally without retention; capacity eviction SHALL NOT bypass provider single-use validation on a later replay.

#### Scenario: Validation differs, success expires, or an exchange fails
- **WHEN** a callback lacks a valid binding, has different exchange material, or arrives after the ten-second success window
- **THEN** it SHALL NOT obtain the earlier successful result or bypass the existing checks.
- **AND** unsuccessful exchanges SHALL NOT be retained as completed results.

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

### Requirement: Verified identity can retry a failed workspace handoff
The auth shell SHALL preserve the distinction between failed identity verification and a temporary failure to continue an already verified identity into the workspace.

#### Scenario: Workspace authorization fails after successful verification
- **WHEN** password or email-code verification succeeds but the native OIDC start request fails
- **THEN** the shell SHALL show an explicit continuation retry and reuse the existing verified session through the normal authorization flow, without resending or reverifying the consumed code or asking for the password again.
- **AND** a prior login-required result SHALL NOT prevent a fresh session check after verification.

#### Scenario: Another tab left an older native account session
- **WHEN** the current tab verifies a new identity, its handoff fails, and another account's native session remains in shared storage
- **THEN** verified-identity retry SHALL recheck the current SDK identity and continue its normal authorization; it SHALL NOT use the older native session as a shortcut into the workspace.
- **AND** a missing identity SHALL require login, while an unavailable identity check SHALL remain recoverable without granting access.

#### Scenario: Verification itself fails
- **WHEN** a code or password is rejected before identity verification succeeds
- **THEN** the existing credential error and correction form SHALL remain; the shell SHALL NOT treat this as a verified continuation.

#### Scenario: Authorization service has a temporary failure
- **WHEN** the verified session's authorization-details or approval request encounters a network failure, timeout or temporary server failure
- **THEN** the existing same-page retry SHALL retain the valid continuation and retry authorization without asking for credentials again.
- **AND** a definite expired/invalid authorization or a failed client/redirect/state validation SHALL remain rejected.

### Requirement: Automatic authorization hops do not remain in browser history
The auth shell SHALL replace automatic one-time authorization transitions while preserving user-initiated external sign-in navigation.

#### Scenario: Back after a completed sign-in
- **WHEN** the user enters sign-in from a normal source page, completes authorization and then goes back
- **THEN** the browser SHALL return to the source page instead of replaying a consumed consent request or showing a stale login failure.

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
