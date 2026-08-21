## Why

The local operations console needs a narrow, authenticated system-admin seam
for seeing a tenant's effective entitlement and making support-safe changes.
Its current tables must not resort to raw SQL or duplicate the Paddle and
OpenRouter billing rules.

## What Changes

- Add a cross-tenant entitlement snapshot backed by the existing entitlement
  service and OpenRouter-managed child-key usage.
- Add a whitelist-only tenant mutation for account status and storage quota.
- Add a provider-backed OpenRouter remaining-credit adjustment/reset bounded by
  the current plan allowance; Paddle plan and billing state remain webhook/API
  owned.
- Record each successful operator mutation in the existing system audit log.

## Out of Scope

- A general SQL or arbitrary mutation endpoint.
- Manual Paddle plan, invoice, refund, or subscription writes.
- A Musuw usage ledger, OpenRouter HTTP client, or alternate provider adapter.
