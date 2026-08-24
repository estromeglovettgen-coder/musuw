# Verification Report: consumer-plan-entitlements

The local baseline below was verified through 2026-08-21 (America/Phoenix)
against the combined local integration branch. Its earlier CI/push/deployment
deferral is a historical boundary; the current production evidence is recorded
in the dated section below.

## 2026-08-23 typed video-credit retry correction

- A red-first worker-boundary test drove the real document video-ingestion path
  with a typed OpenRouter credit-exhaustion failure. Before the correction,
  `errors.As` failed because failure persistence had reduced the cause to an
  ordinary formatted error, so the existing middleware could not emit
  `SkipRetry`.
- The smallest correction uses `%w` at the video failure call and reuses one
  `fmt.Errorf` value for both the persisted message and returned error. The same
  test is green for typed classification and `SkipRetry`; it also proves the
  existing failed status, reparsable source lifecycle, stable credit message,
  and `DOCREADER_PARSE_FAILED` stage code remain unchanged.
- Focused and complete router, OpenRouter transport, VLM video, and complete
  application service tests pass without a provider or network call. The server
  build, strict validation of all configured OpenSpec changes, and diff
  whitespace check also pass.

## Result

- The four-plan matrix remains one pure server definition: Free/Plus/Pro/Max provide 5/20/40/80 GiB and USD 1/1.25/2.50/5 monthly OpenRouter limits.
- Free enforcement is server-side: one knowledge base, ten documents per knowledge base, no video, and one least-cost built-in OpenRouter model per required capability.
- Paid consumers receive the larger platform catalog but cannot create, edit, test, credential, or invoke arbitrary models.
- OpenRouter's official Go SDK owns child-key creation, monthly limit updates, usage lookup, and deletion. The inference transport installs the tenant key and stable non-PII `user`; there is no shared inference key, BYOK path, local spend ledger, or file-byte price estimate.
- First-use persistence uses the existing tenant row lock and encrypted credentials JSONB. Provider-side race losers are deleted. Plan and tenant lifecycle operations fail closed rather than orphaning keys or diverging silently.
- HTTP 402 and terminal OpenRouter SSE credit errors are non-retryable; ingestion reuses WeKnora's failed/reparse and trace-finalization paths.
- Paid credit boundaries fail closed when a legacy row has no recorded billing period; only an explicit yearly period may advance lazily, so missing migration data cannot grant an unpaid month.

## Fresh evidence

