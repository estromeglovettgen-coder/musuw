## 1. Native Model Controls

- [x] 1.1 Expose the existing Models settings section and its capability tabs/debugger.
- [x] 1.2 Restore the existing chat model selector with last-choice and default fallback behavior.
- [x] 1.3 Persist one default model per tenant and model type through the existing model API.

## 2. Verified Built-ins

- [x] 2.1 Route the managed DeepSeek modes through OpenRouter and add only region-tested chat choices.
- [x] 2.2 Configure the verified embedding, rerank, vision, and ASR presets without changing knowledge-base bindings.

## 3. Verification and Release

- [x] 3.1 Pass focused frontend, backend, static production, and OpenSpec checks.
- [x] 3.2 Verify the local browser build starts, then verify authenticated settings and model selection online.
- [x] 3.3 Commit and push the task version, wait for CI/deploy, then run bounded online model and browser acceptance checks.
