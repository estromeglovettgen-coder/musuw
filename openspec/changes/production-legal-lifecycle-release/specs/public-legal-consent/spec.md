## ADDED Requirements

### Requirement: Auth entry exposes affirmative legal acknowledgement
The logged-out auth shell SHALL display direct links to the canonical public
Terms of Service and Privacy Policy in the active locale. Google and email-code
initiation MUST remain unavailable until a native, unchecked acknowledgement
is selected, and the acknowledgement MUST distinguish agreement to the Terms
from acknowledgement of the Privacy Policy.

#### Scenario: User has not acknowledged the documents
- **WHEN** a logged-out user opens the sign-in form and has not selected the acknowledgement
- **THEN** the Google and email-code initiation actions are disabled while both legal documents remain directly accessible

#### Scenario: User acknowledges the documents
- **WHEN** the user explicitly selects the acknowledgement
- **THEN** the existing Google and email-code initiation actions become available without adding a new identity or consent service

#### Scenario: User is entering a received email code
- **WHEN** an email code has already been requested
- **THEN** code verification remains available and the legal links remain visible

### Requirement: Public policies match the live service
The bilingual public legal suite MUST identify the Musuw operator and contact,
describe actual data categories, purposes, retention determination, rights and
account-deletion channels, cross-border processing, and name the live external
provider roles. It MUST NOT identify an unavailable provider as active, claim
an unimplemented control, expose a secret, or replace mandatory consumer
rights with Musuw's voluntary terms.

#### Scenario: Visitor reads the Privacy Policy before authentication
- **WHEN** a visitor opens the canonical Privacy Policy from the auth shell
- **THEN** the page is public, responsive, bilingual, names the live identity, edge/storage, AI, and payment provider roles, and explains how to exercise privacy and deletion rights

#### Scenario: Visitor reads purchase terms
- **WHEN** a visitor opens the Terms, Refund, or Subscription document
- **THEN** the page distinguishes Musuw product terms from Paddle's Merchant-of-Record terms, explains renewal and cancellation, and preserves both mandatory rights and any additional Musuw promise
