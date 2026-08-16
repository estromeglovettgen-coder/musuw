## 1. Reuse and harden platform defaults

- [x] 1.1 Verify existing document knowledge-base defaults against the active
  built-in model rows before persistence, with a focused unavailable-catalog
  regression test.
- [x] 1.2 Retain the existing default/backfill migration and remove standard
  user navigation that treats incomplete legacy data as a reason to expose
  settings.

## 2. Wire the two existing chat modes

- [x] 2.1 Update the existing built-in-agent YAML so Quick is V4 Flash and Pro
  is V4 Pro with the complete existing in-tenant tool set.
- [x] 2.2 Make platform Quick/Pro model resolution authoritative on the server
  and cover attempted client model overrides.
- [x] 2.3 Reuse the existing input-mode selector to expose only V4 Flash and
  V4 Pro, derive its model from the selected built-in agent, keep Pro thinking
  available, and preserve the selected Pro mode across reload.

## 3. Remove configuration exposure and release mismatch

- [x] 3.1 Remove standard knowledge-base settings and uninitialized-model
  entrances while retaining create/upload/content actions.
- [x] 3.2 Add the smallest release checks that prevent a UI-only catalog/model
  mismatch, plus focused source/simulation coverage.

## 4. Verify and deliver

- [x] 4.1 Run focused Go and frontend tests, build checks, and strict OpenSpec
  validation.
- [ ] 4.2 After production capacity is restored, run one full release and
  browser-test create, upload, retrieval, Flash, Pro, deep thinking, and
  tool-capability flows; remove intentional preset test knowledge bases only
  as part of that acceptance run.
