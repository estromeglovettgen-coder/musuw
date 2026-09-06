import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { At } from "@phosphor-icons/react/At";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { Check } from "@phosphor-icons/react/Check";
import { Copy } from "@phosphor-icons/react/Copy";
import { ImageSquare } from "@phosphor-icons/react/ImageSquare";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { MusuwProductShell } from "./MusuwProductShell";
import { DemoSourcePreview } from "./DemoSourcePreview";
import { REASONING_STORY, isChineseStory } from "../data/knowledgeStories";
import "../real-chat-demo.css";

const PHASES = Object.freeze([
  "idle", "typing", "sent", "searching", "comparing", "drafting", "answering", "complete",
]);
export const REAL_CHAT_PHASES = PHASES;
const QUERY_TYPING_MS = 39;
const ANSWER_TYPING_MS = 18;
const phaseRank = (phase) => PHASES.indexOf(phase);

function buildTimeline(phase, copy) {
  const rank = phaseRank(phase);
  if (rank < phaseRank("searching")) return [];
  return copy.steps.map((step, index) => ({
    ...step, pending: rank === phaseRank("searching") + index, done: rank > phaseRank("searching") + index,
  })).filter((step, index) => index === 0 || rank >= phaseRank("searching") + index);
}

function RealChatComposer({ copy, query, isReplying, onSend, onStop }) {
  return (
    <div className="real-chat-composer visual-chat-composer">
      <div className="real-chat-composer__surface visual-chat-composer__surface">
        <textarea className="real-chat-composer__textarea visual-chat-composer__textarea" aria-label={copy.placeholder} placeholder={copy.placeholder} rows="1" value={query} readOnly />
        <div className="real-chat-composer__toolbar visual-chat-composer__toolbar">
          <div className="real-chat-composer__tools visual-chat-composer__tools" aria-hidden="true">
            <span className="real-chat-composer__tool visual-chat-composer__tool"><At size={15} weight="bold" /></span>
            <span className="real-chat-composer__tool visual-chat-composer__tool"><ImageSquare size={15} /></span>
            <span className="real-chat-composer__tool visual-chat-composer__tool"><Paperclip size={15} /></span>
          </div>
          <div className="real-chat-composer__actions visual-chat-composer__actions">
            <button type="button" className="real-chat-composer__model visual-chat-composer__combined-picker" aria-label={copy.model} tabIndex={-1}>
              <span>{copy.model}</span><small>{copy.effort}</small><CaretDown size={11} />
            </button>
            {isReplying ? (
              <button type="button" className="real-chat-composer__send visual-chat-composer__send is-stop" aria-label={copy.stop} onClick={onStop}><span className="real-chat-composer__stop-square visual-chat-composer__stop-square" /></button>
            ) : (
              <button type="button" className="real-chat-composer__send visual-chat-composer__send" aria-label={copy.send} disabled={!query.trim()} onClick={onSend}><PaperPlaneTilt size={14} weight="fill" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pipeline({ copy, phase, expanded, onToggle }) {
  const rank = phaseRank(phase);
  const answered = rank >= phaseRank("answering");
  const timeline = buildTimeline(phase, copy);
  if (rank < phaseRank("sent")) return null;
  return (
    <section className="real-chat-pipeline visual-rag-pipeline">
      <div className="visual-rag-pipeline__sr" role="status" aria-live="polite">{answered ? copy.searchDone : copy.preparation}</div>
      {answered && !expanded ? (
        <button type="button" className="visual-rag-pipeline__summary" aria-expanded="false" onClick={onToggle}>
          <span>{copy.searchDone}</span><span className="visual-rag-pipeline__reference-summary">{copy.references}</span><CaretDown size={14} className="is-folded" aria-hidden="true" />
        </button>
      ) : (
        <div className="visual-rag-timeline">
          {rank === phaseRank("sent") && <div className="visual-rag-step is-running"><span className="visual-rag-step__rail" aria-hidden="true"><span className="visual-rag-step__spinner" /></span><div className="visual-rag-step__body"><strong>{copy.preparation}</strong></div></div>}
          {timeline.map((step) => (
            <div key={step.title} className={`visual-rag-step ${step.pending ? "is-running" : "is-done"}`}>
              <span className="visual-rag-step__rail" aria-hidden="true">{step.pending ? <span className="visual-rag-step__spinner" /> : <Check size={14} weight="bold" />}</span>
              <span className="visual-rag-step__body"><strong>{step.title}</strong>{step.done && <span className="visual-rag-step__summary">{step.summary}</span>}</span>
            </div>
          ))}
          {answered && <div className="visual-rag-step is-done"><span className="visual-rag-step__rail" aria-hidden="true"><Check size={14} weight="bold" /></span><div className="visual-rag-step__body"><strong>{copy.finish}</strong></div></div>}
        </div>
      )}
    </section>
  );
}

function AssistantMessage({ copy, locale, phase, answer, expanded, onToggle, onSource, sourceId }) {
  if (phaseRank(phase) < phaseRank("sent")) return null;
  const answered = phaseRank(phase) >= phaseRank("answering");
  const complete = phase === "complete";
  const labels = isChineseStory(locale) ? ["用户访谈", "客服反馈", "使用漏斗"] : ["Interviews", "Support", "Usage funnel"];
  return (
    <article className="real-chat-assistant visual-assistant-message">
      <div className="visual-assistant-message__context"><div className="visual-assistant-pipeline"><Pipeline copy={copy} phase={phase} expanded={expanded} onToggle={onToggle} /></div></div>
      {answered && (
        <section className="real-chat-answer visual-assistant-answer">
          <div className="visual-assistant-answer__content"><div className="visual-assistant-markdown">{answer}{!complete && <span className="real-chat-answer__caret" aria-hidden="true" />}</div></div>
          {complete && (
            <>
              <div className="real-chat-citations">
                {copy.sourceIds.map((id, index) => <button key={id} type="button" className="real-chat-citation demo-citation-button" aria-expanded={sourceId === id} onClick={() => onSource(id)}><LinkSimple size={13} />{labels[index]}</button>)}
              </div>
              <div className="visual-assistant-toolbar" role="toolbar" aria-label={copy.finish}>
                <button type="button" className="visual-assistant-toolbar__button" aria-label={copy.copy} onClick={() => { navigator.clipboard?.writeText(copy.answer).catch(() => {}); }}><Copy size={14} /></button>
                <span className="visual-assistant-toolbar__button" title={copy.save} aria-hidden="true"><BookmarkSimple size={14} /></span>
              </div>
              <small className="demo-scope-note">{copy.disclaimer}</small>
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
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [cancelled, setCancelled] = useState(false);
  const [sourceId, setSourceId] = useState(null);

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
    setPhase("idle"); setQuery(""); setAnswer(""); setTimelineExpanded(true); setCancelled(false); setSourceId(null);
  }, []);
  const runTurn = useCallback(() => {
    clearTimers();
    const runId = ++runRef.current;
    reset();
    if (reducedMotion) {
      setPhase("complete"); setAnswer(copy.answer); setTimelineExpanded(false);
      return;
    }
    const later = (callback, delay) => schedule(() => { if (runId === runRef.current) callback(); }, delay);
    const send = () => {
      setQuery(""); setPhase("sent");
      later(() => setPhase("searching"), 560);
      later(() => setPhase("comparing"), 1480);
      later(() => setPhase("drafting"), 2420);
      later(() => {
        setPhase("answering"); setTimelineExpanded(false);
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
      }, 3360);
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

  const isReplying = phaseRank(phase) >= phaseRank("sent") && phase !== "complete" && !cancelled;
  const showUserMessage = phaseRank(phase) >= phaseRank("sent");
  const showAssistantMessage = showUserMessage && (!cancelled || Boolean(answer));
  const handleStop = useCallback(() => {
    clearTimers(); ++runRef.current; setCancelled(true);
    if (answer) setPhase("complete");
    setTimelineExpanded(false);
  }, [answer, clearTimers]);
  const inspectSource = (id) => { clearTimers(); ++runRef.current; setSourceId(id); };
  const closeSource = () => {
    setSourceId(null);
    if (!reducedMotion && inView) schedule(runTurn, 8500);
  };

  return (
    <MusuwProductShell className="capability-demo capability-demo-reasoning real-chat-demo" data-capability-demo="reasoning" data-chat-phase={phase} shellRef={rootRef} title={copy.title}>
      <div className="real-chat-demo__body visual-chat-view">
        <div className="real-chat-demo__messages visual-chat-messages">
          {showUserMessage && <article className="visual-chat-message-row is-user"><article className="real-chat-user-message visual-user-message"><div className="visual-user-message__bubble">{copy.question}</div></article></article>}
          {showAssistantMessage && <article className="visual-chat-message-row is-assistant"><AssistantMessage copy={copy} locale={locale} phase={phase} answer={answer} expanded={timelineExpanded} onToggle={() => setTimelineExpanded((value) => !value)} onSource={inspectSource} sourceId={sourceId} /></article>}
        </div>
        <div className="real-chat-input visual-chat-input"><RealChatComposer copy={copy} query={query} isReplying={isReplying} onSend={runTurn} onStop={handleStop} /></div>
      </div>
      <DemoSourcePreview sourceId={sourceId} locale={locale} onClose={closeSource} />
    </MusuwProductShell>
  );
}
export default ReasoningCapabilityDemo;
