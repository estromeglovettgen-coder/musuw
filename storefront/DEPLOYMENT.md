# Storefront deployment boundary

The Cloudflare Worker named `musuw-site` owns only the static marketing site at
`musuw.com` and `www.musuw.com`, including locale-aware document metadata. It
must not receive payment credentials or expose an `/api/checkout` route.

Product actions cross to `https://app.musuw.com/auth/start`. Pricing actions carry
only a bounded local plan and billing period. The product origin owns Google
login, the opaque musuw session, backend-created Paddle transactions, signed
Webhook billing state, and Customer Portal links.

Before a production release, verify the authorized Worker version, custom
domains, app host, Google redirect allowlist, Paddle environment/catalog, and
the Go reverse proxy separately. If rollback is required, restore the previous
Cloudflare Worker version; the untouched source directory named in
`SOURCE_PROVENANCE.md` remains the original visual rollback source.

The application release owns the authenticated product origin separately from
this static homepage. Keep homepage deployment free of authentication,
provider, and payment credentials.
