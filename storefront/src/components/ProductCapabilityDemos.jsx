import { useEffect, useRef, useState } from "react";
import { At } from "@phosphor-icons/react/At";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { Check } from "@phosphor-icons/react/Check";
import { Copy } from "@phosphor-icons/react/Copy";
import { FileText } from "@phosphor-icons/react/FileText";
import { ImageSquare } from "@phosphor-icons/react/ImageSquare";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { ShareNetwork } from "@phosphor-icons/react/ShareNetwork";
import { useInView, useReducedMotion } from "motion/react";
import { MusuwProductShell } from "./MusuwProductShell";
import {
  CAPABILITY_DEMO_PHASES,
  nextCapabilityDemoPhase,
  resolveCapabilityDemoPhase,
} from "./productDemoMotion";

const COPY = Object.freeze({
  en: Object.freeze({
    shared: Object.freeze({
      placeholder: "Ask questions directly to the model",
      model: "DeepSeek V4 Flash",
      effort: "Off",
    }),
    reasoning: Object.freeze({
      title: "Launch plan evidence review",
      status: "3 sources connected",
      question: "What changed in the launch plan, and why?",
      sourceItems: Object.freeze(["Launch brief", "Research notes", "Team update"]),
      steps: Object.freeze(["Search the library", "Compare the evidence", "Draft with citations"]),
      answer: "The release moved to October so the team can finish the accessibility review.",
      citation: "Team update · §4",
      rounds: "reasoning rounds",
      tools: "tool calls",
    }),
    wiki: Object.freeze({
      title: "Market signals · Wiki",
      status: "Saved just now",
      library: "Research library",
      items: Object.freeze(["Market signals", "Quarterly research notes", "Interview synthesis"]),
      sourceMeta: "18 pages · added today",
      breadcrumb: "Wiki / Research",
      pageTitle: "Market signals",
      summary: "Demand is shifting toward private, source-grounded knowledge tools.",
      entities: Object.freeze(["Privacy", "Knowledge work", "AI adoption"]),
      sourceLink: "4 linked sources",
      updated: "Updated from Quarterly research notes",
    }),
    graph: Object.freeze({
      title: "Launch strategy · Graph",
      status: "Mapping relationships",
      search: "Find an entity or relation",
      nodeUnit: "node",
      nodeUnits: "nodes",
      linkUnit: "link",
      linkUnits: "links",
      labels: Object.freeze({
        strategy: "Launch strategy",
        research: "User research",
        privacy: "Privacy",
        roadmap: "Roadmap",
        models: "Model choice",
        sources: "Source policy",
        metrics: "Success metrics",
      }),
    }),
    answer: Object.freeze({
      title: "Launch risk review",
      status: "Citations verified",
      question: "Which launch risk needs attention first?",
      response: "Accessibility review is the only risk blocking the release date.",
      citation: "Launch brief · Risk register",
      saved: "Saved to Product launch Wiki",
    }),
  }),
  zh: Object.freeze({
    shared: Object.freeze({
      placeholder: "直接向模型提问",
      model: "DeepSeek V4 Flash",
      effort: "关闭",
    }),
    reasoning: Object.freeze({
      title: "发布计划证据审查",
      status: "已连接 3 份资料",
      question: "发布计划改了什么？原因是什么？",
      sourceItems: Object.freeze(["发布简报", "研究笔记", "团队更新"]),
      steps: Object.freeze(["检索知识库", "比对资料证据", "生成带引用回答"]),
      answer: "发布时间调整到十月，以便团队完成无障碍审查。",
      citation: "团队更新 · 第 4 节",
      rounds: "轮推理",
      tools: "次工具调用",
    }),
    wiki: Object.freeze({
      title: "市场信号 · Wiki",
      status: "刚刚保存",
      library: "研究资料库",
      items: Object.freeze(["市场信号", "季度研究笔记", "访谈洞察汇总"]),
      sourceMeta: "18 页 · 今日添加",
      breadcrumb: "Wiki / 研究",
      pageTitle: "市场信号",
      summary: "用户更需要私密、可追溯来源的知识工具。",
      entities: Object.freeze(["隐私", "知识工作", "智能体应用"]),
      sourceLink: "关联 4 份资料",
      updated: "已根据《季度研究笔记》更新",
    }),
    graph: Object.freeze({
      title: "发布策略 · 图谱",
      status: "正在连接关系",
      search: "查找实体或关系",
      nodeUnit: "个节点",
      nodeUnits: "个节点",
      linkUnit: "条关系",
      linkUnits: "条关系",
      labels: Object.freeze({
        strategy: "发布策略",
        research: "用户研究",
        privacy: "隐私",
        roadmap: "路线图",
        models: "模型选择",
        sources: "来源规则",
        metrics: "成功指标",
      }),
    }),
    answer: Object.freeze({
      title: "发布风险审查",
      status: "引用已核验",
      question: "哪个发布风险最需要优先处理？",
      response: "无障碍审查是当前唯一影响发布日期的风险。",
      citation: "发布简报 · 风险清单",
      saved: "已保存到产品发布 Wiki",
    }),
  }),
});

