## ADDED Requirements

### Requirement: Operators can inspect an effective tenant entitlement

The system SHALL expose a SystemAdmin/platform-key snapshot for an explicit
tenant using the existing tenant and entitlement services. The response SHALL
include storage quota/used bytes, configured and effective plan/status,
verified billing period metadata, OpenRouter used/remaining/reset/status, and
MUST NOT include provider credentials.

#### Scenario: Provider usage is available

- **WHEN** a permitted operator requests a tenant entitlement snapshot
- **THEN** the response returns the current provider-backed usage and the
  tenant's effective plan and storage state

#### Scenario: Provider usage is unavailable

- **WHEN** OpenRouter management usage cannot be read
- **THEN** the snapshot remains readable and reports
  `openrouter_credits_status=unavailable` without fabricating usage

### Requirement: Tenant status and storage quota use a narrow mutation

The system SHALL accept only `active`/`inactive` status and positive
`storage_quota_bytes` through the SystemAdmin mutation route. It MUST reject
plan, Paddle, credential, and arbitrary tenant fields and SHALL audit success.

#### Scenario: Invalid mutation is submitted

- **WHEN** an operator submits an unsupported status, non-positive quota, or
  no whitelisted field
- **THEN** the request returns 400 and the tenant is unchanged

### Requirement: OpenRouter support adjustment uses the provider authority

The system SHALL adjust an existing tenant child key through the official
OpenRouter KeyManager and SHALL bound remaining credits by the current plan's
allowance. `reset:true` SHALL restore that allowance. It MUST NOT add a local
usage ledger or mutate Paddle state and SHALL audit success.

#### Scenario: Operator resets remaining credits

- **WHEN** a permitted operator submits `{"reset":true}`
- **THEN** the provider-managed key is set to lifetime usage plus the current
  plan allowance and the response reports the refreshed entitlement

#### Scenario: Operator requests an out-of-range amount

- **WHEN** `remaining_microusd` exceeds the current plan allowance or is
  negative
- **THEN** the request is rejected without a provider update
