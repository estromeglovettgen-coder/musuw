import { useEffect, useMemo, useRef, useState } from "react";
import { At } from "@phosphor-icons/react/At";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { Copy } from "@phosphor-icons/react/Copy";
import { ImageSquare } from "@phosphor-icons/react/ImageSquare";
import { Info } from "@phosphor-icons/react/Info";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { motion, useInView, useReducedMotion } from "motion/react";
import { MusuwProductShell } from "./MusuwProductShell";
import { DemoSourcePreview } from "./DemoSourcePreview";
import { HERO_STORY, isChineseStory } from "../data/knowledgeStories";

const COMPLETE_PHASE = "complete";
const ANSWER_SEGMENT_KEYS = Object.freeze([
  "confirmation", "findingLead", "phrase", "recordLead", "recordPhrase", "recordTail", "timing",
]);

function createSegmentMap(answer) {
  let offset = 0;
  return Object.fromEntries(ANSWER_SEGMENT_KEYS.map((key) => {
    const text = answer[key];
    const segment = { text, start: offset, end: offset + Array.from(text).length };
    offset = segment.end;
    return [key, segment];
  }));
}

export function HeroProductDemo({ locale = "en" }) {
  const copy = isChineseStory(locale) ? HERO_STORY["zh-CN"] : HERO_STORY.en;
  const containerRef = useRef(null);
  const inspecting = useRef(false);
  const isInView = useInView(containerRef, { amount: 0.32 });
  const reduceMotion = useReducedMotion();
  const questionCharacters = useMemo(() => Array.from(copy.question), [copy.question]);
  const answerSegments = useMemo(() => createSegmentMap(copy.answer), [copy.answer]);
  const answerCharacters = useMemo(() => ANSWER_SEGMENT_KEYS.flatMap((key) => Array.from(copy.answer[key])), [copy.answer]);
  const [phase, setPhase] = useState("idle");
  const [questionLength, setQuestionLength] = useState(0);
  const [answerLength, setAnswerLength] = useState(0);
  const [sourceId, setSourceId] = useState(null);

  useEffect(() => {
    inspecting.current = false;
    setSourceId(null);
    if (reduceMotion) {
      setPhase(COMPLETE_PHASE);
      setQuestionLength(questionCharacters.length);
      setAnswerLength(answerCharacters.length);
      return undefined;
    }
    if (!isInView) {
      setPhase("idle"); setQuestionLength(0); setAnswerLength(0);
      return undefined;
    }
    let cancelled = false;
    const timers = new Set();
    const wait = (milliseconds) => new Promise((resolve) => {
      const timer = window.setTimeout(() => { timers.delete(timer); resolve(); }, milliseconds);
      timers.add(timer);
    });
    const typeCharacters = async (characters, setter, cadence) => {
      for (let index = 1; index <= characters.length; index += 1) {
        if (cancelled) return false;
        setter(index);
        await wait(cadence);
      }
      return !cancelled;
    };
    const waitForInspection = async () => {
      while (!cancelled && inspecting.current) await wait(250);
    };
    const play = async () => {
      while (!cancelled) {
        await waitForInspection();
        if (cancelled) return;
        setPhase("typing-question"); setQuestionLength(0); setAnswerLength(0); setSourceId(null);
        await wait(420);
        if (!(await typeCharacters(questionCharacters, setQuestionLength, 23))) return;
        setPhase("sending"); await wait(260);
        if (cancelled) return;
        setPhase("thinking"); await wait(980);
        if (cancelled) return;
        setPhase("answering");
        if (!(await typeCharacters(answerCharacters, setAnswerLength, 9))) return;
        setPhase(COMPLETE_PHASE);
        await wait(3500);
        if (cancelled) return;
        await waitForInspection();
        if (cancelled) return;
        setSourceId(copy.sourceIds[1]);
        await wait(4000);
        await waitForInspection();
        if (cancelled) return;
        setSourceId(null);
        await wait(6500);
      }
    };
    play();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [answerCharacters, copy, isInView, questionCharacters, reduceMotion]);

  const hasSubmitted = ["thinking", "answering", COMPLETE_PHASE].includes(phase);
  const hasAnswer = phase === "answering" || phase === COMPLETE_PHASE;
  const isComplete = phase === COMPLETE_PHASE;
  const visibleSegment = (key) => {
    const segment = answerSegments[key];
    const characters = Array.from(segment.text);
    const length = Math.max(0, Math.min(characters.length, answerLength - segment.start));
    return characters.slice(0, length).join("");
  };
  const reachedSegmentEnd = (key) => answerLength >= answerSegments[key].end;
  const caretIn = (key) => {
    const segment = answerSegments[key];
    return phase === "answering" && answerLength > segment.start && answerLength < segment.end;
  };
  const closeSource = () => { setSourceId(null); inspecting.current = false; };
  const citation = (index) => (
    <button
      type="button"
      className="hero-demo-citation demo-citation-button"
      aria-expanded={sourceId === copy.sourceIds[index]}
      onClick={() => {
        inspecting.current = true;
        setSourceId(copy.sourceIds[index]);
      }}
    >{copy.citations[index]}</button>
  );

  return (
    <MusuwProductShell
      className="hero-product-demo"
      shellRef={containerRef}
      title={copy.conversation}
      data-story="everyday-law"
      data-demo-phase={phase}
      onFocusCapture={() => { inspecting.current = true; }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) inspecting.current = false;
      }}
    >
      {hasSubmitted ? (
        <motion.div className="hero-demo-question" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
          {copy.question}
        </motion.div>
      ) : null}
      <div className="hero-demo-thread">
        {hasSubmitted ? (
          <motion.div className="hero-demo-summary" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
            <strong>{copy.summary.primary}</strong><span>·</span>
            <strong>{copy.summary.secondary}</strong><span>·</span>
            <strong>{copy.summary.tertiary}</strong><CaretRight size={11} weight="bold" />
          </motion.div>
        ) : null}
        {hasAnswer ? (
          <motion.div className="hero-demo-answer" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {visibleSegment("confirmation") ? <p>{visibleSegment("confirmation")}{caretIn("confirmation") ? <span className="hero-demo-caret" /> : null}</p> : null}
            {visibleSegment("findingLead") || visibleSegment("phrase") ? (
              <p>{visibleSegment("findingLead")}<strong>{visibleSegment("phrase")}</strong>
                {reachedSegmentEnd("phrase") ? citation(0) : null}
                {caretIn("findingLead") || caretIn("phrase") ? <span className="hero-demo-caret" /> : null}
              </p>
            ) : null}
            {visibleSegment("recordLead") || visibleSegment("recordPhrase") ? (
              <p>{visibleSegment("recordLead")}<strong>{visibleSegment("recordPhrase")}</strong>{visibleSegment("recordTail")}
                {reachedSegmentEnd("recordTail") ? citation(1) : null}{" "}{visibleSegment("timing")}
                {reachedSegmentEnd("timing") ? citation(2) : null}
                {caretIn("recordLead") || caretIn("recordPhrase") || caretIn("recordTail") || caretIn("timing") ? <span className="hero-demo-caret" /> : null}
              </p>
            ) : null}
            {isComplete ? (
              <>
                <motion.div className="hero-demo-answer-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} aria-hidden="true">
                  <Copy size={14} /><BookmarkSimple size={14} /><span className="hero-demo-info-action"><Info size={12} /></span>
                </motion.div>
                <small className="demo-scope-note">{copy.disclaimer}</small>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </div>
      <div className={`hero-demo-composer ${phase === "sending" ? "is-sending" : ""} ${hasSubmitted ? "has-submitted" : ""}`}>
        <div className="hero-demo-composer-text">
          {hasSubmitted ? copy.placeholder : questionCharacters.slice(0, questionLength).join("")}
          {phase === "typing-question" ? <span className="hero-demo-caret" /> : null}
        </div>
        <div className="hero-demo-composer-tools">
          <div><At size={15} weight="bold" /><ImageSquare size={15} /><Paperclip size={15} /></div>
          <div>
            <span className="hero-demo-model"><strong>{copy.model}</strong><span>{copy.effort}</span><CaretDown size={10} /></span>
            <motion.span className={`hero-demo-send ${hasSubmitted ? "is-disabled" : ""}`} animate={{ scale: phase === "sending" ? 0.9 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }}>
              <PaperPlaneTilt size={13} />
            </motion.span>
          </div>
        </div>
      </div>
      <DemoSourcePreview sourceId={sourceId} locale={locale} onClose={closeSource} />
    </MusuwProductShell>
  );
}
