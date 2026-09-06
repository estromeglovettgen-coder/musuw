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
import "../real-chat-demo.css";

const COPY = Object.freeze({
  zh: Object.freeze({
    title: "下一阶段产品优先级判断",
    question: "下一阶段应该先提升搜索，还是先做团队协作？结合用户访谈、客服反馈和使用数据给出判断。",
    preparation: "正在拆解问题",
    steps: Object.freeze([
      { title: "检索用户访谈", summary: "23 份访谈 · 8 次提到协作" },
      { title: "核对客服反馈", summary: "127 条反馈 · 31 次提到“找不到”" },
      { title: "比较影响范围", summary: "使用数据 · 搜索失败后退出更明显" },
    ]),
    answer: "建议先提升搜索。团队协作有明确需求，但“找不到已有内容”影响的用户范围更大，也更直接阻断现有用户继续使用；协作可以排在搜索体验稳定之后。",
    citation: "优先级分析 · 3 组证据",
    searchDone: "3 组证据已比对",
    references: "23 份访谈 · 127 条反馈",
    placeholder: "基于你的知识提问",
    model: "DeepSeek V4 Flash",
    effort: "关闭",
    copy: "复制回答",
    save: "添加到知识库",
    finish: "形成判断",
    send: "发送",
    stop: "停止生成",
  }),
  en: Object.freeze({
    title: "Decide what to build next",
    question: "Should we improve search first or build team collaboration next? Use interviews, support feedback, and usage notes to decide.",
    preparation: "Breaking down the question",
    steps: Object.freeze([
      { title: "Review user interviews", summary: "23 interviews · collaboration mentioned 8 times" },
      { title: "Check support feedback", summary: "127 items · 31 mention finding existing content" },
      { title: "Compare impact", summary: "Usage notes · search failure correlates with exits" },
    ]),
    answer: "Improve search first. Collaboration has clear demand, but failure to find existing content affects more users and blocks the current workflow more directly. Collaboration should follow once search is reliable.",
    citation: "Priority analysis · 3 evidence sets",
    searchDone: "3 evidence sets compared",
    references: "23 interviews · 127 feedback items",
    placeholder: "Ask across your knowledge",
    model: "DeepSeek V4 Flash",
    effort: "Off",
    copy: "Copy answer",
    save: "Add to knowledge base",
    finish: "Recommendation ready",
    send: "Send",
    stop: "Stop generation",
  }),
});

const PHASES = Object.freeze([
  "idle",
  "typing",
  "sent",
  "searching",
  "comparing",
  "drafting",
  "answering",
  "complete",
]);

export const REAL_CHAT_PHASES = PHASES;

const QUERY_TYPING_MS = 39;
const ANSWER_TYPING_MS = 24;

function localize(locale) {
  return locale === "zh" || locale === "zh-CN" ? COPY.zh : COPY.en;
}

function phaseRank(phase) {
  return PHASES.indexOf(phase);
}

function buildTimeline(phase, copy) {
  const rank = phaseRank(phase);
  if (rank < phaseRank("searching")) return [];
  return copy.steps.map((step, index) => ({
    ...step,
    pending: rank === phaseRank("searching") + index,
    done: rank > phaseRank("searching") + index,
  })).filter((step, index) => index === 0 || rank >= phaseRank("searching") + index);
}

