import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkSimple } from "@phosphor-icons/react/BookmarkSimple";
import { Copy } from "@phosphor-icons/react/Copy";
import { Info } from "@phosphor-icons/react/Info";
import { motion, useInView, useReducedMotion } from "motion/react";
import { AuthoritativeChatComposer, AuthoritativeChatSurface } from "./AuthoritativeChatSurface";
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
  // Keep the visibility observer for the existing hero contract, but do not
  // key the playback effect from it: the dashboard itself moves during the
  // hero scroll transform, which otherwise tears down and restarts typing on
  // every intersection-ratio update and makes the demo look frozen.
  useInView(containerRef, { amount: 0.32 });
  const reduceMotion = useReducedMotion();
  const questionCharacters = useMemo(() => Array.from(copy.question), [copy.question]);
  const answerSegments = useMemo(() => createSegmentMap(copy.answer), [copy.answer]);
  const answerCharacters = useMemo(() => ANSWER_SEGMENT_KEYS.flatMap((key) => Array.from(copy.answer[key])), [copy.answer]);
  const [phase, setPhase] = useState("idle");
  const [questionLength, setQuestionLength] = useState(0);
  const [answerLength, setAnswerLength] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setPhase(COMPLETE_PHASE);
      setQuestionLength(questionCharacters.length);
      setAnswerLength(answerCharacters.length);
      return undefined;
    }
    let cancelled = false;
    const timers = new Set();
    const wait = (milliseconds) => new Promise((resolve) => {
      const timer = window.setTimeout(() => { timers.delete(timer); resolve(); }, milliseconds);
      timers.add(timer);
    });
    const typeCharacters = (characters, setter, cadence) => new Promise((resolve) => {
      let index = 0;
      const startedAt = performance.now();
      const tick = (now) => {
        if (cancelled) {
          resolve(false);
          return;
        }
        const nextIndex = Math.min(characters.length, Math.max(1, Math.floor((now - startedAt) / cadence)));
        if (nextIndex > index) {
          index = nextIndex;
          setter(index);
        }
        if (index >= characters.length) {
          resolve(true);
          return;
        }
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
    const play = async () => {
      while (!cancelled) {
        setPhase("typing-question"); setQuestionLength(0); setAnswerLength(0);
        await wait(420);
        if (!(await typeCharacters(questionCharacters, setQuestionLength, 23))) return;
        setPhase("sending"); await wait(260);
        if (cancelled) return;
        setPhase("thinking"); await wait(980);
        if (cancelled) return;
        setPhase("answering");
        if (!(await typeCharacters(answerCharacters, setAnswerLength, 9))) return;
        setPhase(COMPLETE_PHASE);
        // Keep the resolved answer readable, but do not leave the hero looking
        // like a static screenshot for most of its loop.
        await wait(3_200);
      }
    };
    play();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [answerCharacters, copy, questionCharacters, reduceMotion]);

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
  const citation = (index) => (
    <span
      className="hero-demo-citation demo-citation-button"
      data-demo-source-ref={copy.sourceIds[index]}
    >{copy.citations[index]}</span>
  );

  const typedQuestion = questionCharacters.slice(0, questionLength).join("");
  const messages = (
    <>
      {hasSubmitted ? (
        <motion.div className="hero-demo-question authoritative-chat-user-message" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
          {copy.question}
        </motion.div>
      ) : null}
      <div className="hero-demo-thread authoritative-chat-assistant-message">
        {phase === "thinking" ? (
          <motion.div className="hero-demo-retrieval" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} role="status" aria-live="polite">
            <span className="hero-demo-retrieval-spinner" aria-hidden="true" />
            {isChineseStory(locale) ? "正在检索并核对相关资料…" : "Retrieving and checking relevant sources…"}
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
            {isComplete ? <motion.div className="hero-demo-answer-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} aria-hidden="true"><Copy size={17} /><BookmarkSimple size={17} /><span className="hero-demo-info-action"><Info size={14} /></span></motion.div> : null}
          </motion.div>
        ) : null}
      </div>
    </>
  );

  return (
    <AuthoritativeChatSurface
      className="hero-product-demo"
      shellRef={containerRef}
      title={copy.conversation}
      data-story="everyday-law"
      data-demo-phase={phase}
      data-demo-interactive="false"
      inert
      welcome={phase === "idle" || phase === "typing-question" ? (isChineseStory(locale) ? "Hi，我是 Musuw，让你的知识触手可及" : "Hi, I am Musuw. Your knowledge, within reach.") : null}
      messages={messages}
      composer={(
        <AuthoritativeChatComposer
          className={`hero-demo-composer ${phase === "sending" ? "is-sending" : ""} ${hasSubmitted ? "has-submitted" : ""}`}
          effort={copy.effort}
          isReplying={phase === "sending" || phase === "thinking" || phase === "answering"}
          model={copy.model}
          placeholder={copy.placeholder}
          query={hasSubmitted ? "" : typedQuestion}
        />
      )}
    />
  );
}
