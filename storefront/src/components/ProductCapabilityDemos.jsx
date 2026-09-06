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
      placeholder: "Ask across your knowledge",
      model: "DeepSeek V4 Flash",
      effort: "Off",
    }),
    answer: Object.freeze({
      title: "Keep the useful answer",
      question: "What did we learn about first-use friction?",
      response: "New users need a clear next step immediately after their first import; uncertainty at that moment is the strongest recurring friction in the recent research.",
      citation: "User interviews · 12 excerpts",
      summary: Object.freeze(["12 excerpts", "4 related concepts", "ready to reuse"]),
      saved: "Saved to Onboarding Wiki",
    }),
  }),
  zh: Object.freeze({
    shared: Object.freeze({
      placeholder: "基于你的知识提问",
      model: "DeepSeek V4 Flash",
      effort: "关闭",
    }),
    answer: Object.freeze({
      title: "把有用回答留下来",
      question: "关于首次使用阻力，我们已经确认了什么？",
      response: "新用户第一次导入资料后，需要马上知道下一步该做什么；最近的研究里，这个时刻的不确定感是最反复出现的使用阻力。",
      citation: "用户访谈 · 12 条证据",
      summary: Object.freeze(["12 条证据", "4 个相关概念", "可继续复用"]),
      saved: "已保存到 Onboarding Wiki",
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
          <strong>{copy.answer.summary[0]}</strong><span>·</span>
          <strong>{copy.answer.summary[1]}</strong><span>·</span>
          <strong>{copy.answer.summary[2]}</strong>
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
