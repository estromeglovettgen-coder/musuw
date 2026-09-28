## Context

The auth shell stored the SDK session in tab storage while native app tokens already used shared localStorage. A successful email-code exchange followed by loss of the tab context therefore returned to login. Production correlation distinguishes this from an SDK read exception; browser fixtures reproduce the condition, but cannot explain Quark internals.

## Goals / Non-Goals

**Goals:** preserve same-origin identity across documents, truthful storage failure, logout cleanup, and recovery account isolation.

**Non-Goals:** no alternate identity backend, credential bridge, database change, payment/model calls, or promise that localStorage survives every browser mode. Keep the standard provider/OIDC flow and callback validation.

## Decisions

- Configure the existing SDK session in shared localStorage. Retain short-lived PKCE material and tab-only continuation state. Never migrate or fall back to legacy tab credentials; an unfinished old login may require one new login. This avoids maintaining two credential sources.
- Use the SDK's fixed-bearer revocation API to revoke the captured session, and remove that same local snapshot immediately after initiating the request. Its delayed result never deletes a later login. Runtime deadline cleanup also compares its captured snapshot. The normal SDK signOut unconditionally deletes whichever shared session exists on completion, so it is unsuitable for this concurrent boundary.
- Password recovery stores only a short-lived SHA-256 fingerprint of its exchanged access token. Refresh and submit require the same identity session; an expired grant or account switch requires a new recovery flow.
- SDK updateUser rereads mutable shared state and cannot accept an explicit token. Use a request-scoped, nonpersistent SDK client with the captured recovery session for this one mutation. This preserves SDK validation and fixed-target authorization without writing an old snapshot over a newly signed-in account. It adds one provider user validation request only during password reset.

## Risks / Trade-offs

- Shared identity persists across documents/restarts → explicit logout clears shared identity; never copy old tab tokens back.
- Account switch during recovery → validate before mutation and bind the outbound password request to the captured session; never overwrite the shared account on completion.
- Browser denies shared storage → existing recoverable error UI, no insecure fallback or empty success.
- Exact-token recovery binding rejects a rotated token → safe explicit recovery retry; grant lifetime remains ten minutes.
- Real Quark may also clear shared storage → report this limitation and verify on the user's phone after release.

## Migration Plan

No schema migration. Run runtime, real-SDK and browser regressions, typecheck/build, then one consolidated adversarial review. Build in GitHub, accept immutable images on staging, promote the same digests, and verify production assets. Rollback uses the previous image pair. No secret or real-user trace enters source control.
