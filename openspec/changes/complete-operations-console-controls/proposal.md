## Why

The loopback operations console still requires a shell command to change its
isolated TEST/PRODUCTION process and does not expose the platform's five real
consumer model policies. The consumer application also retains dark-mode
stacking and light-surface regressions in model selectors and knowledge-base
workflows.

## What Changes

- Add a one-click, loopback-only environment switch that preserves the
  process-per-environment isolation boundary, restarts through the existing
  launcher, and reloads the current console page when the target is healthy.
- Add a five-row operations model-policy matrix backed by the real active
  builtin OpenRouter catalog and the existing typed system settings.
- Expand that catalog with currently available free and low-cost OpenRouter
  chat, rerank, vision, and transcription choices, using only provider model
  identifiers verified against OpenRouter's live model discovery APIs.
- Reject Chat, Embedding, unknown scenes, wrong native types, unsafe catalog
  rows, duplicate paid options, arbitrary fields, and forged IDs at the
  server write boundary.
- Correct the dark-only model-selector stacking context and close dark theme
  coverage for the visible knowledge-base Document, Wiki, and Graph surfaces.
- Preserve read-only database connections, platform-key capability checks,
  CSRF/Origin/Host protections, current model runtime authority, and all
  knowledge-base business behavior.

## Capabilities

### New Capabilities

- `knowledge-dark-theme-consistency`: Complete dark-mode surface and popup
  behavior for consumer model settings and knowledge-base workflows.

### Modified Capabilities

- `system-admin-operations`: Add a process-safe browser control for switching
  the local console target and a narrow consumer model-policy matrix.

## Impact

- Local operations launcher/server, console Vue entry, safe model-policy API,
  SystemAdmin routes, Lite route gate, and associated tests/documentation.
- Final theme closure and semantic dark tokens for settings, knowledge-base,
  graph, chat-composer, and navigation surfaces.
- No new model type, model table, arbitrary settings proxy, second database
  pool, credential exposure, or browser-side datasource configuration.