const GRAPH_NODES = Object.freeze([
  Object.freeze({ key: "strategy", x: 280, y: 164, r: 22, phase: 0 }),
  Object.freeze({ key: "research", x: 128, y: 92, r: 16, phase: 1 }),
  Object.freeze({ key: "privacy", x: 104, y: 238, r: 13, phase: 2 }),
  Object.freeze({ key: "roadmap", x: 426, y: 86, r: 17, phase: 1 }),
  Object.freeze({ key: "models", x: 454, y: 220, r: 14, phase: 2 }),
  Object.freeze({ key: "sources", x: 284, y: 286, r: 13, phase: 3 }),
  Object.freeze({ key: "metrics", x: 284, y: 48, r: 12, phase: 3 }),
]);

const GRAPH_EDGES = Object.freeze([
  Object.freeze({ from: "strategy", to: "research", phase: 1 }),
  Object.freeze({ from: "strategy", to: "roadmap", phase: 1 }),
  Object.freeze({ from: "research", to: "privacy", phase: 2 }),
  Object.freeze({ from: "strategy", to: "models", phase: 2 }),
  Object.freeze({ from: "privacy", to: "sources", phase: 3 }),
  Object.freeze({ from: "models", to: "sources", phase: 3 }),
  Object.freeze({ from: "roadmap", to: "metrics", phase: 3 }),
]);

function localize(locale) {
  return locale === "zh" || locale === "zh-CN" ? COPY.zh : COPY.en;
}

function phaseIndex(phase) {
  return CAPABILITY_DEMO_PHASES.indexOf(phase);
}

function useCapabilityDemoPhase() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(CAPABILITY_DEMO_PHASES[0]);

  useEffect(() => {
    if (reducedMotion) {
      setPhase("complete");
      return undefined;
    }
    if (!inView) {
      setPhase("capture");
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPhase((current) => nextCapabilityDemoPhase(current));
    }, 1500);

    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);

  return {
    ref,
    phase: resolveCapabilityDemoPhase(phase, reducedMotion),
  };
}

function DemoComposer({ copy }) {
  return (
    <div className="product-demo-composer">
      <span>{copy.placeholder}</span>
      <div className="product-demo-composer-tools">
        <span><At size={13} weight="bold" /><ImageSquare size={13} /><Paperclip size={13} /></span>
        <span>
          <span className="product-demo-model">
            <strong>{copy.model}</strong><small>{copy.effort}</small><CaretDown size={9} />
          </span>
          <i><PaperPlaneTilt size={12} /></i>
        </span>
      </div>
    </div>
  );
}

export function ReasoningCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();
  const activeIndex = phaseIndex(phase);

  return (
    <MusuwProductShell
      className="capability-demo capability-demo-reasoning"
      data-capability-demo="reasoning"
      data-demo-phase={phase}
      shellRef={ref}
      title={copy.reasoning.title}
    >
      <div className="product-demo-query">
        <strong>{copy.reasoning.question}</strong>
      </div>
      <div className="product-demo-thread reasoning-demo-thread">
        <div className="product-demo-summary">
          <strong>2</strong> {copy.reasoning.rounds}<span>·</span>
          <strong>3</strong> {copy.reasoning.tools}<span>·</span><strong>15s</strong>
          <CaretRight size={10} weight="bold" aria-hidden="true" />
        </div>
        <ol className="reasoning-process">
          {copy.reasoning.steps.map((step, index) => (
            <li
              className={`${activeIndex === index + 1 ? "is-active" : ""} ${activeIndex > index + 1 ? "is-complete" : ""}`}
              key={step}
            >
              <span>{index + 1}</span>
              <div><strong>{step}</strong><small>{copy.reasoning.sourceItems[index]}</small></div>
              <Check size={12} weight="bold" aria-hidden="true" />
            </li>
          ))}
        </ol>
        <div className={`product-demo-answer ${phase === "complete" ? "is-complete" : ""}`}>
          <p>{copy.reasoning.answer}</p>
          <span><LinkSimple size={12} aria-hidden="true" />{copy.reasoning.citation}</span>
        </div>
      </div>
      <DemoComposer copy={copy.shared} />
    </MusuwProductShell>
  );
}

