## 1. Product Boundary Contracts

- [x] 1.1 Add failing Lite server tests for document-only KB creation, executable capability routes, crafted Skill/Sandbox chat inputs, deferred providers/connectors, and memory policy routes.
- [x] 1.2 Deepen the existing Lite product gate and capability response until the boundary tests pass without changing Standard behavior.
- [x] 1.3 Add a read-only FAQ-row audit path/check for existing and empty databases without destructive migration.

## 2. Knowledge Experience

- [x] 2.1 Add frontend contract tests for Basic/Advanced-only Lite navigation, forced document type, deep-link fallback, and hidden technical controls.
- [x] 2.2 Implement the Musuw Basic/Advanced knowledge editor and preserve existing Standard editor behavior.
- [x] 2.3 Hide the automatic-tag model selector in Lite and enforce DeepSeek V4 Flash, three matches, and manual-tag preservation through the server-owned configuration.
- [x] 2.4 Keep AnyDoc automatic and remove XMind, GitLab, and Tencent IMA discovery/invocation from the Lite product surface.

## 3. Memory, Chat, Agent, and Settings Experience

- [x] 3.1 Add Lite navigation/access tests for personal memory, admin workspace memory, role denial, complete Advanced visibility, and full configuration persistence.
- [x] 3.2 Implement Musuw-styled personal/workspace memory pages with common controls direct and all remaining settings in one Advanced disclosure.
- [x] 3.3 Remove Sandbox, Skill, environment-variable, shell, sandbox-file, and generated-artifact discovery/configuration/invocation from Lite frontend state and agent/chat surfaces.
- [x] 3.4 Retain low-cost main chat/document improvements and current intentional Musuw Agent/MCP behavior.
- [x] 3.5 Remove deferred search/integration/password UI while retaining current Musuw login, plans, quotas, R2, graph, and operations behavior.

## 4. Automated Verification

- [x] 4.1 Run focused backend route, knowledge, memory, auto-tag, and empty/existing database tests.
- [x] 4.2 Run focused frontend product-gate, settings, KB editor, memory, agent, chat, i18n, and visual-contract tests.
- [x] 4.3 Run full Go tests, frontend tests, type-check, lint where configured, and production builds.

## 5. Review and Real-User Acceptance

- [x] 5.1 Perform one consolidated adversarial review, record findings before edits, then fix only reproduced/current blockers in one bounded corrective delta.
- [x] 5.2 Start the exact reviewed build with a real Lite ordinary-user fixture and audit database state/configuration.
- [x] 5.3 Exercise all included capabilities and excluded deep links in the browser, inspect desktop/narrow and light/dark UI, and classify each review finding by actual reproducibility.
- [x] 5.4 Record the original findings, corrective decisions, remaining observations, and browser evidence; commit the implementation on the upgrade branch.
