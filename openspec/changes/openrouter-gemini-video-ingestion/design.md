## Context

The active v0.7.2 fork rejects video. OpenRouter accepts private videos directly as base64 `video_url` content, while Musuw already has an OpenRouter-backed VLM and a text-to-chunk ingestion pipeline.

## Goals / Non-Goals

**Goals:**

- Convert a supported stored video into searchable Markdown with the platform's approved native-video VLM.
- Reuse existing upload storage, status, chunking, embedding, indexing, and summary behavior.

**Non-Goals:**

- Transcoding, frame extraction, duration probing, streaming upload, or a new worker/service.
- Supporting containers that OpenRouter does not document.

## Decisions

- Extend the existing remote VLM adapter with an optional video prediction contract; existing decorators forward it.
- Send stored bytes as a base64 data URL to the existing `/chat/completions` endpoint.
- Bypass DocReader only for video-to-Markdown conversion, then immediately rejoin the existing document pipeline.
- Pin the default `builtin-openrouter-vlm` to `google/gemini-2.5-flash` and use
  OpenRouter's `google-vertex` provider route on the Tokyo runtime. The earlier
  Hong Kong Qwen fallback remains historical evidence only; do not add a second
  transport, credential, media path, or automatic cross-model retry.

## Risks / Trade-offs

- Base64 increases request memory; the existing upload limit bounds the one-shot request.
- Provider failures use the existing retry and failed-status path; the model is
  never silently changed inside one document task.
- Only MP4, MPEG, MOV, and WebM are admitted in browser and server validation.