export function WikiCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();
  const activeIndex = phaseIndex(phase);

  return (
    <MusuwProductShell
      activeItem="library"
      className="capability-demo capability-demo-wiki"
      data-capability-demo="wiki"
      data-demo-phase={phase}
      shellRef={ref}
      title={copy.wiki.title}
    >
      <div className="wiki-demo-body">
        <aside className="wiki-demo-nav">
          <span className="demo-overline">{copy.wiki.library}</span>
          {copy.wiki.items.map((item, index) => (
            <div
              className={`${index === 0 ? "is-current" : ""} ${activeIndex >= Math.min(index, 2) ? "is-reached" : ""}`}
              key={item}
            >
              <FileText size={14} aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
          <small>{copy.wiki.sourceMeta}</small>
        </aside>
        <article className={`wiki-demo-page ${activeIndex >= 1 ? "is-updated" : ""}`}>
          <div className="wiki-demo-page-meta">
            <span>{copy.wiki.breadcrumb}</span>
            <small>{copy.wiki.updated}</small>
          </div>
          <h4>{copy.wiki.pageTitle}</h4>
          <p>{copy.wiki.summary}</p>
          <div className="wiki-entities">
            {copy.wiki.entities.map((entity) => <span key={entity}>{entity}</span>)}
          </div>
          <div className="wiki-source-link">
            <LinkSimple size={13} aria-hidden="true" />
            {copy.wiki.sourceLink}
            <CaretRight size={10} weight="bold" aria-hidden="true" />
          </div>
          <div className="wiki-page-lines" aria-hidden="true"><i /><i /><i /></div>
        </article>
      </div>
    </MusuwProductShell>
  );
}

export function GraphCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();
  const activeIndex = phaseIndex(phase);
  const nodesByKey = Object.fromEntries(GRAPH_NODES.map((node) => [node.key, node]));
  const activeNodeCount = GRAPH_NODES.filter((node) => node.phase <= activeIndex).length;
  const activeEdgeCount = GRAPH_EDGES.filter((edge) => edge.phase <= activeIndex).length;

  return (
    <MusuwProductShell
      activeItem="library"
      className="capability-demo capability-demo-graph"
      data-capability-demo="graph"
      data-demo-phase={phase}
      shellRef={ref}
      title={copy.graph.title}
    >
      <div className="graph-demo-toolbar">
        <span><MagnifyingGlass size={12} aria-hidden="true" />{copy.graph.search}</span>
        <span><ShareNetwork size={13} aria-hidden="true" />{activeNodeCount} / {GRAPH_NODES.length}</span>
      </div>
      <div className="graph-demo-canvas">
        <svg viewBox="0 0 560 330" role="img" aria-label={copy.graph.title}>
          <g className="graph-live-edges" aria-hidden="true">
            {GRAPH_EDGES.map((edge) => {
              const from = nodesByKey[edge.from];
              const to = nodesByKey[edge.to];
              return (
                <line
                  className={activeIndex >= edge.phase ? "is-linked" : ""}
                  pathLength="1"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  key={`${edge.from}-${edge.to}`}
                />
              );
            })}
          </g>
          <g className="graph-nodes">
            {GRAPH_NODES.map((node) => (
              <g
                className={`${node.key === "strategy" ? "is-primary" : ""} ${activeIndex >= node.phase ? "is-linked" : ""}`}
                transform={`translate(${node.x} ${node.y})`}
                key={node.key}
              >
                <circle r={node.r} />
                <text y={node.r + 20} textAnchor="middle">{copy.graph.labels[node.key]}</text>
              </g>
            ))}
          </g>
        </svg>
        <div className="graph-demo-legend" aria-hidden="true">
          <span><i />{activeNodeCount} {activeNodeCount === 1 ? copy.graph.nodeUnit : copy.graph.nodeUnits}</span>
          <span><i />{activeEdgeCount} {activeEdgeCount === 1 ? copy.graph.linkUnit : copy.graph.linkUnits}</span>
        </div>
      </div>
    </MusuwProductShell>
  );
}

export function AnswerCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();

  return (
    <MusuwProductShell
      className="capability-demo capability-demo-answer"
      data-capability-demo="answer"
      data-demo-phase={phase}
      shellRef={ref}
      title={copy.answer.title}
    >
      <div className="product-demo-query answer-demo-query">
        <strong>{copy.answer.question}</strong>
      </div>
      <div className="product-demo-thread answer-demo-thread">
        <div className="product-demo-summary">
          <strong>2</strong> {copy.reasoning.rounds}<span>·</span>
          <strong>3</strong> {copy.reasoning.tools}<span>·</span><strong>15s</strong>
          <CaretRight size={10} weight="bold" aria-hidden="true" />
        </div>
        <div className="product-demo-answer is-complete">
          <p>{copy.answer.response}</p>
          <span><LinkSimple size={12} aria-hidden="true" />{copy.answer.citation}</span>
          <div className="answer-demo-actions" aria-hidden="true">
            <Copy size={13} /><BookmarkSimple size={13} />
          </div>
        </div>
        <div className={`answer-demo-saved ${phase === "complete" ? "is-complete" : ""}`}>
          <Check size={12} weight="bold" aria-hidden="true" />
          {copy.answer.saved}
        </div>
      </div>
      <DemoComposer copy={copy.shared} />
    </MusuwProductShell>
  );
}
