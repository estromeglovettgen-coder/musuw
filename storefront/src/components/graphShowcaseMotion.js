/**
 * Pure timing and focus contract for the storefront's Obsidian graph story.
 *
 * The actual Pixi renderer still owns pixels, force simulation, and pointer
 * handling.  This module only turns the renderer's playback snapshot plus a
 * clock into stable camera/label/focus parameters.  Keeping the story here
 * makes the marketing sequence deterministic while retaining Obsidian's
 * progression speed baseline (`0.5 * sqrt(edgeCount)`, clamped to 5-100).
 */

export const GRAPH_SHOWCASE_STAGES = Object.freeze([
  "seed",
  "grow",
  "focus",
  "hover",
  "drawer",
]);

export const GRAPH_SHOWCASE_MOTION = Object.freeze({
  // A small readable seed remains on screen before the graph starts filling in.
  // Keep roughly the first fifth of nodes on screen for at least three
  // seconds; the remaining growth then takes the sequence to about ten
  // seconds before the camera focus/hover beat begins.
  seedDurationMs: 5_500,
  growthDurationMs: 15_500,
  settleDurationMs: 720,
  focusDurationMs: 820,
  // Leave the directed neighborhood on screen long enough for the native
  // renderer's 420ms fit plus camera easing to settle before the simulated
  // click opens the detail surface. A one-second beat could advance while
  // the graph was still zooming, producing a tiny transient cluster.
  hoverDurationMs: 2_000,
  seedNodeCount: 28,
  accelerationNodeCount: 65,
  growthThreshold: 28 / 337,
  labelFadeStart: 65 / 337,
  labelFadeEnd: 1,
  initialCameraScale: 0.55,
  midpointCameraScale: 0.45,
  pulledBackCameraScale: 0.24,
  focusCameraScale: 0.68,
  hoverCameraScale: 0.72,
  initialGrowthSpeed: 8,
  maxGrowthSpeed: 100,
  relatedOpacity: 1,
  dimmedOpacity: 0.16,
  stopAt: "drawer",
});

const EPSILON = 1e-6;

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * clamp(amount, 0, 1);
}

function easeOut(value, power = 2) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), Math.max(1, power));
}

function normalizedCount(value, fallback = 0) {
  const candidate = Math.floor(finite(value, fallback));
  return Math.max(0, candidate);
}

function timingOptions(options = {}) {
  const custom = options?.motion && typeof options.motion === "object"
    ? options.motion
    : options;
  const value = (key) => finite(custom?.[key], GRAPH_SHOWCASE_MOTION[key]);
  return {
    ...GRAPH_SHOWCASE_MOTION,
    seedDurationMs: Math.max(0, value("seedDurationMs")),
    growthDurationMs: Math.max(0, value("growthDurationMs")),
    focusDurationMs: Math.max(0, value("focusDurationMs")),
    hoverDurationMs: Math.max(0, value("hoverDurationMs")),
    growthThreshold: clamp(value("growthThreshold"), 0, 1),
    labelFadeStart: clamp(value("labelFadeStart"), 0, 1),
    labelFadeEnd: clamp(value("labelFadeEnd"), 0, 1),
  };
}

/**
 * The progression counter used by the local Obsidian graph renderer.
 *
 * Obsidian derives the base node rate from the incoming edge count rather
 * than from an arbitrary animation duration.  Keeping that equation here
 * lets the presentation story stay in sync with the imported graph engine.
 */
export function obsidianGraphGrowthSpeed(totalLinks) {
  const links = Math.max(0, finite(totalLinks, 0));
  return clamp(0.5 * Math.sqrt(links), 5, 100);
}

function graphList(value, key) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value[key])) return value[key];
  return [];
}

/**
 * Native Obsidian progression counts a node item plus every outgoing link
 * item.  The renderer still owns the queue/cursor; this function only exposes
 * the total so a director can budget a pause/resume sequence.
 */
