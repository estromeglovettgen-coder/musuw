import { useCallback, useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

export const CAPABILITY_DEMO_PHASES = Object.freeze(["capture", "reason", "connect", "complete"]);
export function nextCapabilityDemoPhase(phase) {
  const index = CAPABILITY_DEMO_PHASES.indexOf(phase);
  return CAPABILITY_DEMO_PHASES[(index + 1) % CAPABILITY_DEMO_PHASES.length];
}
export function resolveCapabilityDemoPhase(phase, reducedMotion) { return reducedMotion ? "complete" : phase; }
export function useCapabilityDemoPhase() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(CAPABILITY_DEMO_PHASES[0]);
  useEffect(() => {
    if (reducedMotion) { setPhase("complete"); return undefined; }
    if (!inView) { setPhase("capture"); return undefined; }
    const timer = window.setInterval(() => setPhase((current) => nextCapabilityDemoPhase(current)), 1500);
    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);
  return { ref, phase: resolveCapabilityDemoPhase(phase, reducedMotion) };
}

// Always start with readable UI. The source is already open before any zoom.
export const WIKI_DEMO_STAGES = Object.freeze([
  "page", "moving-source", "hovering-source", "clicking-source", "source-open", "focus-source", "restore",
]);
export const WIKI_STAGE_DURATIONS = Object.freeze({
  page: 2200, "moving-source": 850, "hovering-source": 450,
  "clicking-source": 180, "source-open": 650, "focus-source": 3600, restore: 1300,
});
export function useWikiDemoFlow() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState("page");
  const [paused, setPaused] = useState(false);
  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => { setPaused(false); setStage("restore"); }, []);

  useEffect(() => {
    if (reducedMotion || !inView) {
      setStage("page");
      if (!inView) setPaused(false);
      return undefined;
    }
    if (paused) return undefined;
    const timer = window.setTimeout(() => {
      const index = WIKI_DEMO_STAGES.indexOf(stage);
      setStage(WIKI_DEMO_STAGES[(index + 1) % WIKI_DEMO_STAGES.length]);
    }, WIKI_STAGE_DURATIONS[stage]);
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, stage, paused]);

  // Scroll only the existing reader, never the surrounding page or app chrome.
  // Element bounds account for the template's mobile scale and current camera.
  useEffect(() => {
    const reader = ref.current?.querySelector('[data-wiki-reader="true"]');
    if (!reader) return;
    if (!inView || stage === "restore") {
      reader.scrollTo({ top: 0, left: 0, behavior: reducedMotion || !inView ? "instant" : "smooth" });
      return;
    }
    if (stage !== "moving-source" || paused) return;
    const target = reader.querySelector('[data-wiki-source-trigger="true"]');
    if (!target) return;
    const readerBounds = reader.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const scale = readerBounds.height / (reader.offsetHeight || 1);
    if (scale <= 0) return;
    const below = (targetBounds.bottom - readerBounds.bottom) / scale + 20;
    if (below > 0) reader.scrollTo({ top: reader.scrollTop + below, left: 0, behavior: "smooth" });
  }, [inView, reducedMotion, stage, paused]);

  return { ref, stage, reducedMotion, inView, paused: paused || !inView, pause, resume };
}
