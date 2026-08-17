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
The system SHALL expose and accept only the least-cost configured model for each required capability to Free tenants and SHALL expose all active configured models to paid tenants. Server-side model resolution SHALL reject a disallowed model ID even when the caller bypasses the UI. Built-in DeepSeek chat models SHALL use OpenRouter rather than the DeepSeek direct API.

#### Scenario: Free tenant lists chat models
- **WHEN** a Free tenant requests available chat models
- **THEN** only the configured least-cost chat model is returned

#### Scenario: Free tenant submits a paid model ID
- **WHEN** a Free tenant directly requests a model that is not its allowed model for that capability
- **THEN** the server rejects the request without calling the provider

#### Scenario: Paid tenant selects a model
- **WHEN** an active paid tenant selects any active configured model
- **THEN** the existing model path is used without a plan-model rejection

### Requirement: OpenRouter usage is attributed and capped
Every OpenRouter JSON request SHALL include a stable, non-PII internal user identifier when the API supports it. Before provider work the system SHALL reject a tenant whose current-month remaining credit cannot cover the request estimate, and after a successful response it SHALL add OpenRouter's authoritative reported cost to that tenant's current UTC month usage.

#### Scenario: Request has sufficient credit
- **WHEN** the request estimate is within the tenant's remaining monthly credit
- **THEN** the provider request proceeds and its reported cost is recorded against that tenant

#### Scenario: Request exceeds remaining credit
- **WHEN** the request estimate is greater than the tenant's remaining monthly credit
- **THEN** the server rejects the request before calling OpenRouter

#### Scenario: Calendar month changes
- **WHEN** the stored usage month differs from the current UTC month
- **THEN** effective usage is reset to zero before the new request is evaluated

### Requirement: File parsing is preflighted
The system SHALL calculate a simple conservative OpenRouter credit estimate from each uploaded file's byte size and SHALL reject parsing before durable storage when the estimate exceeds the tenant's remaining monthly credit. Actual model calls SHALL remain the source of charged usage.

#### Scenario: File estimate exceeds balance
- **WHEN** an upload's parse estimate exceeds the tenant's remaining monthly credit
- **THEN** the upload is rejected before its object is persisted or a parser is started

#### Scenario: File estimate fits balance
- **WHEN** an upload's parse estimate fits the remaining monthly credit and other limits pass
- **THEN** the existing upload and parsing pipeline proceeds unchanged

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
