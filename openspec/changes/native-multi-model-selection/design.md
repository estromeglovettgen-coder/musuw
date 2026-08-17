## Context

WeKnora v0.7.2 already implements model CRUD for chat, embedding, rerank, vision, and ASR models, plus a model debugger and a conversation model picker. Musuw retained that code but hid the settings section and filtered the picker to two model IDs.

## Goals / Non-Goals

**Goals:**

- Restore the native model UI in the current Musuw visual shell.
- Make the default flag functional without changing the model schema.
- Ship only OpenRouter models proven callable from the production region.
- Preserve existing V4 Flash/Pro behavior and knowledge-base bindings.

**Non-Goals:**

- A provider marketplace, dynamic catalog sync, per-model routing service, fallback graph, or new credential system.
- Migrating existing knowledge-base vector dimensions.
- Exposing unrelated platform administration sections.

## Decisions

- Add only `general` and `models` to the existing settings shell. The complete native `ModelSettings` view already supplies the five capability tabs and debugger.
- Show every active KnowledgeQA model returned by the existing API in the chat picker. Store the last user choice in the existing per-browser key; if absent, use the model marked default and then the V4 Flash fallback.
- Reconnect `is_default` in the existing create/update API and clear other defaults of the same tenant and model type before save. No new table or preference entity is needed.
- Keep stable IDs for the two managed DeepSeek modes, but call their OpenRouter model slugs. Add only four other chat models that returned HTTP 200 from the production region; omit providers blocked there.
- Keep the existing embedding, rerank, VLM, and ASR IDs and dimensions. The real upload pipeline already proved the embedding binding, so changing it would invalidate existing vectors for no product benefit.

## Risks / Trade-offs

- **A saved default conflicts with a shared built-in default** → tenant-owned defaults are preferred in the client; built-in YAML retains one platform fallback.
- **A historical conversation references another model** → valid restored IDs remain selected; fallback occurs only when the ID is unavailable.
- **A provider is region-blocked later** → the native settings debugger remains available to administrators; no speculative fallback layer is added.

## Migration Plan

No schema migration is required. On release, the existing built-in model reconciler updates the YAML-managed rows. Existing knowledge bases keep their saved model IDs.

## Open Questions

None.