- Backend entitlement, session, OpenRouter, router, and type suites passed; all Go packages compiled with `go test ./... -run '^$'`.
- Frontend passed 516/516 tests, Vue type-check, and production build. Auth passed 45/45 tests and type-check; storefront passed 38/38 tests and production build.
- Local authenticated API acceptance returned Free's 5 GiB/USD 1/1 KB/10 docs/no-video entitlement and exactly five built-in OpenRouter capability models. Paid-plan simulation returned the larger built-in catalog. Paid-model detail was denied to Free; model mutation/provider/debug/credential endpoints and both initialization write routes returned the Lite not-found boundary.
- Local browser acceptance showed the correct Free and Plus plan cards, plan-specific chat choices, no model-configuration affordance, a server-rejected second Free knowledge base, and successful cleanup of the temporary knowledge base.
- With the management key intentionally absent, a real chat request selected the approved Qwen model, attempted no shared-key fallback, logged `management_key_not_configured`, emitted a terminal error, and closed the stream cleanly.
- A fresh database integrity audit found every active tenant on the exact 5/20/40/80 GiB quota for its plan, every default and knowledge-base storage reference valid, tenant storage usage equal to the active-document sum, every active knowledge base bound to valid built-in OpenRouter capability IDs, and no Free knowledge-base/document/video limit breach. Every provisioned Free or paid child key had a persisted personal credit boundary; the only Free rows without one had never provisioned a key, so first use will initialize the registration-anniversary cycle without pre-granting or stacking inactive months. No consumer-visible credential row or retained temporary knowledge base remained.
- Fresh Chrome acceptance showed the Free account's registration-anniversary reset date and remaining-credit percentage, compact profile/usage settings without embedded plan cards, the standalone four-card `/plans` page, and Paddle-localized monthly and yearly prices. The Lite route guard preserves the user-profile deep link; the chat composer contains exactly the model and reasoning-effort rows, no agent selector, and the stored runtime normalizes to the full-capability built-in agent.
- After explicit action-time confirmation, Chrome opened the Plus monthly Paddle Sandbox checkout through the real `/plans` action. The `/checkout?plan=plus&period=monthly` page rendered one visible official Paddle inline frame, the Musuw Plus summary and five benefits, and an enabled subscription control without any outer or frame error; Musuw rendered no custom card input.
- Paddle independently selected Chinese UI with US as the current buyer country and exposed card and PayPal, but not Alipay. This confirms that browser locale and billing country remain separate and that payment-method selection is Paddle-owned. No country, payment, or personal field was changed; no payment detail was entered or saved, and the subscription control was not clicked.
- Leaving Checkout and returning to the real usage settings kept the account on Free, showed the upgrade action, granted no paid plan, and rendered no embedded plan cards.
- After switching the test browser to a US IP, Paddle's native localized preview resolved `$5.00`, `$10.00`, and `$20.00` monthly. The comparison page now removes only the meaningless `.00`, showing `$5`, `$10`, and `$20`, while preserving fractional localized amounts such as converted HKD prices. The Sandbox annual prices and mainland-China CNY overrides were restored through Paddle's official catalog API to the product's ten-month-style annual matrix: `$49`, `$99`, and `$199` in the comparison, with `¥289`, `¥589`, and `¥1,289` for mainland China. Two abandoned draft transactions were canceled, six obsolete one-time or legacy-subscription prices were archived, and the obsolete Personal product was archived after confirming that no subscription or completed payment depended on them. A fresh Paddle inventory then contained exactly the six application-bound recurring prices and no active one-time price. The plan comparison does not itemize tax; Paddle remains authoritative for final checkout tax and payment methods.
- The post-migration regression suite reproduced and fixed the unknown-paid-period case: an expired paid allowance with no `paddle_billing_period` now returns the renewal-pending error and never updates the OpenRouter key limit. The focused test and the complete service/repository/handler suites passed after the fix.
- A later launch-stage correction established that Paddle Live is not authorized and fixed production must remain Sandbox. A red-first static contract first failed because the production preflight still hard-coded a Live API key, then passed after a shared environment-shape validator was introduced. A second red-first check proved the first generalized version still accepted a complete Live unit; the fixed-production wrapper now rejects it in both preflight and app entrypoint. Synthetic checks still validate the future Live shape in isolation, but the deployable path accepts only Sandbox `test_` + `pdl_sdbx_apikey_`, one `pdl_ntfset_` destination secret, and six distinct `pri_` values. Tests cover both API-key mix directions, both client-token mix directions, a complete Live rejection, invalid webhook shape, missing/duplicate prices, secret non-leakage, and the read-only Compose mount. No operator credential or external Paddle object was read or changed in this repository-only correction. At that local stage, real Sandbox catalog reads and a signed Sandbox destination delivery were still required external evidence; the current production catalog/delivery proof is recorded below. Future Live enablement requires a reviewed code change.
- The owner clarified that all launch data is disposable test data and no cross-environment subscription migration is required. The provider-orphan probe, recovery checkout response, paid same-plan checkout routing, recovery copy, and their tests were removed instead of expanding a custom recovery subsystem. A red-first service case proved that an initial paid lifecycle event without a confirmed provider period previously synthesized a local monthly boundary; the service now ignores that event before changing the plan, provider identity, cadence, or OpenRouter limit. At that historical local boundary, a fresh standard Sandbox checkout and signed activation were still required; the current real checkout and signed activation evidence is recorded below, and no database edit or recovery event is accepted as a substitute.
- A red-first service regression reproduced the stale-subscription overwrite risk, then the green local service/handler suites proved that active or paused paid tenants ignore different-subscription lifecycle events while only durable Free/canceled tenants accept a different subscription on a signed active initial activation with a confirmed period newer than `occurred_at`; Free-anniversary, canceled-same-sub resumed, and other Free/canceled updated/resumed/past-due events without a confirmed period remain rejected, while paused same-plan resume still preserves its confirmed term. Earlier reviewer-account payment and cancellation evidence is retained only as historical context; it is superseded for current acceptance by the stronger same-account lifecycle recorded below.
- The obsolete Paddle overlay wrapper had no production consumer and was deleted. Plan comparison still uses Paddle `PricePreview()`, and payment remains the single official one-page inline Paddle Checkout; no parallel custom card or payment workflow remains.
- The active Paddle Sandbox destination was missing `transaction.completed`, which meant a monthly subscription could update its plan but could never deliver the paid renewal signal. The destination now subscribes to that event alongside the existing lifecycle set. Paddle's official `subscription_renewal` simulation delivered signed `subscription.updated` and `transaction.completed` requests with HTTP 200; the same-period completion was correctly ignored. A signed custom next-period completion then returned `applied=true`, advanced the Max tenant from the September boundary to 2026-10-20, and restored 100% remaining credit in the authenticated in-app browser. Replaying the identical simulation returned `applied=false` and left the boundary unchanged, proving period-level idempotency without a database edit or real charge.
- The same run exposed that the generic HTTP logger persisted the full Paddle webhook payload. The body-suppression seam now excludes authentication and Paddle webhook payloads at every status, and generic access logs retain bounded bodies only for failed ordinary API calls. The remaining consumer chat/search logs record query lengths, target counts, IDs and outcomes instead of raw prompts; the Agent entry no longer serializes the whole session solely for logging, pipeline events no longer copy prompts or tool arguments, stream timing no longer previews reasoning or answer text, and title events record only title length. Message search keeps the original query for execution rather than mutating it through a log sanitizer. A cold new-chat load retained method, path, status, size, latency, business events, and the `applied` decision without copying successful agent prompts, model catalogs, knowledge-base metadata, user content, or payment payloads into the log stream.
- The apparent messages behind deleted sessions were traced to WeKnora v0.7.2's unchanged soft-delete contract: reads join only active sessions while child messages remain for retention. No custom cleanup or database mutation was added.
- A fresh in-app-browser upload exposed that host development had dropped Compose's default `RETRIEVE_DRIVER=postgres`. Restoring that same upstream default produced 2/4 persisted vectors and 24,865/75,582 counted bytes for two real documents; `tenants.storage_used` exactly matched the active-document sum. Rebuilding the original document passed the same assertion, and deleting both test documents returned the tenant, active-document sum, and test-vector count to zero.

