import assert from "node:assert/strict";
import test from "node:test";

import {
  GRAPH_SHOWCASE_STAGES,
  GRAPH_SHOWCASE_MOTION,
  deriveGraphFocus,
  graphShowcaseCameraScale,
  graphShowcaseGrowthCameraScale,
  graphShowcaseLabelAlpha,
  graphShowcasePauseMs,
  graphShowcaseSnapshot,
  obsidianNodeUnlockCosts,
  obsidianProgressionItemTotal,
  obsidianGraphGrowthSpeed,
  resolveGraphShowcaseNode,
  resolveGraphShowcaseStage,
} from "../src/components/graphShowcaseMotion.js";
import { createLittlePrinceGraph } from "../src/data/littlePrinceGraph.js";

const TOTAL_NODES = 360;
const TOTAL_LINKS = 14_400;

const FIXTURE_NODES = [
  { slug: "summary:book", title: "《小王子》：全书阅读图谱" },
  { slug: "chapter:01", title: "第1章：大人看不懂的画" },
  { slug: "theme:friendship", title: "友谊" },
  { slug: "symbol:rose", title: "玫瑰" },
  { slug: "place:desert", title: "沙漠" },
];
const FIXTURE_EDGES = [
  { source: "summary:book", target: "chapter:01" },
  { source: "summary:book", target: "theme:friendship" },
  { source: "chapter:01", target: "symbol:rose" },
];

test("showcase stages are ordered from slow growth through a terminal drawer", () => {
  assert.deepEqual(GRAPH_SHOWCASE_STAGES, ["seed", "grow", "focus", "hover", "drawer"]);
  assert.equal(GRAPH_SHOWCASE_MOTION.stopAt, "drawer");
  assert.ok(GRAPH_SHOWCASE_MOTION.seedDurationMs > GRAPH_SHOWCASE_MOTION.focusDurationMs);
  assert.ok(GRAPH_SHOWCASE_MOTION.growthThreshold > 0);
  assert.ok(GRAPH_SHOWCASE_MOTION.growthThreshold < 1);
  assert.ok(GRAPH_SHOWCASE_MOTION.seedDurationMs >= 5_000);
  assert.ok(GRAPH_SHOWCASE_MOTION.seedDurationMs + GRAPH_SHOWCASE_MOTION.growthDurationMs >= 20_000);
  assert.ok(GRAPH_SHOWCASE_MOTION.seedDurationMs + GRAPH_SHOWCASE_MOTION.growthDurationMs <= 22_000);
});

test("the growth speed keeps Obsidian's sqrt(link-count) baseline and accelerates after the seed", () => {
  assert.equal(obsidianGraphGrowthSpeed(TOTAL_LINKS), 60);
  const slow = graphShowcaseSnapshot(250, {
    totalNodes: TOTAL_NODES,
    totalLinks: TOTAL_LINKS,
    visibleNodes: 3,
  });
  const later = graphShowcaseSnapshot(5_900, {
    totalNodes: TOTAL_NODES,
    totalLinks: TOTAL_LINKS,
    visibleNodes: 124,
  });
  assert.ok(slow.visibleNodes >= 1);
  assert.ok(later.visibleNodes > slow.visibleNodes);
  assert.ok(later.growthSpeed > slow.growthSpeed);
  assert.ok(later.growthSpeed <= obsidianGraphGrowthSpeed(TOTAL_LINKS));
});

test("camera pulls back during growth, fades labels to zero, then punches in", () => {
  const seed = graphShowcaseSnapshot(400, {
    totalNodes: TOTAL_NODES,
    totalLinks: TOTAL_LINKS,
    visibleNodes: 4,
  });
  const growth = graphShowcaseSnapshot(6_500, {
    totalNodes: TOTAL_NODES,
    totalLinks: TOTAL_LINKS,
    visibleNodes: 146,
  });
  const focused = graphShowcaseSnapshot(
    GRAPH_SHOWCASE_MOTION.seedDurationMs
      + GRAPH_SHOWCASE_MOTION.growthDurationMs
      + GRAPH_SHOWCASE_MOTION.focusDurationMs
      + 10,
    { totalNodes: TOTAL_NODES, totalLinks: TOTAL_LINKS },
  );
  assert.equal(seed.stage, "seed");
  assert.equal(growth.stage, "grow");
  assert.ok(growth.cameraScale < seed.cameraScale);
  assert.ok(growth.labelAlpha < seed.labelAlpha);
  assert.equal(focused.labelAlpha, 0);
  assert.ok(focused.cameraScale > growth.cameraScale);
  assert.equal(focused.labelsVisible, false);
  assert.equal(graphShowcaseLabelAlpha(TOTAL_NODES, TOTAL_NODES), 0);
  assert.ok(graphShowcaseCameraScale("grow", 0.7) < graphShowcaseCameraScale("seed", 0.05));
  assert.equal(graphShowcaseGrowthCameraScale(1, 337), 0.55);
  assert.equal(graphShowcaseGrowthCameraScale(28, 337), 0.55);
  assert.ok(graphShowcaseGrowthCameraScale(65, 337) < 0.5);
  assert.ok(graphShowcaseGrowthCameraScale(337, 337) <= 0.25);
});

