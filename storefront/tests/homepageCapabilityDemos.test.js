import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getStorefrontCopy } from "../src/i18n.js";
import { applyHomepageMarketingRefresh } from "../src/homepageMarketingRefresh.js";

const root = new URL("../", import.meta.url).pathname;

function renderFixture() {
  return JSON.parse(
    execFileSync(process.execPath, [join(root, "tests/renderStorefrontFixture.mjs")], {
      cwd: root,
      encoding: "utf8",
    }),
  );
}

function section(markup, id, nextId) {
  const start = markup.indexOf(`id="${id}"`);
  const end = nextId ? markup.indexOf(`id="${nextId}"`, start) : markup.length;
  assert.notEqual(start, -1, `missing #${id}`);
  return markup.slice(start, end === -1 ? markup.length : end);
}

test("homepage capability areas render as real DOM demos without product screenshots", () => {
  const { home } = renderFixture();

  for (const kind of ["reasoning", "wiki", "graph", "loop", "answer"]) {
    assert.match(home, new RegExp(`data-capability-demo="${kind}"`));
  }
  assert.doesNotMatch(home, /\/images\/musuw-[a-z-]+\.jpg/);
  assert.doesNotMatch(home, /<video\b|<canvas\b/);
  assert.match(home, /class="final-cta-visual" aria-hidden="true"/);
  assert.doesNotMatch(
    readFileSync(join(root, "index.html"), "utf8"),
    /rel="preload"[^>]+musuw-[a-z-]+\.jpg/,
  );
  assert.ok(
    existsSync(join(root, "src/components/ProductCapabilityDemos.jsx")),
    "dynamic homepage demos must live in an owned component",
  );
});

test("essential homepage content is visible in server HTML before observers or timers run", () => {
  const { home } = renderFixture();
  const features = section(home, "feature", "platform");
  const platform = section(home, "platform", "pricing");

  assert.doesNotMatch(features, /opacity:0/);
  assert.doesNotMatch(platform, /opacity:0/);
  assert.match(platform, /Built for the full knowledge loop/);
  assert.match(platform, /data-capability-demo="loop"/);
});

test("homepage headings stay fixed except for the required Chinese terminology correction", () => {
  const en = applyHomepageMarketingRefresh(getStorefrontCopy("en"));
  const zh = applyHomepageMarketingRefresh(getStorefrontCopy("zh-CN"));

  assert.deepEqual(
    [
      en.hero.titleLine1,
      en.hero.titleLine2,
      en.features.intro.title,
      en.platform.intro.title,
      en.pricing.intro.title,
      en.comparison.title,
      en.faq.title,
      en.finalCta.title,
    ],
    [
      "Turn source material into",
      "intelligent knowledge assets",
      "RAG agents and connected knowledge—working as one",
      "Built for the full knowledge loop",
      "Plans & Pricing",
      "Plans and features",
      "Questions before you start",
      "Put your knowledge to work",
    ],
  );
  assert.deepEqual(
    [
      zh.hero.titleLine1,
      zh.hero.titleLine2,
      zh.features.intro.title,
      zh.platform.intro.title,
      zh.pricing.intro.title,
      zh.comparison.title,
      zh.faq.title,
      zh.finalCta.title,
    ],
    [
      "把资料转化为",
      "会思考的知识资产",
      "智能体与相互连接的知识 协同工作",
      "覆盖完整知识闭环",
      "方案与定价",
      "方案与功能",
      "开始前的常见问题",
      "让知识真正为你工作",
    ],
  );
});

test("visible Chinese homepage marketing uses 智能体 and contains no RAG or Agent", () => {
  const { chineseHome } = renderFixture();
  const visibleText = chineseHome.replace(/<[^>]+>/g, " ");

  assert.match(visibleText, /智能体/);
  assert.doesNotMatch(visibleText, /(?:^|\s)RAG(?:\s|$)|Agent/i);
});

test("capability motion exposes bounded phases and a static reduced-motion end state", async () => {
  const motion = await import("../src/components/productDemoMotion.js");

  assert.deepEqual(motion.CAPABILITY_DEMO_PHASES, ["capture", "reason", "connect", "complete"]);
  assert.equal(motion.nextCapabilityDemoPhase("capture"), "reason");
  assert.equal(motion.nextCapabilityDemoPhase("complete"), "capture");
  assert.equal(motion.resolveCapabilityDemoPhase("reason", true), "complete");
  assert.equal(motion.resolveCapabilityDemoPhase("reason", false), "reason");

  const source = readFileSync(join(root, "src/components/ProductCapabilityDemos.jsx"), "utf8");
  const styles = readFileSync(join(root, "src/product-demos.css"), "utf8");
  assert.match(source, /useReducedMotion/);
  assert.match(source, /window\.setInterval/);
  assert.match(source, /window\.clearInterval/);
  assert.doesNotMatch(source, /initial=\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(source, /graph-base-edges/);
  assert.match(styles, /\.graph-live-edges line\.is-linked[\s\S]*?stroke-dashoffset:\s*0/);
  assert.match(styles, /\.graph-nodes g circle[\s\S]*?opacity:\s*0/);
  assert.match(styles, /\.graph-nodes g\.is-linked circle[\s\S]*?transform:\s*scale\(1\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none !important/);
});
