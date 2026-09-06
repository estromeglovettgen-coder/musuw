import { useEffect, useMemo, useRef, useState } from "react";
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

// Public-safe fixtures deliberately mirror a coherent real user's workspace.
// Wiki and Graph use different knowledge bases so each homepage demo can speak
// to a different common job while preserving the production UI contract.
const PRODUCT_COPY = Object.freeze({
  zh: Object.freeze({
    wiki: Object.freeze({
      app: Object.freeze({
        newChat: "新对话",
        knowledgeBases: "知识库",
        agents: "智能体",
        today: "今天",
        recent: "近7天",
        userName: "Musuw 演示",
        userMeta: "个人知识空间",
        sessions: Object.freeze([
          "Agent Memory 和 RAG 有什么区别？",
          "整理 MCP 学习资料",
          "课程笔记：Agent Evaluation",
          "长上下文为什么还需要记忆？",
          "AI Agent 学习路线",
          "论文阅读：Memory Systems",
          "视频笔记：Tool Use",
          "Context Engineering 资料梳理",
        ]),
      }),
      header: Object.freeze({
        knowledgeBases: "知识库",
        current: "AI Agent 学习库",
        description: "论文、课程、文章和视频笔记持续汇入，自动整理成可检索的 Wiki 与知识关系",
        documents: "文档 (26)",
        wiki: "Wiki",
        graph: "图谱",
      }),
      content: Object.freeze({
        search: "搜索 Wiki 页面...",
        loading: "正在整理知识索引…",
        index: "索引",
        indexOverview: "AI Agent 学习库",
        indexLead: "来自论文、课程、文章、视频和个人笔记的核心概念已经自动整理到这里。",
        indexHint: "选择一个页面，查看它如何从多份资料中汇总并保留来源关系。",
        knowledge: "知识 18",
        summaries: "摘要 6",
        back: "RAG",
        pageTitle: "Agent Memory",
        type: "概念",
        lead: "Agent Memory 是让智能体在一次对话之外保留并重新利用上下文、经验或用户信息的机制。",
        introBeforeLink: "在你的资料里，Agent Memory 经常与 ",
        inlineLink: "RAG",
        introAfterLink: " 一起出现，但两者解决的问题不同：RAG 负责取回外部知识，Memory 更强调持续保留和复用过去的信息。",
        core: "常见类型",
        bullets: Object.freeze([
          "短期记忆：维持当前任务需要的临时上下文",
          "长期记忆：跨会话保留稳定信息与偏好",
          "情景记忆：保存过去发生过的任务与事件",
          "语义记忆：沉淀可复用的事实、概念与关系",
        ]),
        audienceTitle: "与长上下文的区别",
        audience: "更长的上下文窗口能一次装下更多内容，但不会自动决定哪些信息值得长期保留，也不会替你建立跨会话的持续记忆。",
        assessmentTitle: "为什么这页会持续更新",
        assessment: "当新的论文、课程或笔记进入知识库，musuw 会继续补充定义、关联概念和来源，而不是把这次总结留在一条聊天记录里。",
        linkedFrom: "反向链接",
        backlinkTitle: "Context Engineering",
        sources: "资料来源",
        sourceTitle: "11 个来源 · 论文、视频与个人笔记",
        groups: Object.freeze([
          Object.freeze({ label: "核心概念", count: 5, items: Object.freeze(["AI Agent", "Tool Use", "Agent Memory", "Planning", "Evaluation"]) }),
          Object.freeze({ label: "协议与工具", count: 3, items: Object.freeze(["MCP", "Function Calling", "Tool Routing"]) }),
          Object.freeze({ label: "方法与架构", count: 4, items: Object.freeze(["RAG", "Context Engineering", "Multi-Agent", "Reflection"]) }),
        ]),
      }),
    }),
    graph: Object.freeze({
      app: Object.freeze({
        newChat: "新对话",
        knowledgeBases: "知识库",
        agents: "智能体",
        today: "今天",
        recent: "近7天",
        userName: "Musuw 演示",
        userMeta: "产品研究空间",
        sessions: Object.freeze([
          "为什么新用户首周流失？",
          "Onboarding 研究",
          "激活指标怎么定义？",
          "用户访谈：首次价值",
          "Retention 分析",
          "PLG 增长模型",
          "Churn 原因归纳",
          "新手引导竞品拆解",
        ]),
      }),
      header: Object.freeze({
        knowledgeBases: "知识库",
        current: "增长与产品研究",
        description: "用户访谈、客服反馈、使用分析和增长资料被连接成一张持续演化的产品知识网络",
        documents: "文档 (41)",
        wiki: "Wiki",
        graph: "图谱",
      }),
      content: Object.freeze({
        search: "搜索整张知识图谱...",
        summary: "摘要",
        entity: "资料",
        concept: "概念",
        synthesis: "综合",
        comparison: "对比",
        overview: "首周留存研究",
        count: "14 / 14 个节点",
        status: "跨资料关系已连接",
        playbackRunning: "正在把不同来源中的概念连接起来",
        labels: Object.freeze({
          index: "Index",
          interviews: "用户访谈",
          retention: "Retention",
          onboarding: "Onboarding 研究",
          activation: "Activation",
          time_to_value: "Time to Value",
          plg: "Product-led Growth",
          support: "客服反馈",
          analytics: "使用分析",
          competitors: "竞品拆解",
          friction: "首次使用阻力",
          aha: "Aha Moment",
          adoption: "Feature Adoption",
          summary: "首周留存 - Summary",
        }),
      }),
    }),
  }),
  en: Object.freeze({
    wiki: Object.freeze({
      app: Object.freeze({
        newChat: "New chat",
        knowledgeBases: "Knowledge bases",
        agents: "Agents",
        today: "Today",
        recent: "Last 7 days",
        userName: "Musuw Demo",
        userMeta: "Personal knowledge",
        sessions: Object.freeze([
          "How is Agent Memory different from RAG?",
          "Organize my MCP reading",
          "Course notes: Agent Evaluation",
          "Why memory if context windows are long?",
          "AI Agent learning path",
          "Paper notes: Memory Systems",
          "Video notes: Tool Use",
          "Context Engineering research",
        ]),
      }),
      header: Object.freeze({
        knowledgeBases: "Knowledge bases",
        current: "AI Agent Learning",
        description: "Papers, courses, articles, videos, and notes keep growing into a searchable Wiki and connected knowledge",
        documents: "Documents (26)",
        wiki: "Wiki",
        graph: "Graph",
      }),
      content: Object.freeze({
        search: "Search Wiki pages...",
        loading: "Building the knowledge index…",
        index: "Index",
        indexOverview: "AI Agent Learning",
        indexLead: "Core concepts from papers, courses, articles, videos, and personal notes are organized here automatically.",
        indexHint: "Open a page to see how several sources become one maintained, traceable piece of knowledge.",
        knowledge: "Knowledge 18",
        summaries: "Summaries 6",
        back: "RAG",
        pageTitle: "Agent Memory",
        type: "Concept",
        lead: "Agent Memory lets an agent retain and reuse context, experience, or user information beyond a single conversation.",
        introBeforeLink: "Across your sources, Agent Memory often appears next to ",
        inlineLink: "RAG",
        introAfterLink: ", but they solve different problems: RAG retrieves external knowledge, while Memory focuses on retaining and reusing information over time.",
        core: "Common forms",
        bullets: Object.freeze([
          "Short-term memory: temporary context needed for the current task",
          "Long-term memory: stable information and preferences across sessions",
          "Episodic memory: prior tasks and events the agent can recall",
          "Semantic memory: reusable facts, concepts, and relationships",
        ]),
        audienceTitle: "Why a long context window is not the same thing",
        audience: "A larger context window can hold more at once, but it does not decide what should persist or maintain useful information across future sessions.",
        assessmentTitle: "Why this page keeps getting better",
        assessment: "As new papers, courses, and notes arrive, musuw can extend the definition, related concepts, and source links instead of leaving the insight trapped in one chat.",
        linkedFrom: "Linked from",
        backlinkTitle: "Context Engineering",
        sources: "Sources",
        sourceTitle: "11 sources · papers, videos, and personal notes",
        groups: Object.freeze([
          Object.freeze({ label: "Core concepts", count: 5, items: Object.freeze(["AI Agent", "Tool Use", "Agent Memory", "Planning", "Evaluation"]) }),
          Object.freeze({ label: "Protocols & tools", count: 3, items: Object.freeze(["MCP", "Function Calling", "Tool Routing"]) }),
          Object.freeze({ label: "Methods & architecture", count: 4, items: Object.freeze(["RAG", "Context Engineering", "Multi-Agent", "Reflection"]) }),
        ]),
      }),
    }),
    graph: Object.freeze({
      app: Object.freeze({
        newChat: "New chat",
        knowledgeBases: "Knowledge bases",
        agents: "Agents",
        today: "Today",
        recent: "Last 7 days",
        userName: "Musuw Demo",
        userMeta: "Product research",
        sessions: Object.freeze([
          "Why do new users churn in week one?",
          "Onboarding research",
          "How should activation be defined?",
          "User interviews: first value",
          "Retention analysis",
          "PLG growth model",
          "Churn pattern synthesis",
          "Competitor onboarding teardown",
        ]),
      }),
      header: Object.freeze({
        knowledgeBases: "Knowledge bases",
        current: "Growth & Product Research",
        description: "Interviews, support feedback, usage analysis, and growth research connect into an evolving product knowledge network",
        documents: "Documents (41)",
        wiki: "Wiki",
        graph: "Graph",
      }),
      content: Object.freeze({
        search: "Search the knowledge graph...",
        summary: "Summaries",
        entity: "Sources",
        concept: "Concepts",
        synthesis: "Synthesis",
        comparison: "Comparisons",
        overview: "First-week retention research",
        count: "14 / 14 nodes",
        status: "Cross-source relationships connected",
        playbackRunning: "Connecting concepts found across different sources",
        labels: Object.freeze({
          index: "Index",
          interviews: "User interviews",
          retention: "Retention",
          onboarding: "Onboarding research",
          activation: "Activation",
          time_to_value: "Time to Value",
          plg: "Product-led Growth",
          support: "Support feedback",
          analytics: "Usage analytics",
          competitors: "Competitor teardown",
          friction: "First-use friction",
          aha: "Aha Moment",
          adoption: "Feature Adoption",
          summary: "Week-one retention - Summary",
        }),
      }),
    }),
  }),
});

