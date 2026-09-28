## Why

Production diagnostics show successful email-code verification followed by an authorization document with a new tab flow and an absent identity session. The same-origin anonymous journey survives. A real-SDK browser fixture reproduces the bounce when tab storage disappears; errors and timeouts are not involved in this incident.

## What Changes

- Use the Supabase SDK's standard shared same-origin session storage so authorization survives loss of tab state while shared storage remains.
- Keep short authorization state and existing validation; do not import legacy tab credentials or add a token bridge.
- Revoke the provider session before local logout cleanup and bind password recovery to the session that completed recovery.

## Capabilities

### New Capabilities

- `shared-auth-session-continuity`: consistent identity continuation and safe direct consumers across browser documents.

### Modified Capabilities

None in the consolidated spec store. This supersedes the session-only identity decision in the earlier password-auth change; PKCE validation and its short lifetime remain.

## Impact

Musuw auth shell, its tests and release evidence. No database migration, dependency, paid service, native WeKnora auth change or new authentication protocol. Private incident records stay outside the repository.

Before production promotion, a reported knowledge-card navigation failure revealed a current release blocker in the existing frontend chunk policy. The same release must correct the overbroad Dagre chunk assignment, provide route-load failure feedback, and exercise actual production bundles through documents, Wiki and graph. This restores existing navigation without changing knowledge-base behavior.
