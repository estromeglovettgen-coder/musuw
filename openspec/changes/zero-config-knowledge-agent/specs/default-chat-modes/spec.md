## ADDED Requirements

### Requirement: Exactly two standard chat modes
The standard answer-mode selector SHALL expose only the existing
`builtin-quick-answer` and `builtin-smart-reasoning` agents. It MUST present
them as V4 Flash and V4 Pro rather than exposing arbitrary agent
configuration. A separate model picker MAY expose only the server-approved
platform catalog for the active plan.

#### Scenario: User opens the standard chat mode selector
- **WHEN** the built-in catalog is available
- **THEN** the selector offers V4 Flash and V4 Pro and no other built-in or
  custom-agent entry

### Requirement: Flash uses the quick RAG pipeline
V4 Flash MUST use the existing quick-answer pipeline and the currently
selected server-approved chat model for fast knowledge-base answers.

#### Scenario: User selects V4 Flash
- **WHEN** the user sends a message in V4 Flash
- **THEN** the request resolves the quick-answer built-in agent and the
  selected approved model

#### Scenario: Client attempts a disallowed model override
- **WHEN** a request for V4 Flash supplies a model outside the active plan catalog
- **THEN** the server rejects the model without invoking it

### Requirement: Pro uses the smart-reasoning pipeline
V4 Pro MUST use the existing smart-reasoning pipeline and currently selected
server-approved chat model. Its deep-thinking control MUST remain available;
hidden Agent/MCP/Skill/web-search overrides MUST remain unavailable in Musuw
Lite.

#### Scenario: User selects V4 Pro with deep thinking enabled
- **WHEN** the user sends a message in V4 Pro with deep thinking enabled
- **THEN** the request resolves the smart-reasoning built-in agent, selected
  approved model, and thinking override

#### Scenario: Client submits a hidden tool override
- **WHEN** a Lite chat request supplies an Agent, MCP, Skill, or web-search override
- **THEN** the Lite product gate rejects the request
