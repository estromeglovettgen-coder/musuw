# musuw Storefront

This tracked package is the approved public marketing, localization, pricing,
trust, and legal surface for `musuw.com`. It preserves the imported React/Vite
visual composition while handing product authority to `app.musuw.com`.

General actions open `https://app.musuw.com/auth/start`. Personal and Pro pricing
actions append only `plan=personal|pro` and `period=monthly|yearly`. The
storefront Worker serves and localizes static assets; it has no account,
checkout, billing, or entitlement endpoint.

Paddle Checkout runs only in the authenticated musuw React application. The
musuw backend validates the bounded plan intent, creates the transaction, and
mirrors billing state only from verified Paddle Webhooks.

## Local verification

```bash
npm ci
npm test
npm run preview:worker
```

The Worker preview defaults to `127.0.0.1:8791`. A successful `main` CI run
deploys production through GitHub Actions; local tests never run a deploy
command.

See [`SOURCE_PROVENANCE.md`](SOURCE_PROVENANCE.md) for the retained source
record.
