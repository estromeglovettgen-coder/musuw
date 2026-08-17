## Why

WeKnora already contains model management and chat model selection, but Musuw currently hides those entry points and limits chat to two managed DeepSeek choices. Users need the native controls restored with a small catalog that is verified from the production region.

## What Changes

- Expose the existing Models section beside General settings.
- Restore the existing chat model dropdown while preserving the V4 Flash/Pro mode switch.
- Let tenant administrators mark one model per type as the default.
- Route the existing DeepSeek choices through OpenRouter and add a small set of region-tested chat models.
- Retain the existing production-proven embedding, rerank, vision, and speech presets.

## Capabilities

### New Capabilities

- `native-multi-model-selection`: native model configuration, defaults, and conversation selection for Musuw.

### Modified Capabilities

None.

## Impact

The existing WeKnora model API, settings views, conversation input, and built-in model YAML are affected. No new service, provider adapter, or model abstraction is introduced.
