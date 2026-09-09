## ADDED Requirements

### Requirement: Verified shared choices
The system SHALL expose only model endpoints that pass their configured inference interface during release acceptance and SHALL use the same global catalog across homepage, agent editor and scene settings.

#### Scenario: Newly admitted model
- **WHEN** a paid user opens each conversation-model selector
- **THEN** verified Grok, Kimi, current GPT and Gemini options are selectable and complete a real response.

### Requirement: Compatible retirement
The system SHALL remove retired provider endpoints while retaining working saved choices when a compatible replacement exists, without changing plan rules.

#### Scenario: Retired MiniMax free endpoint
- **WHEN** a user has saved the previous MiniMax model ID
- **THEN** it resolves to the verified MiniMax endpoint with an accurate label and existing plan authorization.

### Requirement: Production acceptance
The release SHALL include actual application response and selector evidence on production, plus native-interface probes for exposed auxiliary model types.

#### Scenario: Production verification
- **WHEN** the updated release is deployed
- **THEN** defaults, new selections and saved compatible selections work and unavailable endpoints are absent from exposed options.

### Requirement: Native capability compatibility
The system SHALL preserve catalog requirements in the actual vision and transcription request formats.

#### Scenario: Mandatory vision reasoning
- **WHEN** the selected vision model requires reasoning
- **THEN** image extraction does not send an unsupported disabled-reasoning override.

#### Scenario: JSON-only transcription
- **WHEN** GPT-4o mini transcription is selected
- **THEN** the native request uses JSON while existing Whisper selections retain verbose JSON and segment timestamps.
