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

const DEMO_COPY = Object.freeze({
  en: Object.freeze({
    conversation: "Northstar Calibration Phrase in Aurora Observation Guide",
    question:
      "Which phrase marks the Northstar calibration in the Aurora observation guide? Include the source citation.",
    placeholder: "Ask questions directly to the model",
    reasoning: "reasoning round(s)",
    tools: "tool call(s)",
    answer: Object.freeze({
      confirmation: "I have confirmed the answer from the source document.",
      findingLead:
        "The phrase that marks the Northstar calibration in the Aurora observation guide is ",
      phrase: "ORBITAL SAGE 4826.",
      recordLead:
        "The guide's calibration record states: \"The Northstar calibration phrase is ",
      recordPhrase: "ORBITAL SAGE 4826.",
      recordTail:
        "\" It must be copied exactly into the observation record so a reviewer can distinguish evidence retrieved from this source from general model knowledge.",
      timing:
        " The calibration is recorded after the second horizon scan and before the spectral review, once the reference line has been confirmed stable.",
    }),
    citation: "auror...de.md",
    model: "DeepSeek V4 Flash",
    effort: "Off",
  }),
  "zh-CN": Object.freeze({
    conversation: "《极光观测指南》中的北极星校准短语",
    question: "《极光观测指南》中标记北极星校准的短语是什么？请附上来源引用。",
    placeholder: "直接向模型提问",
    reasoning: "轮推理",
    tools: "次工具调用",
    answer: Object.freeze({
      confirmation: "我已从来源文档中确认答案。",
      findingLead: "《极光观测指南》中标记北极星校准的短语是 ",
      phrase: "ORBITAL SAGE 4826。",
      recordLead: "指南的校准记录写明：“北极星校准短语是 ",
      recordPhrase: "ORBITAL SAGE 4826。",
      recordTail:
        "”该短语必须原样写入观测记录，以便审核人员区分来自此来源的证据与模型的一般知识。",
      timing: " 校准记录位于第二次地平线扫描之后、光谱审查之前，此时参考线已确认稳定。",
    }),
    citation: "极光...指南.md",
    model: "DeepSeek V4 Flash",
    effort: "关闭",
  }),
});

const COMPLETE_PHASE = "complete";
const ANSWER_SEGMENT_KEYS = Object.freeze([
  "confirmation",
  "findingLead",
  "phrase",
  "recordLead",
  "recordPhrase",
  "recordTail",
  "timing",
]);

function localizedCopy(locale) {
  return locale === "zh-CN" || locale === "zh" ? DEMO_COPY["zh-CN"] : DEMO_COPY.en;
}

function createSegmentMap(answer) {
  let offset = 0;
  return Object.fromEntries(
    ANSWER_SEGMENT_KEYS.map((key) => {
      const text = answer[key];
      const segment = { text, start: offset, end: offset + Array.from(text).length };
      offset = segment.end;
      return [key, segment];
    }),
  );
}