export function obsidianProgressionItemTotal(nodes, edges) {
  return graphList(nodes, "nodes").length + graphList(edges, "edges").length;
}

/**
 * Return one zero-based unlock cost per node in renderer order.  A node costs
 * one item for itself plus one item for each outgoing edge.  The first node
 * in the Little Prince fixture is `summary:book` and consequently costs 28
 * (one node item + its 27 outgoing links), matching the native queue.
 */
export function obsidianNodeUnlockCosts(nodes, edges) {
  const nodeList = graphList(nodes, "nodes");
  const edgeList = graphList(edges, "edges");
  const outgoing = new Map();
  for (const edge of edgeList) {
    const source = nodeSlug(edge?.source);
    if (!source) continue;
    outgoing.set(source, (outgoing.get(source) ?? 0) + 1);
  }
  return Object.freeze(nodeList.map(node => {
    const slug = nodeSlug(node);
    return 1 + (slug ? outgoing.get(slug) ?? 0 : 0);
  }));
}

/**
 * Convert one native item cost into a pause for an existing renderer
 * pause/resume loop.  `visibleIndex` is zero-based, `itemSpeed` is items per
 * second, and `timeCompression > 1` shortens the marketing playback while
 * preserving the relative cadence (the 28-item seed remains slower than a
 * one-item tail node).
 */
export function graphShowcasePauseMs(
  visibleIndex,
  costs,
  itemSpeed,
  { timeCompression = 1 } = {},
) {
  if (!Array.isArray(costs)) return 0;
  const index = Math.floor(finite(visibleIndex, -1));
  const speed = finite(itemSpeed, 0);
  const compression = finite(timeCompression, 1);
  if (index < 0 || index >= costs.length || speed <= 0 || compression <= 0) return 0;
  const cost = Math.max(0, finite(costs[index], 0));
  return (cost / speed) * 1_000 / compression;
}

/**
 * Return the node rate for the current visible-node fraction.  The seed uses a
 * deliberately slower rate; after the seed threshold the rate eases toward
 * Obsidian's edge-derived baseline so a dense graph visibly accelerates.
 */
export function graphShowcaseGrowthSpeed(
  visibleNodes,
  totalNodes,
  totalLinks,
  options = {},
) {
  const motion = timingOptions(options);
  const total = normalizedCount(totalNodes);
  if (total <= 0) return 0;

  const progress = clamp(finite(visibleNodes, 0) / total, 0, 1);
  const nativeSpeed = Math.min(obsidianGraphGrowthSpeed(totalLinks), motion.maxGrowthSpeed);
  const slowSpeed = Math.min(nativeSpeed, Math.max(0, motion.initialGrowthSpeed));
  if (progress <= motion.growthThreshold || nativeSpeed <= slowSpeed) return slowSpeed;

  const afterSeed = (progress - motion.growthThreshold) / Math.max(
    EPSILON,
    1 - motion.growthThreshold,
  );
  return lerp(slowSpeed, nativeSpeed, easeOut(afterSeed, 1.35));
}

/**
 * Resolve the five visual stages from an elapsed clock.  `Infinity` is useful
 * for a paused/terminal presentation and intentionally resolves to `drawer`.
 */
export function resolveGraphShowcaseStage(elapsedMs, options = {}) {
  const motion = timingOptions(options);
  const elapsed = Math.max(0, finite(elapsedMs, Number.POSITIVE_INFINITY));
  if (!Number.isFinite(elapsed)) return "drawer";

  const seedEnd = motion.seedDurationMs;
  const growthEnd = seedEnd + motion.growthDurationMs;
  const focusEnd = growthEnd + motion.focusDurationMs;
  const hoverEnd = focusEnd + motion.hoverDurationMs;
  if (elapsed < seedEnd) return "seed";
  if (elapsed < growthEnd) return "grow";
  if (elapsed < focusEnd) return "focus";
  if (elapsed < hoverEnd) return "hover";
  return "drawer";
}

