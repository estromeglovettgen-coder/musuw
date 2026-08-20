## ADDED Requirements

### Requirement: Four tenant-scoped consumer plans
The system SHALL assign each consumer tenant exactly one active plan and SHALL use the following limits: Free = 5 GiB storage and USD 1.00 monthly OpenRouter credit; Plus = 20 GiB and USD 1.25; Pro = 40 GiB and USD 2.50; Max = 80 GiB and USD 5.00. New and existing tenants without an explicit paid entitlement SHALL be Free.

#### Scenario: New consumer signs in
- **WHEN** a Google user receives a new home tenant
- **THEN** the tenant has the Free plan, 5 GiB storage, and USD 1.00 of OpenRouter credit for the personal month anchored to that tenant's registration time

#### Scenario: Paid plan is synchronized
- **WHEN** a verified billing event activates Plus, Pro, or Max for a tenant
- **THEN** the tenant's effective storage and monthly OpenRouter credit limits match that plan

### Requirement: Free content limits are enforced server-side
The system SHALL limit Free tenants to one knowledge base, ten documents in that knowledge base, and no video upload. Paid tenants SHALL not receive those three Free-only limits, while all tenants remain subject to storage and file-type support.

#### Scenario: Free tenant reaches its knowledge-base limit
- **WHEN** a Free tenant that already owns one knowledge base requests another
- **THEN** the server rejects the request with an actionable plan-limit response and creates nothing

#### Scenario: Free tenant reaches its document limit
- **WHEN** a Free tenant whose knowledge base already contains ten documents requests another upload
- **THEN** the server rejects the upload before storing or parsing it

#### Scenario: Free tenant attempts video upload
- **WHEN** a Free tenant submits a supported video type now or in a later release
- **THEN** the server rejects it before storage or parsing

### Requirement: Model access follows the active plan
The system SHALL expose and accept only platform-built-in OpenRouter models from the server-owned catalog. Free tenants SHALL receive only the least-cost configured model for each required capability; paid tenants SHALL receive the larger plan-approved platform catalog. Consumer tenants SHALL NOT create, edit, test, credential, or invoke arbitrary models, including BYOK and manually inserted models. Server-side model resolution SHALL reject a disallowed model ID even when the caller bypasses the UI. Built-in DeepSeek chat models SHALL use OpenRouter rather than the DeepSeek direct API.

#### Scenario: Free tenant lists chat models
- **WHEN** a Free tenant requests available chat models
- **THEN** only the configured least-cost chat model is returned

#### Scenario: Free tenant submits a paid model ID
- **WHEN** a Free tenant directly requests a model that is not its allowed model for that capability
- **THEN** the server rejects the request without calling the provider

#### Scenario: Paid tenant selects a model
- **WHEN** an active paid tenant selects any model in its server-provided platform catalog
- **THEN** the existing model path is used without a plan-model rejection

#### Scenario: Consumer attempts custom model configuration
- **WHEN** a consumer calls a model mutation, provider, debug, or credential endpoint or submits a non-platform model ID
- **THEN** the endpoint is unavailable or the model is rejected without calling the provider

### Requirement: OpenRouter usage is attributed and capped
Each tenant SHALL use one OpenRouter-managed child key with no provider calendar reset. Free SHALL use a monthly period anchored to tenant registration. A monthly paid plan SHALL receive its next allowance only after a successfully paid Paddle recurring period. An annual paid plan SHALL receive one allowance per monthly subperiod of the already-paid annual term. The key SHALL be lazily created through OpenRouter's official SDK, encrypted in the existing tenant credential field, never returned to a consumer, and used for chat, embedding, rerank, vision, and speech calls. Every supported OpenRouter JSON request SHALL also include a stable, non-PII internal user identifier. Musuw SHALL NOT fall back to a shared inference key or a user-supplied key, SHALL NOT keep a second usage counter, and SHALL use OpenRouter's lifetime usage, absolute limit, and remaining value as the usage and enforcement authority.

#### Scenario: First provider request
- **WHEN** an eligible tenant without a child key starts its first OpenRouter-backed inference and management credentials are configured
- **THEN** the server creates one no-reset key, persists the encrypted winner and first personal credit-period end, deletes any raced loser, and performs inference with that tenant key

#### Scenario: Provisioning cannot be secured
- **WHEN** the management key or valid encryption key is absent
- **THEN** inference fails closed with an observable reason and no shared or plaintext key is used

#### Scenario: Monthly limit is exhausted
- **WHEN** OpenRouter returns HTTP 402 or an equivalent terminal SSE credit error for the tenant key
- **THEN** the request terminates without generic retries and exposes the product's monthly-credit error state

#### Scenario: Plan changes for a provisioned tenant
- **WHEN** a verified billing event changes the effective plan
- **THEN** initial paid activation grants one full paid-period allowance, a same-period upgrade preserves used credit and adds only the plan difference, cancellation starts the effective Free allowance, and provider failure leaves or restores the previous durable limit

#### Scenario: Free personal month elapses
- **WHEN** a Free tenant first reads entitlement or invokes a model after its registration-anchored monthly boundary
- **THEN** the existing key limit becomes lifetime usage plus exactly one Free allowance and the next registration anniversary is stored

#### Scenario: Several inactive periods elapsed
- **WHEN** a Free or annual-paid tenant returns after more than one credit boundary
- **THEN** only one current allowance is granted and the stored boundary advances to the next future boundary without stacking missed allowances

#### Scenario: Monthly renewal is not yet confirmed
- **WHEN** a monthly-paid credit boundary expires before a matching successful Paddle recurring transaction is verified
- **THEN** model access is blocked and no old unused credit carries into the unpaid period