## 2026-08-23 production release and Sandbox lifecycle

- Exact-revision CI, Cloudflare storefront delivery, and Tokyo server delivery all reached terminal success. Public health and revision smoke returned HTTP 200 and matched the current deployed release.
- The same freshly confirmed disposable password account completed logout and password re-login, then reported an authoritative initial Free entitlement. Earlier reviewer-account payment evidence does not substitute for any step in this account's lifecycle.
- Exactly one real Paddle Sandbox Plus monthly standard checkout completed for that account. Its exact signed initial delivery group—`subscription.created`, `subscription.activated`, and the initial `transaction.completed`—each reached delivered HTTP 2xx with `attempts=1`.
- The same subscription's official Pro preview returned HTTP 200 and its apply returned HTTP 202. The resulting signed `subscription.updated` and `transaction.completed` deliveries each reached HTTP 2xx with `attempts=1`; no browser response granted the entitlement.
- The final authoritative entitlement was Pro, active, and monthly, with the required checkout/provider bindings and paid/credit periods present. Gemini 3.7 and Claude Haiku 4.5 were each exercised once in their first in-product UI proof; both completed with a non-empty answer, with neither an error nor a pending state remaining. The following entitlement read reported `credits_status=available` and usable credits.
- The already-failed default Gemini 2.5 video was not uploaded again. After the
  OpenRouter parent account satisfied the provider's required funding boundary,
  the existing item was reparsed exactly once through the product and completed
  the default video-ingestion path. This does not claim subscription
  cancellation or account deletion.
- Task `4.13` remains unchecked because its fresh-checkout half is now proven but its stale-data/account-deletion half is not. No SQL edit, recovery subsystem, forged event, duplicate checkout, cancellation of the new subscription, or account deletion is used as a substitute.

## Historical local release boundary

The two plan-document keys remain intentionally unconfigured in the local
verification baseline, so the earlier statement that no fresh paid OpenRouter
call or production deployment was claimed applies only to that baseline. The
current production delivery and Sandbox billing evidence are recorded above.

## 2026-08-23 current deployed entitlement release

- The selected revision completed all seven CI jobs on the first run, followed
  by terminal-success Cloudflare storefront and Tokyo production deliveries.
  Public and loopback health, root, and auth probes returned HTTP 200.
- Production preflight and runtime checks confirm one complete Paddle Sandbox
  unit. Sensitive runtime files have the required restrictive permissions, and
  the configured credential mounts are read-only; no Live unit is authorized.
- The same-account Free-to-Plus-to-Pro checkout/update, paid model, and default
  video reparse/citation evidence recorded above remains the current lifecycle
  proof.
- Task 4.13 remains unchecked: the fresh checkout and signed activation half is
  proven, but the required stale-data and account/data-deletion half is not.