/**
 * Convert visible-node progress into an Obsidian-style label alpha.  The
 * labels stay readable for the seed, then fade continuously as the canvas
 * becomes dense; terminal focus/hover stages therefore contain no labels.
 */
export function graphShowcaseLabelAlpha(visibleNodes, totalNodes, options = {}) {
  const motion = timingOptions(options);
  const total = normalizedCount(totalNodes);
  if (total <= 0) return 0;
  const progress = clamp(finite(visibleNodes, 0) / total, 0, 1);
  if (progress <= motion.labelFadeStart) return 1;
  if (progress >= motion.labelFadeEnd) return 0;
  const fade = (progress - motion.labelFadeStart) / Math.max(
    EPSILON,
    motion.labelFadeEnd - motion.labelFadeStart,
  );
  return clamp(1 - easeOut(fade, 1.2), 0, 1);
}

/**
 * Return a camera scale for a stage.  Values are relative to the graph
 * canvas: the initial seed is close enough to read, dense growth pulls back,
 * and the final focus/hover/drawer state punches in again.
 */
export function graphShowcaseCameraScale(stage, normalizedGrowthProgress = 0, options = {}) {
  const motion = timingOptions(options);
  const progress = clamp(finite(normalizedGrowthProgress, 0), 0, 1);
  if (stage === "grow") {
    return lerp(motion.initialCameraScale, motion.pulledBackCameraScale, easeOut(progress, 1.1));
  }
  if (stage === "focus") return motion.focusCameraScale;
  if (stage === "hover" || stage === "drawer") return motion.hoverCameraScale;
  return motion.initialCameraScale;
}

/**
 * Camera targets for the actual Little Prince node cursor. The first 28 files
 * keep the readable Obsidian import scale, a short middle frontier starts the
 * pullback, and the dense tail continues upward without a cut.
 */
export function graphShowcaseGrowthCameraScale(visibleNodes, totalNodes, options = {}) {
  const motion = timingOptions(options);
  const total = Math.max(1, normalizedCount(totalNodes, 1));
  const visible = clamp(normalizedCount(visibleNodes), 0, total);
  const seedEnd = Math.min(total, normalizedCount(motion.seedNodeCount, 28));
  const middleEnd = Math.max(seedEnd + 1, Math.min(total, normalizedCount(motion.accelerationNodeCount, 65)));
  if (visible <= seedEnd) return motion.initialCameraScale;
  if (visible <= middleEnd) {
    return lerp(
      motion.initialCameraScale,
      motion.midpointCameraScale,
      (visible - seedEnd) / Math.max(1, middleEnd - seedEnd),
    );
  }
  return lerp(
    motion.midpointCameraScale,
    motion.pulledBackCameraScale,
    easeOut((visible - middleEnd) / Math.max(1, total - middleEnd), 1.1),
  );
}

function nodeSlug(node) {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return null;
  return typeof node.slug === "string"
    ? node.slug
    : typeof node.id === "string"
      ? node.id
      : null;
}

/** Pick a stable center node, preferring the book summary used by the fixture. */
export function resolveGraphShowcaseNode(nodes, preferredSlug = "summary:book") {
  const slugs = (Array.isArray(nodes) ? nodes : [])
    .map(nodeSlug)
    .filter(Boolean);
  if (slugs.length === 0) return null;
  if (slugs.includes(preferredSlug)) return preferredSlug;
  const summary = slugs.find(slug => slug.startsWith("summary:"));
  return summary ?? slugs[0];
}

/**
 * Compute the same visual focus semantics as the native renderer: the hovered
 * node and its immediate neighbors stay bright while every other node dims.
 */
