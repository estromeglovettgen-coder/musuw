# Verification evidence

## 2026-08-23 production lifecycle and release

- The complete production revision reached terminal success through exact-SHA
  CI, Cloudflare storefront delivery, and immutable-GHCR server delivery.
  Public health and revision probes matched that release.
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

## Historical video scope boundary

The earlier supported TEST native-video route reached provider-classified HTTP
402 / `DOCREADER_PARSE_FAILED` without exhausted tenant allowance. No new
service, Live charge, fake event, or manual entitlement mutation was used. This
is retained as a historical failure boundary, not a current blocker: the later
Production default-route reparse completed on the original upload after the
OpenRouter parent account satisfied the provider's required funding boundary.
The detailed parse, retrieval, citation, and retention evidence lives in the
OpenRouter and reviewer-readiness changes.

## 2026-08-23 policy hardening (deployed)

- The bilingual legal source now identifies Paddle as Merchant of Record,
  links Paddle Buyer Terms, Refund Policy, and buyer support, and describes
  recurring billing and cancellation using the provider's current routes.
- Musuw publishes a 30-day money-back guarantee aligned with Paddle's Seller
  Handbook recommendation and Paddle's rule preserving additional supplier
  rights, while avoiding an unverified support response deadline. The privacy
  text avoids asserting an unsupported controller role.
- Storefront build and all 53 storefront tests passed locally. The policy
  hardening was then delivered by the current exact-revision CI, Cloudflare
  storefront, and Tokyo server paths; each reached terminal success. Public
  home, contact, auth, platform, plans, and health smoke probes returned HTTP
  200, and runtime revision probes matched the deployed release.
- A verified public support phone is still not evidenced. No number is
  invented or published; support email and the current buyer-support links
  remain the only evidenced channels. This remains an explicit Paddle
  review-risk gap.

## 2026-08-23 current Paddle re-verification and footer correction (local)

- Current Paddle primary sources were rechecked at the official Seller
  Handbook, Domain Review, Buyer Terms, Refund Policy, and paddle.net buyer
  support routes:
  - <https://www.paddle.com/seller-guides/seller-handbook>
  - <https://www.paddle.com/help/start/account-verification/what-is-domain-verification>
  - <https://www.paddle.com/legal/buyer-terms>
  - <https://www.paddle.com/legal/refund-policy>
  - <https://paddle.net/>
- The existing bilingual legal source already retains Paddle's exact required
  English Merchant-of-Record sentence, the voluntary 30-calendar-day refund
  guarantee, automatic-renewal and end-of-period cancellation disclosure,
  Paddle Buyer Terms and Refund Policy links, and paddle.net buyer support.
  The public home/footer already expose clear product, price, Terms, Privacy,
  Refund, and Contact routes. No unsupported support-response deadline was
  found, so no policy text was rewritten.
- The adjacent rendered-footer contract failed first against the historical
  pre-correction `© 2026 Musuw.` value, then passed after both locale sources were changed to
  the exact shared line `© 2026 musuw. All rights reserved.` The production
  storefront build and all 53 storefront tests then passed.
- Final repository checks passed: strict OpenSpec validation reported 14 of 14
  changes valid, and `git diff --check` reported no whitespace errors.
- Paddle's current Seller Handbook asks sellers to publish both a buyer-support
  email and phone number. No verified public business phone is evidenced in the
  repository or authorized source. Task 1.6 therefore remains unchecked; no
  phone, address, or KYC identity is fabricated, and the existing support email
  plus official buyer-support routes remain the only published channels.
- This correction is local and uncommitted. It does not claim a new CI run,
  push, deployment, Live Paddle authorization, payment-logic change, price
  change, or checkout change.
