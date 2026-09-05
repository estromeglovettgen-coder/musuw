import { useMemo, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowsClockwise } from "@phosphor-icons/react/ArrowsClockwise";
import { BookOpenText } from "@phosphor-icons/react/BookOpenText";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCenteredText } from "@phosphor-icons/react/ChatCenteredText";
import { ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";
import { CornersOut } from "@phosphor-icons/react/CornersOut";
import { EyeSlash } from "@phosphor-icons/react/EyeSlash";
import { FileText } from "@phosphor-icons/react/FileText";
import { FolderSimple } from "@phosphor-icons/react/FolderSimple";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { Graph } from "@phosphor-icons/react/Graph";
import { ListBullets } from "@phosphor-icons/react/ListBullets";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { PauseCircle } from "@phosphor-icons/react/PauseCircle";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { PlayCircle } from "@phosphor-icons/react/PlayCircle";
import { Plus } from "@phosphor-icons/react/Plus";
import { Question } from "@phosphor-icons/react/Question";
import { Tag } from "@phosphor-icons/react/Tag";
import { Trash } from "@phosphor-icons/react/Trash";
import { TreeStructure } from "@phosphor-icons/react/TreeStructure";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { X } from "@phosphor-icons/react/X";
import { ObsidianGraphCanvas } from "./ObsidianGraphCanvas";
import { createDefaultObsidianGraphSettings } from "./obsidian-graph/obsidianGraphSettings";

// Mechanical React translation of the production Vue surface. Keep the source
// class contracts from menu.vue, KnowledgeBase.vue, and WikiBrowser.vue so the
// public preview drifts with the product only when those source surfaces change.
// Account and session values below are deliberately public-safe fixtures.
const PRODUCT_COPY = Object.freeze({
  zh: Object.freeze({
    app: Object.freeze({
      newChat: "新对话",
      knowledgeBases: "知识库",
      agents: "智能体",
      today: "今天",
      recent: "近7天",
      userName: "Musuw 演示",
      userMeta: "产品预览",
      sessions: Object.freeze([
        "你好！有什么可以帮你的吗？",
        "知识复利概念解析",
        "东京今日天气",
        "东京今天天气查询",
        "发布计划证据审查",
        "季度研究笔记",
        "Listmonk 项目调研",
        "知识图谱关系梳理",
        "模型接入方案",
        "资料来源核验",
      ]),
    }),
    header: Object.freeze({
      knowledgeBases: "知识库",
      current: "我的知识库",
      description: "支持点击或拖拽上传，多格式文档自动解析并智能分块，快速构建可检索的知识库",
      documents: "文档 (1)",
      wiki: "Wiki",
      graph: "图谱",
    }),
    wiki: Object.freeze({
      search: "搜索 Wiki 页面...",
      searching: "正在搜索…",
      loading: "加载中…",
      index: "索引",
      indexOverview: "知识库概览",
      indexLead: "这里汇总知识库中的摘要、实体、概念与它们之间的来源关系。",
      indexHint: "从左侧选择页面，或搜索整个 Wiki。",
      knowledge: "知识 12",
      summaries: "摘要 1",
      back: "FreeScout",
      pageTitle: "Listmonk",
      type: "实体",
      lead: "Listmonk 是一个开源自托管邮件简报与EDM营销平台，以替代昂贵Mailchimp、纯CPU高毛利和稳定的被动收入著称。",
      introBeforeLink: "Listmonk 是一款自托管的邮件简报（Newsletter）与 EDM 营销平台，定位是替代昂贵的 ",
      introAfterLink: "——不，其核心定位是替代昂贵的 Mailchimp 的自托管方案。它并不只是简单的发邮件脚本，而是包含了一整套邮件营销基础设施。",
      core: "核心功能",
      bullets: Object.freeze([
        "自托管邮件列表（Mailing List）管理",
        "新闻简报（Newsletter）制作与发送",
        "批量邮件营销系统",
        "订阅表单收集",
        "用户分群（Segment）管理",
        "定时群发",
        "打开/点击追踪",
        "邮件模板系统",
        "投递底层自带垃圾邮件评分 与 速率控制（投递调度）引擎",
      ]),
      audienceTitle: "目标客户",
      audience: "海外自媒体博主、独立产品创始人、跨境卖家、小规模工作室。",
      assessmentTitle: "盈利潜力评估（开发者视角）",
      assessment: "Listmonk 被评估为适合独立开发者进行云端托管 SaaS 订阅商业化的高潜力开源项目之一。",
      linkedFrom: "反向链接",
      sources: "资料来源",
      sourceTitle: "季度研究笔记",
      resultSummary: "开源自托管邮件简报与 EDM 营销平台，包含邮件列表、订阅与投递能力。",
      resultDate: "2026/09/04",
      groups: Object.freeze([
        Object.freeze({ label: "产品评估", count: 4, items: Object.freeze(["暴利程度", "短期爆单潜力", "自带自然流量", "魔改上手难度"]) }),
        Object.freeze({ label: "商业模式", count: 2, items: Object.freeze(["云端托管SaaS订阅模式", "长期躺赚能力"]) }),
        Object.freeze({ label: "平台", count: 1, items: Object.freeze([]) }),
        Object.freeze({ label: "开源项目", count: 5, items: Object.freeze(["Cal.com", "FreeScout", "Listmonk", "Penpot", "Plausible"]) }),
      ]),
    }),
    graph: Object.freeze({
      search: "搜索 Wiki 页面...",
      summary: "摘要",
      entity: "实体",
      concept: "概念",
      synthesis: "综合",
      comparison: "对比",
      fit: "适应屏幕",
      arrows: "隐藏箭头",
      overview: "全库概览",
      count: "14 / 14 个节点",
      status: "已展示知识库全部节点",
      settings: "图谱设置",
      settingsOpen: "打开图谱设置",
      settingsClose: "关闭图谱设置",
      settingsReset: "重置图谱设置",
      display: "显示",
      textFade: "文字淡化",
      nodeSize: "节点大小",
      linkThickness: "连线粗细",
      forces: "力",
      center: "中心力",
      repel: "排斥力",
      link: "连接力",
      linkDistance: "连接距离",
      playbackTitle: "图谱生长",
      playbackDescription: "按 Obsidian 的原生顺序逐个展示节点与关系。",
      playbackPlay: "播放",
      playbackPause: "暂停",
      playbackResume: "继续",
      playbackReplay: "重新播放",
      playbackProgress: "{visible} / {total}",
      playbackRunning: "正在按顺序展示节点与关系",
      playbackPaused: "播放已暂停",
      labels: Object.freeze({
        index: "Index",
        difficulty: "魔改上手难度",
        subscription: "云端托管SaaS订阅模式",
        passive: "长期躺赚能力",
        short: "短期爆单潜力",
        margin: "暴利程度",
        traffic: "自带自然流量",
        summary: "暴利方案 - Summary",
      }),
    }),
  }),
  en: Object.freeze({
    app: Object.freeze({
      newChat: "New chat",
      knowledgeBases: "Knowledge bases",
      agents: "Agents",
      today: "Today",
      recent: "Last 7 days",
      userName: "Musuw Demo",
      userMeta: "Product preview",
      sessions: Object.freeze([
        "How can I help you?",
        "Knowledge compounding analysis",
        "Tokyo weather today",
        "Tokyo forecast lookup",
        "Launch plan evidence review",
        "Quarterly research notes",
        "Listmonk project research",
        "Knowledge graph relationships",
        "Model integration plan",
        "Source evidence review",
      ]),
    }),
    header: Object.freeze({
      knowledgeBases: "Knowledge bases",
      current: "My knowledge base",
      description: "Upload by clicking or dragging. Documents are parsed and intelligently chunked into a searchable knowledge base.",
      documents: "Documents (1)",
      wiki: "Wiki",
      graph: "Graph",
    }),
    wiki: Object.freeze({
      search: "Search Wiki pages...",
      searching: "Searching…",
      loading: "Loading…",
      index: "Index",
      indexOverview: "Knowledge base overview",
      indexLead: "A directory of summaries, entities, concepts, and the source relationships between them.",
      indexHint: "Select a page from the sidebar or search the entire Wiki.",
      knowledge: "Knowledge 12",
      summaries: "Summaries 1",
      back: "FreeScout",
      pageTitle: "Listmonk",
      type: "Entity",
      lead: "Listmonk is an open-source, self-hosted newsletter and EDM marketing platform positioned as an alternative to Mailchimp.",
      introBeforeLink: "Listmonk is a self-hosted newsletter and EDM marketing platform positioned as an alternative to ",
      introAfterLink: "—more precisely, to Mailchimp. It combines mailing lists, campaigns, subscriptions, segmentation, scheduling, tracking, and templates.",
      core: "Core capabilities",
      bullets: Object.freeze([
        "Self-hosted mailing-list management",
        "Newsletter creation and delivery",
        "Bulk email campaigns",
        "Subscription form collection",
        "Audience segmentation",
        "Scheduled delivery",
        "Open and click tracking",
        "Email templates",
        "Spam scoring and delivery rate control",
      ]),
      audienceTitle: "Target customers",
      audience: "Independent publishers, product founders, cross-border sellers, and small studios.",
      assessmentTitle: "Commercial potential",
      assessment: "Listmonk is well suited to a hosted SaaS subscription operated by an independent developer.",
      linkedFrom: "Linked from",
      sources: "Sources",
      sourceTitle: "Quarterly research notes",
      resultSummary: "An open-source self-hosted newsletter and EDM platform with lists, subscriptions, and delivery tooling.",
      resultDate: "2026/09/04",
      groups: Object.freeze([
        Object.freeze({ label: "Product evaluation", count: 4, items: Object.freeze(["Profit margin", "Short-term sales", "Organic traffic", "Modification difficulty"]) }),
        Object.freeze({ label: "Business model", count: 2, items: Object.freeze(["Hosted SaaS subscription", "Long-term recurring revenue"]) }),
        Object.freeze({ label: "Platforms", count: 1, items: Object.freeze([]) }),
        Object.freeze({ label: "Open-source projects", count: 5, items: Object.freeze(["Cal.com", "FreeScout", "Listmonk", "Penpot", "Plausible"]) }),
      ]),
    }),
    graph: Object.freeze({
      search: "Search Wiki pages...",
      summary: "Summaries",
      entity: "Entities",
      concept: "Concepts",
      synthesis: "Synthesis",
      comparison: "Comparisons",
      fit: "Fit to view",
      arrows: "Hide arrows",
      overview: "Knowledge-base overview",
      count: "14 / 14 nodes",
      status: "Showing every node in the knowledge base",
      settings: "Graph settings",
      settingsOpen: "Open graph settings",
      settingsClose: "Close graph settings",
      settingsReset: "Reset graph settings",
      display: "Display",
      textFade: "Text fade",
      nodeSize: "Node size",
      linkThickness: "Link thickness",
      forces: "Forces",
      center: "Center force",
      repel: "Repel force",
      link: "Link force",
      linkDistance: "Link distance",
      playbackTitle: "Graph growth",
      playbackDescription: "Reveal nodes and links in Obsidian's native order.",
      playbackPlay: "Play",
      playbackPause: "Pause",
      playbackResume: "Resume",
      playbackReplay: "Replay",
      playbackProgress: "{visible} / {total}",
      playbackRunning: "Revealing nodes and links in sequence",
      playbackPaused: "Playback paused",
      labels: Object.freeze({
        index: "Index",
        difficulty: "Modification difficulty",
        subscription: "Hosted SaaS subscription",
        passive: "Long-term recurring revenue",
        short: "Short-term sales potential",
        margin: "Profit margin",
        traffic: "Organic traffic",
        summary: "Profitability - Summary",
      }),
    }),
  }),
});

const GRAPH_NODES = Object.freeze([
  Object.freeze({ id: "index", label: "Index", type: "index", x: 276, y: 249, r: 8 }),
  Object.freeze({ id: "github", label: "GitHub", type: "entity", x: 455, y: 153, r: 11 }),
  Object.freeze({ id: "passive", label: "长期躺赚能力", type: "concept", x: 522, y: 159, r: 12 }),
  Object.freeze({ id: "plausible", label: "Plausible", type: "entity", x: 376, y: 196, r: 11 }),
  Object.freeze({ id: "listmonk", label: "Listmonk", type: "entity", x: 435, y: 213, r: 11 }),
  Object.freeze({ id: "difficulty", label: "魔改上手难度", type: "concept", x: 562, y: 201, r: 12 }),
  Object.freeze({ id: "subscription", label: "云端托管SaaS订阅模式", type: "concept", x: 494, y: 238, r: 10 }),
  Object.freeze({ id: "penpot", label: "Penpot", type: "entity", x: 379, y: 252, r: 11 }),
  Object.freeze({ id: "freescout", label: "FreeScout", type: "entity", x: 442, y: 270, r: 11 }),
  Object.freeze({ id: "cal", label: "Cal.com", type: "entity", x: 605, y: 258, r: 11 }),
  Object.freeze({ id: "margin", label: "暴利程度", type: "concept", x: 548, y: 282, r: 12 }),
  Object.freeze({ id: "short", label: "短期爆单潜力", type: "concept", x: 400, y: 324, r: 12 }),
  Object.freeze({ id: "traffic", label: "自带自然流量", type: "concept", x: 525, y: 334, r: 12 }),
  Object.freeze({ id: "summary", label: "暴利方案 - Summary", type: "summary", x: 463, y: 342, r: 11 }),
]);

const ENTITY_NODE_IDS = Object.freeze(["github", "plausible", "listmonk", "penpot", "freescout", "cal"]);
const CONCEPT_NODE_IDS = Object.freeze(["passive", "difficulty", "subscription", "margin", "short", "traffic"]);
const GRAPH_EDGES = Object.freeze([
  ...ENTITY_NODE_IDS.flatMap((entity) => CONCEPT_NODE_IDS.map((concept) => [entity, concept])),
  ...ENTITY_NODE_IDS.map((entity) => [entity, "summary"]),
  ...CONCEPT_NODE_IDS.map((concept) => ["summary", concept]),
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
  const hasSelectedPage = stage === "loading-page" || stage === "page";

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
                    <span className={item === "Listmonk" && hasSelectedPage ? "is-selected" : ""} key={item}>
                      {group.label.includes("项目") || group.label.includes("source") ? <Tag size={11} /> : <span className="kb-preview-bulb" />}
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
            {copy.groups.slice(0, 3).map((group) => (
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
              <div className="wiki-reader-title-badges wiki-reader-title-badges--secondary kb-preview-reader-badges"><span className="wiki-badge wiki-badge--type"><Tag size={10} />{copy.type}</span><span className="wiki-badge wiki-badge--ver">v1</span></div>
            </div>
            <div className="wiki-reader-aside"><div className="wiki-reader-actions kb-preview-reader-actions"><PencilSimple size={13} /><ClockCounterClockwise size={13} /><Graph size={13} /><Trash size={13} /></div></div>
          </div>
        </div>
        <div className="kb-preview-reader-time"><ClockCounterClockwise size={10} />2026/09/04 02:58:23</div>
        <p className="kb-preview-reader-lead">{copy.lead}</p>
        <div className="wiki-reader-body kb-preview-reader-body">
          <p>{copy.introBeforeLink}<a className="wiki-content-link kb-preview-content-link" href="#feature">Cal.com</a>{copy.introAfterLink}</p>
          <h5>{copy.core}</h5>
          <ul>{copy.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          <h5>{copy.audienceTitle}</h5>
          <p>{copy.audience}</p>
          <h5>{copy.assessmentTitle}</h5>
          <p>{copy.assessment}</p>
        </div>
        <footer className="wiki-reader-footer kb-preview-reader-footer">
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.linkedFrom}</span><span className="wiki-reader-footer-value"><a className="wiki-content-link kb-preview-content-link" href="#feature">FreeScout</a></span></div>
          <div className="wiki-reader-footer-row"><span className="wiki-reader-footer-label">{copy.sources}</span><span className="wiki-reader-footer-value"><a className="wiki-content-link kb-preview-content-link" href="#feature">{copy.sourceTitle}</a></span></div>
        </footer>
      </div>
    </article>
  );
}

function WikiProductSurface({ copy, flow }) {
  const stage = flow?.stage ?? "page";

  return (
    <div className="wiki-browser kb-preview-wiki-browser" data-wiki-flow-state={stage}>
      <WikiSidebar copy={copy} stage={stage} />
      <div className="wiki-content kb-preview-wiki-content">
        {stage === "page" ? <WikiReader copy={copy} /> : null}
        {stage === "loading-page" ? <div className="wiki-reader kb-preview-wiki-reader"><div className="wiki-reader-empty kb-preview-reader-empty"><div className="wiki-empty-icon"><BookOpenText size={22} /></div><p className="wiki-empty-title">{copy.indexHint}</p></div></div> : null}
        {stage === "index" ? <WikiIndexReader copy={copy} /> : null}
        {stage === "loading-index" ? <WikiIndexReader copy={copy} loading /> : null}
      </div>
    </div>
  );
}

function GraphSettingSlider({ label, max, min, onChange, step, value }) {
  const fillRatio = (value - min) / (max - min);

  return (
    <label className="setting-item kb-preview-setting-item">
      <span>{label}</span>
      <input
        aria-label={label}
        className="graph-slider"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        style={{ "--slider-fill-ratio": fillRatio }}
        type="range"
        value={value}
      />
    </label>
  );
}

function GraphSettingsPanel({ copy, onClose, onPlaybackAction, onReset, onSettingChange, playback, settings }) {
  const displayOpen = !settings["collapse-display"];
  const forcesOpen = !settings["collapse-forces"];
  const actionLabel = playback.state === "playing"
    ? copy.playbackPause
    : playback.state === "paused"
      ? copy.playbackResume
      : playback.state === "complete"
        ? copy.playbackReplay
        : copy.playbackPlay;
  const ActionIcon = playback.state === "playing"
    ? PauseCircle
    : playback.state === "complete"
      ? ArrowsClockwise
      : PlayCircle;
  const progress = copy.playbackProgress
    .replace("{visible}", playback.visible)
    .replace("{total}", playback.total);

  return (
    <div className="obsidian-graph-controls-wrap kb-preview-graph-controls-wrap" data-graph-settings-panel="true">
      <div className="graph-controls kb-preview-graph-controls">
      <div className="graph-controls-actions kb-preview-graph-controls-actions">
        <button aria-label={copy.settingsReset} onClick={onReset} title={copy.settingsReset} type="button"><ArrowsClockwise size={12} /></button>
        <button aria-label={copy.settingsClose} onClick={onClose} title={copy.settingsClose} type="button"><X size={12} /></button>
      </div>
      <section className="graph-control-section kb-preview-graph-control-section">
        <button className="tree-item-self kb-preview-settings-heading" onClick={() => onSettingChange("collapse-display", displayOpen)} type="button">
          <CaretRight className={displayOpen ? "is-open" : ""} size={10} />{copy.display}
        </button>
        {displayOpen ? (
          <div className="tree-item-children kb-preview-settings-fields">
            <GraphSettingSlider label={copy.textFade} max={3} min={-3} onChange={(value) => onSettingChange("textFadeMultiplier", value)} step={0.1} value={settings.textFadeMultiplier} />
            <GraphSettingSlider label={copy.nodeSize} max={5} min={0.1} onChange={(value) => onSettingChange("nodeSizeMultiplier", value)} step={0.1} value={settings.nodeSizeMultiplier} />
            <GraphSettingSlider label={copy.linkThickness} max={5} min={0.1} onChange={(value) => onSettingChange("lineSizeMultiplier", value)} step={0.1} value={settings.lineSizeMultiplier} />
          </div>
        ) : null}
      </section>
      <section className="graph-control-section graph-playback-section kb-preview-graph-control-section kb-preview-graph-playback-section">
        <div className="graph-playback-heading kb-preview-graph-playback-heading">
          <strong><Graph size={11} />{copy.playbackTitle}</strong>
          <span aria-live="polite">{progress}</span>
        </div>
        <p>{copy.playbackDescription}</p>
        <button className="playback-button kb-preview-playback-button" disabled={playback.total === 0} onClick={onPlaybackAction} type="button">
          <ActionIcon size={12} />{actionLabel}
        </button>
      </section>
      <section className="graph-control-section kb-preview-graph-control-section">
        <button className="tree-item-self kb-preview-settings-heading" onClick={() => onSettingChange("collapse-forces", forcesOpen)} type="button">
          <CaretRight className={forcesOpen ? "is-open" : ""} size={10} />{copy.forces}
        </button>
        {forcesOpen ? (
          <div className="tree-item-children kb-preview-settings-fields">
            <GraphSettingSlider label={copy.center} max={1} min={0} onChange={(value) => onSettingChange("centerStrength", value)} step={0.01} value={settings.centerStrength} />
            <GraphSettingSlider label={copy.repel} max={20} min={0} onChange={(value) => onSettingChange("repelStrength", value)} step={0.1} value={settings.repelStrength} />
            <GraphSettingSlider label={copy.link} max={1} min={0} onChange={(value) => onSettingChange("linkStrength", value)} step={0.01} value={settings.linkStrength} />
            <GraphSettingSlider label={copy.linkDistance} max={500} min={30} onChange={(value) => onSettingChange("linkDistance", value)} step={1} value={settings.linkDistance} />
          </div>
        ) : null}
      </section>
      </div>
    </div>
  );
}

function GraphProductSurface({ autoPlay, copy }) {
  const canvasRef = useRef(null);
  const [settings, setSettings] = useState(() => createDefaultObsidianGraphSettings());
  const [showArrows, setShowArrows] = useState(false);
  const [playback, setPlayback] = useState(() => ({ state: "idle", visible: GRAPH_NODES.length, total: GRAPH_NODES.length }));
  const settingsOpen = !settings.close;
  const visibleCount = Math.max(0, Math.min(playback.visible, GRAPH_NODES.length));
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

  return (
    <div className="wiki-browser kb-preview-wiki-browser is-graph">
      <div className="wiki-graph kb-preview-graph">
        <div className="wiki-graph-search-container kb-preview-graph-search-container">
          <div className="wiki-graph-search-row kb-preview-graph-search-row">
            <div className="wiki-graph-search kb-preview-graph-search"><MagnifyingGlass size={12} /><span>{copy.search}</span><CaretDown size={10} /></div>
            <Question className="wiki-graph-help-trigger kb-preview-graph-help" size={15} />
          </div>
        </div>
        <div className="wiki-graph-canvas kb-preview-graph-canvas">
          <ObsidianGraphCanvas
            autoPlay={autoPlay}
            data={graphData}
            onPlaybackChange={setPlayback}
            ref={canvasRef}
            settings={settings}
            showArrows={showArrows}
          />
        </div>
        <aside className={`wiki-graph-legend kb-preview-graph-legend ${settingsOpen ? "is-settings-open" : ""}`}>
          <div className="legend-items kb-preview-legend-items">
            {labels.map(([type, label, color]) => <span className="legend-item clickable" data-graph-legend-type={type} key={type}><i className="legend-dot" style={{ background: color }} />{label}</span>)}
          </div>
          <div className="legend-divider kb-preview-legend-divider" />
          <div className="legend-actions kb-preview-legend-actions">
            <button className="legend-action" data-graph-action="fit-view" onClick={() => canvasRef.current?.fit()} type="button"><CornersOut size={11} />{copy.fit}</button>
            <button className="legend-action" data-graph-action="toggle-arrows" onClick={() => setShowArrows((visible) => !visible)} type="button"><EyeSlash size={11} />{copy.arrows}</button>
          </div>
          <div className="legend-settings kb-preview-legend-settings-wrap">
            {settingsOpen ? (
              <GraphSettingsPanel
                copy={copy}
                onClose={() => setSettings((current) => ({ ...current, close: true }))}
                onPlaybackAction={() => {
                  if (playback.state === "playing") canvasRef.current?.pause();
                  else if (playback.state === "paused") canvasRef.current?.resume();
                  else canvasRef.current?.play();
                }}
                onReset={() => setSettings({ ...createDefaultObsidianGraphSettings(), close: false })}
                onSettingChange={(key, value) => setSettings((current) => ({ ...current, [key]: value }))}
                playback={playback}
                settings={settings}
              />
            ) : (
              <button aria-expanded="false" aria-label={copy.settingsOpen} className="graph-settings-trigger legend-action kb-preview-legend-settings" data-graph-settings="true" onClick={() => setSettings((current) => ({ ...current, close: false }))} title={copy.settingsOpen} type="button"><GearSix size={11} /><span>{copy.settings}</span></button>
            )}
          </div>
          <div className="wiki-graph-status-card kb-preview-legend-status">
            <span><Graph size={11} />{copy.overview}</span>
            <strong>{visibleCount} / {GRAPH_NODES.length} {copy.count.replace(/^14 \/ 14\s*/, "")}</strong>
            <small>{playback.state === "playing" ? copy.playbackRunning : playback.state === "paused" ? copy.playbackPaused : copy.status}</small>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function KnowledgeBaseProductPreview({
  graphAutoPlay = false,
  locale = "en",
  phase = "complete",
  shellRef,
  view,
  wikiFlow,
}) {
  const copy = isChinese(locale) ? PRODUCT_COPY.zh : PRODUCT_COPY.en;

  return (
    <div
      className={`kb-product-preview-viewport kb-product-preview-${view}`}
      data-capability-demo={view}
      data-demo-phase={view === "wiki" ? wikiFlow?.stage ?? phase : "obsidian-native"}
      data-product-page-shell={view}
      ref={shellRef}
    >
      <div className="kb-product-preview">
        <ProductSidebar copy={copy.app} />
        <main className={`visual-knowledge-page kb-preview-knowledge-page ${view === "graph" ? "is-graph-tab" : ""}`}>
          <KnowledgeHeader active={view} copy={copy.header} />
          <section className="visual-knowledge-wiki-host kb-preview-wiki-host">
            {view === "wiki"
              ? <WikiProductSurface copy={copy.wiki} flow={wikiFlow} />
              : <GraphProductSurface autoPlay={graphAutoPlay} copy={copy.graph} />}
          </section>
        </main>
      </div>
    </div>
  );
}
