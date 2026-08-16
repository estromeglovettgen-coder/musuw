## 1. Visual authority and shared system

- [ ] 1.1 Audit the archived Musuw source and record the real visual token and composition authority.
- [ ] 1.2 Implement shared Musuw typography, theme tokens, controls, focus states, and responsive layout primitives in the active frontend.
- [ ] 1.3 Recompose the application shell and simplified consumer navigation without changing routes or handlers.

## 2. Core consumer surfaces

- [ ] 2.1 Recompose chat and source/citation presentation using the Musuw research-content hierarchy.
- [ ] 2.2 Recompose knowledge-base list, detail, and creation presentation without changing data or action contracts.
- [ ] 2.3 Exclude the knowledge graph from the migration and remove any graph-specific visual overrides introduced by this change.
- [ ] 2.4 Remove visible upstream brand residue and unused visual chrome from consumer routes.

## 3. Fast local and release workflow

- [ ] 3.1 Validate and document host-mode Go/Vite development with dependency services independently controlled.
- [ ] 3.2 Verify the release command builds and publishes only the required production artifacts with rollback retained.

## 4. Verification and release

- [ ] 4.1 Run focused frontend tests, type checks, production builds, and visual regression checks for changed surfaces.
- [ ] 4.2 Exercise the local application in a browser as a consumer across login, chat, knowledge-base, settings, and logout flows; confirm the graph remains unchanged.
- [ ] 4.3 Run deployment preflight, publish the verified release, and verify the production consumer journey in a browser.
