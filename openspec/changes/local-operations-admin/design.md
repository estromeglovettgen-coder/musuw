## Authority and seam

The existing `EntitlementService` remains the only owner of effective plan,
period, and provider usage semantics. The system-admin handler only projects
its result for an explicit tenant ID and delegates OpenRouter writes to the
same official-SDK-backed `KeyManager` path used by consumer inference and
Paddle synchronization.

The existing `TenantService.UpdateTenant` is reused after a strict request
whitelist. No caller-provided tenant JSON, credential, plan, or Paddle field is
accepted.

## Routes

- `GET /api/v1/system/admin/tenants/:id/entitlement` — requires
  `system_tenants_read` or `system_tenants_manage` on a platform key (or a
  human SystemAdmin). Returns storage, effective/configured plan, status,
  Paddle term metadata, consumer-period OpenRouter allowance/used/remaining,
  provider raw used/remaining, and reset/status. Provider failures are
  represented as `openrouter_credits_status=unavailable` by the existing
  fail-closed service; raw counters remain zero unless the provider read
  succeeded.
- `PATCH /api/v1/system/admin/tenants/:id` — requires
  `system_tenants_manage`; accepts only `status` (`active`/`inactive`) and/or
  positive `storage_quota_bytes`.
- `PUT /api/v1/system/admin/tenants/:id/openrouter-credits` — requires
  `system_tenants_manage`; accepts either non-negative
  `remaining_microusd` (not above the Max allowance of 5,000,000 microusd) or
  `reset:true` (current effective plan allowance).

- `GET /api/v1/system/admin/users/:user_id/investigation` — requires
  `system_tenants_read` or `system_tenants_manage`; accepts optional positive
  `tenant_id` and returns bounded safe projections from existing repositories.
  Langfuse query is explicitly unavailable because WeKnora has no read client;
  OpenRouter status comes from the entitlement snapshot. No prompt,
  attachment, key, span payload, or dead-letter payload is projected.

The investigation route is intentionally a thin aggregation at the existing
handler seam. It does not create a second event bus, trace store, or usage
ledger. Knowledge spans and dead letters are queried only by already-known
knowledge-base/document scopes and are capped before serialization.

Lite keeps its consumer product boundary authoritative on the server. The
gate exact-matches only the operations routes above plus the existing
capability-scoped runtime and audit reads/actions. Authentication,
`SystemAdmin`, and platform-key capability checks still run normally. General
system settings, platform-key management, and every other upstream admin route
remain hidden, so changing the browser UI or guessing a URL cannot expose the
control plane.

Successful writes emit system-scope audit rows with old/new or requested
values and never include credentials.