#### Scenario: Paid subscription renews successfully
- **WHEN** a signed Paddle `transaction.completed` has origin `subscription_recurring`, a newer billing period, and the same tenant-bound customer, subscription, and server-owned price
- **THEN** the existing child key's no-reset absolute limit becomes its lifetime usage plus exactly one current-plan allowance and the period end is stored once

#### Scenario: Paid renewal is duplicated or unpaid
- **WHEN** the same billing period is delivered again, or a transaction is non-recurring, incomplete, mismatched, or unsigned
- **THEN** no additional allowance is granted

### Requirement: Ingestion reuses the native failure and recovery lifecycle
The system SHALL NOT estimate OpenRouter cost from file bytes. When a provider-managed limit is exhausted during ingestion, the current task SHALL stop without retry, the knowledge row SHALL use WeKnora's existing failed status and trace finalization, and the source object SHALL remain available for the existing reparse flow after credits are restored.

#### Scenario: Credits expire during parsing
- **WHEN** an OpenRouter-backed ingestion stage receives a typed credit-exhaustion error
- **THEN** the stage is marked failed once, is not automatically retried, and can be reparsed through WeKnora's existing workflow after upgrade or monthly reset

### Requirement: Users can inspect their effective entitlement
The authenticated product SHALL show the current plan, storage used and limit, credit used and limit, the exact current allowance boundary when available, and the principal Free-only restrictions in Usage & billing settings. It SHALL also show the four plans as equal, concise comparison cards with actions determined by the durable current plan.

#### Scenario: User opens Usage & billing settings
- **WHEN** an authenticated user opens Usage & billing settings
- **THEN** the values displayed come from the server's effective tenant entitlement rather than browser state

#### Scenario: Localized plan prices are shown
- **WHEN** Paddle is configured and a plan price is available
- **THEN** the client calls Paddle.js `PricePreview()` with the same server-mapped price ID used by checkout and renders Paddle's formatted total without inferring country from UI language

### Requirement: Optional Paddle checkout, self-service, and events are fail-closed
When Paddle environment values are fully configured, an authenticated Free tenant SHALL be able to open Paddle's hosted checkout only for the six server-owned Plus, Pro, and Max monthly/yearly price mappings. An active paid tenant SHALL be able to preview and apply only a strictly higher server-owned tier on its existing subscription; the server SHALL derive the hidden subscription/customer identity and existing billing period, use Paddle's official immediate-proration preview/update with payment failure preventing the change, and replace the single subscription item with the mapped target price. The system SHALL bind each offered or updated price to that tenant, accept subscription lifecycle events for plan state and only successful recurring transaction events for allowance refresh, all with a valid Paddle signature and matching binding, and apply them idempotently. An authenticated tenant with a verified Paddle customer identity SHALL be able to open Paddle's hosted customer portal using a fresh server-created session. A browser callback, subscription-update response, or transaction event SHALL NOT grant a plan; only the verified active subscription can do so. When Paddle is not fully configured, checkout and subscription changes SHALL be displayed as unavailable and no client-supplied plan claim SHALL grant an entitlement.

#### Scenario: Free user starts hosted checkout
- **WHEN** an authenticated Free user chooses an allowed plan and billing period
- **THEN** the official Paddle.js overlay receives exactly one server-mapped price with quantity one, tenant-bound custom data, and Musuw's current supported UI locale while Paddle remains authoritative for country, currency, tax, and eligible payment methods

#### Scenario: Valid activation event
- **WHEN** a correctly signed Paddle subscription event contains a known price, tenant identifier, and matching checkout binding
- **THEN** the mapped paid plan is applied once

#### Scenario: Invalid or unknown event
- **WHEN** the signature or binding is invalid, the price is unknown, the tenant identifier is absent, or the event is neither a subscription lifecycle event nor a successful recurring completion
- **THEN** no entitlement changes

#### Scenario: Duplicate delivery
- **WHEN** Paddle repeats an already processed signed subscription event
- **THEN** the endpoint acknowledges it without applying the plan a second time

#### Scenario: Paid tenant opens General settings
- **WHEN** a tenant already has a paid plan
- **THEN** current entitlement is displayed but new checkout options are withheld to prevent a duplicate subscription

#### Scenario: Paid tenant previews a higher tier
- **WHEN** an authenticated active Plus tenant asks to preview Pro
- **THEN** the server proves ownership of the hidden live subscription, preserves its current monthly or yearly period, and returns Paddle's immediate prorated amount for the server-mapped Pro price without changing the subscription

#### Scenario: Paid tenant confirms a higher tier
- **WHEN** that tenant confirms the previewed upgrade and Paddle accepts payment
- **THEN** the existing subscription contains exactly the mapped target item and target binding, while the plan and existing OpenRouter child-key limit change only after the signed `subscription.updated` webhook is processed

#### Scenario: Paid tenant submits an unsafe plan change
- **WHEN** the target is equal, lower, unknown, the subscription/customer ownership differs, or the live subscription is not the one active server-owned item expected for the durable plan
- **THEN** Paddle is not updated and the durable plan and OpenRouter child-key limit remain unchanged

#### Scenario: Customer manages billing
- **WHEN** an authenticated tenant with a Paddle customer record clicks manage billing
- **THEN** the server resolves the customer from that tenant, creates a fresh Paddle portal session through the official SDK, and returns only its HTTPS overview URL

#### Scenario: Portal ownership cannot be proven
- **WHEN** a request is anonymous or the authenticated tenant has no Paddle customer record
- **THEN** no portal session is created and no Paddle customer or subscription identifier is exposed

#### Scenario: Paddle is unconfigured
- **WHEN** required Paddle environment values are absent
- **THEN** the product reports billing as unavailable while all effective entitlement enforcement remains active
