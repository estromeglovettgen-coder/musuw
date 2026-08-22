## Context

Musuw already has bilingual public Terms, Privacy, Refund, Subscription,
Acceptable Use, Cookie, Security, and Contact pages on `musuw.com`. The auth
shell on `app.musuw.com` does not link them and its Google/email actions can be
started without an affirmative acknowledgement. The repository is also ahead
of the last deployed `main`; GitHub Actions is the only permitted production
code entry and independently delivers the Cloudflare storefront and the
server application.

The legal text must describe actual behavior, not copy another company's
contract. Current official requirements and mature SaaS documents are inputs
for coverage and presentation only. Production uses Supabase for identity,
Resend for authentication email, optional Google sign-in, Cloudflare for the
public edge and R2 storage, OpenRouter plus the model provider selected
in-product for AI processing, Langfuse Japan Cloud for production AI
observability, and Paddle as Merchant of Record. Each active recipient must be
represented according to its bounded production role.

## Goals / Non-Goals

**Goals:**

- Make the canonical Terms and Privacy Policy visible before a logged-out user
  starts Google or email authentication.
- Require a clear, unchecked acknowledgement that distinguishes agreement to
  the Terms from acknowledgement of the Privacy Policy.
- Keep bilingual legal disclosures aligned with actual collection, named live
  providers, cross-border processing, retention determination, rights,
  cancellation, refunds, and billing behavior.
- Deliver one immutable SHA through the existing release workflows and verify
  the actual deployed user lifecycle in Chrome.

**Non-Goals:**

- Claiming a lawyer's jurisdiction-specific certification or copying another
  company's copyrighted policy language.
- Adding consent databases, cookie-management vendors, a second auth system,
  a second deployment path, or a parallel billing environment.
- Creating a real production charge merely to prove checkout. Payment
  acceptance stops before payment unless an existing safe transaction can
  prove the live entitlement path.
- Exposing secrets, prompts, uploaded content, payment details, or one-time
  codes in logs, screenshots, or acceptance notes.

## Decisions

### Use one local acknowledgement gate in the existing auth shell

The login panel will render an unchecked native checkbox with direct Terms and
Privacy links. Google and email-code initiation remain disabled until it is
checked. Verification of an already-requested email code stays available so a
refresh or callback cannot strand a user. This provides a visible affirmative
action without inventing a consent service or changing Supabase/OIDC.

A passive “by continuing” sentence was considered because it is common on
large SaaS login pages. The explicit unchecked control better supports the
clear affirmative-action and prominent-notice expectations relevant to this
China-operated product, with little implementation cost.

### Keep the public legal suite canonical and reconcile only evidence-backed gaps

`storefront/src/legalContent.js` remains the one bilingual source. The policy
will name the live provider roles and link to their notices, state that the
selected model/provider receives only content needed for a requested feature,
and preserve the existing voluntary 30-day Musuw refund promise because
Paddle's current policy expressly permits suppliers to grant additional
rights. Unknown infrastructure identities, retention durations, or legal
representations will not be invented.

Replacing the suite with a generated template or copying OpenAI, Notion,
Resend, Google, or Paddle text was considered and rejected: their service
roles, jurisdictions, and data flows do not match Musuw.

### Reuse the exact-SHA GitHub release

After local tests pass, the complete current `main` is pushed once. A green CI
run for that SHA must trigger both the existing Cloudflare storefront workflow
and immutable GHCR/server workflow. Success requires public probes and runtime
revision evidence; a workflow label alone is insufficient. Rollback is the
documented exact-SHA manual dispatch of the previous known-good revision.

### Exercise production as a user without unsafe financial mutation

Chrome acceptance covers account entry, a fresh disposable knowledge base,
representative upload/parse, retrieval/chat with plan-allowed models and
reasoning, billing-page state and Paddle checkout handoff, logout/re-login,
and cleanup. An existing paid entitlement can prove post-payment behavior; a
new live card charge is not required. Disposable knowledge content is deleted
after evidence is collected; the user's real account and paid subscription are
not deleted or canceled.

## Risks / Trade-offs

- [A checkbox is not a server-side consent ledger] → retain the click as a
  clear user action but do not add a new identity database solely for this
  release; formal counsel can require versioned consent records later.
- [A provider or product data flow changes] → keep the policy tied to named
  current roles and update the effective date whenever the live flow changes.
- [CI or one delivery target fails] → do not call the release complete; repair
  the existing workflow and rerun the same exact SHA when possible.
- [Production checkout cannot be safely completed] → verify the live Paddle
  overlay and checkout handoff, use existing entitlement evidence, and report
  the unexecuted real-charge boundary honestly.
- [Acceptance creates user data] → use uniquely named disposable content and
  delete it through the public Musuw API/UI after the test.

## Migration Plan

1. Add contract tests, then implement the auth acknowledgement and any
   evidence-backed legal corrections.
2. Run auth, storefront, frontend, Go, source-boundary, secret, release, and
   strict OpenSpec checks locally.
3. Commit and push the one complete revision to `main`; monitor CI,
   storefront, and server production workflows to terminal success.
4. Verify public domains, legal pages, auth links, health, deployed revision,
   and the real browser lifecycle; remove disposable acceptance data.
5. If a release regression is found, use the existing exact-SHA recovery path
   for the previous known-good revision.

## Open Questions

None.
