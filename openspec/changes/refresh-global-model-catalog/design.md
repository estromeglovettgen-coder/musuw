## Context

The three consumer selectors use the database reconciled from builtin_models.yaml. Scene options also use the existing system-setting policy defaults. MiniMax M3 free inference returned HTTP 404. A real production Nemotron Lightning conversation failed with upstream 429 overload; GLM 5.2 worked and is upgraded to the current family endpoint.

## Goals / Non-Goals

**Goals:** working international and Chinese model choices, synchronized selectors, preserved saved selections, production evidence.

**Non-Goals:** video ingestion redesign, new providers, changing memberships, automatic background catalog updates.

## Decisions

Keep the existing YAML registry and native reconciliation. Verify actual inference before admission. Preserve existing stable IDs for compatible model-family upgrades, including legacy IDs with a free suffix, while removing misleading display labels and provider slugs. Use new IDs for new families; add them to existing scene policy defaults. Test the actual native interfaces for vision, rerank, ASR and embeddings rather than assuming the chat model listing describes them.

Remove the account-gated Muse vision option and the unavailable MiniMax free vision option. MiniMax's paid endpoint passed conversation/tool tests but repeatedly failed a simple image observation, so it is not admitted as a vision scene option. Existing production knowledge bases, agents and system settings have no references to the removed vision IDs.

Preserve mandatory reasoning capability when constructing the native vision client. Optional models retain the existing disabled-reasoning extraction behavior; mandatory models omit the unsupported override and use the provider default. Configure GPT-4o mini transcription to request JSON; retain verbose JSON and timestamps for existing Whisper clients. Both incompatibilities were reproduced with failing regression tests before the fixes.

## Risks / Trade-offs

- Provider listings can outlive endpoints → perform real bounded inference and retain dated evidence.
- A new catalog entry can be omitted by scene policy → compare all three user-facing lists and policy defaults.
- Existing user selection can reference a retired slug → preserve compatible stable IDs.
- Production promotion has an existing protected workflow → build and verify the immutable release through that workflow; report any actual remaining approval gate.

## Migration Plan

Run catalog reconciliation via the normal release. Preserve user overrides. Return to prior immutable image pair for rollback. Test a saved MiniMax selection, default conversation and new models after release.

## Verification

The final exposed catalog passed 40 native-client probes against a short-lived, capped child key in the production OpenRouter workspace: 25 conversations with a tool-result round trip and streaming answer, 7 image observations, 4 transcriptions, 3 rerank requests and one 4096-dimensional embedding. The existing two dedicated video routes are unchanged and excluded from the selectable vision scene list. The child key was deleted after testing. Release, browser and production reconciliation evidence is recorded separately as delivery proceeds.
