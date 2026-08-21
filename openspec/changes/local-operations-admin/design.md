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
  Paddle term metadata, and OpenRouter used/remaining/reset/status. Provider
  failures are represented as `openrouter_credits_status=unavailable` by the
  existing fail-closed service.
- `PATCH /api/v1/system/admin/tenants/:id` — requires
  `system_tenants_manage`; accepts only `status` (`active`/`inactive`) and/or
  positive `storage_quota_bytes`.
- `PUT /api/v1/system/admin/tenants/:id/openrouter-credits` — requires
  `system_tenants_manage`; accepts either non-negative
  `remaining_microusd` (not above the current plan allowance) or `reset:true`.

Successful writes emit system-scope audit rows with old/new or requested
values and never include credentials.
