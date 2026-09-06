import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { BookOpenText } from "@phosphor-icons/react/BookOpenText";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCenteredText } from "@phosphor-icons/react/ChatCenteredText";
import { ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";
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
import { ObsidianGraphCanvas } from "./ObsidianGraphCanvas";
import { DemoSourcePreview } from "./DemoSourcePreview";
import { KNOWLEDGE_STORIES, isChineseStory } from "../data/knowledgeStories";

// Keep IDs, node types, geometry and topology stable: only the story labels change.
const graphLabels = KNOWLEDGE_STORIES.en.graph.content.labels;
const GRAPH_NODES = Object.freeze([
  Object.freeze({ id: "index", label: graphLabels.index, type: "index", x: 276, y: 249, r: 8 }),
  Object.freeze({ id: "interviews", label: graphLabels.interviews, type: "entity", x: 455, y: 153, r: 11 }),
  Object.freeze({ id: "retention", label: graphLabels.retention, type: "concept", x: 522, y: 159, r: 12 }),
  Object.freeze({ id: "onboarding", label: graphLabels.onboarding, type: "entity", x: 376, y: 196, r: 11 }),
  Object.freeze({ id: "activation", label: graphLabels.activation, type: "entity", x: 435, y: 213, r: 11 }),
  Object.freeze({ id: "time_to_value", label: graphLabels.time_to_value, type: "concept", x: 562, y: 201, r: 12 }),
  Object.freeze({ id: "plg", label: graphLabels.plg, type: "concept", x: 494, y: 238, r: 10 }),
  Object.freeze({ id: "support", label: graphLabels.support, type: "entity", x: 379, y: 252, r: 11 }),
  Object.freeze({ id: "analytics", label: graphLabels.analytics, type: "entity", x: 442, y: 270, r: 11 }),
  Object.freeze({ id: "competitors", label: graphLabels.competitors, type: "entity", x: 605, y: 258, r: 11 }),
  Object.freeze({ id: "friction", label: graphLabels.friction, type: "concept", x: 548, y: 282, r: 12 }),
  Object.freeze({ id: "aha", label: graphLabels.aha, type: "concept", x: 400, y: 324, r: 12 }),
  Object.freeze({ id: "adoption", label: graphLabels.adoption, type: "concept", x: 525, y: 334, r: 12 }),
  Object.freeze({ id: "summary", label: graphLabels.summary, type: "summary", x: 463, y: 342, r: 11 }),
]);
const GRAPH_EDGES = Object.freeze([
  ["index", "summary"],
  ["summary", "retention"],
  ["summary", "time_to_value"],
  ["summary", "aha"],
  ["interviews", "aha"],
  ["interviews", "friction"],
  ["onboarding", "time_to_value"],
  ["onboarding", "aha"],
  ["activation", "aha"],
  ["activation", "retention"],
  ["support", "friction"],
  ["analytics", "activation"],
  ["analytics", "retention"],
  ["competitors", "time_to_value"],
  ["plg", "retention"],
  ["adoption", "retention"],
  ["friction", "time_to_value"],
  ["aha", "activation"],
]);
const GRAPH_DATA = Object.freeze({
  nodes: Object.freeze(GRAPH_NODES.map((node) => Object.freeze({
    slug: node.id, title: node.label, page_type: node.type,
    link_count: GRAPH_EDGES.filter(([source, target]) => source === node.id || target === node.id).length,
  }))),
  edges: Object.freeze(GRAPH_EDGES.map(([source, target]) => Object.freeze({ source, target }))),
  meta: Object.freeze({ mode: "overview" }),
});
export const GRAPH_PREVIEW_TOTALS = Object.freeze({ nodes: GRAPH_NODES.length, links: GRAPH_EDGES.length });

function ProductSidebar({ copy }) {
  const today = copy.sessions.slice(0, 1);
  const recent = copy.sessions.slice(1);
  return (
    <aside className="visual-sidebar kb-preview-app-sidebar" data-product-app-sidebar="true">
      <header className="visual-sidebar__header kb-preview-sidebar-header"><img src="/images/musuw-logo.png" alt="" draggable={false} /><CaretLeft size={12} aria-hidden="true" /></header>
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

function KnowledgeHeader({ active, copy }) {
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
      <div className="wiki-sidebar-header kb-preview-wiki-sidebar-header"><label className="kb-preview-wiki-search"><MagnifyingGlass size={13} /><input aria-label={copy.search} placeholder={copy.search} readOnly type="search" value="" /></label></div>
      <div className="wiki-page-list kb-preview-wiki-page-list">
        <div className="wiki-nav-item kb-preview-wiki-index"><FileText size={12} /><span>{copy.index}</span></div>
        <div className="wiki-sidebar-divider kb-preview-wiki-divider" />
        <div className="wiki-tab-bar kb-preview-wiki-tabbar"><strong>{copy.knowledge}</strong><span>{copy.summaries}</span><i><TreeStructure size={12} /><ListBullets size={12} /></i><FolderSimple size={12} /><Plus size={11} /></div>
        <div className="wiki-tree-list kb-preview-wiki-tree">
          {copy.groups.map((group) => (
            <section key={group.label}>
              <div><CaretRight className={group.items.length ? "is-open" : ""} size={10} /><strong>{group.label}</strong><small>{group.count}</small></div>
              {group.items.map((item) => <span className={item === copy.pageTitle ? "is-selected" : ""} key={item}><Tag size={11} /><b>{item}</b></span>)}
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}

function WikiReader({ copy, stage, sourceId, onSource }) {
  const hovering = ["hovering-source", "clicking-source"].includes(stage);
  return (
    <article className="wiki-reader kb-preview-wiki-reader" data-wiki-reader="true">
      <div className="wiki-reader-inner kb-preview-wiki-reader-inner">
        <div className="wiki-nav-bar"><div className="wiki-nav-back kb-preview-reader-back"><ArrowLeft size={10} />{copy.back}</div></div>
        <div className="wiki-reader-header kb-preview-reader-header">
          <div className="wiki-reader-title-row kb-preview-reader-title-row">
            <div className="wiki-reader-title-block">
              <h4 className="wiki-reader-title"><span className="wiki-reader-title-text">{copy.pageTitle}</span></h4>
              <div className="wiki-reader-title-badges wiki-reader-title-badges--secondary kb-preview-reader-badges"><span className="wiki-badge wiki-badge--type"><Tag size={10} />{copy.type}</span><span className="wiki-badge wiki-badge--ver">v4</span></div>
            </div>
            <div className="wiki-reader-aside"><div className="wiki-reader-actions kb-preview-reader-actions"><PencilSimple size={13} /><ClockCounterClockwise size={13} /><Graph size={13} /><Trash size={13} /></div></div>
          </div>
        </div>
        <div className="kb-preview-reader-time"><ClockCounterClockwise size={10} />{copy.updatedAt}</div>
        <p className="kb-preview-reader-lead">{copy.lead}</p>
        <div className="wiki-reader-body kb-preview-reader-body">
          <p>{copy.introBeforeLink}<span className="wiki-content-link kb-preview-content-link">{copy.inlineLink}</span>{copy.introAfterLink}</p>
          <h5>{copy.core}</h5>
          <ul>{copy.bullets.map((item, index) => <li key={item}>{item} <button className="wiki-content-link kb-preview-content-link demo-citation-button" type="button" aria-expanded={sourceId === copy.sourceIds[index]} onClick={() => onSource(copy.sourceIds[index])}>[{index + 1}]</button></li>)}</ul>
          <h5>{copy.audienceTitle}</h5><p>{copy.audience}</p>
          <h5>{copy.assessmentTitle}</h5><p>{copy.assessment} <button className="wiki-content-link kb-preview-content-link demo-citation-button" type="button" aria-expanded={sourceId === copy.sourceIds[2]} onClick={() => onSource(copy.sourceIds[2])}>[3]</button></p>
        </div>
        <footer className="wiki-reader-footer kb-preview-reader-footer">
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.linkedFrom}</span><span className="wiki-reader-footer-value"><span className="wiki-content-link kb-preview-content-link">{copy.backlinkTitle}</span></span></div>
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.sources}</span><span className="wiki-reader-footer-value"><button className={`wiki-content-link kb-preview-content-link kb-preview-wiki-source-trigger ${hovering ? "is-hovered" : ""}`} data-wiki-source-trigger="true" type="button" aria-expanded={Boolean(sourceId)} onClick={() => onSource(copy.sourceIds[0])}>{copy.sourceTitle}</button></span></div>
          <small className="demo-scope-note">{copy.note}</small>
        </footer>
      </div>
    </article>
  );
}

function WikiProductSurface({ copy, flow, locale }) {
  const stage = flow?.stage ?? "page";
  const hostRef = useRef(null);
  const [manualSource, setManualSource] = useState(null);
  useEffect(() => { if (!flow?.inView) setManualSource(null); }, [flow?.inView, copy]);
  const autoSource = !flow?.paused && ["source-open", "focus-source"].includes(stage) ? copy.sourceIds[0] : null;
  const sourceId = manualSource || autoSource;
  const openSource = (id) => { flow?.pause?.(); setManualSource(id); };
  const closeSource = () => { setManualSource(null); flow?.resume?.(); };
  // Keep evidence readable outside the template's mobile product scale.
  const portalHost = hostRef.current?.closest('[data-wiki-camera="true"]');
  const source = <DemoSourcePreview sourceId={sourceId} locale={locale} onClose={closeSource} />;
  return (
    <div className="wiki-browser kb-preview-wiki-browser" data-wiki-flow-state={stage} ref={hostRef}>
      <WikiSidebar copy={copy} />
      <div className="wiki-content kb-preview-wiki-content">
        <WikiReader copy={copy} stage={stage} sourceId={sourceId} onSource={openSource} />
        {sourceId && portalHost ? createPortal(source, portalHost) : source}
      </div>
    </div>
  );
}

function GraphProductSurface({ autoPlay, copy }) {
  const canvasRef = useRef(null);
  const [playback, setPlayback] = useState(() => ({ state: "idle", visible: GRAPH_NODES.length, total: GRAPH_NODES.length }));
  const graphData = useMemo(() => ({
    ...GRAPH_DATA,
    nodes: GRAPH_DATA.nodes.map((node) => ({ ...node, title: copy.labels[node.slug] ?? node.title })),
  }), [copy]);
  const labels = [
    ["summary", copy.summary, "#0052d9"],
    ["entity", copy.entity, "#2ba471"],
    ["concept", copy.concept, "#e37318"],
    ["synthesis", copy.synthesis, "#0594fa"],
    ["comparison", copy.comparison, "#d54941"],
  ];
  const visibleCount = Math.max(0, Math.min(playback.visible, GRAPH_NODES.length));

  useEffect(() => {
    if (!autoPlay) return undefined;
    const timer = window.setInterval(() => canvasRef.current?.replay(), 8200);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  const graphScale = playback.state === "complete"
    ? 1.055
    : playback.state === "playing" && visibleCount >= 8
      ? 1.025
      : 1;

  return (
    <div className="wiki-browser kb-preview-wiki-browser is-graph">
      <div className="wiki-graph kb-preview-graph">
        <div className="wiki-graph-search-container kb-preview-graph-search-container">
          <div className="wiki-graph-search-row kb-preview-graph-search-row">
            <div className="wiki-graph-search kb-preview-graph-search"><MagnifyingGlass size={12} /><span>{copy.search}</span><CaretDown size={10} /></div>
          </div>
        </div>
        <motion.div
          className="wiki-graph-canvas kb-preview-graph-canvas"
          animate={{ scale: graphScale }}
          transition={{ type: "spring", stiffness: 115, damping: 24, mass: 0.8 }}
          style={{ pointerEvents: "none", transformOrigin: "52% 54%" }}
        >
          <ObsidianGraphCanvas
            autoPlay={autoPlay}
            data={graphData}
            onPlaybackChange={setPlayback}
            ref={canvasRef}
            showArrows
          />
        </motion.div>
        <aside className="wiki-graph-legend kb-preview-graph-legend">
          <div className="legend-items kb-preview-legend-items">
            {labels.map(([type, label, color]) => <span className="legend-item" data-graph-legend-type={type} key={type}><i className="legend-dot" style={{ background: color }} />{label}</span>)}
          </div>
          <div className="legend-divider kb-preview-legend-divider" />
          <div className="wiki-graph-status-card kb-preview-legend-status">
            <span><Graph size={11} />{copy.overview}</span>
            <strong>{visibleCount} / {GRAPH_NODES.length} {copy.count.replace(/^14 \/ 14\s*/, "")}</strong>
            <small>{playback.state === "playing" ? copy.playbackRunning : copy.status}</small>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DemoPointer({ stage, reducedMotion, rootRef, paused }) {
  const [point, setPoint] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (reducedMotion || paused) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    let frame;
    let stopped = false;
    const started = performance.now();
    const measure = () => {
      if (stopped) return;
      const bounds = root.getBoundingClientRect();
      const target = root.querySelector('[data-wiki-source-trigger="true"]');
      const scaleX = bounds.width / (root.offsetWidth || 1);
      const scaleY = bounds.height / (root.offsetHeight || 1);
      let left = root.offsetWidth * 0.54;
      let top = root.offsetHeight * 0.37;
      if (stage !== "page" && stage !== "restore" && target) {
        const rect = target.getBoundingClientRect();
        left = (rect.left - bounds.left + rect.width * 0.58) / scaleX;
        top = (rect.top - bounds.top + rect.height * 0.55) / scaleY;
      }
      left = Math.max(8, Math.min(left, root.offsetWidth - 25));
      top = Math.max(8, Math.min(top, root.offsetHeight - 25));
      setPoint((old) => Math.abs(old.left - left) + Math.abs(old.top - top) < 0.25 ? old : { left, top });
      if (performance.now() - started < 900) frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [stage, reducedMotion, rootRef, paused]);
  if (reducedMotion || paused) return null;
  const clicking = stage === "clicking-source";
  const opacity = ["source-open", "focus-source"].includes(stage) ? 0 : 0.95;
  return (
    <motion.div aria-hidden="true" data-demo-pointer="true" animate={{ ...point, opacity, scale: clicking ? 0.88 : 1 }} initial={false} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} style={{ position: "absolute", zIndex: 30, width: 24, height: 24, pointerEvents: "none", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.22))" }}>
      {clicking ? <motion.span animate={{ opacity: [0.5, 0], scale: [0.7, 1.25] }} transition={{ duration: 0.18 }} style={{ position: "absolute", left: -4, top: -4, width: 18, height: 18, border: "1px solid rgba(37,99,235,.6)", borderRadius: "50%" }} /> : null}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2.8L18.3 12.1L12.1 13.4L9.3 19.7L4 2.8Z" fill="white" stroke="#111827" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    </motion.div>
  );
}

function wikiCamera(stage, reducedMotion, origin) {
  return { scale: !reducedMotion && stage === "focus-source" ? 1.07 : 1, x: 0, y: 0, transformOrigin: origin };
}

export function KnowledgeBaseProductPreview({ graphAutoPlay = false, locale = "en", phase = "complete", shellRef, view, wikiFlow }) {
  const viewCopy = (isChineseStory(locale) ? KNOWLEDGE_STORIES.zh : KNOWLEDGE_STORIES.en)[view];
  const viewportRef = useRef(null);
  const attachRef = useCallback((node) => {
    viewportRef.current = node;
    if (typeof shellRef === "function") shellRef(node);
    else if (shellRef) shellRef.current = node;
  }, [shellRef]);
  const [origin, setOrigin] = useState("50% 50%");
  const stage = wikiFlow?.stage ?? "page";
  useEffect(() => {
    if (view !== "wiki") return;
    if (stage === "page") { setOrigin("50% 50%"); return; }
    if (stage !== "source-open") return;
    const root = viewportRef.current;
    const surface = root?.querySelector('[data-wiki-camera="true"]');
    const panel = root?.querySelector(".demo-source-preview");
    if (!surface || !panel) return;
    const bounds = surface.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    if (bounds.width && bounds.height) setOrigin(`${((rect.left + rect.width / 2 - bounds.left) / bounds.width) * 100}% ${((rect.top + rect.height / 2 - bounds.top) / bounds.height) * 100}%`);
  }, [view, stage, locale]);
  const camera = view === "wiki" ? wikiCamera(stage, Boolean(wikiFlow?.reducedMotion), origin) : { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" };
  const surface = (
    <>
      <ProductSidebar copy={viewCopy.app} />
      <main className={`visual-knowledge-page kb-preview-knowledge-page ${view === "graph" ? "is-graph-tab" : ""}`}>
        <KnowledgeHeader active={view} copy={viewCopy.header} />
        <section className="visual-knowledge-wiki-host kb-preview-wiki-host">
          {view === "wiki" ? <WikiProductSurface copy={viewCopy.content} flow={wikiFlow} locale={locale} /> : <GraphProductSurface autoPlay={graphAutoPlay} copy={viewCopy.content} />}
        </section>
      </main>
    </>
  );
  return (
    <div className={`kb-product-preview-viewport kb-product-preview-${view}`} data-capability-demo={view} data-demo-phase={view === "wiki" ? stage : "obsidian-directed"} data-product-page-shell={view} ref={attachRef} style={{ position: "relative", overflow: "hidden" }}>
      {view === "wiki" ? (
        <motion.div data-wiki-camera="true" className="kb-preview-wiki-camera" animate={{ scale: camera.scale, x: camera.x, y: camera.y }} initial={false} transition={{ type: "spring", stiffness: 110, damping: 24, mass: 0.85 }} style={{ transformOrigin: camera.transformOrigin }}>
          <div className="kb-product-preview">{surface}</div>
        </motion.div>
      ) : (
        <motion.div className="kb-product-preview" animate={{ scale: camera.scale, x: camera.x, y: camera.y }} initial={false} transition={{ type: "spring", stiffness: 110, damping: 24, mass: 0.85 }} style={{ transformOrigin: camera.transformOrigin }}>{surface}</motion.div>
      )}
      {view === "wiki" ? <DemoPointer stage={stage} reducedMotion={Boolean(wikiFlow?.reducedMotion)} rootRef={viewportRef} paused={wikiFlow?.paused} /> : null}
    </div>
  );
}
