## ADDED Requirements

### Requirement: Users can select configured conversation models

The conversation input SHALL expose every active KnowledgeQA model available to the current tenant. The selected model SHALL be used for the conversation and remembered per browser. When no valid remembered selection exists, a tenant-owned default SHALL take precedence over the platform default and managed V4 Flash fallback.

#### Scenario: User changes the conversation model

- **WHEN** an authenticated user opens the chat model dropdown and selects another available model
- **THEN** the selected model is shown in the input and used for subsequent conversation requests
- **AND** reloading the page preserves that choice while the model remains available

### Requirement: Administrators can configure all native model capabilities

The settings shell SHALL expose WeKnora's existing Models view with Chat, Embedding, Rerank, Vision, and ASR capability tabs. An administrator SHALL be able to add, edit, test, and choose a default model through the existing API and credential mechanism.

#### Scenario: Administrator selects a default

- **WHEN** an administrator saves a model as default
- **THEN** that model is the only default owned by the tenant for its model type
- **AND** the default state is visible after the model list is reloaded

### Requirement: Built-in models are usable from the production region

Musuw SHALL ship an OpenRouter-backed built-in catalog whose chat, embedding, rerank, vision, and speech entries have been verified with bounded real requests from the production region. The managed V4 Flash and V4 Pro IDs SHALL remain stable while using OpenRouter DeepSeek model slugs.

#### Scenario: Fresh tenant uses built-in capabilities

- **WHEN** a tenant opens model settings without creating a custom model
- **THEN** configured built-ins are visible for all five native model types
- **AND** the default chat and ingestion capability models can be invoked without adding credentials
