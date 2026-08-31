## Context

WikiBrowser is both a graph view and a mature product workflow. Its original SVG implementation combines rendering with selection, bloom, ego navigation, filtering, search focus, and the page drawer. The desired change is deliberately narrower: improve the motion and pixels while retaining the product contract.

The local Obsidian 1.13.7 graph package exposes a Worker with its graph simulator, message protocol, drag lifecycle, and force configuration. The renderer seam is the correct boundary for reusing it.

## Goals / Non-Goals

**Goals:**

- Make node motion, dragging, settling, zoom, labels, and dimming feel like Obsidian.
- Keep the original WeKnora graph page visually and behaviorally recognizable.
- Add only a compact visual/force control surface and persist it per knowledge base.
- Follow WeKnora light/dark mode while keeping category colors unchanged.
- Retain original exploration cues and drawer navigation.

**Non-Goals:**

- Changing graph APIs, limits, graph filtering semantics, page types, permissions, or backend behavior.
- Replacing WeKnora controls with an Obsidian application shell.
- Exposing multiple renderer/style selectors on the production graph page.
- Filtering or recoloring graph data from the visual settings panel.

## Decisions

### Keep product behavior in WikiBrowser

WikiBrowser continues to own all API calls and callbacks. `WikiGraphRenderer` receives the raw response and reports pointer/camera events. Click, double-click, Shift-click, stage-click, search focus, fit, arrow visibility, drawer opening, ego loading, and bloom loading remain WikiBrowser actions.

### Use one production renderer path

The page always requests `DEFAULT_WIKI_GRAPH_STYLE`, backed by the exact local Worker and Pixi renderer. The registry may retain dormant adapters, but the production UI has no renderer selector and no automatic switch to an alternative page renderer.

### Keep settings visual-only

The compact panel exposes label fade, node size, line thickness, four force settings, animation restart, reset, collapse, and close. The original legend owns arrows and page-type filters. Settings never transform the graph response.

The versioned settings schema remains complete and tolerant of existing saved records, while only visual fields are consumed by this view. Writes are debounced and scoped by knowledge-base ID.

### Resolve theme colors at the canvas boundary

Pixi requires integer colors, so a small adapter resolves WeKnora CSS variables through computed styles. It watches the document's `theme-mode` and class attributes, updates background/line/text/accent colors in place, and does not rebuild the graph. Category fills come from one mapping shared with the original legend.

### Recreate original affordances inside Pixi

The renderer keeps total link count separately from rendered degree. That allows Obsidian sizing to use rendered degree while hidden-neighbor rings and hover bloom retain the original WeKnora meaning. Directed-edge membership is retained so a deduplicated line can still render a reverse arrow.

### Preserve original service bounds

Overview stays at 500, ego stays at 500, and the HTTP hard maximum stays at 2,000. A rendering change does not justify broadening the public response contract.

## Risks / Trade-offs

- **Theme variables are CSS strings while Pixi needs integers** -> resolve through a hidden computed-style probe and fall back to calibrated constants only when the browser cannot resolve a value.
- **Selected/hovered colors could erase page-type meaning** -> keep fills fixed and use themed outlines, labels, edges, and opacity for feedback.
- **Moving rendering out of WikiBrowser could drop affordances** -> lock the original control order and node actions with source-level contract tests, and explicitly implement hidden-neighbor rings, bloom, and bidirectional arrows in the adapter.
- **Worker/canvas resources could survive navigation** -> centralize teardown in the controller and call it on view changes and unmount.
- **Dormant renderer packages increase build output** -> they remain lazy chunks and are not loaded by the production graph path; removal is outside this UI-only change.

## Migration Plan

1. Ship the renderer and settings under the existing graph route.
2. Existing graph data, endpoints, saved wiki content, and permissions require no migration.
3. Existing partial settings records are normalized field by field.
4. Rollback restores the SVG renderer and removes the settings entry; no backend or stored content rollback is required.
