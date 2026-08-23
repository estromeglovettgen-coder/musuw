# Verification evidence

## 2026-08-23 production lifecycle and release

- The complete production revision was
  `42395dbf9df923bc75d841d694531102d7adc06c`. Exact-SHA CI run
  `32625412806`, Cloudflare storefront run `32625936901`, and immutable-GHCR
  server run `32625936888` all reached terminal success. Public health and
  revision probes matched that release.
- Real Chrome acceptance completed the English legal/auth continuation, new
  reviewer password sign-in, knowledge-base creation, English source upload
  and completed parsing, KB-scoped retrieval with citations, model/reasoning
  and supported tool paths, plans/Paddle checkout handoff without a Live
  charge, logout, password re-login, and authorized fixture cleanup.
- The disposable production reviewer knowledge base and conversation were
  deleted through the authenticated product API after evidence capture. The
  reviewer account was retained; no Live payment or refund was created.

## Public English smoke

- `https://musuw.com/` and `/contact` returned 200 English storefront HTML;
  the rendered shell had no Chinese or obsolete Musnow text. The app auth,
  platform, plans, and health entry routes returned 200.
- The four active English product captures returned 200 with `image/jpeg`
  responses and the committed 3024x1898 DPR2 intrinsic dimensions.
- Canonical metadata probes found Open Graph, Twitter, favicon/apple-touch,
  and manifest references. The public root contained no Chinese or Musnow
  text.

## Scope note

The current video acceptance remains intentionally deferred because the
supported TEST native-video route reached provider-classified HTTP 402 /
`DOCREADER_PARSE_FAILED` without exhausted tenant allowance. No new service,
provider credit, Live charge, fake event, or manual entitlement mutation was
used.
