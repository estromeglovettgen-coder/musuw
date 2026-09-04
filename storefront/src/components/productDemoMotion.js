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
