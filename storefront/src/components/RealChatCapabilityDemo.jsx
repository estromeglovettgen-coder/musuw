import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { Check } from "@phosphor-icons/react/Check";
import { Copy } from "@phosphor-icons/react/Copy";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { AuthoritativeChatComposer, AuthoritativeChatSurface } from "./AuthoritativeChatSurface";
import { REASONING_STORY, isChineseStory } from "../data/knowledgeStories";
import "../real-chat-demo.css";

const PHASES = Object.freeze([
  "idle", "typing", "sent", "searching", "comparing", "drafting", "validating", "answering", "complete",
]);
export const REAL_CHAT_PHASES = PHASES;
const QUERY_TYPING_MS = 39;
const ANSWER_TYPING_MS = 18;
const phaseRank = (phase) => PHASES.indexOf(phase);

function buildTimeline(phase, copy) {
  const rank = phaseRank(phase);
  if (rank < phaseRank("sent")) return [];
  const firstActiveStage = rank - phaseRank("sent");
  const visibleCount = Math.min(copy.steps.length, Math.max(1, firstActiveStage + 1));
  return copy.steps.slice(0, visibleCount).map((step, index) => ({
    ...step,
    pending: rank < phaseRank("complete") && index === firstActiveStage,
    done: rank >= phaseRank("complete") || index < firstActiveStage,
  }));
}

