import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../wiki-product-surface.css";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { BookOpenText } from "@phosphor-icons/react/BookOpenText";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCenteredText } from "@phosphor-icons/react/ChatCenteredText";
import { ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";
import { CursorClick } from "@phosphor-icons/react/CursorClick";
import { FileText } from "@phosphor-icons/react/FileText";
import { FolderSimple } from "@phosphor-icons/react/FolderSimple";
import { Graph } from "@phosphor-icons/react/Graph";
import { ListBullets } from "@phosphor-icons/react/ListBullets";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { Tag } from "@phosphor-icons/react/Tag";
import { Trash } from "@phosphor-icons/react/Trash";
import { TreeStructure } from "@phosphor-icons/react/TreeStructure";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { motion } from "motion/react";
import { GraphNodeDetailDrawer } from "./GraphNodeDetailDrawer";
import { ObsidianGraphCanvas } from "./ObsidianGraphCanvas";
import { GRAPH_SHOWCASE_MOTION } from "./graphShowcaseMotion";
import { obsidianTextAlpha } from "./obsidian-graph/obsidianNativeGraphContract.ts";
import { KNOWLEDGE_STORIES, isChineseStory } from "../data/knowledgeStories";
import {
  LITTLE_PRINCE_GRAPH_TOTALS,
  LITTLE_PRINCE_GRAPH_VIEW,
  createLittlePrinceGraph,
} from "../data/littlePrinceGraph";

const GRAPH_PREVIEW_SETTINGS = Object.freeze({
  scale: LITTLE_PRINCE_GRAPH_VIEW.initialScale,
  textFadeMultiplier: LITTLE_PRINCE_GRAPH_VIEW.textFadeMultiplier,
  nodeSizeMultiplier: LITTLE_PRINCE_GRAPH_VIEW.nodeSizeMultiplier,
  lineSizeMultiplier: LITTLE_PRINCE_GRAPH_VIEW.lineSizeMultiplier,
  centerStrength: LITTLE_PRINCE_GRAPH_VIEW.centerStrength,
  repelStrength: LITTLE_PRINCE_GRAPH_VIEW.repelStrength,
  linkStrength: LITTLE_PRINCE_GRAPH_VIEW.linkStrength,
  linkDistance: LITTLE_PRINCE_GRAPH_VIEW.linkDistance,
});
const GRAPH_FOCUS_SLUG = "character:prince";
const GRAPH_TERMINAL_TEXT_FADE = 1.2;
const GRAPH_FIT_SETTLE_MS = 220;
const WIKI_POINTER_TRANSITION = Object.freeze({ duration: 0.96, ease: [0.22, 1, 0.36, 1] });
export const GRAPH_PREVIEW_TOTALS = LITTLE_PRINCE_GRAPH_TOTALS;

function ProductSidebar({ collapsed = false, copy }) {
  const today = copy.sessions.slice(0, 1);
  const recent = copy.sessions.slice(1);
  return (
    <aside className={`visual-sidebar kb-preview-app-sidebar${collapsed ? " is-collapsed" : ""}`} data-product-app-sidebar="true" data-product-app-sidebar-state={collapsed ? "collapsed" : "expanded"}>
      <header className="visual-sidebar__header kb-preview-sidebar-header"><img src="/images/musuw-logo.png" alt="" draggable={false} />{collapsed ? <CaretRight size={12} aria-hidden="true" /> : <CaretLeft size={12} aria-hidden="true" />}</header>
      <div className="visual-sidebar__primary-actions kb-preview-primary-actions">
        <button className="visual-sidebar__primary is-new kb-preview-primary is-new" type="button"><ChatCenteredText size={13} /><b>{copy.newChat}</b></button>
        <button className="visual-sidebar__primary is-kb is-active kb-preview-primary is-active" type="button"><FolderSimple size={13} /><b>{copy.knowledgeBases}</b><small>3</small></button>
        <button className="visual-sidebar__primary is-native kb-preview-primary" type="button"><UsersThree size={13} /><b>{copy.agents}</b></button>
      </div>
      <div className="visual-sidebar__history kb-preview-history">
        <section><h5>{copy.today}</h5>{today.map((item) => <span key={item}>{item}</span>)}</section>
        <section><h5>{copy.recent}</h5>{recent.map((item) => <span key={item}>{item}</span>)}</section>
      </div>
      <footer className="visual-sidebar__footer kb-preview-user"><i>M</i><span><b>{copy.userName}</b><small>{copy.userMeta}</small></span><CaretDown size={10} /></footer>
    </aside>
  );
}

function KnowledgeHeader({ active = "graph", copy }) {
  return (
    <header className="visual-knowledge-header kb-preview-knowledge-header">
      <div className="visual-knowledge-header__copy kb-preview-header-copy">
        <div className="visual-knowledge-breadcrumb kb-preview-breadcrumb"><CaretLeft size={10} /><span>{copy.knowledgeBases}</span><em>/</em><strong>{copy.current}</strong><CaretDown size={9} /><em>/</em><span>{active === "wiki" ? copy.wiki : copy.graph}</span></div>
        <p>{copy.description}</p>
      </div>
      <div className="visual-knowledge-header__actions kb-preview-header-actions">
        <div className="visual-knowledge-tabs kb-preview-tabs" role="tablist">
          <button aria-selected="false" data-kb-tab="documents" role="tab" type="button"><FileText size={12} />{copy.documents}</button>
          <button aria-selected={active === "wiki"} className={active === "wiki" ? "is-active" : ""} data-kb-tab="wiki" role="tab" type="button"><BookOpenText size={12} />{copy.wiki}</button>
          <button aria-selected={active === "graph"} className={active === "graph" ? "is-active" : ""} data-kb-tab="graph" role="tab" type="button"><Graph size={12} />{copy.graph}</button>
        </div>
      </div>
    </header>
  );
}

function WikiSidebar({ copy }) {
  return (
    <aside className="wiki-sidebar kb-preview-wiki-sidebar" data-wiki-sidebar="true">
      <div className="wiki-sidebar-header kb-preview-wiki-sidebar-header">
        <label className="kb-preview-wiki-search">
          <MagnifyingGlass size={13} aria-hidden="true" />
          <input aria-label={copy.search} placeholder={copy.search} readOnly type="search" value="" />
        </label>
      </div>
      <div className="wiki-page-list kb-preview-wiki-page-list">
        <div className="wiki-nav-item kb-preview-wiki-index"><FileText size={12} aria-hidden="true" /><span>{copy.index}</span></div>
        <div className="wiki-sidebar-divider kb-preview-wiki-divider" />
        <div className="wiki-tab-bar kb-preview-wiki-tabbar">
          <strong>{copy.knowledge}</strong><span>{copy.summaries}</span>
          <i aria-hidden="true"><TreeStructure size={12} /><ListBullets size={12} /></i>
          <FolderSimple size={12} aria-hidden="true" /><Plus size={11} aria-hidden="true" />
        </div>
        <div className="wiki-tree-list kb-preview-wiki-tree">
          {copy.groups.map((group) => (
            <section key={group.label}>
              <div><CaretRight className={group.items.length ? "is-open" : ""} size={10} aria-hidden="true" /><strong>{group.label}</strong><small>{group.count}</small></div>
              {group.items.map((item) => (
                <span className={item === copy.pageTitle ? "is-selected" : ""} key={item}>
                  <Tag size={11} aria-hidden="true" />
                  <b>{item}</b>
                </span>
              ))}
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}

function WikiReader({ copy, linkRef, linkState = "idle" }) {
  return (
    <article className="wiki-reader kb-preview-wiki-reader" data-wiki-page-id={copy.pageId} data-wiki-reader="true">
      <div className="wiki-reader-inner kb-preview-wiki-reader-inner">
        <div className="wiki-nav-bar"><div className="wiki-nav-back kb-preview-reader-back"><ArrowLeft size={10} aria-hidden="true" />{copy.back}</div></div>
        <div className="wiki-reader-header kb-preview-reader-header">
          <div className="wiki-reader-title-row kb-preview-reader-title-row">
            <div className="wiki-reader-title-block">
              <h4 className="wiki-reader-title"><span className="wiki-reader-title-text">{copy.pageTitle}</span></h4>
              <div className="wiki-reader-title-badges wiki-reader-title-badges--secondary kb-preview-reader-badges"><span className="wiki-badge wiki-badge--type"><Tag size={10} aria-hidden="true" />{copy.type}</span><span className="wiki-badge wiki-badge--ver">v1</span></div>
            </div>
            <div className="wiki-reader-aside"><div className="wiki-reader-actions kb-preview-reader-actions" aria-hidden="true"><PencilSimple size={13} /><ClockCounterClockwise size={13} /><Graph size={13} /><Trash size={13} /></div></div>
          </div>
        </div>
        <div className="kb-preview-reader-time"><ClockCounterClockwise size={10} aria-hidden="true" />{copy.updatedAt}</div>
        <div className="kb-preview-wiki-main-section">
          <p className="kb-preview-reader-lead">{copy.lead}</p>
          <div className="wiki-reader-body kb-preview-reader-body">
            <p>
              {copy.introBeforeLink}
              {linkRef ? (
                <a
                  className={`wiki-content-link kb-preview-content-link${linkState === "pressing" ? " is-pressing" : ""}`}
                  data-wiki-demo-link="true"
                  data-wiki-link-state={linkState}
                  href={`#${copy.linkedPage.pageId}`}
                  ref={linkRef}
                >
                  {copy.inlineLink}
                </a>
              ) : <span className="wiki-content-link kb-preview-content-link">{copy.inlineLink}</span>}
              {copy.introAfterLink}
            </p>
            <h5>{copy.core}</h5>
            <ul>{copy.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <div className="wiki-reader-body kb-preview-reader-body kb-preview-wiki-reader-tail">
          <h5>{copy.audienceTitle}</h5>
          <p>{copy.audience}</p>
          <h5>{copy.assessmentTitle}</h5>
          <p>{copy.assessment}</p>
        </div>
        <footer className="wiki-reader-footer kb-preview-reader-footer">
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.linkedFrom}</span><span className="wiki-reader-footer-value"><span className="wiki-content-link kb-preview-content-link">{copy.backlinkTitle}</span></span></div>
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.sources}</span><span className="wiki-reader-footer-value"><span className="wiki-content-link kb-preview-content-link">{copy.sourceTitle}</span></span></div>
        </footer>
      </div>
    </article>
  );
}

function WikiProductSurface({ copy, header, reducedMotion, sidebar, stage }) {
  const hostRef = useRef(null);
  const linkRef = useRef(null);
  const [pointerPath, setPointerPath] = useState(null);
  const linked = stage === "linked-page";
  const readerCopy = linked ? { ...copy, ...copy.linkedPage } : copy;
  const linkState = stage === "pressing-link" ? "pressing" : stage === "moving-to-link" ? "approaching" : "idle";

  useLayoutEffect(() => {
    const host = hostRef.current;
    const link = linkRef.current;
    if (!host || !link) return undefined;
    let frame = 0;
    let active = true;
    const measure = () => {
      frame = 0;
      if (!active) return;
      const hostRect = host.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      if (hostRect.width <= 0 || hostRect.height <= 0 || linkRect.width <= 0 || linkRect.height <= 0) return;
      const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
      const target = {
        x: clamp(linkRect.left - hostRect.left + Math.min(12, linkRect.width * 0.35) - 3, 8, hostRect.width - 28),
        y: clamp(linkRect.top - hostRect.top + linkRect.height * 0.7 - 3, 8, hostRect.height - 28),
      };
      let start = {
        x: clamp(hostRect.width * 0.8, 12, hostRect.width - 28),
        y: clamp(hostRect.height * 0.78, 12, hostRect.height - 28),
      };
      if (Math.hypot(start.x - target.x, start.y - target.y) < 90) {
        start = { x: clamp(hostRect.width - 32, 12, hostRect.width - 28), y: clamp(hostRect.height - 36, 12, hostRect.height - 28) };
      }
      setPointerPath((current) => (
        current
        && current.start.x === start.x
        && current.start.y === start.y
        && current.target.x === target.x
        && current.target.y === target.y
          ? current
          : { start, target }
      ));
    };
    const queueMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(queueMeasure);
    observer.observe(host);
    observer.observe(link);
    queueMeasure();
    document.fonts?.ready?.then(() => { if (active) queueMeasure(); });
    return () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [copy.pageId, linked]);

  return (
    <div className="kb-product-preview kb-product-preview-wiki is-wiki" data-real-product-view="wiki" data-wiki-surface="true">
      <ProductSidebar collapsed copy={sidebar} />
      <main className="visual-knowledge-page kb-preview-knowledge-page is-wiki-tab">
        <KnowledgeHeader active="wiki" copy={header} />
        <section className="visual-knowledge-wiki-host kb-preview-wiki-host" ref={hostRef}>
          <div className="kb-preview-wiki-camera" data-wiki-camera="true" data-wiki-camera-scale="1">
            <div className="wiki-browser kb-preview-wiki-browser" data-wiki-flow-state={stage}>
              <WikiSidebar copy={readerCopy} />
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="wiki-content kb-preview-wiki-content"
                initial={linked && !reducedMotion ? { opacity: 0.68, y: 7 } : false}
                key={readerCopy.pageId}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <WikiReader copy={readerCopy} linkRef={linked ? null : linkRef} linkState={linkState} />
              </motion.div>
            </div>
          </div>
          {pointerPath && ["moving-to-link", "pressing-link"].includes(stage) ? (
            <motion.span
              animate={{
                opacity: 1,
                scale: stage === "pressing-link" ? 0.84 : 1,
                x: pointerPath.target.x,
                y: pointerPath.target.y,
              }}
              className={`kb-preview-wiki-pointer${stage === "pressing-link" ? " is-clicking" : ""}`}
              data-wiki-auto-pointer={stage}
              initial={{ opacity: 0, scale: 0.94, x: pointerPath.start.x, y: pointerPath.start.y }}
              transition={{
                opacity: { duration: 0.18 },
                scale: { duration: stage === "pressing-link" ? 0.14 : 0.24 },
                x: WIKI_POINTER_TRANSITION,
                y: WIKI_POINTER_TRANSITION,
              }}
            >
              <CursorClick size={22} weight="fill" />
              <i aria-hidden="true" />
            </motion.span>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function graphColor(value) {
  return typeof value === "number" ? `#${value.toString(16).padStart(6, "0")}` : value;
}

function graphPreviewUsesBottomDrawer(surface) {
  const viewport = surface?.closest(".kb-product-preview-viewport");
  const shellWidth = viewport?.clientWidth
    ?? surface?.closest(".kb-product-preview")?.clientWidth
    ?? surface?.clientWidth
    ?? (typeof window !== "undefined" ? window.innerWidth : 0);
  return shellWidth > 0 && shellWidth <= 760;
}

function graphDrawerInset(surface) {
  if (graphPreviewUsesBottomDrawer(surface)) return 0;
  const shellWidth = surface?.closest(".kb-product-preview")?.clientWidth ?? surface?.clientWidth ?? 0;
  // The production drawer overlays the right side of the graph. On a narrow
  // preview its fixed 255px minimum would leave the renderer only a sliver of
  // usable width and force a postage-stamp fit. Keep a small breathing gap
  // before the drawer on narrow shells, while preserving the desktop drawer
  // inset and the renderer's existing fit contract.
  const narrowMinInset = shellWidth > 0 && shellWidth < 760 ? 200 : 255;
  return Math.min(350, Math.max(narrowMinInset, shellWidth * 0.35));
}

function graphDrawerBottomInset(surface) {
  if (!graphPreviewUsesBottomDrawer(surface)) return 0;
  const host = surface?.closest(".kb-product-preview-viewport");
  const hostRect = host?.getBoundingClientRect();
  const surfaceRect = surface?.getBoundingClientRect();
  if (!hostRect || !surfaceRect) return 0;
  // Keep the bottom sheet compact enough that the graph still has a useful
  // upper viewport on phones. The drawer body can scroll independently, so
  // reserving a full half of a 430px preview would leave the renderer only a
  // handful of pixels after its fit padding.
  const drawerHeight = Math.min(180, Math.max(140, hostRect.height * 0.4));
  const drawerTop = hostRect.bottom - drawerHeight;
  const coveredHeight = Math.min(
    Math.max(0, surfaceRect.height - 1),
    Math.max(0, surfaceRect.bottom - drawerTop),
  );
  // Pass the real covered height to the renderer. Its mobile bottom-sheet fit
  // uses a compact vertical padding (while retaining the normal horizontal
  // padding), so the selected cluster stays above the sheet without lying
  // about the reserved viewport.
  return coveredHeight;
}

function createGraphDrawerPayload(graphData, locale, orderedNeighborSlugs = null) {
  const language = isChineseStory(locale) ? "zh" : "en";
  const node = graphData.nodes.find(({ slug }) => slug === GRAPH_FOCUS_SLUG);
  if (!node) return null;
  const category = graphData.categories.find(({ id }) => id === node.page_type);
  const neighborSlugs = new Set();
  for (const edge of graphData.edges) {
    if (edge.source === node.slug) neighborSlugs.add(edge.target);
    if (edge.target === node.slug) neighborSlugs.add(edge.source);
  }
  const neighborOrder = Array.isArray(orderedNeighborSlugs)
    ? orderedNeighborSlugs.filter((slug) => neighborSlugs.has(slug)).slice(0, 10)
    : graphData.nodes.filter((candidate) => neighborSlugs.has(candidate.slug)).slice(0, 10).map(({ slug }) => slug);
  const neighborBySlug = new Map(graphData.nodes.map((candidate) => [candidate.slug, candidate]));
  const neighbors = neighborOrder
    .map((slug) => neighborBySlug.get(slug))
    .filter(Boolean)
    .map((candidate) => ({
      ...candidate,
      color: graphColor(candidate.color),
      relation: language === "zh" ? "一跳关联" : "Direct relation",
    }));
  const localized = language === "zh"
    ? {
        summary: "小王子从 B-612 出发，在行星旅途中观察成人世界，并在与玫瑰、狐狸和飞行员的关系中理解责任、驯养与告别。",
        sections: [
          { heading: "阅读脉络", body: "这个节点贯穿全书 27 个章节，连接故乡、旅程、相遇、驯养、责任与归返。" },
          { heading: "关系线索", body: "与玫瑰的照料、与狐狸建立的联结，以及和飞行员分享的沙漠经历，共同构成故事的情感主线。" },
        ],
      }
    : {
        summary: "The Little Prince leaves B-612, observes the adult world, and learns about responsibility, taming, and farewell through the rose, the fox, and the pilot.",
        sections: [
          { heading: "Reading path", body: "This node spans all 27 chapters, connecting home, travel, encounters, taming, responsibility, and return." },
          { heading: "Relationship thread", body: "Care for the rose, the bond with the fox, and the shared desert journey with the pilot form the story's emotional spine." },
        ],
      };
  return {
    node: {
      ...node,
      categoryLabel: category?.label,
      color: graphColor(node.color),
      summary: localized.summary,
      source: language === "zh" ? "《小王子》全书阅读图谱" : "The Little Prince complete reading graph",
    },
    neighbors,
    sections: localized.sections,
  };
}

function GraphProductSurface({ autoPlay, copy, locale, onDrawerChange, onStageChange }) {
  const canvasRef = useRef(null);
  const graphViewportRef = useRef(null);
  const pointerRef = useRef(null);
  const surfaceRef = useRef(null);
  const focusRightInsetRef = useRef(LITTLE_PRINCE_GRAPH_VIEW.fitRightInset);
  const focusBottomInsetRef = useRef(0);
  const lastFocusFitAtRef = useRef(0);
  const drawerPreparingRef = useRef(false);
  const terminalGenerationRef = useRef(0);
  const terminalTimersRef = useRef([]);
  const fitTimerRef = useRef(null);
  const fittedCameraScaleRef = useRef(LITTLE_PRINCE_GRAPH_VIEW.initialScale);
  const growthScaleCapRef = useRef(LITTLE_PRINCE_GRAPH_VIEW.initialScale);
  const growthFitActiveRef = useRef(false);
  const terminalStartedRef = useRef(false);
  const graphData = useMemo(() => createLittlePrinceGraph(locale), [locale]);
  const drawerPayload = useMemo(() => createGraphDrawerPayload(graphData, locale), [graphData, locale]);
  const directNeighborSlugs = useMemo(() => {
    const slugs = new Set();
    for (const edge of graphData.edges) {
      if (edge.source === GRAPH_FOCUS_SLUG) slugs.add(edge.target);
      if (edge.target === GRAPH_FOCUS_SLUG) slugs.add(edge.source);
    }
    return [...slugs];
  }, [graphData]);
  const defaultFocusNeighborSlugs = useMemo(
    () => drawerPayload?.neighbors?.map(({ slug }) => slug).filter(Boolean) ?? [],
    [drawerPayload],
  );
  const [terminalNeighborSlugs, setTerminalNeighborSlugs] = useState(defaultFocusNeighborSlugs);
  const terminalNeighborSlugsRef = useRef(defaultFocusNeighborSlugs);
  const focusNodeSlugs = useMemo(() => {
    // The drawer only exposes the first ten direct relations. Keep the
    // terminal camera's fit set in lock-step with that visible contract; the
    // previous implementation fitted every one-hop relation (27 nodes for
    // the Little Prince fixture), which made the same drawer view collapse to
    // a postage stamp on narrow canvases.
    const slugs = new Set([GRAPH_FOCUS_SLUG]);
    for (const slug of terminalNeighborSlugs) {
      if (slug) slugs.add(slug);
    }
    return [...slugs];
  }, [terminalNeighborSlugs]);
  const total = graphData.nodes.length;
  const [playback, setPlayback] = useState(() => ({ state: "idle", visible: total, total }));
  const [showcaseStage, setShowcaseStage] = useState("idle");
  const [fittedCameraScale, setFittedCameraScale] = useState(LITTLE_PRINCE_GRAPH_VIEW.initialScale);
  const visibleCount = Math.max(0, Math.min(playback.visible, total));
  const terminal = ["settle", "focus", "hover", "drawer"].includes(showcaseStage);
  const cameraScale = ["focus", "hover", "drawer"].includes(showcaseStage)
    ? LITTLE_PRINCE_GRAPH_VIEW.focusScale
    : fittedCameraScale;
  const textFadeMultiplier = terminal
    ? GRAPH_TERMINAL_TEXT_FADE
    : LITTLE_PRINCE_GRAPH_VIEW.textFadeMultiplier;
  const labelAlpha = obsidianTextAlpha(cameraScale, textFadeMultiplier);

  const clearTerminalTimers = useCallback(() => {
    terminalGenerationRef.current += 1;
    drawerPreparingRef.current = false;
    for (const timer of terminalTimersRef.current) window.clearTimeout(timer);
    terminalTimersRef.current = [];
  }, []);

  const fitVisibleNodes = useCallback(() => {
    void canvasRef.current?.fit({
      visibleOnly: true,
      // Keep the initial presentation scale as the upper bound rather than
      // feeding the last fit back as a permanent ceiling. A single force
      // tick can briefly place an outlier far away; using that transient fit
      // as maxScale used to monotonically lock every subsequent fit to a tiny
      // camera scale. The renderer still eases each target, and later fits
      // are free to recover when the layout settles.
      maxScale: growthFitActiveRef.current
        ? growthScaleCapRef.current
        : LITTLE_PRINCE_GRAPH_VIEW.initialScale,
    });
  }, []);

  const handleCameraScaleChange = useCallback((scale) => {
    if (!Number.isFinite(scale)) return;
    const nextScale = Math.min(
      LITTLE_PRINCE_GRAPH_VIEW.initialScale,
      Math.max(Number.EPSILON, scale),
    );
    const fittedScale = growthFitActiveRef.current
      ? Math.min(growthScaleCapRef.current, nextScale)
      : nextScale;
    if (growthFitActiveRef.current) growthScaleCapRef.current = fittedScale;
    fittedCameraScaleRef.current = fittedScale;
    setFittedCameraScale(fittedScale);
  }, []);

  const scheduleVisibleFit = useCallback(() => {
    fitVisibleNodes();
    if (fitTimerRef.current) window.clearTimeout(fitTimerRef.current);
    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = null;
      fitVisibleNodes();
    }, GRAPH_FIT_SETTLE_MS);
  }, [fitVisibleNodes]);

  const chooseNearestTerminalNeighbors = useCallback(() => {
    const center = canvasRef.current?.getNodeViewportPoint(GRAPH_FOCUS_SLUG);
    if (!center) return terminalNeighborSlugsRef.current;
    const ranked = directNeighborSlugs
      .map((slug) => ({ slug, point: canvasRef.current?.getNodeViewportPoint(slug) }))
      .filter(({ point }) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
      .sort((left, right) => (
        (left.point.x - center.x) ** 2 + (left.point.y - center.y) ** 2
        - (right.point.x - center.x) ** 2 - (right.point.y - center.y) ** 2
      ))
      .slice(0, 10)
      .map(({ slug }) => slug);
    const next = ranked.length > 0 ? ranked : terminalNeighborSlugsRef.current;
    terminalNeighborSlugsRef.current = next;
    setTerminalNeighborSlugs(current => current.join("|") === next.join("|") ? current : next);
    return next;
  }, [directNeighborSlugs]);

  const beginTerminalSequence = useCallback(() => {
    if (terminalStartedRef.current) return;
    terminalStartedRef.current = true;
    clearTerminalTimers();
    const generation = terminalGenerationRef.current;
    canvasRef.current?.clearSelection();
    onDrawerChange?.(null);
    scheduleVisibleFit();
    setShowcaseStage("settle");

    const focusTimer = window.setTimeout(() => {
      setShowcaseStage("focus");
    }, GRAPH_SHOWCASE_MOTION.settleDurationMs);
    const hoverTimer = window.setTimeout(() => {
      // Once the force layout has settled, prefer the ten direct neighbours
      // nearest to the focus node. The drawer and terminal fit use the same
      // ordered set, avoiding a single remote chapter dictating a tiny zoom.
      chooseNearestTerminalNeighbors();
      setShowcaseStage("hover");
      canvasRef.current?.setHoveredNode(GRAPH_FOCUS_SLUG);
    }, GRAPH_SHOWCASE_MOTION.settleDurationMs + GRAPH_SHOWCASE_MOTION.focusDurationMs);
    const drawerTimer = window.setTimeout(() => {
      void (async () => {
        const rightInset = graphDrawerInset(surfaceRef.current);
        const bottomInset = graphDrawerBottomInset(surfaceRef.current);
        focusRightInsetRef.current = rightInset;
        focusBottomInsetRef.current = bottomInset;
        drawerPreparingRef.current = true;
        const terminalNeighbors = terminalNeighborSlugsRef.current;
        const terminalFocusSlugs = [GRAPH_FOCUS_SLUG, ...terminalNeighbors];
        const terminalPayload = createGraphDrawerPayload(graphData, locale, terminalNeighbors);
        await canvasRef.current?.fit({
          nodeSlugs: terminalFocusSlugs,
          rightInset,
          bottomInset,
          maxScale: LITTLE_PRINCE_GRAPH_VIEW.focusScale,
        });
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
        if (terminalGenerationRef.current !== generation) return;
        drawerPreparingRef.current = false;
        canvasRef.current?.setSelectedNode(GRAPH_FOCUS_SLUG);
        setShowcaseStage("drawer");
        onDrawerChange?.(terminalPayload);
      })();
    }, GRAPH_SHOWCASE_MOTION.settleDurationMs + GRAPH_SHOWCASE_MOTION.focusDurationMs + GRAPH_SHOWCASE_MOTION.hoverDurationMs);
    terminalTimersRef.current = [focusTimer, hoverTimer, drawerTimer];
  }, [chooseNearestTerminalNeighbors, clearTerminalTimers, focusNodeSlugs, graphData, locale, onDrawerChange, scheduleVisibleFit]);

  const handlePlaybackChange = useCallback((snapshot) => {
    setPlayback(snapshot);
    if (snapshot.state === "playing") {
      growthFitActiveRef.current = true;
      const accelerationProgress = Math.max(0, Math.min(
        1,
        (snapshot.visible - LITTLE_PRINCE_GRAPH_VIEW.seedNodeCount)
          / Math.max(1, total - LITTLE_PRINCE_GRAPH_VIEW.seedNodeCount),
      ));
      const growthTimeScale = LITTLE_PRINCE_GRAPH_VIEW.progressionTimeScale
        + (LITTLE_PRINCE_GRAPH_VIEW.progressionMaxTimeScale - LITTLE_PRINCE_GRAPH_VIEW.progressionTimeScale)
          * accelerationProgress;
      canvasRef.current?.setProgressionTimeScale(growthTimeScale);
      if (snapshot.visible <= 1) {
        terminalStartedRef.current = false;
        clearTerminalTimers();
        if (fitTimerRef.current) window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
        onDrawerChange?.(null);
        canvasRef.current?.clearSelection();
        growthFitActiveRef.current = true;
        growthScaleCapRef.current = LITTLE_PRINCE_GRAPH_VIEW.initialScale;
        terminalNeighborSlugsRef.current = defaultFocusNeighborSlugs;
        setTerminalNeighborSlugs(defaultFocusNeighborSlugs);
        fittedCameraScaleRef.current = LITTLE_PRINCE_GRAPH_VIEW.initialScale;
        setFittedCameraScale(LITTLE_PRINCE_GRAPH_VIEW.initialScale);
      } else if (snapshot.visible > LITTLE_PRINCE_GRAPH_VIEW.seedNodeCount) {
        scheduleVisibleFit();
      }
      setShowcaseStage(snapshot.visible <= LITTLE_PRINCE_GRAPH_VIEW.seedNodeCount ? "seed" : "grow");
    } else if (snapshot.state === "complete") {
      beginTerminalSequence();
    }
  }, [beginTerminalSequence, clearTerminalTimers, defaultFocusNeighborSlugs, onDrawerChange, scheduleVisibleFit, total]);

  useEffect(() => {
    // Release the monotonic growth ceiling only after React has committed the
    // terminal stage. Otherwise the completion fit can report a tiny rebound
    // while the DOM still says `grow`, which reads as a last-frame zoom-in.
    if (showcaseStage === "settle") growthFitActiveRef.current = false;
  }, [showcaseStage]);

  useEffect(() => {
    canvasRef.current?.setSettings({
      ...GRAPH_PREVIEW_SETTINGS,
      scale: cameraScale,
      textFadeMultiplier,
    });
  }, [cameraScale, textFadeMultiplier]);

  useEffect(() => {
    if (showcaseStage !== "focus" && showcaseStage !== "hover" && showcaseStage !== "drawer") return;
    const rightInset = showcaseStage === "drawer"
      ? graphDrawerInset(surfaceRef.current)
      : LITTLE_PRINCE_GRAPH_VIEW.fitRightInset;
    const bottomInset = showcaseStage === "drawer"
      ? graphDrawerBottomInset(surfaceRef.current)
      : 0;
    focusRightInsetRef.current = rightInset;
    focusBottomInsetRef.current = bottomInset;
    void canvasRef.current?.fit({
      nodeSlugs: focusNodeSlugs,
      rightInset,
      bottomInset,
      maxScale: LITTLE_PRINCE_GRAPH_VIEW.focusScale,
    });
  }, [focusNodeSlugs, showcaseStage]);

  useEffect(() => {
    if (showcaseStage !== "hover" && showcaseStage !== "drawer") return undefined;
    let frameId = 0;
    const trackFocus = () => {
      const viewport = graphViewportRef.current;
      const pointer = pointerRef.current;
      const focusPoint = canvasRef.current?.getNodeViewportPoint(GRAPH_FOCUS_SLUG);
      if (viewport && focusPoint) {
        const points = focusNodeSlugs
          .map((slug) => canvasRef.current?.getNodeViewportPoint(slug))
          .filter(Boolean);
        const bounds = points.reduce((result, point) => ({
          minX: Math.min(result.minX, point.x),
          maxX: Math.max(result.maxX, point.x),
          minY: Math.min(result.minY, point.y),
          maxY: Math.max(result.maxY, point.y),
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        if (points.length > 0) {
          viewport.dataset.graphFocusBounds = [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].map(value => value.toFixed(2)).join(",");
        }
        const padding = 18;
        const rightEdge = viewport.clientWidth - focusRightInsetRef.current - padding;
        const bottomEdge = viewport.clientHeight - focusBottomInsetRef.current - padding;
        const usableWidth = Math.max(1, rightEdge - padding);
        const usableHeight = Math.max(1, bottomEdge - padding);
        const coverage = Math.max(
          (bounds.maxX - bounds.minX) / usableWidth,
          (bounds.maxY - bounds.minY) / usableHeight,
        );
        // A force tick can pull the selected cluster inward after a fit. It
        // may remain technically inside the safe rectangle, so checking only
        // allVisible would never ask the renderer to reclaim the canvas. A
        // throttled refit keeps the terminal cluster legible while still
        // delegating all camera math to the existing renderer.fit(). Use a
        // higher fill target before the drawer opens (more canvas is available)
        // and a lower one after the drawer inset is applied.
        const coverageThreshold = focusRightInsetRef.current <= LITTLE_PRINCE_GRAPH_VIEW.fitRightInset
          ? 0.68
          : 0.55;
        const underfilled = coverage < coverageThreshold
          && focusPoint.scale < LITTLE_PRINCE_GRAPH_VIEW.focusScale - 0.01;
        viewport.dataset.graphFocusCoverage = coverage.toFixed(3);
        const allVisible = points.length === focusNodeSlugs.length && points.every((point) => (
          point.x >= padding
          && point.x <= rightEdge
          && point.y >= padding
          && point.y <= bottomEdge
        ));
        viewport.dataset.graphFocusNode = GRAPH_FOCUS_SLUG;
        viewport.dataset.graphFocusX = focusPoint.x.toFixed(2);
        viewport.dataset.graphFocusY = focusPoint.y.toFixed(2);
        viewport.dataset.graphFocusVisible = String(points.filter((point) => (
          point.x >= padding
          && point.x <= rightEdge
          && point.y >= padding
          && point.y <= bottomEdge
        )).length);
        viewport.dataset.graphFocusTotal = String(focusNodeSlugs.length);
        viewport.dataset.graphFocusAllVisible = String(allVisible);
        viewport.dataset.graphFocusRightInset = focusRightInsetRef.current.toFixed(2);
        viewport.dataset.graphFocusBottomInset = focusBottomInsetRef.current.toFixed(2);
        viewport.dataset.graphCameraScale = focusPoint.scale.toFixed(3);
        if (pointer) {
          pointer.style.left = `${focusPoint.x - 3}px`;
          pointer.style.top = `${focusPoint.y - 3}px`;
        }
        const now = performance.now();
        if ((!allVisible || underfilled) && !drawerPreparingRef.current && now - lastFocusFitAtRef.current >= 520) {
          lastFocusFitAtRef.current = now;
          void canvasRef.current?.fit({
            nodeSlugs: focusNodeSlugs,
            rightInset: focusRightInsetRef.current,
            bottomInset: focusBottomInsetRef.current,
            maxScale: LITTLE_PRINCE_GRAPH_VIEW.focusScale,
          });
        }
      }
      frameId = window.requestAnimationFrame(trackFocus);
    };
    trackFocus();
    return () => window.cancelAnimationFrame(frameId);
  }, [focusNodeSlugs, showcaseStage]);

  useEffect(() => {
    onStageChange?.(showcaseStage);
  }, [onStageChange, showcaseStage]);

  useEffect(() => () => {
    clearTerminalTimers();
    if (fitTimerRef.current) window.clearTimeout(fitTimerRef.current);
    onDrawerChange?.(null);
  }, [clearTerminalTimers, onDrawerChange]);

  return (
    <div className="wiki-browser kb-preview-wiki-browser is-graph" data-graph-label-alpha={Number(labelAlpha.toFixed(3))} data-graph-node-count={total} data-graph-showcase-stage={showcaseStage} ref={surfaceRef}>
      <div className="wiki-graph kb-preview-graph">
        <div className="wiki-graph-search-container kb-preview-graph-search-container"><div className="wiki-graph-search-row kb-preview-graph-search-row"><div className="wiki-graph-search kb-preview-graph-search"><MagnifyingGlass size={12} /><span>{copy.search}</span><CaretDown size={10} /></div></div></div>
        <div className="wiki-graph-canvas kb-preview-graph-canvas" data-graph-camera-scale={Number(cameraScale.toFixed(3))} ref={graphViewportRef} style={{ pointerEvents: "none" }}>
          <ObsidianGraphCanvas autoPlay={autoPlay} data={graphData} onCameraScaleChange={handleCameraScaleChange} onPlaybackChange={handlePlaybackChange} progressionTimeScale={LITTLE_PRINCE_GRAPH_VIEW.progressionTimeScale} ref={canvasRef} settings={GRAPH_PREVIEW_SETTINGS} />
          {["hover", "drawer"].includes(showcaseStage) ? (
            <motion.span
              animate={{ opacity: 1, scale: showcaseStage === "drawer" ? 0.88 : 1 }}
              className={`kb-preview-graph-pointer${showcaseStage === "drawer" ? " is-clicking" : ""}`}
              data-graph-auto-pointer={showcaseStage}
              initial={{ opacity: 0, scale: 0.9 }}
              ref={pointerRef}
              transition={{ duration: showcaseStage === "drawer" ? 0.16 : 0.62, ease: [0.22, 1, 0.36, 1] }}
            >
              <CursorClick size={22} weight="fill" />
              <i aria-hidden="true" />
            </motion.span>
          ) : null}
        </div>
        <aside className="wiki-graph-legend kb-preview-graph-legend">
          <div className="legend-items kb-preview-legend-items">{graphData.categories.map(({ id, label, color }) => <span className="legend-item" data-graph-legend-type={id} key={id}><i className="legend-dot" style={{ background: color }} />{label}</span>)}</div>
          <div className="legend-divider kb-preview-legend-divider" />
          <div className="wiki-graph-status-card kb-preview-legend-status"><span><Graph size={11} />{copy.overview}</span><strong>{visibleCount} / {total} {copy.count}</strong><small>{playback.state === "playing" ? copy.playbackRunning : copy.status}</small></div>
        </aside>
      </div>
    </div>
  );
}

export function KnowledgeBaseProductPreview({ graphAutoPlay = false, locale = "en", shellRef, view, wikiFlow }) {
  const story = isChineseStory(locale) ? KNOWLEDGE_STORIES.zh : KNOWLEDGE_STORIES.en;
  const wikiCopy = story.wiki;
  const graphCopy = story.graph;
  const viewportRef = useRef(null);
  const [graphDrawer, setGraphDrawer] = useState(null);
  const [graphStage, setGraphStage] = useState("idle");
  const attachRef = useCallback((node) => {
    viewportRef.current = node;
    if (typeof shellRef === "function") shellRef(node);
    else if (shellRef) shellRef.current = node;
  }, [shellRef]);
  const stage = wikiFlow?.stage ?? "page";
  const reducedMotion = Boolean(wikiFlow?.reducedMotion);

  return (
    <div className={`kb-product-preview-viewport kb-product-preview-${view}`} data-capability-demo={view} data-demo-interactive="false" data-demo-phase={view === "wiki" ? stage : graphStage} data-product-page-shell={view} inert ref={attachRef}>
      {view === "wiki" ? (
        <WikiProductSurface
          copy={wikiCopy.content}
          header={wikiCopy.header}
          reducedMotion={reducedMotion}
          sidebar={wikiCopy.app}
          stage={stage}
        />
      ) : (
        <>
          <div className="kb-product-preview is-graph">
            <ProductSidebar collapsed copy={graphCopy.app} />
            <main className="visual-knowledge-page kb-preview-knowledge-page is-graph-tab"><KnowledgeHeader active="graph" copy={graphCopy.header} /><section className="visual-knowledge-wiki-host kb-preview-wiki-host"><GraphProductSurface autoPlay={graphAutoPlay} copy={graphCopy.content} locale={locale} onDrawerChange={setGraphDrawer} onStageChange={setGraphStage} /></section></main>
          </div>
          <GraphNodeDetailDrawer locale={locale} neighbors={graphDrawer?.neighbors} node={graphDrawer?.node} open={Boolean(graphDrawer)} sections={graphDrawer?.sections} />
        </>
      )}
    </div>
  );
}
