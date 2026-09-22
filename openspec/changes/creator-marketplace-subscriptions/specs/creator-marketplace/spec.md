## ADDED Requirements

### Requirement: Reviewed creator publication
Only effective Max users SHALL submit owned KB/agent references and private contact/authorization information. Only system administrators SHALL review and publish approved assets. Public catalog responses MUST omit private creator and execution configuration.

#### Scenario: Creator submission and review
- **WHEN** a Max user submits a valid draft and an administrator approves a platform-prepared service
- **THEN** the approved presentation appears in the catalog while the draft/contact/prompt remain private

#### Scenario: Unqualified and unauthorized writes
- **WHEN** a non-Max user submits or a non-system-admin attempts approval
- **THEN** the backend denies the operation without changing publication

### Requirement: Independent automatic subscriptions
Each buyer/product SHALL have an independent recurring subscription. Monthly and yearly prices MUST belong to the verified product/environment; default annual base price SHALL be ten monthly base amounts for one year of service. Product purchases MUST NOT modify membership plan, storage, or model credits.

#### Scenario: Coexisting products and membership
- **WHEN** a member buys two different products and cancels renewal for one
- **THEN** the other product and membership remain unchanged and the canceled renewal retains access until paid expiry

#### Scenario: Duplicate and invalid checkout
- **WHEN** checkout is repeated concurrently for a product or a client injects a foreign price
- **THEN** duplicate active subscriptions are prevented and unapproved prices are rejected

### Requirement: Honest payment synchronization and orders
The app SHALL show purchased subscriptions and transaction history in order management with actual amount/currency, period, status, renewal/cancellation and authenticated provider management links. Frontend payment success MUST NOT alone grant access.

#### Scenario: Delayed webhook
- **WHEN** the provider completes payment before the application receives confirmation
- **THEN** the app shows confirmation pending and offers state refresh without encouraging another charge

#### Scenario: Private orders
- **WHEN** a buyer supplies another buyer's subscription or transaction identifier
- **THEN** the app denies access and does not generate their portal session

### Requirement: Subscription lifecycle correctness
Event processing SHALL be idempotent and resistant to stale events. Paid expiry, cancellation, failed renewal, full/partial refund and dispute adjustments MUST target the corresponding product and paid transaction period. Refund alone MUST NOT be described as canceling future renewal.

#### Scenario: Duplicate renewal and old refund
- **WHEN** a renewal notification is replayed and a previous period is refunded
- **THEN** the transaction is recorded once and a later independently paid period is not incorrectly removed

#### Scenario: Lost event recovery
- **WHEN** a notification was missed but provider state is authoritative
- **THEN** reconciliation restores the correct subscription state without duplicate grant or payment

### Requirement: Paid native chat
Go-use SHALL open the native new-chat composer with approved agent and KB selected and DeepSeek Flash as default, without automatic query submission or draft replacement. Every QA request SHALL reauthorize product access and retain buyer session/model-billing ownership while limiting retrieval to approved resources.

#### Scenario: Use and continue
- **WHEN** a paid buyer opens a product and submits or continues a conversation
- **THEN** native retrieval uses that service and model usage/session records belong to the buyer

#### Scenario: Scope injection and expired access
- **WHEN** a caller injects another KB/agent, omits entitlement, or continues after expiry
- **THEN** execution fails honestly before model use and never silently answers as a generic model

### Requirement: Safe publication lifecycle
Draft changes and creator membership expiry MUST NOT destroy bought service data. Unpublishing SHALL stop new sales. Permanent service withdrawal SHALL account for future renewals and unfulfilled paid terms. Creator access MUST NOT expose buyer conversations.

#### Scenario: Draft deleted after purchase
- **WHEN** a creator changes or deletes a draft after platform publication
- **THEN** existing buyers retain the approved service within their paid terms

### Requirement: Staging acceptance
The release SHALL remain staging-only, with Taylor featured and several labeled fixture KB/agent products. Provider operations MUST use Paddle Sandbox. Acceptance SHALL include real sandbox checkout and backend synchronization, alongside normal/error/recovery and desktop/mobile UI verification.

#### Scenario: Sandbox release
- **WHEN** the reviewed feature SHA is deployed
- **THEN** staging uses the matching images/migrations/catalog and no production runtime or live billing configuration changes
