# Verification

Verified 2026-08-16 against release `bf1a4af34509025a64bf40b40dba8fb2a397ee12`.

- Local: the frontend dev build loaded; the configured Google OAuth callback intentionally returned to `app.musuw.com`, so authenticated browser acceptance ran against the deployed release.
- Checks: 383 frontend tests, frontend type-check/build, focused default-model tests, full Go CI, release contracts, and strict OpenSpec validation passed.
- GitHub: CI run `31986752985`, storefront run `31986988847`, and production run `31986988823` completed successfully.
- Production settings: 11 models were visible across Chat, Embedding, ReRank, Vision, and Speech; the expected default tags and OpenRouter provider labels were present.
- Production model test: `deepseek/deepseek-v4-flash` returned `OK` in 1.887 seconds using 34 total tokens.
- Production chat: the picker exposed all seven chat models; selecting `qwen/qwen3.7-flash` remained selected after a full page reload.
- Health: `musuw.com`, `www.musuw.com`, and `app.musuw.com/health` returned HTTP 200.