function Pipeline({ copy, phase }) {
  const rank = phaseRank(phase);
  const timeline = buildTimeline(phase, copy);
  if (rank < phaseRank("sent")) return null;
  return (
    <section className="real-chat-pipeline visual-rag-pipeline">
      <div className="visual-rag-pipeline__sr" role="status" aria-live="polite">{copy.pipelineStatus}</div>
      {rank >= phaseRank("answering") ? (
        <div className="visual-rag-pipeline__summary" data-rag-pipeline-summary="complete">
          <strong>{copy.pipelineStatus}</strong>
          <span className="visual-rag-pipeline__reference-summary">{copy.pipelineSummary}</span>
        </div>
      ) : (
        <div className="visual-rag-timeline">
          {timeline.map((step) => (
            <div key={step.title} className={`visual-rag-step ${step.pending ? "is-running" : "is-done"}`}>
              <span className="visual-rag-step__rail" aria-hidden="true">{step.pending ? <span className="visual-rag-step__spinner" /> : <Check size={14} weight="bold" />}</span>
              <span className="visual-rag-step__body"><strong>{step.title}</strong>{step.done && <span className="visual-rag-step__summary">{step.summary}</span>}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AssistantMessage({ copy, locale, phase, answer }) {
  if (phaseRank(phase) < phaseRank("sent")) return null;
  const answered = phaseRank(phase) >= phaseRank("answering");
  const complete = phase === "complete";
  const labels = isChineseStory(locale) ? ["用户访谈", "客服反馈", "使用漏斗"] : ["Interviews", "Support", "Usage funnel"];
  return (
    <article className="real-chat-assistant visual-assistant-message">
      <div className="visual-assistant-message__context"><div className="visual-assistant-pipeline"><Pipeline copy={copy} phase={phase} /></div></div>
      {answered && (
        <section className="real-chat-answer visual-assistant-answer">
          <div className="visual-assistant-answer__content"><div className="visual-assistant-markdown">{answer}{!complete && <span className="real-chat-answer__caret" aria-hidden="true" />}</div></div>
          {complete && (
            <>
              <div className="real-chat-citations">
                {copy.sourceIds.map((id, index) => <span key={id} className="real-chat-citation demo-citation-button" data-demo-source-ref={id}><LinkSimple size={13} />{labels[index]}</span>)}
              </div>
              <div className="visual-assistant-toolbar" role="toolbar" aria-label={copy.finish}>
                <span className="visual-assistant-toolbar__button" aria-label={copy.copy}><Copy size={14} /></span>
                <span className="visual-assistant-toolbar__button" title={copy.save} aria-hidden="true"><BookmarkSimple size={14} /></span>
              </div>
            </>
          )}
        </section>
      )}
    </article>
  );
}

// The public fixture follows the native composer -> pipeline -> answer contract.
// The read-only composer does not pretend to answer arbitrary visitor questions.
export function ReasoningCapabilityDemo({ locale = "en" }) {
  const copy = useMemo(() => isChineseStory(locale) ? REASONING_STORY.zh : REASONING_STORY.en, [locale]);
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const timerRefs = useRef(new Set());
  const runRef = useRef(0);
  const [phase, setPhase] = useState("idle");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach((timer) => { clearTimeout(timer); clearInterval(timer); });
    timerRefs.current.clear();
  }, []);
  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(() => { timerRefs.current.delete(timer); callback(); }, delay);
    timerRefs.current.add(timer);
    return timer;
  }, []);
  const reset = useCallback(() => {
    setPhase("idle"); setQuery(""); setAnswer("");
  }, []);
  const runTurn = useCallback(() => {
    clearTimers();
    const runId = ++runRef.current;
    reset();
    if (reducedMotion) {
      setPhase("complete"); setAnswer(copy.answer);
      return;
    }
    const later = (callback, delay) => schedule(() => { if (runId === runRef.current) callback(); }, delay);
    const send = () => {
      setQuery(""); setPhase("sent");
      later(() => setPhase("searching"), 560);
      later(() => setPhase("comparing"), 1480);
      later(() => setPhase("drafting"), 2420);
      later(() => setPhase("validating"), 3300);
      later(() => {
        setPhase("answering");
        const characters = Array.from(copy.answer);
        let index = 0;
        const ticker = setInterval(() => {
          if (runId !== runRef.current) { clearInterval(ticker); return; }
          index += 1; setAnswer(characters.slice(0, index).join(""));
          if (index >= characters.length) {
            clearInterval(ticker); timerRefs.current.delete(ticker);
            later(() => setPhase("complete"), 240);
            later(() => runTurn(), 8500);
          }
        }, ANSWER_TYPING_MS);
        timerRefs.current.add(ticker);
      }, 4300);
    };
    later(() => {
      setPhase("typing");
      const characters = Array.from(copy.question);
      let index = 0;
      const ticker = setInterval(() => {
        if (runId !== runRef.current) { clearInterval(ticker); return; }
        index += 1; setQuery(characters.slice(0, index).join(""));
        if (index >= characters.length) {
          clearInterval(ticker); timerRefs.current.delete(ticker);
          later(send, 220);
        }
      }, QUERY_TYPING_MS);
      timerRefs.current.add(ticker);
    }, 520);
  }, [clearTimers, copy, reducedMotion, reset, schedule]);

  useEffect(() => {
    if (inView || reducedMotion) runTurn();
    else { ++runRef.current; clearTimers(); reset(); }
    return () => { ++runRef.current; clearTimers(); };
  }, [clearTimers, inView, reducedMotion, reset, runTurn]);

  const isReplying = phaseRank(phase) >= phaseRank("sent") && phase !== "complete";
  const showUserMessage = phaseRank(phase) >= phaseRank("sent");
  const showAssistantMessage = showUserMessage;

  return (
    <AuthoritativeChatSurface
      className="capability-demo capability-demo-reasoning real-chat-demo"
      data-capability-demo="reasoning"
      data-chat-phase={phase}
      data-demo-interactive="false"
      inert
      shellRef={rootRef}
      title={copy.title}
      welcome={phase === "idle" || phase === "typing" ? (isChineseStory(locale) ? "Hi，我是 Musuw，让你的知识触手可及" : "Hi, I am Musuw. Your knowledge, within reach.") : null}
      messages={(
        <div className="real-chat-demo__messages visual-chat-messages">
          {showUserMessage && <article className="visual-chat-message-row is-user"><article className="real-chat-user-message visual-user-message"><div className="visual-user-message__bubble">{copy.question}</div></article></article>}
          {showAssistantMessage && <article className="visual-chat-message-row is-assistant"><AssistantMessage copy={copy} locale={locale} phase={phase} answer={answer} /></article>}
        </div>
      )}
      composer={(
        <AuthoritativeChatComposer
          className="real-chat-composer"
          effort={copy.effort}
          isReplying={isReplying}
          model={copy.model}
          placeholder={copy.placeholder}
          query={query}
          sendLabel={copy.send}
          stopLabel={copy.stop}
        />
      )}
    />
  );
}
export default ReasoningCapabilityDemo;
