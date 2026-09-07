import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { Copy } from "@phosphor-icons/react/Copy";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { AuthoritativeChatComposer, AuthoritativeChatSurface } from "./AuthoritativeChatSurface";
import { KnowledgeBaseProductPreview } from "./KnowledgeBaseProductPreview";
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
      question: "What should we test after this retention review?",
      agent: "Knowledge Q&A",
      conclusionLabel: "Conclusion",
      conclusion: "Prioritize a shorter path to the first completed exercise; it is the clearest lever supported by both interviews and funnel drop-off.",
      validationLabel: "Verification boundary",
      validation: "Expand only if a controlled test improves completion and week-one retention. This evidence identifies a hypothesis, not proof of causality or a universal rollout.",
      sources: Object.freeze(["Interviews", "Usage funnel"]),
      copy: "Copy answer",
      save: "Save to knowledge base",
    }),
  }),
  zh: Object.freeze({
    shared: Object.freeze({
      placeholder: "基于你的知识提问",
      model: "DeepSeek V4 Flash",
      effort: "关闭",
    }),
    answer: Object.freeze({
      title: "保留有依据的研究结论",
      question: "这次留存复盘，最值得先验证什么？",
      agent: "知识问答",
      conclusionLabel: "结论",
      conclusion: "优先测试更短的首次练习路径；用户访谈与漏斗流失都指向它是当前最清晰的改进杠杆。",
      validationLabel: "验证边界",
      validation: "只有在对照实验同时改善练习完成率和首周留存时再扩大范围。现有证据提出的是待验证的假设，并不能证明因果或支持全面推广。",
      sources: Object.freeze(["用户访谈", "使用漏斗"]),
      copy: "复制回答",
      save: "保存到知识库",
    }),
  }),
});

function localize(locale) {
  return locale === "zh" || locale === "zh-CN" ? COPY.zh : COPY.en;
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
      graphAutoPlay={inView && reducedMotion === false}
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
    <AuthoritativeChatSurface
      className="capability-demo capability-demo-answer real-chat-demo"
      data-capability-demo="answer"
      data-demo-interactive="false"
      data-demo-phase={phase}
      inert
      messages={(
        <>
          <article className="visual-chat-message-row is-user">
            <article className="visual-user-message">
              <div className="visual-user-message__bubble">{copy.answer.question}</div>
            </article>
          </article>
          <article className="visual-chat-message-row is-assistant">
            <article className="visual-assistant-message">
              <section className="visual-assistant-answer">
                <div className="visual-assistant-answer__content">
                  <div className="visual-assistant-markdown">
                    <section className="real-chat-answer-section" data-answer-section="conclusion">
                      <h4>{copy.answer.conclusionLabel}</h4>
                      <p>{copy.answer.conclusion}</p>
                    </section>
                    <section className="real-chat-answer-section" data-answer-section="validation-boundary">
                      <h4>{copy.answer.validationLabel}</h4>
                      <p>{copy.answer.validation}</p>
                    </section>
                  </div>
                </div>
                <div className="real-chat-citations" aria-label={copy.answer.sources.join(", ")}>
                  {copy.answer.sources.map((source) => <span key={source} className="real-chat-citation"><LinkSimple size={12} aria-hidden="true" />{source}</span>)}
                </div>
                <div className="visual-assistant-toolbar" role="toolbar" aria-label={copy.answer.title}>
                  <button type="button" className="visual-assistant-toolbar__button" aria-label={copy.answer.copy} disabled><Copy size={14} /></button>
                  <button type="button" className="visual-assistant-toolbar__button" aria-label={copy.answer.save} disabled><BookmarkSimple size={14} /></button>
                </div>
              </section>
            </article>
          </article>
        </>
      )}
      shellRef={ref}
      title={copy.answer.title}
      composer={(
        <AuthoritativeChatComposer
          agent={copy.answer.agent}
          effort={copy.shared.effort}
          model={copy.shared.model}
          placeholder={copy.shared.placeholder}
        />
      )}
    />
  );
}