test("native progression budgets node plus outgoing-link items and preserves the slow seed cadence", () => {
  const graph = createLittlePrinceGraph("en");
  const costs = obsidianNodeUnlockCosts(graph.nodes, graph.edges);
  assert.equal(obsidianProgressionItemTotal(graph.nodes, graph.edges), 1_125);
  assert.equal(costs.length, graph.nodes.length);
  assert.equal(costs[0], 28, "summary:book has one node item plus 27 outgoing links");
  assert.ok(costs.slice(1, 28).some(cost => cost > 1), "the early chapter frontier keeps a heavier cadence");
  assert.ok(costs.some((cost, index) => index > 28 && cost === 1), "later leaf nodes use the short cadence");

  const seedPause = graphShowcasePauseMs(0, costs, obsidianGraphGrowthSpeed(graph.edges.length), {
    timeCompression: 2,
  });
  const leafIndex = costs.findIndex((cost, index) => index > 28 && cost === 1);
  const leafPause = graphShowcasePauseMs(leafIndex, costs, obsidianGraphGrowthSpeed(graph.edges.length), {
    timeCompression: 2,
  });
  assert.ok(seedPause > leafPause * 20, "the 28-item seed should remain visibly slower than a leaf");
  assert.equal(graphShowcasePauseMs(0, costs, 0), 0);
  assert.equal(graphShowcasePauseMs(0, costs, 16, { timeCompression: 0 }), 0);
});

test("terminal hover uses a deterministic node and dims non-neighbors", () => {
  const anchor = resolveGraphShowcaseNode(FIXTURE_NODES);
  assert.equal(anchor, "summary:book");
  const focus = deriveGraphFocus(FIXTURE_NODES, FIXTURE_EDGES, anchor);
  assert.deepEqual(focus.relatedSlugs, ["summary:book", "chapter:01", "theme:friendship"]);
  assert.deepEqual(focus.dimmedSlugs, ["symbol:rose", "place:desert"]);

  const hovered = graphShowcaseSnapshot(30_000, {
    totalNodes: FIXTURE_NODES.length,
    totalLinks: FIXTURE_EDGES.length,
    visibleNodes: FIXTURE_NODES.length,
    nodes: FIXTURE_NODES,
    edges: FIXTURE_EDGES,
  });
  assert.equal(hovered.stage, "drawer");
  assert.equal(hovered.hoveredSlug, anchor);
  assert.equal(hovered.selectedSlug, anchor);
  assert.equal(hovered.drawerVisible, true);
  assert.equal(hovered.stopped, true);
  assert.deepEqual(hovered.relatedSlugs, focus.relatedSlugs);
  assert.deepEqual(hovered.dimmedSlugs, focus.dimmedSlugs);
});

test("stage and focus helpers are deterministic and tolerant of empty input", () => {
  assert.equal(resolveGraphShowcaseStage(-1), "seed");
  assert.equal(resolveGraphShowcaseStage(Number.POSITIVE_INFINITY), "drawer");
  assert.equal(resolveGraphShowcaseNode([]), null);
  assert.deepEqual(deriveGraphFocus([], [], null), {
    hoveredSlug: null,
    relatedSlugs: [],
    dimmedSlugs: [],
  });
  const invalid = graphShowcaseSnapshot(100, { totalNodes: 0, totalLinks: 0 });
  assert.equal(invalid.visibleNodes, 0);
  assert.equal(invalid.hoveredSlug, null);
  assert.equal(invalid.drawerVisible, false);
});
