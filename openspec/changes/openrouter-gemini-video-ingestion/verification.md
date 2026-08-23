# Verification evidence

## 2026-08-23 Tokyo default-route contract repair

- The consumer video path resolves `types.PlatformKnowledgeBaseVLMModelID`
  (`builtin-openrouter-vlm`) without a per-upload override. Its catalog contract
  now pins the exact model `google/gemini-2.5-flash`, matching display and
  description metadata, while the remote video transport pins its provider to
  `google-vertex`.
- The paid chat catalog row `builtin-openrouter-gemini-flash` intentionally
  remains the separate Gemini 3.7 chat choice; it is not the default video
  model and was not changed by this repair.
- The focused catalog contract was red against the previous Qwen VLLM row and
  green after the Gemini mapping was restored. Remote VLM video routing and
  process-configuration tests also pass.
- A real Tokyo production upload without an override is still required before
  marking the regional video and reviewer lifecycle gates complete.

## 2026-08-22 Hong Kong regional fallback (historical)

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

## 2026-08-23 final approved-route gate

- Two bounded Qwen native-video smokes (the reviewer fixture and a 1.5-second
  English MP4) reached the provider's HTTP 402 classification. The observed
  wallet and tenant allowance were not exhausted; no credit purchase, retry
  loop, alternate service, fake event, or manual entitlement mutation was
  used.
- Direct probes of the approved Gemini video routes returned HTTP 403 from
  temporary provider-management credentials. This is not treated as
  canonical consumer-path evidence.
- The canonical TEST consumer path was then exercised once with a fresh
  official OIDC session, a temporary English knowledge base, and the
  per-upload `builtin-openrouter-gemini-flash` override. Upload returned HTTP
  200, but polling reached `processing` and then the normalized
  `provider_error` failure at about two minutes; at that release the override
  row was incorrectly bound to Gemini 3.7, so this run is not evidence for
  Gemini 2.5 and no retrieval success is claimed.
- The documented Japan transport/SSH target was unavailable, so no DNS,
  server, or new provider path was added. All temporary knowledge bases,
  documents, and conversations from these checks were removed through the
  authenticated product capability.

Tasks 4.3, 5.4, and 5.6 remain unchecked until an approved route completes
video parsing, indexing, retrieval, and evidence without changing the
no-recharge/no-new-service boundary.

## 2026-08-23 TEST reviewer gate

- A fresh English H.264/AAC MP4 was uploaded through the real TEST Max browser
  flow. The document reached the terminal `DOCREADER_PARSE_FAILED` state after
  the supported reparse/recovery path was exercised once.
- The first non-wrapper failure was the existing OpenRouter transport's HTTP
  402 credit-exhaustion classification on the native-video request. The root
  OpenRouter wallet and the tenant Max allowance were both available; no
  recharge, provider change, fake event, SQL edit, or repeated reparse was
  performed.
- At the time of this run Qwen 3.7 Flash was the configured OpenRouter/Alibaba
  fallback and its catalog metadata advertised video input. The result is
  historical external-provider evidence, not current Tokyo default-route
  evidence.
- The video item, TEST reviewer knowledge base, and temporary conversations
  were removed through the product capability after evidence capture. Task
  4.3 remains unchecked and the video portion of the reviewer lifecycle stays
  an explicit residual risk until a supported provider route succeeds.
