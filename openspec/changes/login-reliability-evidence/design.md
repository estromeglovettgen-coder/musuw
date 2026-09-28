## Context

The existing auth runtime maps absent identity sessions, provider errors, thrown errors and deadlines to null. Its consent caller then renders the ordinary login form. A real-runtime/SDK fixture reproduces the same form when sessionStorage is replaced across documents, while retaining the original storage completes authorization. This is a sufficient failure condition, not proof of a browser's actual behavior. Existing production startup durations include navigation and cannot isolate slow resource delivery from application work.

## Goals / Non-Goals

**Goals:** retain truthful recoverable error states, allow a retry of the same authorization, distinguish missing state from unavailable state, and attribute successful and failed login stages with bounded private evidence.

**Non-Goals:** no sessionStorage-to-localStorage identity-token migration, new authentication flow, lowered validation, paid monitoring, new proxy/service, payment/model testing, or unsupported claims of globally fixed network latency.

## Decisions

- Extend the existing runtime result states. Only an actually absent session requests login. Temporary errors retain pending authorization and expose a retry; completed one-time operations remain deduplicated. This avoids introducing a parallel login state machine.
- Keep native request IDs and existing tab flow IDs. Add a ten-minute host-only anonymous journey cookie and per-document ID for diagnostics only. These IDs carry no authentication authority. Report whether tab correlation was restored, expired or unavailable so a changed ID is not mistaken for lost authentication storage.
- Extend the existing diagnostic allowlist with fixed page, result and browser-hint enums and bounded numeric timings. Only known same-origin build-resource basenames are allowed; paths, query strings, raw user agents, errors, email addresses and credentials remain excluded. Existing payloads remain accepted.
- Read native Performance Navigation/Resource Timing for response and transfer stages; record entry, route readiness and mount separately. Resource entries are observations, not proof of cache misses or physical network location. Browser hints are not authoritative device identification.
- Add bounded structured server OIDC outcomes associated with request IDs and the anonymous journey. Never log state, code, nonce, token, binding-cookie values or callback payloads.

## Risks / Trade-offs

- Diagnostic failure or blocked storage must not affect login → best-effort transport, bounded volume and explicit degraded-correlation status.
- Legacy frontend/backend mixtures during release → optional fields, backward-compatible server handling and same tested image pair.
- A cookie can be cleared or altered → treat correlation as untrusted metadata, never identity; keep expiry and validation.
- Browser timings can include background time and unobservable transfers → log bounded navigation/visibility hints and retain stated measurement limits.
- Blind retries can duplicate OTP or consume authorization codes → retry only explicit recoverable reads/continuation, not OTP sends or successful one-time operations.

## Migration Plan

No database migration. Run targeted auth, diagnostics, native OIDC and browser failure/recovery tests, followed by typechecks/builds and a consolidated adversarial review. Build immutable images in GitHub, verify them on staging, and promote the exact digests with an exact-release review record. Rollback uses the previous immutable pair. Private incident evidence stays outside the public repository.

## Open Questions

Actual browser behavior behind the reported lost continuation and the exact cause of the long startup require the new production evidence; local fixtures cannot establish either retrospectively.
