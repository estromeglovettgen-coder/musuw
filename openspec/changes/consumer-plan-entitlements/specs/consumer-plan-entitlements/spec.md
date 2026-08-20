## ADDED Requirements

### Requirement: Four tenant-scoped consumer plans
The system SHALL assign each consumer tenant exactly one active plan and SHALL use the following limits: Free = 5 GiB storage and USD 1.00 monthly OpenRouter credit; Plus = 20 GiB and USD 1.25; Pro = 40 GiB and USD 2.50; Max = 80 GiB and USD 5.00. New and existing tenants without an explicit paid entitlement SHALL be Free.

#### Scenario: New consumer signs in
- **WHEN** a Google user receives a new home tenant
- **THEN** the tenant has the Free plan, 5 GiB storage, and USD 1.00 of OpenRouter credit for the current UTC calendar month

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
Each tenant SHALL use one OpenRouter-managed child key whose native monthly-reset limit equals the effective plan credit. The key SHALL be lazily created through OpenRouter's official SDK, encrypted in the existing tenant credential field, never returned to a consumer, and used for chat, embedding, rerank, vision, and speech calls. Every supported OpenRouter JSON request SHALL also include a stable, non-PII internal user identifier. Musuw SHALL NOT fall back to a shared inference key or a user-supplied key. OpenRouter's key state SHALL be the usage and enforcement authority.

#### Scenario: First provider request
- **WHEN** an eligible tenant without a child key starts its first OpenRouter-backed inference and management credentials are configured
- **THEN** the server creates one monthly-limited key, persists the encrypted winner, deletes any raced loser, and performs inference with that tenant key

#### Scenario: Provisioning cannot be secured
- **WHEN** the management key or valid encryption key is absent
- **THEN** inference fails closed with an observable reason and no shared or plaintext key is used

#### Scenario: Monthly limit is exhausted
- **WHEN** OpenRouter returns HTTP 402 or an equivalent terminal SSE credit error for the tenant key
- **THEN** the request terminates without generic retries and exposes the product's monthly-credit error state

#### Scenario: Plan changes for a provisioned tenant
- **WHEN** a verified billing event changes the effective plan
- **THEN** the provider key limit is synchronized before the durable plan is committed, and failure leaves or restores the previous durable limit

### Requirement: Ingestion reuses the native failure and recovery lifecycle
The system SHALL NOT estimate OpenRouter cost from file bytes. When a provider-managed limit is exhausted during ingestion, the current task SHALL stop without retry, the knowledge row SHALL use WeKnora's existing failed status and trace finalization, and the source object SHALL remain available for the existing reparse flow after credits are restored.

#### Scenario: Credits expire during parsing
- **WHEN** an OpenRouter-backed ingestion stage receives a typed credit-exhaustion error
- **THEN** the stage is marked failed once, is not automatically retried, and can be reparsed through WeKnora's existing workflow after upgrade or monthly reset

### Requirement: Users can inspect their effective entitlement
The authenticated product SHALL show the current plan, storage used and limit, monthly OpenRouter credit used and limit, and the principal Free-only restrictions in General settings.

#### Scenario: User opens General settings
- **WHEN** an authenticated user opens General settings
- **THEN** the values displayed come from the server's effective tenant entitlement rather than browser state

### Requirement: Optional Paddle events are fail-closed
When Paddle environment values are configured, the system SHALL accept only webhook requests with a valid Paddle signature and a known server-side price mapping, SHALL apply subscription activation or cancellation idempotently, and SHALL derive the tenant from signed event custom data. When Paddle is not fully configured, checkout SHALL be displayed as unavailable and no client-supplied plan claim SHALL grant an entitlement.

#### Scenario: Valid activation event
- **WHEN** a correctly signed Paddle event contains a known price and tenant identifier
- **THEN** the mapped paid plan is applied once

#### Scenario: Invalid or unknown event
- **WHEN** the signature is invalid, the price is unknown, or the tenant identifier is absent
- **THEN** no entitlement changes

#### Scenario: Paddle is unconfigured
- **WHEN** required Paddle environment values are absent
- **THEN** the product reports billing as unavailable while all effective entitlement enforcement remains active
