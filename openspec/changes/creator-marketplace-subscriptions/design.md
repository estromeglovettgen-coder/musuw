## Context

The app has native KB/agent execution, separate tenant model credentials, Paddle membership checkout, verified webhook queues, and a Vue Musuw presentation layer. Membership persists one subscription per tenant. Native shared-agent execution switches the context to the source tenant and can therefore charge the source; Lite deliberately blocks that sharing route. Native KB clone does not support cross-tenant complete publication.

## Goals / Non-Goals

Goals: minimum complete reviewed catalog, recurring independent product access, coherent order management, correct buyer-owned chat/model billing, staging Sandbox proof. Preserve native model/retrieval algorithms and existing membership behavior.

Non-goals: marketplace payouts, creator public profiles, full billing state mirrors, asset version-control engines, new runtimes, production promotion, and production price changes. Annual ten-month pricing applies to the new product catalog; existing live membership prices are not silently changed.

## Decisions

- Add a distinct marketplace module inside the existing Go app. Persist product/submission, per-product subscriptions, and transactions with paid periods. Reuse Paddle client, verified event intake and queue infrastructure; route market events to market records without touching tenant membership fields.
- Each product has independent monthly/yearly recurring prices. Annual currency and price must match ten monthly base units, and price/product/environment relationships are server verified. Use existing customer binding where available; never recognize a buyer by email alone.
- Effective Max gates submission; system-admin reviews/publishes. Reviewed platform assets are separate from creator drafts. Initially the operator uses existing import/edit flows to prepare platform KBs/agents; do not invent automatic cross-tenant cloning.
- Runtime request carries product ID. Server resolves paid access and approved KB/agent, creates a trusted request-scoped access context, and preserves buyer tenant/model billing/session ownership. Only the approved source KB scope participates in native retrieval. Browser-supplied source/KB/agent IDs do not expand access.
- Buyers receive public presentation metadata, never prompts, creator contacts, source keys or edit capabilities. Source raw downloads/configuration remain denied; necessary citation reads require scoped access.
- Go-use opens the existing new-chat UI, applying the agent before KB selection and DeepSeek Flash as default. It does not auto-send or replace an existing draft. New chats and continuation requests reauthorize access.
- Reuse Paddle customer portal for payment method/cancellation/invoices. Order management combines service subscriptions and transaction records with an existing membership management link. Canceled renewal remains usable to paid end. Past-due does not invent unpaid access. Refund handling relates to the refunded transaction/period, not merely customer identity.
- Account erasure reuses the existing durable user fence and Paddle cancellation guard. Inventory all product customers/subscriptions, cancel unpaid checkouts, reconcile in-flight writes, then wait for provider terminal state before minimizing new marketplace records. Deleted buyers cannot be rebound by late billing events; approved platform assets survive source creator deletion.
- Deploy an immutable feature-branch SHA to staging using the existing staging-only workflow, never merging to main just to obtain staging. Use additive schema and isolate sandbox provider IDs/fixtures.

## Risks / Trade-offs

- Cross-tenant retrieval/credentials → preserve buyer execution context, scope source resource access explicitly, and test adjacent model/KB/tool paths.
- Duplicate/unordered/provider-delayed events → idempotent records, transaction-period association, independent event cursors and repair through provider reconciliation.
- Membership/product coexistence → never write product subscriptions into membership fields; test two products plus paid membership.
- Manual publication requires operator work → existing native uploads are the first safe route; disclose incomplete Wiki rather than claiming clone completeness.
- Sandbox success does not establish Paddle business-model approval → preserve prior unconfirmed classification; no provider representations or production sales in this task.

## Migration Plan

Apply additive SQL migrations through existing release. Configure sandbox products, prepare reviewed staging assets, then publish fixtures. Verify feature-branch CI, deploy staging digest, run authenticated backend and browser acceptance. Roll back by unpublishing fixture catalog and deploying previous staging digest; preserve billing records and stop fixture renewals as needed. Do not drop subscription/transaction data during operational rollback.

## Open Questions

Resolve operational identifiers from staging/Keychain/provider metadata. Test prices are temporary ($5/month Taylor and small fixtures) and explicitly sandbox-only. No user input is required for these reversible fixtures.
