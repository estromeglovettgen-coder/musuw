# Verification evidence

## 2026-08-22 regional fallback

- OpenRouter's live model catalog reports `qwen/qwen3.7-flash` with native
  `text`, `image`, and `video` input modalities.
- OpenRouter's live endpoint catalog reports an Alibaba endpoint for that exact
  model. The application therefore keeps its existing OpenRouter transport and
  tenant-credit metering while routing Qwen to provider tag `alibaba`.
- The exact Gemini 2.5 Flash to `google-vertex` route remains allowlisted for a
  later Japan-host recheck; it is not the active built-in VLM in this release.
- Focused VLM, built-in catalog, and video-ingestion Go tests passed after the
  Qwen switch.
- A real 46,009-byte, three-second MP4 completed the TEST browser lifecycle:
  native upload, Qwen video summary, indexing, retrieval, exact answer
  `CODE COBALT 7319`, and product-UI knowledge-base cleanup.

Official evidence:

- <https://openrouter.ai/api/v1/models>
- <https://openrouter.ai/api/v1/models/qwen/qwen3.7-flash/endpoints>
- <https://openrouter.ai/docs/guides/overview/multimodal/videos>
- <https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions>

Production paid-term and post-deploy evidence remains tracked by task 4.3.

## 2026-08-23 TEST reviewer gate

- A fresh English H.264/AAC MP4 was uploaded through the real TEST Max browser
  flow. The document reached the terminal `DOCREADER_PARSE_FAILED` state after
  the supported reparse/recovery path was exercised once.
- The first non-wrapper failure was the existing OpenRouter transport's HTTP
  402 credit-exhaustion classification on the native-video request. The root
  OpenRouter wallet and the tenant Max allowance were both available; no
  recharge, provider change, fake event, SQL edit, or repeated reparse was
  performed.
- Qwen 3.7 Flash remains the configured OpenRouter/Alibaba fallback and its
  catalog metadata advertises video input. The failure is therefore recorded
  as an external provider/model gate, not as successful video ingestion.
- The video item, TEST reviewer knowledge base, and temporary conversations
  were removed through the product capability after evidence capture. Task
  4.3 remains unchecked and the video portion of the reviewer lifecycle stays
  an explicit residual risk until a supported provider route succeeds.
