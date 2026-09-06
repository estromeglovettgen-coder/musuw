import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getStorefrontCopy } from "../src/i18n.js";
import { applyHomepageMarketingRefresh } from "../src/homepageMarketingRefresh.js";
import {
  obsidianGraphProgressionCursor,
  obsidianGraphProgressionSpeed,
} from "../src/components/obsidian-graph/obsidianNativeGraphContract.ts";

const root = new URL("../", import.meta.url).pathname;
let renderedFixture;

function renderFixture() {
  if (!renderedFixture) {
    renderedFixture = JSON.parse(
      execFileSync(process.execPath, [join(root, "tests/renderStorefrontFixture.mjs")], {
        cwd: root,
        encoding: "utf8",
      }),
    );
  }
  return renderedFixture;
}

function section(markup, id, nextId) {
  const start = markup.indexOf(`id="${id}"`);
  const end = nextId ? markup.indexOf(`id="${nextId}"`, start) : markup.length;
  assert.notEqual(start, -1, `missing #${id}`);
  return markup.slice(start, end === -1 ? markup.length : end);
}

test("homepage capability areas render as real DOM demos without product screenshots", () => {
  const { home } = renderFixture();

  for (const kind of ["reasoning", "wiki", "graph", "answer"]) {
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

test("hero and chat demos keep the compact shell while Wiki and Graph use the full product page", () => {
  const { home } = renderFixture();
  const platform = section(home, "platform", "pricing");

  assert.equal(
    (home.match(/data-musuw-product-shell="true"/g) ?? []).length,
    3,
    "the hero and two chat flows should keep the compact Musuw shell",
  );
  assert.equal(
    (home.match(/data-product-page-shell=/g) ?? []).length,
    2,
    "Wiki and Graph should use the mechanically ported full product page",
  );
  assert.equal((platform.match(/data-platform-capability=/g) ?? []).length, 6);
  assert.match(platform, /class="benefit-grid platform-grid"/);
  assert.doesNotMatch(home, /capability-window-dots/);
  assert.doesNotMatch(home, /capability-demo-header|knowledge-loop-primary|knowledge-loop-rail/);
});

test("wiki and graph demos preserve the real surfaces while the preview directs attention", () => {
  const { chineseHome } = renderFixture();
  const previewSource = readFileSync(join(root, "src/components/KnowledgeBaseProductPreview.jsx"), "utf8");

  assert.match(chineseHome, /data-product-page-shell="wiki"/);
  assert.match(chineseHome, /data-product-page-shell="graph"/);
  assert.equal((chineseHome.match(/data-kb-tab="documents"/g) ?? []).length, 2);
  assert.equal((chineseHome.match(/data-kb-tab="wiki"/g) ?? []).length, 2);
  assert.equal((chineseHome.match(/data-kb-tab="graph"/g) ?? []).length, 2);

  assert.match(chineseHome, /data-wiki-sidebar="true"/);
  assert.match(chineseHome, /data-wiki-index="true"/);
  assert.match(chineseHome, /data-wiki-flow-state="loading-index"/);
  assert.equal((chineseHome.match(/visual-sidebar kb-preview-app-sidebar/g) ?? []).length, 2);
  assert.equal((chineseHome.match(/visual-knowledge-page kb-preview-knowledge-page/g) ?? []).length, 2);
  assert.equal((chineseHome.match(/wiki-browser kb-preview-wiki-browser/g) ?? []).length, 2);
  assert.match(chineseHome, /wiki-sidebar kb-preview-wiki-sidebar/);
  assert.match(chineseHome, /wiki-content kb-preview-wiki-content/);
  assert.match(chineseHome, /wiki-reader kb-preview-wiki-reader/);
  assert.match(chineseHome, /wiki-graph kb-preview-graph/);
  assert.match(chineseHome, /wiki-graph-canvas kb-preview-graph-canvas/);
  assert.equal((chineseHome.match(/搜索 Wiki 页面\.\.\./g) ?? []).length, 2);
  assert.match(chineseHome, /搜索整张知识图谱\.\.\./);
  assert.match(previewSource, /Agent Memory/);
  assert.match(previewSource, /首周留存 - Summary/);
  assert.doesNotMatch(previewSource, /Listmonk|暴利程度|长期躺赚/);

  assert.equal((chineseHome.match(/data-graph-legend-type=/g) ?? []).length, 5);
  assert.match(chineseHome, /class="obsidian-graph-canvas"/);
  assert.match(chineseHome, /data-playback-state="idle"/);
  assert.match(chineseHome, /data-playback-total="14"/);
  assert.match(chineseHome, /14 \/ 14 个节点/);
  assert.doesNotMatch(chineseHome, /data-graph-action="fit-view"|data-graph-action="toggle-arrows"|data-graph-settings="true"/);
  assert.match(previewSource, /function DemoPointer/);
  assert.match(previewSource, /pointerEvents: "none"/);
  assert.match(previewSource, /transformOrigin/);

  assert.doesNotMatch(chineseHome, /wiki-demo-body|graph-demo-toolbar/);
  assert.doesNotMatch(chineseHome, /MAX_FIXED_OK|FREE_FIXED_OK|RESTORED_MAX_OK|FREE_OK|PRO_OK|demo@musuw\.com/);
});

test("essential homepage content is visible in server HTML before observers or timers run", () => {
  const { home } = renderFixture();
  const features = section(home, "feature", "platform");
  const platform = section(home, "platform", "pricing");

  assert.doesNotMatch(features, /opacity:0/);
  assert.doesNotMatch(platform, /opacity:0/);
  assert.match(platform, /Built for the full knowledge loop/);
  assert.equal((platform.match(/data-platform-capability=/g) ?? []).length, 6);
});

test("homepage headings keep the approved hierarchy and hero title", () => {
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

test("visible Chinese marketing chrome uses 智能体 terminology", () => {
  const zh = applyHomepageMarketingRefresh(getStorefrontCopy("zh-CN"));
  const visibleMarketingCopy = JSON.stringify({
    hero: zh.hero,
    features: zh.features,
    platform: zh.platform,
    faq: zh.faq,
  });

  assert.match(visibleMarketingCopy, /智能体/);
  assert.doesNotMatch(visibleMarketingCopy, /(?:^|[^A-Za-z])Agent(?:[^A-Za-z]|$)/);
});

test("capability demos use production-visible states and the native Obsidian renderer", () => {
  assert.equal(obsidianGraphProgressionSpeed(48), 5);
  assert.equal(obsidianGraphProgressionCursor(0, 14, 48), 1);
  assert.equal(obsidianGraphProgressionCursor(1_000, 14, 48), 6);
  assert.equal(obsidianGraphProgressionCursor(2_600, 14, 48), 14);

  const source = readFileSync(join(root, "src/components/ProductCapabilityDemos.jsx"), "utf8");
  const chatSource = readFileSync(join(root, "src/components/RealChatCapabilityDemo.jsx"), "utf8");
  const motionSource = readFileSync(join(root, "src/components/productDemoMotion.js"), "utf8");
  const previewSource = readFileSync(join(root, "src/components/KnowledgeBaseProductPreview.jsx"), "utf8");
  const graphCanvasSource = readFileSync(join(root, "src/components/ObsidianGraphCanvas.jsx"), "utf8");
  const graphRendererSource = readFileSync(join(root, "src/components/obsidian-graph/obsidianWikiGraphRenderer.ts"), "utf8");
  const styles = readFileSync(join(root, "src/product-demos.css"), "utf8");

  assert.match(chatSource, /"idle",\s*"typing",\s*"sent",\s*"searching",\s*"comparing",\s*"drafting",\s*"answering",\s*"complete"/);
  assert.match(chatSource, /visual-chat-composer/);
  assert.match(chatSource, /visual-rag-pipeline/);
  assert.match(chatSource, /visual-assistant-message/);
  assert.match(motionSource, /"loading-index",\s*"index",\s*"selecting-page",\s*"loading-page",\s*"page",\s*"focus-source"/);
  assert.match(source, /useWikiDemoFlow/);
  assert.match(motionSource, /useReducedMotion/);
  assert.match(source, /graphAutoPlay=\{inView && !reducedMotion\}/);
  assert.doesNotMatch(previewSource, /data-wiki-reveal-step/);
  assert.match(previewSource, /<ObsidianGraphCanvas/);
  assert.match(previewSource, /canvasRef\.current\?\.replay/);
  assert.match(graphCanvasSource, /new ObsidianWikiGraphRenderer\(container\)/);
  assert.match(graphCanvasSource, /renderer\.startProgression/);
  assert.doesNotMatch(graphCanvasSource, /setInterval|replayTimer/);
  assert.match(graphRendererSource, /new Application\(/);
  assert.match(graphRendererSource, /OBSIDIAN_GRAPH_WORKER_PATH/);
  assert.ok(existsSync(join(root, "public/vendor/obsidian-1.13.7/graph-sim.js")));
  assert.doesNotMatch(source, /initial=\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(previewSource, /data-graph-node=/);
  assert.doesNotMatch(styles, /kb-preview-node-arrival|kb-preview-graph-nodes g\.is-visible/);
  assert.doesNotMatch(styles, /grayscale\(1\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none !important/);
});

test("the storefront graph engine stays byte-for-byte aligned with the production Wiki graph", () => {
  const graphSources = [
    "obsidianWikiGraphRenderer.ts",
    "obsidianGraphSettings.ts",
    "obsidianGraphWorkerProtocol.ts",
    "obsidianForce.worker.ts",
    "weknoraGraphTheme.ts",
  ];

  for (const file of graphSources) {
    assert.equal(
      readFileSync(join(root, "src/components/obsidian-graph", file), "utf8"),
      readFileSync(join(root, "../weknora/frontend/src/views/knowledge/wiki/graph", file), "utf8"),
      `${file} must remain a mechanical copy of the production implementation`,
    );
  }

  assert.deepEqual(
    readFileSync(join(root, "public/vendor/obsidian-1.13.7/graph-sim.js")),
    readFileSync(join(root, "../weknora/frontend/public/vendor/obsidian-1.13.7/graph-sim.js")),
    "the Obsidian worker asset must remain identical to production",
  );
});
