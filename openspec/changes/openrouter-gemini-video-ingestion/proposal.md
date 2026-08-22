## Why

Musuw accepts images and audio but rejects video before the existing ingestion pipeline can produce searchable text. OpenRouter exposes native video input for approved Qwen and Gemini endpoints, so the missing path can be added without frame extraction or FFmpeg in production. Production uses Qwen 3.7 Flash because the Hong Kong runtime cannot reach Gemini reliably.

## What Changes

- Accept OpenRouter's documented MP4, MPEG, MOV, and WebM upload formats.
- Send the stored private video once to the built-in `qwen/qwen3.7-flash` VLM as a base64 `video_url` and turn the response into Markdown.
- Feed that Markdown through the existing WeKnora chunking, embedding, indexing, status, and summary path.
- Keep unsupported video containers rejected and add no transcoder, new worker type, or new storage format.

## Capabilities

### New Capabilities

- `video-knowledge-ingestion`: Upload and index a supported video through an approved native-video OpenRouter model while reusing the native document pipeline.

## Impact

- Affects the upload whitelist, knowledge import validation, document conversion service, built-in OpenRouter VLM, and existing OpenAI-compatible VLM adapter.
- Adds no external dependency or public route.
