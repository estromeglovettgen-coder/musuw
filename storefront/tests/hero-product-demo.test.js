import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { HERO_STORY } from "../src/data/knowledgeStories.js";
import { DEMO_SOURCES } from "../src/data/demoSources.js";

const root = new URL("../", import.meta.url).pathname;

test("the hero keeps the localized in-view product walkthrough and existing shell", () => {
  const hero = readFileSync(join(root, "src/components/HeroScene.jsx"), "utf8");
  const demo = readFileSync(join(root, "src/components/HeroProductDemo.jsx"), "utf8");
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  assert.match(hero, /<HeroProductDemo locale=\{locale\}/);
  assert.doesNotMatch(hero, /<video/);
  assert.match(demo, /useInView/);
  assert.match(demo, /useReducedMotion/);
  assert.match(demo, /HERO_STORY/);
  assert.match(demo, /hero-demo-citation demo-citation-button/);
  assert.match(demo, /<DemoSourcePreview/);
  assert.match(demo, /aria-expanded/);
  assert.doesNotMatch(demo, /Northstar Calibration|ORBITAL SAGE|28 feedback items/);
  assert.doesNotMatch(demo, /reasoning round\(s\)|tool call\(s\)/);
  assert.doesNotMatch(demo, /CheckCircle|Sparkle|\bariaHidden\b/);
  assert.match(demo, /return \(\) =>/);
  assert.match(styles, /\.hero-product-demo\s*\{/);
  assert.match(styles, /\.hero-demo-caret\s*\{/);
  assert.match(styles, /@media \(max-width: 767px\)/);
});

test("each legal fixture declares one jurisdiction and binds all citations to real sources", () => {
  for (const [locale, jurisdiction] of [["zh-CN", "CN-mainland"], ["en", "UK"]]) {
    const story = HERO_STORY[locale];
    assert.equal(story.citations.length, 3);
    assert.equal(story.sourceIds.length, story.citations.length);
    assert.ok(story.disclaimer.length > 20);
    const sources = story.sourceIds.map((id) => DEMO_SOURCES[id]);
    assert.ok(sources.every((source) => source?.kind === "public"));
    assert.ok(sources.every((source) => source.jurisdiction === jurisdiction));
    assert.ok(sources.every((source) => source.locator && source.excerpt && source.url.startsWith("https://")));
    assert.ok(new Set(sources.map((source) => new URL(source.url).hostname)).size >= 2);
  }
  assert.match(HERO_STORY["zh-CN"].question, /婚礼摄影师.*广告.*版权/);
  assert.match(HERO_STORY.en.question, /wedding photographer.*ad.*copyright/);
  assert.match(HERO_STORY["zh-CN"].disclaimer, /中国大陆/);
  assert.match(HERO_STORY.en.disclaimer, /UK/);
});
