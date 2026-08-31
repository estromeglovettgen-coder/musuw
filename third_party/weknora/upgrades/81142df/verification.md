# Upgrade verification record

This record separates inherited-worktree evidence from post-upgrade evidence so
pre-existing failures are not misclassified as vendor-update regressions.

## Pre-upgrade baseline

Source state: prefixed current-worktree audit tree
`fb468c34a8ed49142aee7f1aeaa0e81db2daa561`, before importing official target
`81142dfd17b2778087e95d3a317483a2fd909b91`.

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Upgrade contract red phase | Expected failure | `npm run upgrade:contract`: 3/3 tests failed for the intended reasons: provenance still v0.7.2, appended migrations absent, and representative target modules absent. |
| Go route and Wiki handler focus | Pass | `cd weknora && go test ./internal/router ./internal/handler`; both packages passed, including inherited Lite gate and untracked Wiki graph handler tests. |
| Auth shell | Pass | `cd auth && npm test`; 6 files and 100 tests passed. |
| Workspace router + Obsidian graph focus | Pass | `cd weknora/frontend && npm test -- src/router/index.test.mjs src/views/knowledge/wiki/graph/*.test.ts`; 41 tests passed. |
| Storefront production build | Pass with size warning | Vite built the inherited storefront successfully. |
| Storefront tests | Pre-existing failure | 62 tests passed; `tests/responsiveLayout.test.js` failed because its required `max-width: 1080px` media block is absent from the inherited CSS. `tests/storefrontStructure.test.js` then retained a pending promise and the run was interrupted after 104 seconds. This state predates the kernel import and must be repaired before final acceptance. |
| Dependency installation | Completed | `npm ci` completed in `auth/`, `storefront/`, and `weknora/frontend/`. npm reported no auth vulnerabilities, four storefront advisories, and eight workspace-frontend advisories; dependency reconciliation and final audit remain pending. |

## Post-upgrade verification

Pending implementation. Each final command, result, environment limitation, and
residual risk will be appended here before the branch is declared complete.
