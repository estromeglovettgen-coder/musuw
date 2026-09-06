import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

export const CAPABILITY_DEMO_PHASES = Object.freeze([
  "capture",
  "reason",
  "connect",
  "complete",
]);

export function nextCapabilityDemoPhase(phase) {
  const index = CAPABILITY_DEMO_PHASES.indexOf(phase);
  return CAPABILITY_DEMO_PHASES[(index + 1) % CAPABILITY_DEMO_PHASES.length];
}

export function resolveCapabilityDemoPhase(phase, reducedMotion) {
  return reducedMotion ? "complete" : phase;
}

export function useCapabilityDemoPhase() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(CAPABILITY_DEMO_PHASES[0]);

  useEffect(() => {
    if (reducedMotion) {
      setPhase("complete");
      return undefined;
    }
    if (!inView) {
      setPhase("capture");
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPhase((current) => nextCapabilityDemoPhase(current));
    }, 1500);

    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);

  return {
    ref,
    phase: resolveCapabilityDemoPhase(phase, reducedMotion),
  };
}

export const WIKI_DEMO_STAGES = Object.freeze([
  "loading-index",
  "index",
  "selecting-page",
  "loading-page",
  "page",
  "focus-source",
]);

const WIKI_STAGE_DURATIONS = Object.freeze({
  "loading-index": 620,
  index: 1200,
  "selecting-page": 620,
  "loading-page": 480,
  page: 1800,
  "focus-source": 2300,
});

/**
 * Mirrors WikiBrowser's real visible states while adding a deterministic
 * walkthrough director for the public preview. The data transitions remain
 * production-like: load Index -> select an existing page -> fetch it -> inspect
 * its source relationship. Motion is only a camera/cursor layer over those
 * states, never a second Wiki implementation.
 */
export function useWikiDemoFlow() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState("loading-index");

  useEffect(() => {
    if (reducedMotion) {
      setStage("page");
      return undefined;
    }
    if (!inView) {
      setStage("loading-index");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const index = WIKI_DEMO_STAGES.indexOf(stage);
      setStage(WIKI_DEMO_STAGES[(index + 1) % WIKI_DEMO_STAGES.length]);
    }, WIKI_STAGE_DURATIONS[stage]);

    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, stage]);

  return { ref, stage, reducedMotion };
}
