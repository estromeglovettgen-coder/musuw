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
Each paid buyer/product SHALL have an independent recurring subscription. Monthly and yearly prices MUST belong to the verified product/environment; default annual base price SHALL be ten monthly base amounts for one year of service. Product purchases MUST NOT modify membership plan, storage, or model credits.

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

### Requirement: Reviewed free services
Published free products SHALL have zero month/year price and no Paddle catalog identifiers. Authenticated users SHALL use them without checkout, orders or subscription grants, through the same approved resource scope, native chat and buyer model billing. Reviewed products MUST NOT switch between free and paid.

#### Scenario: Free use without payment
- **WHEN** a logged-in user opens an approved published free service
- **THEN** they can use its native Flash chat without a payment flow and no billing records are created

#### Scenario: Free scope and publication controls
- **WHEN** a free service is unlisted, a source is unauthorized, or a caller injects another resource
- **THEN** new questions are rejected before model use; free pricing does not bypass resource authorization

#### Scenario: Free checkout refusal
- **WHEN** a caller submits a checkout request for a free service
- **THEN** the request is rejected without a Paddle transaction or local subscription

### Requirement: Subscription entry consolidation
Product details SHALL omit subscription-management buttons. The left sidebar SHALL omit its order-management shortcut; the market header SHALL retain the order entry. Orders SHALL retain the authenticated management entry; blocked existing subscriptions SHALL clearly direct the buyer to orders.

#### Scenario: Product and order management
- **WHEN** a buyer views an active or refunded provider-bound paid product
- **THEN** the product has no management button and the sidebar has no order shortcut, while the market header still links to orders and the order entry retains management with financial restrictions unchanged

### Requirement: Full Taylor staging delivery
Taylor staging delivery SHALL contain the complete inventoried production library and persona, including persisted document content, chunks, indexes and available Wiki/graph data, with isolated target ownership and compatible model references. Source production data and billing MUST remain unchanged.

#### Scenario: Verified full migration
- **WHEN** the bounded full-data copy completes
- **THEN** source/target manifests reconcile, native retrieval and necessary citations work, the existing paid product remains usable, and the page accurately describes the complete delivered content

### Requirement: Purchased libraries in the knowledge workspace
Buyers SHALL see previously purchased services in the knowledge workspace with read-only and current entitlement status. Each entry SHALL reference approved platform assets rather than duplicate them into the buyer tenant. Unpaid checkout intents MUST NOT grant a library. Expired or revoked purchases SHALL retain a locked entry while paid period-end cancellation SHALL preserve access until the paid term ends.

#### Scenario: Find and reuse a purchased library
- **WHEN** a buyer opens knowledge bases after a confirmed purchase
- **THEN** the service appears as a read-only subscribed entry and opens its approved published Wiki and graph, with native go-use available for authorized questions

#### Scenario: Expired library
- **WHEN** its subscription expires or current entitlement is revoked
- **THEN** the entry remains visible as locked, every new content read is denied, and historical conversation records remain intact

### Requirement: Scoped read-only Wiki and graph
Authorized buyers SHALL read published Wiki pages, folders, search results, links and graph for the exact approved KB set. Every read MUST revalidate current service entitlement and resource scope while retaining buyer identity. Reads SHALL NOT invoke models or change storage/billing. Unpublished pages, raw source documents/downloads, exports, revision history, credentials, creator details and agent prompts MUST remain inaccessible.

#### Scenario: Read and navigate without writes
- **WHEN** an active buyer browses Wiki, follows a published internal link, searches or opens graph nodes
- **THEN** native content is displayed within the approved KB scope, mutation/maintenance controls are absent, and no model usage is created

#### Scenario: Scope and mutation denial
- **WHEN** an anonymous, unentitled or expired caller requests content, or an entitled caller injects another KB/page, accesses unpublished material, downloads source files, or calls edit/delete/generation/fix/rollback/share operations
- **THEN** the backend rejects the request without disclosing private content, changing source assets or switching buyer billing identity

#### Scenario: Owned-library compatibility
- **WHEN** the buyer opens a knowledge base they own
- **THEN** the existing authorized editing and Wiki/graph behavior remain available, and the subscribed read-only mode does not affect it
