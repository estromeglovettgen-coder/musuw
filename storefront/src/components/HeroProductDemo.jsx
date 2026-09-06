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
    conversation: "Why new users are not coming back",
    question:
      "Across recent interviews and support feedback, what are the three biggest reasons new users do not come back?",
    placeholder: "Ask across your knowledge",
    summary: Object.freeze({
      primary: "28 feedback items",
      secondary: "3 recurring issues",
      tertiary: "9 cited excerpts",
    }),
    answer: Object.freeze({
      confirmation: "Across 28 recent feedback items, three patterns stand out.",
      findingLead: "The biggest issue is ",
      phrase: "unclear next steps after the first import.",
      recordLead: "Users also struggle to ",
      recordPhrase: "verify whether an AI answer is trustworthy.",
      recordTail:
        " Several explicitly asked to open the exact source behind a claim.",
      timing:
        " A third pattern is that older notes become hard to rediscover once the workspace grows.",
    }),
    citations: Object.freeze([
      "User interviews · 12",
      "Support feedback · Aug",
      "Workspace study · §3",
    ]),
    model: "DeepSeek V4 Flash",
    effort: "Off",
  }),
  "zh-CN": Object.freeze({
    conversation: "新用户为什么没有继续回来",
    question: "结合最近的用户访谈和客服反馈，新用户没有继续使用的三个主要原因是什么？",
    placeholder: "基于你的知识提问",
    summary: Object.freeze({
      primary: "28 条反馈",
      secondary: "3 个重复问题",
      tertiary: "9 条可核验证据",
    }),
    answer: Object.freeze({
      confirmation: "综合最近 28 条反馈后，有三个问题反复出现。",
      findingLead: "最明显的是 ",
      phrase: "第一次导入资料后，不知道下一步该做什么。",
      recordLead: "其次，用户很难 ",
      recordPhrase: "判断 AI 回答到底可不可信。",
      recordTail: " 多位用户明确希望能直接打开支持某个结论的原始资料。",
      timing: " 第三个问题是资料越来越多后，之前保存的内容很难再次找到并利用。",
    }),
    citations: Object.freeze([
      "用户访谈 · 12 条",
      "客服反馈 · 8 月",
      "知识库使用研究 · §3",
    ]),
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
        await wait(420);
        if (!(await typeCharacters(questionCharacters, setQuestionLength, 23))) return;

        setPhase("sending");
        await wait(260);
        if (cancelled) return;
        setPhase("thinking");
        await wait(980);
        if (cancelled) return;

        setPhase("answering");
        if (!(await typeCharacters(answerCharacters, setAnswerLength, 9))) return;
        setPhase(COMPLETE_PHASE);
        await wait(5000);
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
            <strong>{copy.summary.primary}</strong>
            <span>·</span>
            <strong>{copy.summary.secondary}</strong>
            <span>·</span>
            <strong>{copy.summary.tertiary}</strong>
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
                {reachedSegmentEnd("phrase") ? (
                  <span className="hero-demo-citation">{copy.citations[0]}</span>
                ) : null}
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
                  <span className="hero-demo-citation">{copy.citations[1]}</span>
                ) : null}{" "}
                {visibleSegment("timing")}
                {reachedSegmentEnd("timing") ? (
                  <span className="hero-demo-citation">{copy.citations[2]}</span>
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
