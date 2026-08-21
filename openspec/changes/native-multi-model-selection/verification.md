# Verification Report: native-multi-model-selection

Verified locally on 2026-08-19 against the combined integration commit containing this report. The implementation reuses WeKnora's model catalog, factories, list/detail APIs, conversation picker, knowledge-base bindings, and request-scoped agent pipeline; it adds no consumer model service or provider abstraction.

- Free browser/API acceptance exposed exactly the server-approved DeepSeek V4 Flash chat model plus the four fixed ingestion capability models.
- Temporary Plus acceptance exposed the eleven approved chat choices (DeepSeek 2, Qwen 1, GPT 3, Gemini 2, and Claude 3) and still showed no add/configure action.
- The selected chat model was persisted by the native picker, carried into the session request, used by the fixed full-capability agent and title generation, and remained subject to server-side plan validation.
- Consumer deep links to `section=models` returned to General. Model create/update/debug/provider/credential surfaces and both initialization write routes were unavailable; custom, non-built-in, and non-OpenRouter models are rejected in service resolution.
- Active knowledge bases reference the stable platform embedding, rerank, VLM, ASR, and Qwen IDs. Legacy custom model rows are not runtime dependencies and are invisible to consumers.
- Frontend 508/508 tests, type-check, production build, focused backend suites, and full Go-package compilation passed.

The earlier production-region bounded model calls establish historical provider reachability. A fresh provider call was intentionally not repeated because the management key is not configured and the user asked to ignore the two plan-document keys. CI, push, and deployment are deferred by explicit instruction.
