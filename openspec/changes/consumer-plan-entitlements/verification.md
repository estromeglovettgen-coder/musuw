# Verification Report: consumer-plan-entitlements

Verified locally through 2026-08-21 (America/Phoenix) against the combined local integration branch. CI, push, and deployment were intentionally deferred at the user's request because the GitHub Actions allowance is exhausted.

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
- Database inspection found every active knowledge base bound to stable built-in OpenRouter capability IDs, no consumer-visible credential rows, valid default storage backends, and no retained temporary knowledge base.
- Fresh Chrome acceptance showed the Free account's registration-anniversary reset date and remaining-credit percentage, compact profile/usage settings without embedded plan cards, the standalone four-card `/plans` page, and Paddle-localized monthly and yearly prices. The Lite route guard preserves the user-profile deep link; the chat composer contains exactly the model and reasoning-effort rows, no agent selector, and the stored runtime normalizes to the full-capability built-in agent.
- After explicit action-time confirmation, Chrome opened the Plus monthly Paddle Sandbox checkout through the real `/plans` action. The `/checkout?plan=plus&period=monthly` page rendered one visible official Paddle inline frame, the Musuw Plus summary and five benefits, and an enabled subscription control without any outer or frame error; Musuw rendered no custom card input.
- Paddle independently selected Chinese UI with US as the current buyer country and exposed card and PayPal, but not Alipay. This confirms that browser locale and billing country remain separate and that payment-method selection is Paddle-owned. No country, payment, or personal field was changed; no payment detail was entered or saved, and the subscription control was not clicked.
- Leaving Checkout and returning to the real usage settings kept the account on Free, showed the upgrade action, granted no paid plan, and rendered no embedded plan cards.
- After switching the test browser to a US IP, the standalone plan page reloaded Paddle's native localized preview as `$5.00`, `$10.00`, and `$20.00` monthly. The Sandbox annual prices and mainland-China CNY overrides were then restored through Paddle's official catalog API to the product's ten-month-style annual matrix: `$49.00`, `$99.00`, and `$199.00`, with `¥289`, `¥589`, and `¥1,289` for mainland China. Two obsolete Pro prices were archived after confirming that no effective subscription used them, leaving only the six application-bound prices active. The plan comparison did not itemize tax; Paddle remained authoritative for final checkout tax and payment methods.
- The post-migration regression suite reproduced and fixed the unknown-paid-period case: an expired paid allowance with no `paddle_billing_period` now returns the renewal-pending error and never updates the OpenRouter key limit. The focused test and the complete service/repository/handler suites passed after the fix.
- A fresh in-app-browser upload exposed that host development had dropped Compose's default `RETRIEVE_DRIVER=postgres`. Restoring that same upstream default produced 2/4 persisted vectors and 24,865/75,582 counted bytes for two real documents; `tenants.storage_used` exactly matched the active-document sum. Rebuilding the original document passed the same assertion, and deleting both test documents returned the tenant, active-document sum, and test-vector count to zero.

## Deferred release boundary

The two plan-document keys remain intentionally unconfigured, so this pass does not claim a fresh paid OpenRouter call. Earlier production evidence remains historical only. The combined candidate is local by explicit instruction; no CI, GitHub push, or production deployment is claimed here.
