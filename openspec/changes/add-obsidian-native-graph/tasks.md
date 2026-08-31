## 1. Protect the original contract

- [x] 1.1 Audit the original WikiBrowser graph template, controls, request bounds, and node interaction flow
- [x] 1.2 Add contract tests for control order, raw graph data, request bounds, click/double-click/bloom, focus, and drawer behavior
- [x] 1.3 Restore the original legend, search, help, status, drawer, theme CSS, and backend hard limit

## 2. Exact physics adapter

- [x] 2.1 Keep the versioned local Obsidian graph Worker and checksum record
- [x] 2.2 Use its existing node/link, force, drag, alpha, and SharedArrayBuffer protocol through a minimal adapter
- [x] 2.3 Release Worker, Pixi, observers, frames, canvas, and pending click state on navigation and unmount

## 3. Renderer integration

- [x] 3.1 Route the raw WeKnora graph response through the renderer seam without filtering or request changes
- [x] 3.2 Preserve fit, search focus, selection, stage clear, arrows, drawer, ego, and bloom callbacks
- [x] 3.3 Preserve hidden-neighbor rings, hover bloom, and bidirectional arrow rendering

## 4. Compact visual controls

- [x] 4.1 Add the small display/force panel without replacing or moving original WeKnora controls
- [x] 4.2 Persist exposed visual values, collapse/close state, and scale per knowledge base with safe normalization
- [x] 4.3 Apply display and force changes live without layout, camera, selection, drawer, or data loss

## 5. Theme and colors

- [x] 5.1 Preserve the six original WeKnora page-type colors in the Pixi adapter
- [x] 5.2 Resolve WeKnora theme variables for background, lines, labels, highlights, and controls
- [x] 5.3 React to live light/dark changes without refetching or rebuilding graph data

## 6. Verification and review

- [x] 6.1 Run graph/settings/contract tests, backend bound test, type checking, diff checks, and production build
- [ ] 6.2 Verify the running Musuw graph after authentication: both themes, persistence, drag propagation, all original controls, source drawer, bloom, and arrows
  - Musuw's full local stack is running at `http://localhost:4190`; authenticated graph inspection remains pending because the fresh local origin is currently at the login screen.
- [x] 6.3 Run one consolidated adversarial review and fix all current blockers
