## Why

The standard Musuw flow currently exposes internal model and knowledge-base
configuration, and a frontend-only release can leave that UI unable to find
the required built-in models.  A user must be able to create a knowledge base,
upload files, and start an appropriate conversation without learning or
operating WeKnora's model plumbing.

## What Changes

- Reuse WeKnora's built-in-model seed and existing knowledge-base defaults so
  a standard knowledge base is created with the complete supported ingestion,
  retrieval, Wiki, and document-processing features already enabled.
- Reject creation with a clear platform-unavailable result when the required
  built-in models are absent, rather than creating a knowledge base that looks
  usable but cannot accept documents.
- **BREAKING** Remove raw model and advanced knowledge-base configuration from
  the standard-user flow.  Standard users retain normal content operations:
  create, rename, upload, organize, query, and delete their own knowledge
  bases.
- Replace the raw chat-model selector with exactly two platform-provided
  entries: V4 Flash (fast) and V4 Pro (full capability).  V4 Pro exposes the
  existing deep-thinking control and every healthy, already-integrated tool
  within the caller's own tenant.
- Keep provider keys, raw model IDs, cross-tenant resources, and platform
  administration outside the user-facing flow.  Make frontend/backend
  built-in-model compatibility a full-release requirement so these entries
  cannot be shipped without their server-side definitions.

## Capabilities

### New Capabilities

- `zero-config-knowledge-base`: Standard knowledge bases are provisioned from
  existing platform defaults and are usable immediately or fail cleanly.
- `default-chat-modes`: Standard chat offers the two fixed platform modes,
  including the Pro deep-thinking and full-tool behavior.
- `built-in-model-release-compatibility`: The standard UI and backend catalog
  publish compatible built-in model definitions together.

### Modified Capabilities

<!-- None. There are no existing repository-level OpenSpec capability specs. -->

## Impact

- `weknora/config/builtin_models.yaml`, its startup seeding, and the full
  release path.
- Existing knowledge-base create/default logic and its standard-user frontend
  views.
- Existing chat model selection, session request handling, agent-tool
  selection, and associated frontend presentation.
- No new provider, agent framework, persistent capability profile, or custom
  permission subsystem is introduced.
