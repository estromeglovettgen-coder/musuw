import { useEffect, useRef, useState } from "react";
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

// Keep the product view at its real scale. The only guided motion is the
// cursor following a Wiki link and the linked page replacing the current one.
export const WIKI_DEMO_STAGES = Object.freeze(["page", "moving-to-link", "pressing-link", "linked-page"]);
export const WIKI_STAGE_DURATIONS = Object.freeze({
  page: 900,
  "moving-to-link": 1050,
  "pressing-link": 620,
});

export function nextWikiDemoStage(stage) {
  const index = WIKI_DEMO_STAGES.indexOf(stage);
  if (index < 0) return WIKI_DEMO_STAGES[0];
  return WIKI_DEMO_STAGES[Math.min(index + 1, WIKI_DEMO_STAGES.length - 1)];
}

export function resolveWikiDemoStage(stage, reducedMotion) {
  return reducedMotion ? "linked-page" : stage;
}

export function useWikiDemoFlow() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.28 });
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState("page");

  useEffect(() => {
    if (reducedMotion) {
      setStage("linked-page");
      return undefined;
    }
    const duration = WIKI_STAGE_DURATIONS[stage];
    if (!inView || !Number.isFinite(duration)) return undefined;
    const timer = window.setTimeout(() => {
      setStage((current) => nextWikiDemoStage(current));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, stage]);

  return { ref, stage: resolveWikiDemoStage(stage, reducedMotion), reducedMotion, inView };
}