function RealChatComposer({ copy, query, isReplying, onChange, onSend, onStop }) {
  return (
    <div className="real-chat-composer visual-chat-composer">
      <div className="real-chat-composer__surface visual-chat-composer__surface">
        <textarea
          className="real-chat-composer__textarea visual-chat-composer__textarea"
          aria-label={copy.placeholder}
          placeholder={copy.placeholder}
          rows="1"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (query.trim()) onSend();
            }
          }}
        />
        <div className="real-chat-composer__toolbar visual-chat-composer__toolbar">
          <div className="real-chat-composer__tools visual-chat-composer__tools" aria-hidden="true">
            <span className="real-chat-composer__tool visual-chat-composer__tool"><At size={15} weight="bold" /></span>
            <span className="real-chat-composer__tool visual-chat-composer__tool"><ImageSquare size={15} /></span>
            <span className="real-chat-composer__tool visual-chat-composer__tool"><Paperclip size={15} /></span>
          </div>
          <div className="real-chat-composer__actions visual-chat-composer__actions">
            <button type="button" className="real-chat-composer__model visual-chat-composer__combined-picker" aria-label={copy.model}>
              <span>{copy.model}</span><small>{copy.effort}</small><CaretDown size={11} />
            </button>
            {isReplying ? (
              <button type="button" className="real-chat-composer__send visual-chat-composer__send is-stop" aria-label={copy.stop} onClick={onStop}>
                <span className="real-chat-composer__stop-square visual-chat-composer__stop-square" />
              </button>
            ) : (
              <button type="button" className="real-chat-composer__send visual-chat-composer__send" aria-label={copy.send} disabled={!query.trim()} onClick={onSend}>
                <PaperPlaneTilt size={14} weight="fill" />
              </button>
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
      <div className="visual-rag-pipeline__sr" role="status" aria-live="polite">
        {answered ? copy.searchDone : copy.preparation}
      </div>
      {answered && !expanded ? (
        <button type="button" className="visual-rag-pipeline__summary" aria-expanded="false" onClick={onToggle}>
          <span>{copy.searchDone}</span>
          <span className="visual-rag-pipeline__reference-summary">{copy.references}</span>
          <CaretDown size={14} className="is-folded" aria-hidden="true" />
        </button>
      ) : (
        <div className="visual-rag-timeline">
          {rank === phaseRank("sent") && (
            <div className="visual-rag-step is-running">
              <span className="visual-rag-step__rail" aria-hidden="true"><span className="visual-rag-step__spinner" /></span>
              <div className="visual-rag-step__body"><strong>{copy.preparation}</strong></div>
            </div>
          )}
          {timeline.map((step) => (
            <div key={step.title} className={`visual-rag-step ${step.pending ? "is-running" : "is-done"}`}>
              <span className="visual-rag-step__rail" aria-hidden="true">
                {step.pending ? <span className="visual-rag-step__spinner" /> : <Check size={14} weight="bold" />}
              </span>
              <span className="visual-rag-step__body">
                <strong>{step.title}</strong>
                {step.done && <span className="visual-rag-step__summary">{step.summary}</span>}
              </span>
            </div>
          ))}
          {answered && (
            <div className="visual-rag-step is-done">
              <span className="visual-rag-step__rail" aria-hidden="true"><Check size={14} weight="bold" /></span>
              <div className="visual-rag-step__body"><strong>{copy.finish}</strong></div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AssistantMessage({ copy, phase, answer, expanded, onToggle }) {
  const hasAssistant = phaseRank(phase) >= phaseRank("sent");
  if (!hasAssistant) return null;
  const answered = phaseRank(phase) >= phaseRank("answering");
  const complete = phase === "complete";

  return (
    <article className="real-chat-assistant visual-assistant-message">
      <div className="visual-assistant-message__context">
        <div className="visual-assistant-pipeline">
          <Pipeline copy={copy} phase={phase} expanded={expanded} onToggle={onToggle} />
        </div>
      </div>
      {answered && (
        <section className="real-chat-answer visual-assistant-answer">
          <div className="visual-assistant-answer__content">
            <div className="visual-assistant-markdown">
              {answer}
              {!complete && <span className="real-chat-answer__caret" aria-hidden="true" />}
            </div>
          </div>
          <span className="real-chat-citation"><LinkSimple size={13} />{copy.citation}</span>
          {complete && (
            <div className="visual-assistant-toolbar" role="toolbar" aria-label={copy.finish}>
              <button type="button" className="visual-assistant-toolbar__button" aria-label={copy.copy}><Copy size={14} /></button>
              <button type="button" className="visual-assistant-toolbar__button" aria-label={copy.save}><BookmarkSimple size={14} /></button>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

/**
 * The marketing preview follows the same visible turn contract as ChatIndex:
 * composer -> user message -> assistant pipeline events -> collapsed RAG row
 * -> streamed answer -> answer toolbar. It is intentionally a presentational
 * fixture; no fake numbered reasoning cards are used.
 */
export function ReasoningCapabilityDemo({ locale = "en" }) {
  const copy = useMemo(() => localize(locale), [locale]);
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

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    timerRefs.current.clear();
  }, []);

  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(() => {
      timerRefs.current.delete(timer);
      callback();
    }, delay);
    timerRefs.current.add(timer);
    return timer;
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setQuery("");
    setAnswer("");
    setTimelineExpanded(true);
    setCancelled(false);
  }, []);

  const runTurn = useCallback(() => {
    clearTimers();
    const runId = ++runRef.current;
    reset();
    if (reducedMotion) {
      setQuery("");
      setPhase("complete");
      setAnswer(copy.answer);
      setTimelineExpanded(false);
      return;
    }

    schedule(() => {
      if (runId !== runRef.current) return;
      setPhase("typing");
      let index = 0;
      const ticker = setInterval(() => {
        if (runId !== runRef.current) {
          clearInterval(ticker);
          return;
        }
        index += 1;
        setQuery(copy.question.slice(0, index));
        if (index >= copy.question.length) {
          clearInterval(ticker);
          timerRefs.current.delete(ticker);
          schedule(() => {
            if (runId !== runRef.current) return;
            setQuery("");
            setPhase("sent");
            schedule(() => setPhase("searching"), 560);
            schedule(() => setPhase("comparing"), 1480);
            schedule(() => setPhase("drafting"), 2420);
            schedule(() => {
              setPhase("answering");
              setTimelineExpanded(false);
              let answerIndex = 0;
              const answerTicker = setInterval(() => {
                answerIndex += 1;
                setAnswer(copy.answer.slice(0, answerIndex));
                if (answerIndex >= copy.answer.length) {
                  clearInterval(answerTicker);
                  timerRefs.current.delete(answerTicker);
                  schedule(() => setPhase("complete"), 240);
                  schedule(() => runTurn(), 4300);
                }
              }, ANSWER_TYPING_MS);
              timerRefs.current.add(answerTicker);
            }, 3360);
          }, 220);
        }
      }, QUERY_TYPING_MS);
      timerRefs.current.add(ticker);
    }, 520);
  }, [clearTimers, copy.answer, copy.question, reducedMotion, reset, schedule]);

  useEffect(() => {
    if (inView) runTurn();
    else {
      ++runRef.current;
      clearTimers();
      reset();
    }
    return () => {
      ++runRef.current;
      clearTimers();
    };
  }, [clearTimers, inView, reset, runTurn]);

  const isReplying = phaseRank(phase) >= phaseRank("sent") && phase !== "complete" && !cancelled;
  const showUserMessage = phaseRank(phase) >= phaseRank("sent");
  const showAssistantMessage = showUserMessage && (!cancelled || Boolean(answer));

  const handleSend = useCallback(() => {
    if (!query.trim()) return;
    clearTimers();
    ++runRef.current;
    setCancelled(false);
    setQuery("");
    setPhase("sent");
    setAnswer("");
    setTimelineExpanded(true);
    schedule(() => setPhase("searching"), 560);
    schedule(() => setPhase("comparing"), 1480);
    schedule(() => setPhase("drafting"), 2420);
    schedule(() => {
      setPhase("answering");
      setTimelineExpanded(false);
      let answerIndex = 0;
      const answerTicker = setInterval(() => {
        answerIndex += 1;
        setAnswer(copy.answer.slice(0, answerIndex));
        if (answerIndex >= copy.answer.length) {
          clearInterval(answerTicker);
          timerRefs.current.delete(answerTicker);
          setPhase("complete");
        }
      }, ANSWER_TYPING_MS);
      timerRefs.current.add(answerTicker);
    }, 3360);
  }, [clearTimers, copy.answer, query, schedule]);

  const handleStop = useCallback(() => {
    clearTimers();
    ++runRef.current;
    setCancelled(true);
    if (answer) setPhase("complete");
    setTimelineExpanded(false);
  }, [answer, clearTimers]);

  return (
    <MusuwProductShell
      className="capability-demo capability-demo-reasoning real-chat-demo"
      data-capability-demo="reasoning"
      data-chat-phase={phase}
      shellRef={rootRef}
      title={copy.title}
    >
      <div className="real-chat-demo__body visual-chat-view">
        <div className="real-chat-demo__messages visual-chat-messages">
          {showUserMessage && (
            <article className="visual-chat-message-row is-user">
              <article className="real-chat-user-message visual-user-message">
                <div className="visual-user-message__bubble">{copy.question}</div>
              </article>
            </article>
          )}
          {showAssistantMessage && (
            <article className="visual-chat-message-row is-assistant">
              <AssistantMessage copy={copy} phase={phase} answer={answer} expanded={timelineExpanded} onToggle={() => setTimelineExpanded((value) => !value)} />
            </article>
          )}
        </div>
        <div className="real-chat-input visual-chat-input">
          <RealChatComposer copy={copy} query={query} isReplying={isReplying} onChange={setQuery} onSend={handleSend} onStop={handleStop} />
        </div>
      </div>
    </MusuwProductShell>
  );
}

export default ReasoningCapabilityDemo;
