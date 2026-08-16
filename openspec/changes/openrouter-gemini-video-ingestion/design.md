## Context

The active v0.7.2 fork deliberately rejects video. Tencent's later FFmpeg/frame-extraction implementation was large and subsequently removed upstream. OpenRouter's current API accepts private videos directly as base64 `video_url` content, while Musuw already has an OpenRouter-backed VLM and a text-to-chunk ingestion pipeline.

## Goals / Non-Goals

**Goals:**

- Convert a supported stored video into searchable Markdown with `google/gemini-2.5-flash`.
- Reuse existing upload storage, processing status, chunking, embedding, indexing, and summary behavior.

**Non-Goals:**

- Transcoding, frame extraction, duration probing, streaming upload, or a new worker/service.
- Supporting containers that OpenRouter does not document.

## Decisions

- Extend the existing remote VLM adapter with an optional video prediction contract. Decorators forward it, so concurrency and tracing remain on the native model path. Other VLM implementations remain unchanged.
- Send private stored bytes as a base64 data URL to the existing `/chat/completions` endpoint. This is OpenRouter's documented local-file contract and avoids public object URLs.
- Bypass DocReader only for the video-to-Markdown conversion. The returned `ReadResult` immediately rejoins the existing document pipeline.
- Pin the built-in OpenRouter VLM to `google/gemini-2.5-flash` and reject video conversion if a different model/provider is selected.

## Risks / Trade-offs

- [Base64 increases request memory] -> Retain the existing global upload limit and make one bounded request; do not add buffering services.
- [Long videos may exceed provider/output limits] -> Surface the provider failure through the existing retry/failed status path.
- [Unsupported containers are selected] -> Whitelist only MP4, MPEG, MOV, and WebM in both browser and server validation.