const GRAPH_NODES = Object.freeze([
  Object.freeze({ id: "index", label: "Index", type: "index", x: 276, y: 249, r: 8 }),
  Object.freeze({ id: "interviews", label: "User interviews", type: "entity", x: 455, y: 153, r: 11 }),
  Object.freeze({ id: "retention", label: "Retention", type: "concept", x: 522, y: 159, r: 12 }),
  Object.freeze({ id: "onboarding", label: "Onboarding research", type: "entity", x: 376, y: 196, r: 11 }),
  Object.freeze({ id: "activation", label: "Activation", type: "entity", x: 435, y: 213, r: 11 }),
  Object.freeze({ id: "time_to_value", label: "Time to Value", type: "concept", x: 562, y: 201, r: 12 }),
  Object.freeze({ id: "plg", label: "Product-led Growth", type: "concept", x: 494, y: 238, r: 10 }),
  Object.freeze({ id: "support", label: "Support feedback", type: "entity", x: 379, y: 252, r: 11 }),
  Object.freeze({ id: "analytics", label: "Usage analytics", type: "entity", x: 442, y: 270, r: 11 }),
  Object.freeze({ id: "competitors", label: "Competitor teardown", type: "entity", x: 605, y: 258, r: 11 }),
  Object.freeze({ id: "friction", label: "First-use friction", type: "concept", x: 548, y: 282, r: 12 }),
  Object.freeze({ id: "aha", label: "Aha Moment", type: "concept", x: 400, y: 324, r: 12 }),
  Object.freeze({ id: "adoption", label: "Feature Adoption", type: "concept", x: 525, y: 334, r: 12 }),
  Object.freeze({ id: "summary", label: "Week-one retention - Summary", type: "summary", x: 463, y: 342, r: 11 }),
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
    slug: node.id,
    title: node.label,
    page_type: node.type,
    link_count: GRAPH_EDGES.filter(([source, target]) => source === node.id || target === node.id).length,
  }))),
  edges: Object.freeze(GRAPH_EDGES.map(([source, target]) => Object.freeze({ source, target }))),
  meta: Object.freeze({ mode: "overview" }),
});

