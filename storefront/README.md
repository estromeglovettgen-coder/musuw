# musuw Storefront

This tracked package is the approved public marketing, localization, pricing,
trust, and legal surface for `musuw.com`. It preserves the imported React/Vite
visual composition while handing product authority to `app.musuw.com`.

General actions open `https://app.musuw.com/auth/start`. Plus, Pro, and Max pricing
actions append only a bounded `plan` and `period=monthly|yearly`. The
storefront Worker serves and localizes static assets; it has no account,
checkout, billing, or entitlement endpoint.

The authenticated application reports the Paddle checkout options currently
available to the signed-in tenant. A paid plan can be mirrored only from a
signature-verified Paddle Webhook; URL parameters and checkout returns never
grant entitlements.

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

## Responsive visual contract

The Storefront uses one Hero background contract at every viewport width:

- desktop layout begins at `1024px`; widths at or below `1023px` use the compact
  navigation and responsive Hero layout;
- `.hero` owns the theme background (`--page`), so dark mode remains `#0c0c10`
  and light mode remains white;
- `.hero-dots` uses the transparent `hero-dot-mask.png` pattern at every
  breakpoint. The legacy light `dot-background.png` raster must never be
  composited over the dark Hero;
- `.hero-liquid` is the only full-surface animated color layer. Its renderer
  stays transparent (`alpha`, transparent material, and no depth write), while
  its source colors, pointer force, and motion amplitude remain unchanged;
- content stays above both decorative layers and must remain readable in both
  themes.

This separation is intentional. Do not reintroduce breakpoint-specific Hero
background images or append another override block to repair a single width;
change the shared contract instead.
