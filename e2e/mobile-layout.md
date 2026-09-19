# Mobile browser layout verification

The mobile overrides keep the existing Musuw theme and apply at widths up to
760 CSS pixels. Desktop layout and business controllers retain their existing
behavior. Phone directory disclosure does not overwrite the desktop preference.

## Reproduce locally

From the repository root, run `node e2e/mobile-fixture-api.mjs`. In a second
terminal, from `weknora/frontend`, run:

```sh
VITE_DEV_PROXY_TARGET=http://127.0.0.1:4194 npm run dev -- --host 127.0.0.1 --port 4193 --strictPort
```

Open `http://127.0.0.1:4193/e2e/mobile-harness.html` at 430 × 932 CSS pixels.
The harness mounts the actual workspace, knowledge, Wiki, graph, chat and agent
components. All data is synthetic; the local fixture rejects writes. The harness
is not an entry point of the production build. To open another page directly,
use, for example, `?page=/platform/chat/mobile-session`.

## Acceptance results — 2026-09-19

- At 430 × 932 and 390 × 844, the knowledge toolbar's nine primary controls are
  in the viewport, with touch targets at least 39 CSS pixels wide and high.
- The phone menu opens as an overlay and closes after navigation. The directory
  starts collapsed; expanding it does not leave a permanent narrow content rail.
- Document grid/list switching, folder navigation, Wiki reading, graph navigation,
  historical chat and agent editing were exercised in the browser.
- A document drawer fills the 390-pixel viewport without cropping; its close
  button is 44 × 44. Document row actions are visible and 40 × 40 on touch screens.
- Chat inputs use 16-pixel text. Tools are 40 × 40 and Send is 44 × 44. At an
  available viewport height of 520 pixels, the composer and Send remain visible.
- Agent settings use a compact horizontal header and a scrollable form. At
  430 × 932 and 700 × 600, the form and footer remain inside the viewport.
- At 1440 × 900, 14 visible knowledge-page elements had identical bounding boxes,
  font, color, background, padding and display values against the clean
  `d0074e33` baseline with identical fixture data.
- `npm run build-with-types` passed. The 18 existing visual and business-parity
  checks below passed. Existing bundle-size warnings remain.

```sh
node --test src/assets/musuwVisualContract.test.mjs \
  src/assets/musuwInputFieldBusinessParity.test.mjs \
  src/assets/musuwKnowledgeBaseBusinessParity.test.mjs \
  src/components/menu.resource-nav.visual-contract.test.mjs \
  src/views/knowledge/KnowledgeBase.filter-controls.visual-contract.test.mjs
```

Verification used Chromium viewport/touch emulation. It does not establish
physical iPhone Safari keyboard behavior, full pixel equivalence for every
desktop page, or production upload/payment behavior. No production data was
changed during these layout checks.