export const GRAPH_PREVIEW_TOTALS = Object.freeze({
  nodes: GRAPH_NODES.length,
  links: GRAPH_EDGES.length,
});

function isChinese(locale) {
  return locale === "zh" || locale === "zh-CN";
}

function ProductSidebar({ copy }) {
  const today = copy.sessions.slice(0, 1);
  const recent = copy.sessions.slice(1);

  return (
    <aside className="visual-sidebar kb-preview-app-sidebar" data-product-app-sidebar="true">
      <header className="visual-sidebar__header kb-preview-sidebar-header">
        <img src="/images/musuw-logo.png" alt="" draggable={false} />
        <CaretLeft size={12} aria-hidden="true" />
      </header>
      <div className="visual-sidebar__primary-actions kb-preview-primary-actions">
        <button className="visual-sidebar__primary is-new kb-preview-primary is-new" type="button"><ChatCenteredText size={13} /><b>{copy.newChat}</b></button>
        <button className="visual-sidebar__primary is-kb is-active kb-preview-primary is-active" type="button"><FolderSimple size={13} /><b>{copy.knowledgeBases}</b><small>3</small></button>
        <button className="visual-sidebar__primary is-native kb-preview-primary" type="button"><UsersThree size={13} /><b>{copy.agents}</b></button>
      </div>
      <div className="visual-sidebar__history kb-preview-history">
        <section><h5>{copy.today}</h5>{today.map((item) => <span key={item}>{item}</span>)}</section>
        <section><h5>{copy.recent}</h5>{recent.map((item) => <span key={item}>{item}</span>)}</section>
      </div>
      <footer className="visual-sidebar__footer kb-preview-user">
        <i>M</i><span><b>{copy.userName}</b><small>{copy.userMeta}</small></span><CaretDown size={10} />
      </footer>
    </aside>
  );
}

