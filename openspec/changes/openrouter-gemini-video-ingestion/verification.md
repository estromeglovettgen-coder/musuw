# Verification evidence

## 2026-08-23 typed credit propagation repair

- A deterministic red-first worker-boundary test used the real
  `ProcessDocument` video path and existing OpenRouter credit middleware. The
  typed credit error reached video failure persistence, then became a plain
  formatted error; `errors.As` failed and the middleware could not return
  `SkipRetry`.
- Video failure wrapping now uses `%w`, while `failKnowledge` uses the same
  formatted error for both its persisted message and returned cause. The test
  is green for the typed cause and `errors.Is(asynq.SkipRetry)` and confirms the
  existing failed row, credit message, OpenRouter root code, and
  `DOCREADER_PARSE_FAILED` document-stage code remain stable.
- Focused and complete router, OpenRouter transport, VLM native-video, and
  complete application service tests pass locally without contacting
  OpenRouter. The server build, strict validation of all configured OpenSpec
  changes, and diff whitespace check also pass.

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
- At that contract snapshot, a real Tokyo production upload without an override
  was still required before marking the regional video and reviewer lifecycle
  gates complete; the current smoke is recorded below.

## Historical 2026-08-23 initial Production no-override failure boundary

- The active reviewer tenant was on the server-authorized Production Paddle
  Sandbox Pro path. Paddle Live remained unauthorized and was not used.
- One English fictional MP4 was uploaded once to the bound reviewer knowledge
  base with no per-upload model override. The process-override relation was
  empty, and the default `builtin-openrouter-vlm` resolved to
  `google/gemini-2.5-flash` through the OpenRouter `google-vertex` route.
- The document ended in `DOCREADER_PARSE_FAILED` with inner
  `openrouter_credits_exhausted`. Four automatic worker attempts processed the
  same upload. The parent balance was positive but below the provider's required
  funding boundary, while the child limit and remaining allowance were positive
  and within the configured plan; activity exposed no failure reason.
- This was a provider-credit failure, not a successful video lifecycle. Tasks
  4.2 and 4.3 were left unchecked at that boundary. The later recovery below
  resolves the provider failure without replacing or uploading the source
  again.

## 2026-08-23 Production recovery through the default route

- The OpenRouter parent account later satisfied the provider's required funding
  boundary. The existing `aurora-observation-briefing.mp4` was not uploaded
  again; the product's Retry parsing/Reparse action was invoked exactly once on
  that same failed item, and its `process_overrides` relation remained empty.
- The historical first processing lineage retained four root attempts. The
  recovery created exactly one new root task, and the worker reported retry
  count zero for that task.
- The provider request used the deployed default `builtin-openrouter-vlm` →
  `google/gemini-2.5-flash` mapping through OpenRouter's `google-vertex` route,
  with no override. It returned HTTP 2xx and non-empty Markdown.
- Final state was `parse=completed`, `summary=completed`, and `pending=0`.
  DocReader, chunking, embedding, and post-processing were each `done`;
  multimodal processing was `skipped` because this video conversion produced no
  image subtask, which is the expected path. Chunks, the searchable index, and
  the summary were all materialized.
- In the knowledge-base-bound chat, the real fixture question returned `after
  the second horizon scan`. Its citation control opened successfully and showed
  the complete MP4 as the source.
- Task 4.2 is complete because both its focused catalog checks and its real
  bounded default-path Gemini request are now proven. Task 4.3 remains unchecked
  because its exact wording also requires cleanup: the MP4 and its reviewer chat
  are intentionally retained for Paddle review rather than deleted.

## Historical 2026-08-22 Hong Kong regional fallback

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

At that historical point, Production paid-term and post-deploy evidence was
still tracked by task 4.3.

## Historical 2026-08-23 final approved-route gate

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

At this historical boundary, tasks 4.3, 5.4, and 5.6 were left unchecked. The
current default-route recovery above supersedes the provider blocker without
changing the no-new-service boundary.

## Historical 2026-08-23 TEST reviewer gate

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
  were removed through the product capability after evidence capture. This was
  a historical residual risk; the later Production default-route recovery above
  resolved the provider-path failure.
