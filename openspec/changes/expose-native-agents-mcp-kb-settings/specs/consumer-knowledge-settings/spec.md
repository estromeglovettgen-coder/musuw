## ADDED Requirements

### Requirement: Consumer knowledge-base configuration
The system SHALL let an authorized consumer create and edit a document knowledge base using the native WeKnora name, description, RAG, Wiki, Wiki granularity, Wiki content-generation instruction, Wiki extraction-focus instruction, and summary-model fields.

#### Scenario: Create a configured knowledge base
- **WHEN** an authorized user creates a document knowledge base and chooses the visible settings
- **THEN** the system persists those choices through the existing WeKnora create contract and platform defaults

#### Scenario: Edit visible knowledge-base fields
- **WHEN** an authorized user opens the knowledge-base editor from the knowledge-base page and saves visible changes
- **THEN** the system updates the same native fields through the existing WeKnora update contract

#### Scenario: Edit from the card menu
- **WHEN** an authorized user opens a completed knowledge-base card's overflow menu and chooses edit
- **THEN** the same native editor opens with persisted values and saves through the existing update contract

### Requirement: Native indexing semantics
The system SHALL expose RAG and Wiki as consumer choices while retaining native validation and keeping the platform-owned graph setting out of the consumer form.

#### Scenario: Choose RAG and Wiki
- **WHEN** a user enables or disables RAG or Wiki in the visible form
- **THEN** the form maps RAG to the existing vector and keyword settings, maps Wiki to the existing Wiki setting, and leaves graph at the platform-owned default

#### Scenario: Avoid false rebuild promises
- **WHEN** a user edits settings on a knowledge base that already contains content
- **THEN** the UI saves the native configuration without claiming or calling a non-existent whole-library rebuild operation

### Requirement: Hidden expert configuration
The consumer form SHALL hide embedding, parser, storage, chunking, graph, FAQ, concurrency, and other expert controls while retaining their native defaults or persisted values.

#### Scenario: Open the consumer editor
- **WHEN** a consumer opens create or edit
- **THEN** only the agreed knowledge-base fields are interactive and no parallel consumer configuration is created

### Requirement: Knowledge settings support both themes
The create and edit dialogs, cards, overflow menu, fields, helper text, and actions SHALL match the reference hierarchy and remain readable and operable in light and dark mode.

#### Scenario: Edit a knowledge base in dark mode
- **WHEN** the application is in dark mode and a user opens knowledge-base settings
- **THEN** the dialog loads successfully and every visible control has readable text, boundaries, focus, hover, disabled, and selected states

### Requirement: FAQ generation is unavailable in Lite
The system SHALL hide FAQ knowledge bases from the Lite consumer surface and SHALL reject native FAQ creation, mutation, copy, and duplicate attempts server-side while preserving Standard WeKnora behavior.

#### Scenario: Crafted Lite FAQ request
- **WHEN** a Lite client calls a native FAQ write route or creates, copies, or duplicates a FAQ knowledge base
- **THEN** the server rejects it without creating or changing FAQ content

#### Scenario: Historical FAQ cleanup
- **WHEN** a tenant has FAQ data created before the Lite restriction
- **THEN** read/search and deletion remain available for inspection and cleanup while it stays absent from the Lite list and manager UI