function KnowledgeHeader({ active, copy }) {
  return (
    <header className="visual-knowledge-header kb-preview-knowledge-header">
      <div className="visual-knowledge-header__copy kb-preview-header-copy">
        <div className="visual-knowledge-breadcrumb kb-preview-breadcrumb">
          <CaretLeft size={10} /><span>{copy.knowledgeBases}</span><em>/</em><strong>{copy.current}</strong><CaretDown size={9} /><em>/</em><span>{active === "wiki" ? copy.wiki : copy.graph}</span>
        </div>
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

function WikiSidebar({ copy, stage }) {
  const hasDirectory = stage !== "loading-index";
  const hasSelectedPage = ["selecting-page", "loading-page", "page", "focus-source"].includes(stage);

  return (
    <aside className="wiki-sidebar kb-preview-wiki-sidebar" data-wiki-sidebar="true">
      <div className="wiki-sidebar-header kb-preview-wiki-sidebar-header">
        <label className="kb-preview-wiki-search">
          <MagnifyingGlass size={13} />
          <input aria-label={copy.search} placeholder={copy.search} readOnly type="search" value="" />
        </label>
      </div>
      <div className="wiki-page-list kb-preview-wiki-page-list">
        {hasDirectory ? (
          <>
            <div className={`wiki-nav-item kb-preview-wiki-index ${hasSelectedPage ? "" : "is-active"}`}><FileText size={12} /><span>{copy.index}</span></div>
            <div className="wiki-sidebar-divider kb-preview-wiki-divider" />
            <div className="wiki-tab-bar kb-preview-wiki-tabbar">
              <strong>{copy.knowledge}</strong><span>{copy.summaries}</span>
              <i><TreeStructure size={12} /><ListBullets size={12} /></i>
              <FolderSimple size={12} /><Plus size={11} />
            </div>
            <div className="wiki-tree-list kb-preview-wiki-tree">
              {copy.groups.map((group) => (
                <section key={group.label}>
                  <div><CaretRight className={group.items.length ? "is-open" : ""} size={10} /><strong>{group.label}</strong><small>{group.count}</small></div>
                  {group.items.map((item) => (
                    <span className={item === copy.pageTitle && hasSelectedPage ? "is-selected" : ""} key={item}>
                      <Tag size={11} />
                      <b>{item}</b>
                    </span>
                  ))}
                </section>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function WikiIndexReader({ copy, loading = false }) {
  return (
    <article className="wiki-reader kb-preview-wiki-reader" data-wiki-index="true">
      <div className="wiki-reader-inner kb-preview-wiki-reader-inner">
        <header className="wiki-reader-header kb-preview-index-header">
          <h4 className="wiki-reader-title">{copy.index}</h4>
          <span>{copy.indexOverview}</span>
        </header>
        {loading ? (
          <div className="wiki-reader-empty kb-preview-reader-empty"><p className="wiki-empty-title">{copy.loading}</p></div>
        ) : (
          <div className="wiki-reader-body wiki-index-body kb-preview-index-body">
            <p className="kb-preview-reader-lead">{copy.indexLead}</p>
            <p>{copy.indexHint}</p>
            {copy.groups.map((group) => (
              <section key={group.label}>
                <h5>{group.label}</h5>
                {group.items.length ? <ul>{group.items.map((item) => <li key={item}><a className="wiki-content-link kb-preview-content-link" href="#feature">{item}</a></li>)}</ul> : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function WikiReader({ copy }) {
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
        <div className="kb-preview-reader-time"><ClockCounterClockwise size={10} />2026/09/03 21:46:12</div>
        <p className="kb-preview-reader-lead">{copy.lead}</p>
        <div className="wiki-reader-body kb-preview-reader-body">
          <p>{copy.introBeforeLink}<a className="wiki-content-link kb-preview-content-link" href="#feature">{copy.inlineLink}</a>{copy.introAfterLink}</p>
          <h5>{copy.core}</h5>
          <ul>{copy.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          <h5>{copy.audienceTitle}</h5>
          <p>{copy.audience}</p>
          <h5>{copy.assessmentTitle}</h5>
          <p>{copy.assessment}</p>
        </div>
        <footer className="wiki-reader-footer kb-preview-reader-footer">
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.linkedFrom}</span><span className="wiki-reader-footer-value"><a className="wiki-content-link kb-preview-content-link" href="#feature">{copy.backlinkTitle}</a></span></div>
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.sources}</span><span className="wiki-reader-footer-value"><a className="wiki-content-link kb-preview-content-link" href="#feature">{copy.sourceTitle}</a></span></div>
        </footer>
      </div>
    </article>
  );
}

function WikiProductSurface({ copy, flow }) {
  const stage = flow?.stage ?? "page";
  const showPage = stage === "page" || stage === "focus-source";
  const showIndex = stage === "index" || stage === "selecting-page";

  return (
    <div className="wiki-browser kb-preview-wiki-browser" data-wiki-flow-state={stage}>
      <WikiSidebar copy={copy} stage={stage} />
      <div className="wiki-content kb-preview-wiki-content">
        {showPage ? <WikiReader copy={copy} /> : null}
        {stage === "loading-page" ? <div className="wiki-reader kb-preview-wiki-reader"><div className="wiki-reader-empty kb-preview-reader-empty"><div className="wiki-empty-icon"><BookOpenText size={22} /></div><p className="wiki-empty-title">{copy.indexHint}</p></div></div> : null}
        {showIndex ? <WikiIndexReader copy={copy} /> : null}
        {stage === "loading-index" ? <WikiIndexReader copy={copy} loading /> : null}
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

function DemoPointer({ stage, reducedMotion }) {
  if (reducedMotion || stage === "loading-index") return null;

  const target = stage === "index"
    ? { left: "11%", top: "35%", opacity: 0.9, scale: 1 }
    : stage === "selecting-page" || stage === "loading-page"
      ? { left: "18%", top: "53%", opacity: 1, scale: stage === "selecting-page" ? 0.84 : 1 }
      : stage === "focus-source"
        ? { left: "73%", top: "82%", opacity: 1, scale: 0.88 }
        : { left: "62%", top: "40%", opacity: 0.9, scale: 1 };
  const clicking = stage === "selecting-page" || stage === "focus-source";

  return (
    <motion.div
      aria-hidden="true"
      animate={target}
      initial={false}
      transition={{ type: "spring", stiffness: 165, damping: 24, mass: 0.7 }}
      style={{
        position: "absolute",
        zIndex: 30,
        width: 24,
        height: 24,
        pointerEvents: "none",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,.22))",
      }}
    >
      {clicking ? (
        <motion.span
          animate={{ opacity: [0.5, 0], scale: [0.45, 1.65] }}
          transition={{ duration: 0.55, repeat: 1, repeatDelay: 0.12 }}
          style={{
            position: "absolute",
            left: -5,
            top: -5,
            width: 22,
            height: 22,
            border: "1.5px solid rgba(37,99,235,.72)",
            borderRadius: "50%",
          }}
        />
      ) : null}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2.8L18.3 12.1L12.1 13.4L9.3 19.7L4 2.8Z" fill="white" stroke="#111827" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

function wikiCamera(stage, reducedMotion) {
  if (reducedMotion) return { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" };
  if (stage === "selecting-page") return { scale: 1.025, x: 5, y: 0, transformOrigin: "22% 54%" };
  if (stage === "loading-page") return { scale: 1.02, x: 2, y: 0, transformOrigin: "26% 54%" };
  if (stage === "page") return { scale: 1.042, x: -5, y: -2, transformOrigin: "68% 45%" };
  if (stage === "focus-source") return { scale: 1.075, x: -10, y: -7, transformOrigin: "72% 80%" };
  return { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" };
}

export function KnowledgeBaseProductPreview({
  graphAutoPlay = false,
  locale = "en",
  phase = "complete",
  shellRef,
  view,
  wikiFlow,
}) {
  const languageCopy = isChinese(locale) ? PRODUCT_COPY.zh : PRODUCT_COPY.en;
  const viewCopy = languageCopy[view];
  const camera = view === "wiki"
    ? wikiCamera(wikiFlow?.stage ?? phase, Boolean(wikiFlow?.reducedMotion))
    : { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" };

  return (
    <div
      className={`kb-product-preview-viewport kb-product-preview-${view}`}
      data-capability-demo={view}
      data-demo-phase={view === "wiki" ? wikiFlow?.stage ?? phase : "obsidian-directed"}
      data-product-page-shell={view}
      ref={shellRef}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <motion.div
        className="kb-product-preview"
        animate={{ scale: camera.scale, x: camera.x, y: camera.y }}
        initial={false}
        transition={{ type: "spring", stiffness: 110, damping: 24, mass: 0.85 }}
        style={{ transformOrigin: camera.transformOrigin }}
      >
        <ProductSidebar copy={viewCopy.app} />
        <main className={`visual-knowledge-page kb-preview-knowledge-page ${view === "graph" ? "is-graph-tab" : ""}`}>
          <KnowledgeHeader active={view} copy={viewCopy.header} />
          <section className="visual-knowledge-wiki-host kb-preview-wiki-host">
            {view === "wiki"
              ? <WikiProductSurface copy={viewCopy.content} flow={wikiFlow} />
              : <GraphProductSurface autoPlay={graphAutoPlay} copy={viewCopy.content} />}
          </section>
        </main>
      </motion.div>
      {view === "wiki" ? <DemoPointer stage={wikiFlow?.stage ?? phase} reducedMotion={Boolean(wikiFlow?.reducedMotion)} /> : null}
    </div>
  );
}
