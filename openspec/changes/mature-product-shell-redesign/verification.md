# Verification evidence

## 2026-08-22 implementation verification

- The installed Codex Desktop bundle at
  `/Applications/ChatGPT.app/Contents/Resources/app.asar` was inspected
  read-only. Musuw reuses its compact interaction geometry without copying
  proprietary source or assets: a two-row overview, 280 px model menu,
  single-line selected check rows, and a 250 px scroll bound.
- Authentication keeps the existing Supabase/WeKnora runtime contract while
  replacing the checkbox gate with an adjacent continuation notice. The auth
  suite passed 48/48 tests, TypeScript type checking, and its production Vite
  build.
- The active Vue frontend passed 534/534 tests, `vue-tsc`, and a production
  Vite build. The focused Codex-style picker suite passed 4/4 after the final
  dark-mode correction.
- Strict OpenSpec validation passed for this change and the three active
  delivery changes.
- A consolidated adversarial review found no remaining P0/P1 blocker. Its one
  reproducible dark-mode trigger mismatch was corrected and locked by a
  focused regression assertion.

## Real Chrome layout evidence

- At 1440 x 900, the authentication card measured 408 px wide, was exactly
  centered, exposed one Google action and one email input, had two canonical
  legal links, no checkbox, and no horizontal overflow.
- At 390 x 844, the authentication card measured 358 px wide with 16 px side
  gutters, both primary actions retained 46 px targets, and no horizontal
  overflow occurred.
- The settings route rendered a full-height Codex-style 280 px sidebar plus a
  main pane at desktop width. Consumer Lite exposed exactly its three
  authorized sections and one settings search field.
- At 390 x 844, settings reflowed to the compact stacked navigation/content
  layout with no horizontal overflow.
- At 390 x 844, the chat picker overview contained exactly two 44 px rows. The
  model submenu measured 280 px wide, exposed 11 entitlement-filtered models,
  contained no search, provider groups, or explanatory copy, and scrolled
  internally rather than expanding the popup. The reasoning submenu used the
  same compact one-line/check contract.

Production release and end-to-end lifecycle evidence remains tracked by task
4.2.
