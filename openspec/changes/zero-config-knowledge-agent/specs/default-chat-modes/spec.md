## ADDED Requirements

### Requirement: Exactly two standard chat modes
The standard chat selector SHALL expose only the existing
`builtin-quick-answer` and `builtin-smart-reasoning` agents.  It MUST present
them as V4 Flash and V4 Pro rather than exposing arbitrary model
configuration.

#### Scenario: User opens the standard chat mode selector
- **WHEN** the built-in catalog is available
- **THEN** the selector offers V4 Flash and V4 Pro and no other built-in or
  custom-agent entry

### Requirement: Flash uses the quick RAG pipeline
V4 Flash MUST use the existing quick-answer pipeline and
`builtin-deepseek-v4-flash` for fast knowledge-base answers.

#### Scenario: User selects V4 Flash
- **WHEN** the user sends a message in V4 Flash
- **THEN** the request resolves the quick-answer built-in agent and the Flash
  model

#### Scenario: Client attempts to override Flash's model
- **WHEN** a request for V4 Flash supplies a different `summary_model_id`
- **THEN** the system uses the Flash model configured on the built-in agent

### Requirement: Pro uses the full existing agent capability
V4 Pro MUST use the existing smart-reasoning pipeline and
`builtin-deepseek-v4-pro`.  Its deep-thinking control MUST remain available,
and its tool configuration MUST include every healthy built-in WeKnora tool
while existing tenant/resource authorization remains enforced.

#### Scenario: User selects V4 Pro with deep thinking enabled
- **WHEN** the user sends a message in V4 Pro with deep thinking enabled
- **THEN** the request resolves the smart-reasoning built-in agent, Pro model,
  existing tool set, and thinking override

#### Scenario: Tool targets an inaccessible resource
- **WHEN** V4 Pro attempts an operation outside the caller's permitted tenant
  resource scope
- **THEN** the existing scope authorization denies the operation