export function HeroProductDemo({ locale = "en" }) {
  const copy = localizedCopy(locale);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { amount: 0.32 });
  const reduceMotion = useReducedMotion();
  const questionCharacters = useMemo(() => Array.from(copy.question), [copy.question]);
  const answerSegments = useMemo(() => createSegmentMap(copy.answer), [copy.answer]);
  const answerCharacters = useMemo(
    () => ANSWER_SEGMENT_KEYS.flatMap((key) => Array.from(copy.answer[key])),
    [copy.answer],
  );
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

    if (!isInView) {
      setPhase("idle");
      setQuestionLength(0);
      setAnswerLength(0);
      return undefined;
    }

    let cancelled = false;
    const timers = new Set();
    const wait = (milliseconds) =>
      new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, milliseconds);
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

    const play = async () => {
      while (!cancelled) {
        setPhase("typing-question");
        setQuestionLength(0);
        setAnswerLength(0);
        await wait(450);
        if (!(await typeCharacters(questionCharacters, setQuestionLength, 27))) return;

        setPhase("sending");
        await wait(300);
        if (cancelled) return;
        setPhase("thinking");
        await wait(1150);
        if (cancelled) return;

        setPhase("answering");
        if (!(await typeCharacters(answerCharacters, setAnswerLength, 12))) return;
        setPhase(COMPLETE_PHASE);
        await wait(5200);
      }
    };

    play();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [answerCharacters, isInView, questionCharacters, reduceMotion]);

  const questionText = questionCharacters.slice(0, questionLength).join("");
  const hasSubmitted = ["thinking", "answering", COMPLETE_PHASE].includes(phase);
  const hasSummary = hasSubmitted;
  const hasAnswer = phase === "answering" || phase === COMPLETE_PHASE;
  const isComplete = phase === COMPLETE_PHASE;

  const visibleSegment = (key) => {
    const segment = answerSegments[key];
    const visibleLength = Math.max(0, Math.min(segment.text.length, answerLength - segment.start));
    return Array.from(segment.text).slice(0, visibleLength).join("");
  };
  const reachedSegmentEnd = (key) => answerLength >= answerSegments[key].end;
  const caretIn = (key) => {
    const segment = answerSegments[key];
    return phase === "answering" && answerLength > segment.start && answerLength < segment.end;
  };

  return (
    <MusuwProductShell
      ariaHidden
      className="hero-product-demo"
      shellRef={containerRef}
      title={copy.conversation}
    >
        {hasSubmitted ? (
          <motion.div
            className="hero-demo-question"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {copy.question}
          </motion.div>
        ) : null}

        <div className="hero-demo-thread">
          {hasSummary ? (
            <motion.div
              className="hero-demo-summary"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <strong>2</strong> {copy.reasoning}
              <span>·</span>
              <strong>3</strong> {copy.tools}
              <span>·</span>
              <strong>15s</strong>
              <CaretRight size={11} weight="bold" />
            </motion.div>
          ) : null}

          {hasAnswer ? (
            <motion.div
              className="hero-demo-answer"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {visibleSegment("confirmation") ? (
                <p>
                  {visibleSegment("confirmation")}
                  {caretIn("confirmation") ? <span className="hero-demo-caret" /> : null}
                </p>
              ) : null}

              {visibleSegment("findingLead") || visibleSegment("phrase") ? (
                <p>
                  {visibleSegment("findingLead")}
                  <strong>{visibleSegment("phrase")}</strong>
                  {caretIn("findingLead") || caretIn("phrase") ? (
                    <span className="hero-demo-caret" />
                  ) : null}
                </p>
              ) : null}

              {visibleSegment("recordLead") || visibleSegment("recordPhrase") ? (
                <p>
                  {visibleSegment("recordLead")}
                  <strong>{visibleSegment("recordPhrase")}</strong>
                  {visibleSegment("recordTail")}
                  {reachedSegmentEnd("recordTail") ? (
                    <span className="hero-demo-citation">{copy.citation}</span>
                  ) : null}{" "}
                  {visibleSegment("timing")}
                  {reachedSegmentEnd("timing") ? (
                    <span className="hero-demo-citation">{copy.citation}</span>
                  ) : null}
                  {caretIn("recordLead") ||
                  caretIn("recordPhrase") ||
                  caretIn("recordTail") ||
                  caretIn("timing") ? (
                    <span className="hero-demo-caret" />
                  ) : null}
                </p>
              ) : null}

              {isComplete ? (
                <motion.div
                  className="hero-demo-answer-actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Copy size={14} />
                  <BookmarkSimple size={14} />
                  <span className="hero-demo-info-action">
                    <Info size={12} />
                  </span>
                </motion.div>
              ) : null}
            </motion.div>
          ) : null}
        </div>

        <div
          className={`hero-demo-composer ${phase === "sending" ? "is-sending" : ""} ${hasSubmitted ? "has-submitted" : ""}`}
        >
          <div className="hero-demo-composer-text">
            {hasSubmitted ? copy.placeholder : questionText}
            {phase === "typing-question" ? <span className="hero-demo-caret" /> : null}
          </div>
          <div className="hero-demo-composer-tools">
            <div>
              <At size={15} weight="bold" />
              <ImageSquare size={15} weight="regular" />
              <Paperclip size={15} weight="regular" />
            </div>
            <div>
              <span className="hero-demo-model">
                <strong>{copy.model}</strong>
                <span>{copy.effort}</span>
                <CaretDown size={10} />
              </span>
              <motion.span
                className={`hero-demo-send ${hasSubmitted ? "is-disabled" : ""}`}
                animate={{ scale: phase === "sending" ? 0.9 : 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                <PaperPlaneTilt size={13} weight="regular" />
              </motion.span>
            </div>
          </div>
        </div>
    </MusuwProductShell>
  );
}
