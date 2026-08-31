## ADDED Requirements

### Requirement: Original WeKnora UI and behavior contract
The system SHALL keep the original graph page's controls, order, position, labels, data actions, and navigation behavior. The only new page control SHALL be a compact visual-settings entry.

#### Scenario: User opens the graph page
- **WHEN** the graph view becomes ready
- **THEN** search, help, the five page-type filters, fit, arrows, frontier growth, overview return, status, and the right-side page drawer SHALL remain in their original positions
- **AND** no renderer or style selector SHALL replace or hide those controls

#### Scenario: User activates a node
- **WHEN** the user clicks, double-clicks, Shift-clicks, searches for, or follows a link to a graph node
- **THEN** the existing selection, drawer, ego, bloom, focus, and source-content flows SHALL run unchanged

### Requirement: Exact graph physics behind the renderer seam
The graph SHALL use the versioned local Obsidian graph Worker through the existing renderer boundary. The Worker and Pixi adapter SHALL own physics, pixels, hit testing, and camera movement; WikiBrowser SHALL continue to own product behavior.

#### Scenario: Drag and release a node
- **WHEN** the user drags a node
- **THEN** that node SHALL follow the pointer while the simulation reheats
- **AND** connected nodes SHALL visibly respond to the force update
- **AND** releasing the node SHALL clear its fixed coordinates and allow the graph to settle

#### Scenario: Renderer lifecycle ends
- **WHEN** the user leaves the graph view or the component unmounts
- **THEN** its Worker, Pixi application, observers, animation frame, and canvas SHALL be released

### Requirement: Compact visual settings
The graph SHALL expose node size, label fade, line thickness, center force, repel force, link force, link distance, restart, reset, section collapse, and panel close controls without duplicating WeKnora business controls.

#### Scenario: User changes a visual value
- **WHEN** a display or force slider changes
- **THEN** the active renderer or Worker SHALL update without refetching or filtering graph data
- **AND** the current node identity, selection, camera, and page drawer SHALL remain intact

#### Scenario: User revisits a knowledge base
- **WHEN** saved graph settings exist for that knowledge base
- **THEN** every persisted visual value, collapse state, close state, and scale SHALL be restored
- **AND** another knowledge base's values SHALL NOT be applied

### Requirement: WeKnora theme and category colors
The visual renderer SHALL follow the active WeKnora light/dark theme while preserving the original category palette.

#### Scenario: Theme changes while the graph is open
- **WHEN** WeKnora changes `theme-mode`
- **THEN** the canvas background, lines, labels, active outlines, and settings UI SHALL update from WeKnora CSS variables without a graph reload

#### Scenario: Nodes render in either theme
- **WHEN** summary, entity, concept, synthesis, comparison, index, or unknown nodes are drawn
- **THEN** their fill colors SHALL remain `#0052d9`, `#2ba471`, `#e37318`, `#0594fa`, `#d54941`, and `#8c8c8c` respectively
- **AND** hover or selection SHALL use outlines and dimming rather than replacing the category fill

### Requirement: Original canvas affordances
The visual adapter SHALL retain the original graph's relationship and exploration cues.

#### Scenario: A node has unloaded neighbors
- **WHEN** its total link count exceeds its rendered neighbors and it is not the ego center
- **THEN** the graph SHALL show a dashed expansion ring
- **AND** an eligible node in ego mode SHALL expose the hover bloom action

#### Scenario: A relation is bidirectional
- **WHEN** both directed edges exist and arrows are enabled
- **THEN** the relation SHALL display arrows in both directions

### Requirement: Unchanged graph data and API contract
The visual integration SHALL pass the original graph response directly to the renderer and SHALL retain the existing overview and ego request bounds.

#### Scenario: Overview loads
- **WHEN** WikiBrowser requests an overview
- **THEN** it SHALL use the original `GRAPH_OVERVIEW_LIMIT`
- **AND** the renderer SHALL NOT prune nodes, recolor them through visual groups, or cause an additional graph request

#### Scenario: Backend receives an explicit limit
- **WHEN** a graph request exceeds the existing hard maximum
- **THEN** the backend SHALL retain its original 2,000-node clamp
