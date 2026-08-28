# Verification Report: enable-paddle-live-production

All evidence below is sanitized. It records only public configuration classes,
counts, statuses, and behavior. No credential, signing secret, card data,
payout detail, private provider response, or Paddle resource identifier is
stored here.

## 2026-08-27 Live cutover

- Paddle Live inventory contains exactly three active SaaS products and six
  distinct active recurring prices: Plus, Pro, and Max in monthly and yearly
  periods. The authenticated production plan page rendered all six localized
  Live amounts through Paddle.js.
- The one active production notification destination uses `traffic_source=all`
  and exactly eleven events: nine subscription/transaction lifecycle events
  plus `adjustment.created` and `adjustment.updated`. No duplicate destination
  or replacement credential was created.
- The production public Paddle response is configured and reports `live`; its
  client token class, six catalog mappings, API key class, destination secret,
  default payment link, and runtime mode passed the shared atomic preflight.
- The existing Live API key and exact destination signing secret are mounted
  from root-owned, non-symlink, mode-`0600` files. The application container
  received non-empty read-only mounts. Values were never printed or copied to
  repository files.
- Retain setup validated `https://app.musuw.com/retain`, Paddle displayed
  `Retain is now live`, and the settings page now reports Paddle.js installed
  on that public recovery page. The authenticated `pwCustomer` path remains
  provider-state-derived; the current manually granted Plus smoke account has
  no Paddle customer binding and therefore cannot prove the optional in-app
  detector.

## Checkout and webhook acceptance

- The real Live `/plans` surface rendered monthly USD 5/10/20 and yearly USD
  49/99/199 for the six server-owned mappings. Public home, contact, Terms,
  Privacy, Refund, `/pay`, `/retain`, and the Live public-config endpoint all
  returned HTTP 200.
- Paddle's official Live API created one automatically collected draft
  transaction for the Plus monthly catalog item and returned the configured
  `/pay` URL. The production page automatically opened one official Paddle
  frame showing the plan, localized tax, amount due, customer fields, and
  Paddle merchant-of-record notice. No customer or payment field was changed,
  and no payment was confirmed. The draft was canceled immediately afterward;
  it had zero payments.
- Paddle's official no-charge adjustment simulation completed twice against the
  exact production destination. Both deliveries were `success` with HTTP 200;
  the replay request was accepted. Focused production logs contained twelve
  Paddle/webhook lines, zero focused errors, and zero panic/fatal lines.
- Signed fixture and worker/service tests cover invalid signatures, sub-five-
  second acknowledgement, durable retry, duplicate and reordered delivery,
  final tenant-marker idempotency, full approved refund/chargeback withdrawal,
  partial/pending/rejected no-op, and provider-read reversal. The Live
  simulation validates the real provider signature/destination seam without
  fabricating a production entitlement event.

## Release evidence

- Exact-revision CI, storefront delivery, and GitHub-hosted production delivery
  completed successfully. The production workflow used GitHub-hosted Ubuntu to
  build immutable app/frontend images, verify their registry digests, and SSH
  through the restricted Tokyo deploy gate.
- Tokyo app and frontend revision labels matched the selected full commit,
  required containers were healthy, and public `/health` returned HTTP 200.
  TikHub and Paddle protected mounts were present and non-empty after the same
  release without reading their values.
- Fresh frontend evidence is 681/681 tests plus Vue type-check. Focused Go race
  packages, production static/runtime contracts, workflow contracts, tracked
  secret scan, credential-registry validation, and strict OpenSpec validation
  are green.

## Explicit boundaries

- The consolidated adversarial review found no Musuw card field, server-created
  first-purchase transaction, checkout operation state, billing ledger, refund
  executor, dunning state machine, or duplicate catalog/destination. Initial
  checkout is Paddle.js `items`/`customData`; the only durable billing operation
  is the narrow paid-subscription upgrade guard required because Paddle's
  subscription update API has no general idempotency key and the available
  Customer Portal has no Product Collections configuration.
- No real card, charge, refund, transfer, payout, or payout-account operation
  occurred. Paddle owns checkout, tax, currency conversion, payment methods,
  dunning, receipts, refunds, and recovery. Musuw only mints a signed checkout
  binding, validates signed events, and mirrors entitlement state.
- Payout/bank configuration remains intentionally untouched. A real public
  buyer-support phone and Retain DKIM/Return-Path DNS remain owner-controlled
  compliance/deliverability follow-ups; neither is represented as complete.
