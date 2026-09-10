# Storefront deployment boundary

The Cloudflare Worker named `musuw-site` owns the static marketing site at
`musuw.com` and `www.musuw.com`, including locale-aware document metadata, and
the independent static partner-board demonstration at `partners.musuw.com`. It
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

The partner hostname serves only the five owned assets under
`public/partner-board/`. Its bilingual scenario is explicitly labeled as
simulated data; it does not call Paddle or the production application API.
The Worker blocks the internal asset prefix on the marketing domains and
does not add a homepage navigation entry. GET/HEAD are the only supported
methods, and unknown partner routes return 404. The existing deployment smoke
step checks the hostname, both languages, all assets, and the API boundary.

The application release owns the authenticated product origin separately from
this static homepage. Keep homepage deployment free of authentication,
provider, and payment credentials.

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the canonical end-to-end
delivery path and production evidence fields.
