import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { ArrowsClockwise } from "@phosphor-icons/react/ArrowsClockwise";
import { Brain } from "@phosphor-icons/react/Brain";
import { Check } from "@phosphor-icons/react/Check";
import { FileText } from "@phosphor-icons/react/FileText";
import { GlobeSimple } from "@phosphor-icons/react/GlobeSimple";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Quotes } from "@phosphor-icons/react/Quotes";
import { ShareNetwork } from "@phosphor-icons/react/ShareNetwork";
import { Stack } from "@phosphor-icons/react/Stack";
import { useInView, useReducedMotion } from "motion/react";
import {
  CAPABILITY_DEMO_PHASES,
  nextCapabilityDemoPhase,
  resolveCapabilityDemoPhase,
} from "./productDemoMotion";

const COPY = Object.freeze({
  en: Object.freeze({
    live: "Live product flow",
    ready: "Ready",
    reasoning: Object.freeze({
      title: "Evidence workspace",
      question: "What changed in the launch plan, and why?",
      sources: "Sources",
      sourceItems: Object.freeze(["Launch brief", "Research notes", "Team update"]),
      steps: Object.freeze(["Search the library", "Compare the evidence", "Draft with citations"]),
      answer: "The release moved to October so the team can finish the accessibility review.",
      citation: "Team update · §4",
    }),
    wiki: Object.freeze({
      title: "Living Wiki",
      source: "Quarterly research notes",
      sourceMeta: "18 pages · added today",
      pageTitle: "Market signals",
      summary: "Demand is shifting toward private, source-grounded knowledge tools.",
      entities: Object.freeze(["Privacy", "Knowledge work", "AI adoption"]),
      sourceLink: "4 linked sources",
    }),
    graph: Object.freeze({
      title: "Knowledge graph",
      status: "Mapping relationships",
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
    loop: Object.freeze({
      title: "Knowledge loop",
      status: "System in sync",
      stages: Object.freeze(["Capture", "Reason", "Connect", "Reuse"]),
    }),
    answer: Object.freeze({
      title: "From answer to knowledge",
      question: "Which launch risk needs attention first?",
      response: "Accessibility review is the only risk blocking the release date.",
      citation: "Launch brief · Risk register",
      saved: "Saved to Product launch Wiki",
    }),
  }),
  zh: Object.freeze({
    live: "产品流程演示",
    ready: "已就绪",
    reasoning: Object.freeze({
      title: "证据工作台",
      question: "发布计划改了什么？原因是什么？",
      sources: "资料来源",
      sourceItems: Object.freeze(["发布简报", "研究笔记", "团队更新"]),
      steps: Object.freeze(["检索知识库", "比对资料证据", "生成带引用回答"]),
      answer: "发布时间调整到十月，以便团队完成无障碍审查。",
      citation: "团队更新 · 第 4 节",
    }),
    wiki: Object.freeze({
      title: "动态 Wiki",
      source: "季度研究笔记",
      sourceMeta: "18 页 · 今日添加",
      pageTitle: "市场信号",
      summary: "用户更需要私密、可追溯来源的知识工具。",
      entities: Object.freeze(["隐私", "知识工作", "智能体应用"]),
      sourceLink: "关联 4 份资料",
    }),
    graph: Object.freeze({
      title: "知识图谱",
      status: "正在连接关系",
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
    loop: Object.freeze({
      title: "知识闭环",
      status: "系统已同步",
      stages: Object.freeze(["采集", "推理", "连接", "复用"]),
    }),
    answer: Object.freeze({
      title: "从回答到知识",
      question: "哪个发布风险最需要优先处理？",
      response: "无障碍审查是当前唯一影响发布日期的风险。",
      citation: "发布简报 · 风险清单",
      saved: "已保存到产品发布 Wiki",
    }),
  }),
});

const GRAPH_NODES = Object.freeze([
  Object.freeze({ key: "strategy", x: 280, y: 164, r: 30, phase: 0 }),
  Object.freeze({ key: "research", x: 128, y: 92, r: 22, phase: 1 }),
  Object.freeze({ key: "privacy", x: 104, y: 238, r: 19, phase: 2 }),
  Object.freeze({ key: "roadmap", x: 426, y: 86, r: 24, phase: 1 }),
  Object.freeze({ key: "models", x: 454, y: 220, r: 20, phase: 2 }),
  Object.freeze({ key: "sources", x: 284, y: 286, r: 19, phase: 3 }),
  Object.freeze({ key: "metrics", x: 284, y: 48, r: 17, phase: 3 }),
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

const LOOP_ICONS = Object.freeze([
  FileText,
  Brain,
  ShareNetwork,
  Stack,
  GlobeSimple,
  ArrowsClockwise,
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

function DemoHeader({ title, status }) {
  return (
    <div className="capability-demo-header">
      <span className="capability-window-dots" aria-hidden="true"><i /><i /><i /></span>
      <strong>{title}</strong>
      <span className="capability-demo-status"><i aria-hidden="true" />{status}</span>
    </div>
  );
}

export function ReasoningCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();
  const activeIndex = phaseIndex(phase);

  return (
    <div
      className="capability-demo capability-demo-reasoning"
      data-capability-demo="reasoning"
      data-demo-phase={phase}
      ref={ref}
    >
      <DemoHeader title={copy.reasoning.title} status={copy.live} />
      <div className="reasoning-demo-body">
        <aside className="reasoning-sources">
          <span className="demo-overline">{copy.reasoning.sources}</span>
          {copy.reasoning.sourceItems.map((item, index) => (
            <div className={activeIndex >= index ? "is-reached" : ""} key={item}>
              <FileText size={15} aria-hidden="true" />
              <span>{item}</span>
              <Check size={13} weight="bold" aria-hidden="true" />
            </div>
          ))}
        </aside>
        <div className="reasoning-workspace">
          <div className="reasoning-question">
            <Quotes size={18} aria-hidden="true" />
            <strong>{copy.reasoning.question}</strong>
          </div>
          <ol className="reasoning-steps">
            {copy.reasoning.steps.map((step, index) => (
              <li
                className={`${activeIndex === index + 1 ? "is-active" : ""} ${activeIndex > index + 1 ? "is-complete" : ""}`}
                key={step}
              >
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className={`reasoning-answer ${phase === "complete" ? "is-complete" : ""}`}>
            <p>{copy.reasoning.answer}</p>
            <span><LinkSimple size={13} aria-hidden="true" />{copy.reasoning.citation}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WikiCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();
  const activeIndex = phaseIndex(phase);

  return (
    <div
      className="capability-demo capability-demo-wiki"
      data-capability-demo="wiki"
      data-demo-phase={phase}
      ref={ref}
    >
      <DemoHeader title={copy.wiki.title} status={copy.ready} />
      <div className="wiki-demo-body">
        <div className={`wiki-source-card ${activeIndex >= 1 ? "is-active" : ""}`}>
          <FileText size={22} aria-hidden="true" />
          <strong>{copy.wiki.source}</strong>
          <span>{copy.wiki.sourceMeta}</span>
          <i /><i /><i /><i />
        </div>
        <div className="wiki-transfer" aria-hidden="true">
          <ArrowRight size={20} />
          <span />
        </div>
        <div className={`wiki-page-card ${activeIndex >= 2 ? "is-active" : ""}`}>
          <span className="wiki-page-path">WIKI / RESEARCH</span>
          <h4>{copy.wiki.pageTitle}</h4>
          <p>{copy.wiki.summary}</p>
          <div className="wiki-entities">
            {copy.wiki.entities.map((entity) => <span key={entity}>{entity}</span>)}
          </div>
          <div className="wiki-source-link">
            <LinkSimple size={14} aria-hidden="true" />
            {copy.wiki.sourceLink}
          </div>
        </div>
      </div>
    </div>
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
    <div
      className="capability-demo capability-demo-graph"
      data-capability-demo="graph"
      data-demo-phase={phase}
      ref={ref}
    >
      <DemoHeader title={copy.graph.title} status={copy.graph.status} />
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
                  key={`${edge.from}-${edge.to}-live`}
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
    </div>
  );
}

export function KnowledgeLoopDemo({ cards, locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();
  const activeIndex = phaseIndex(phase);
  const cardPhases = [0, 1, 2, 1, 0, 3];

  return (
    <div
      className="capability-demo capability-demo-loop"
      data-capability-demo="loop"
      data-demo-phase={phase}
      ref={ref}
    >
      <DemoHeader title={copy.loop.title} status={copy.loop.status} />
      <div className="knowledge-loop-progress" aria-hidden="true">
        {copy.loop.stages.map((stage, index) => (
          <div className={activeIndex >= index ? "is-active" : ""} key={stage}>
            <span>{index + 1}</span>
            <strong>{stage}</strong>
          </div>
        ))}
      </div>
      <div className="knowledge-loop-body">
        <div className="knowledge-loop-primary">
          {cards.slice(0, 3).map(({ title, body }, index) => {
            const Icon = LOOP_ICONS[index];
            return (
              <article className={activeIndex >= cardPhases[index] ? "is-reached" : ""} key={title}>
                <Icon size={19} aria-hidden="true" />
                <div><h3>{title}</h3><p>{body}</p></div>
              </article>
            );
          })}
        </div>
        <div className="knowledge-loop-rail">
          {cards.slice(3).map(({ title, body }, offset) => {
            const index = offset + 3;
            const Icon = LOOP_ICONS[index];
            return (
              <article className={activeIndex >= cardPhases[index] ? "is-reached" : ""} key={title}>
                <Icon size={18} aria-hidden="true" />
                <div><h3>{title}</h3><p>{body}</p></div>
                <Check size={14} weight="bold" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AnswerCapabilityDemo({ locale = "en" }) {
  const copy = localize(locale);
  const { ref, phase } = useCapabilityDemoPhase();

  return (
    <div
      className="capability-demo capability-demo-answer"
      data-capability-demo="answer"
      data-demo-phase={phase}
      ref={ref}
    >
      <DemoHeader title={copy.answer.title} status={copy.ready} />
      <div className="answer-demo-body">
        <div className="answer-demo-question">
          <MagnifyingGlass size={17} aria-hidden="true" />
          <strong>{copy.answer.question}</strong>
        </div>
        <div className="answer-demo-result">
          <p>{copy.answer.response}</p>
          <span><LinkSimple size={13} aria-hidden="true" />{copy.answer.citation}</span>
        </div>
        <div className={`answer-demo-saved ${phase === "complete" ? "is-complete" : ""}`}>
          <Check size={14} weight="bold" aria-hidden="true" />
          {copy.answer.saved}
        </div>
      </div>
    </div>
  );
}
