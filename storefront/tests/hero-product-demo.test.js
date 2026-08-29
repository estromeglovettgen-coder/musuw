import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

test("the hero runs a localized in-view product walkthrough instead of a placeholder video", () => {
  const hero = readFileSync(join(root, "src/components/HeroScene.jsx"), "utf8");
  const demo = readFileSync(join(root, "src/components/HeroProductDemo.jsx"), "utf8");
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");

  assert.match(hero, /<HeroProductDemo locale=\{locale\}/);
  assert.doesNotMatch(hero, /<video/);
  assert.match(demo, /useInView/);
  assert.match(demo, /useReducedMotion/);
  assert.match(demo, /Northstar Calibration Phrase in Aurora Observation Guide/);
  assert.match(demo, /reasoning round\(s\)/);
  assert.match(demo, /tool call\(s\)/);
  assert.match(demo, /hero-demo-citation/);
  assert.doesNotMatch(demo, /CheckCircle/);
  assert.doesNotMatch(demo, /Sparkle/);
  assert.match(demo, /return \(\) =>/);
  assert.match(styles, /\.hero-product-demo\s*\{/);
  assert.match(styles, /\.hero-demo-caret\s*\{/);
  assert.match(styles, /@media \(max-width: 767px\)/);
});
