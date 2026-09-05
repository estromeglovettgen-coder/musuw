import { At } from "@phosphor-icons/react/At";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { Check } from "@phosphor-icons/react/Check";
import { Copy } from "@phosphor-icons/react/Copy";
import { ImageSquare } from "@phosphor-icons/react/ImageSquare";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { KnowledgeBaseProductPreview } from "./KnowledgeBaseProductPreview";
import { MusuwProductShell } from "./MusuwProductShell";
import {
  useCapabilityDemoPhase,
  useWikiDemoFlow,
} from "./productDemoMotion";

export { ReasoningCapabilityDemo } from "./RealChatCapabilityDemo";

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

function localize(locale) {
  return locale === "zh" || locale === "zh-CN" ? COPY.zh : COPY.en;
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

export function WikiCapabilityDemo({ locale = "en" }) {
  const flow = useWikiDemoFlow();

  return (
    <KnowledgeBaseProductPreview
      locale={locale}
      shellRef={flow.ref}
      view="wiki"
      wikiFlow={flow}
    />
  );
}

export function GraphCapabilityDemo({ locale = "en" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();

  return (
    <KnowledgeBaseProductPreview
      graphAutoPlay={inView && !reducedMotion}
      locale={locale}
      shellRef={ref}
      view="graph"
    />
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
