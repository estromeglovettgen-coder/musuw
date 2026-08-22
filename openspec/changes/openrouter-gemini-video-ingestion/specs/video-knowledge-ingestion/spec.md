## ADDED Requirements

### Requirement: Supported video upload
Musuw SHALL accept MP4, MPEG, MOV, and WebM knowledge uploads and SHALL reject undocumented video containers.

#### Scenario: Consumer selects a supported video
- **WHEN** an authenticated paid consumer selects a supported video in the native upload flow
- **THEN** the file SHALL be stored and queued through the existing document-processing task

#### Scenario: Free consumer selects a video
- **WHEN** a Free consumer attempts a video upload
- **THEN** the existing entitlement gate SHALL reject it before model inference

### Requirement: Native OpenRouter video understanding
Musuw SHALL convert each supported video to Markdown using the built-in OpenRouter VLM. The production catalog SHALL use `qwen/qwen3.7-flash` routed to the Alibaba endpoint; `google/gemini-2.5-flash` MAY remain explicitly admitted for region-specific verification.

#### Scenario: Worker processes a private video
- **WHEN** the document worker reads a supported stored video
- **THEN** it SHALL send a base64 `video_url` to OpenRouter and receive factual searchable Markdown

### Requirement: Native ingestion continuation
Musuw SHALL feed generated video Markdown through the existing chunking, embedding, indexing, status, and summary pipeline.

#### Scenario: Video understanding succeeds
- **WHEN** the approved native-video model returns non-empty Markdown
- **THEN** the knowledge item SHALL use the same downstream lifecycle as another parsed document

#### Scenario: Video understanding fails
- **WHEN** the provider rejects or cannot understand the video
- **THEN** the existing retry and failed-status behavior SHALL surface the failure without partial indexed content
