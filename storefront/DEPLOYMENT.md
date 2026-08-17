# Storefront deployment boundary

The Cloudflare Worker named `musuw-site` owns only the static marketing site at
`musuw.com` and `www.musuw.com`, including locale-aware document metadata. It
must not receive payment credentials or expose an `/api/checkout` route.

Product actions cross to `https://app.musuw.com/auth/start`. Pricing actions carry
only a bounded local plan and billing period. The product origin owns Google
login, the opaque musuw session, enforced entitlement state, and optional signed
Paddle Webhook billing state. When Paddle is not configured, upgrades remain
unavailable.

After a successful `main` CI run, GitHub Actions builds this package, deploys
the exact commit to `musuw-site`, and probes both public domains plus the app
handoff. A failed smoke check is reported and may restore the immediately
previous Worker version; rerun a known-good full SHA through the same workflow.
Local workstations are not a production deployment path.

The application release owns the authenticated product origin separately from
this static homepage. Keep homepage deployment free of authentication,
provider, and payment credentials.

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the canonical end-to-end
delivery path and production evidence fields.