export function deriveGraphFocus(nodes, edges, hoveredSlug) {
  const slugs = (Array.isArray(nodes) ? nodes : [])
    .map(nodeSlug)
    .filter(Boolean);
  if (!hoveredSlug || !slugs.includes(hoveredSlug)) {
    return { hoveredSlug: null, relatedSlugs: [], dimmedSlugs: [] };
  }

  const adjacency = new Map(slugs.map(slug => [slug, new Set()]));
  for (const edge of Array.isArray(edges) ? edges : []) {
    const source = nodeSlug(edge?.source);
    const target = nodeSlug(edge?.target);
    if (!source || !target || source === target) continue;
    if (!adjacency.has(source) || !adjacency.has(target)) continue;
    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  }
  const neighbors = adjacency.get(hoveredSlug) ?? new Set();
  const relatedSlugs = slugs.filter(slug => slug === hoveredSlug || neighbors.has(slug));
  const related = new Set(relatedSlugs);
  return {
    hoveredSlug,
    relatedSlugs,
    dimmedSlugs: slugs.filter(slug => !related.has(slug)),
  };
}

/**
 * Build one deterministic frame for the presentation layer.
 *
 * The final `drawer` frame is terminal: the selected slug is stable, the
 * relationship focus is preserved, and `stopped` tells a caller not to loop.
 */
export function graphShowcaseSnapshot(elapsedMs, options = {}) {
  const motion = timingOptions(options);
  const totalNodes = normalizedCount(options.totalNodes ?? options.nodes?.length);
  const totalLinks = Math.max(0, finite(options.totalLinks, 0));
  const stage = resolveGraphShowcaseStage(elapsedMs, motion);
  const isTerminal = stage === "drawer";
  const isFocused = stage === "hover" || isTerminal;
  const hoveredSlug = isFocused ? resolveGraphShowcaseNode(options.nodes, options.anchorSlug) : null;
  const focus = deriveGraphFocus(options.nodes, options.edges, hoveredSlug);
  // The Pixi renderer supplies `visibleNodes` from its native playback
  // callback.  We deliberately do not derive a second cursor here.  When a
  // caller only asks for a terminal frame, all nodes are the useful fallback.
  const suppliedVisibleNodes = options.visibleNodes;
  const visibleNodes = suppliedVisibleNodes === undefined
    ? (stage === "focus" || isFocused ? totalNodes : 0)
    : clamp(normalizedCount(suppliedVisibleNodes), 0, totalNodes);
  const labelAlpha = stage === "focus" || isFocused
    ? 0
    : graphShowcaseLabelAlpha(visibleNodes, totalNodes, motion);
  const growthProgress = totalNodes > 0 ? visibleNodes / totalNodes : 0;
  const cameraProgress = stage === "grow"
    ? clamp(
      (growthProgress - motion.growthThreshold)
        / Math.max(EPSILON, 1 - motion.growthThreshold),
      0,
      1,
    )
    : growthProgress;
  const cameraScale = graphShowcaseCameraScale(stage, cameraProgress, motion);

  return {
    stage,
    visibleNodes,
    totalNodes,
    growthProgress,
    growthSpeed: stage === "grow" || stage === "seed"
      ? graphShowcaseGrowthSpeed(visibleNodes, totalNodes, totalLinks, motion)
      : 0,
    cameraScale,
    labelAlpha,
    labelsVisible: labelAlpha > 0.001,
    hoveredSlug,
    selectedSlug: isTerminal ? hoveredSlug : null,
    relatedSlugs: focus.relatedSlugs,
    dimmedSlugs: focus.dimmedSlugs,
    relatedOpacity: motion.relatedOpacity,
    dimmedOpacity: motion.dimmedOpacity,
    drawerVisible: isTerminal && Boolean(hoveredSlug),
    stopped: isTerminal,
    playing: !isTerminal,
  };
}

// A shorter alias keeps call sites readable when a component only needs the
// frame contract; the named export above remains the canonical API.
export const getGraphShowcaseFrame = graphShowcaseSnapshot;
