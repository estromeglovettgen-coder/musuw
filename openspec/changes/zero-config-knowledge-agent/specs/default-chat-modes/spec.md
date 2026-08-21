## ADDED Requirements

### Requirement: One full-capability consumer agent
The standard Musuw chat surface SHALL always use
`builtin-smart-reasoning`, the existing full-capability RAG and tool agent. It
MUST NOT expose an agent or answer-mode selector. A separate model picker SHALL
expose only the server-approved platform catalog for the active plan, and its
reasoning picker SHALL expose only efforts supported by the selected model.

#### Scenario: User opens the standard composer
- **WHEN** the built-in catalog is available
- **THEN** the composer offers model and reasoning-effort choices without an
  agent or answer-mode choice

#### Scenario: User sends a standard message
- **WHEN** the user sends a message with an approved model and reasoning effort
- **THEN** the request resolves the smart-reasoning built-in agent, selected
  approved model, and supported reasoning override

#### Scenario: Client attempts a disallowed model override
- **WHEN** a request supplies a model outside the active plan catalog
- **THEN** the server rejects the model without invoking it

#### Scenario: Client submits a hidden tool override
- **WHEN** a Lite chat request supplies an Agent, MCP, Skill, or web-search override
- **THEN** the Lite product gate rejects the request
