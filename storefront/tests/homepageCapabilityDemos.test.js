import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getStorefrontCopy } from "../src/i18n.js";
import { applyHomepageMarketingRefresh } from "../src/homepageMarketingRefresh.js";
import { KNOWLEDGE_STORIES, REASONING_STORY } from "../src/data/knowledgeStories.js";
import {
  obsidianGraphProgressionCursor,
  obsidianGraphProgressionSpeed,
} from "../src/components/obsidian-graph/obsidianNativeGraphContract.ts";

const root = new URL("../", import.meta.url).pathname;
let renderedFixture;
function renderFixture() {
  if (!renderedFixture) {
    renderedFixture = JSON.parse(execFileSync(process.execPath, [join(root, "tests/renderStorefrontFixture.mjs")], { cwd: root, encoding: "utf8" }));
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
  for (const kind of ["reasoning", "wiki", "graph", "answer"]) assert.match(home, new RegExp(`data-capability-demo="${kind}"`));
  assert.doesNotMatch(home, /\/images\/musuw-[a-z-]+\.jpg/);
  assert.doesNotMatch(home, /<video\b|<canvas\b/);
  assert.match(home, /class="final-cta-visual" aria-hidden="true"/);
  assert.doesNotMatch(readFileSync(join(root, "index.html"), "utf8"), /rel="preload"[^>]+musuw-[a-z-]+\.jpg/);
  assert.ok(existsSync(join(root, "src/components/ProductCapabilityDemos.jsx")));
});

test("hero and chat demos keep the compact shell while Wiki and Graph use the full product page", () => {
  const { home } = renderFixture();
  const platform = section(home, "platform", "pricing");
  assert.equal((home.match(/data-musuw-product-shell="true"/g) ?? []).length, 3);
  assert.equal((home.match(/data-product-page-shell=/g) ?? []).length, 2);
  assert.equal((platform.match(/data-platform-capability=/g) ?? []).length, 6);
  assert.match(platform, /class="benefit-grid platform-grid"/);
  assert.doesNotMatch(home, /capability-window-dots/);
  assert.doesNotMatch(home, /capability-demo-header|knowledge-loop-primary|knowledge-loop-rail/);
});

test("wiki starts with a readable research page and graph retains its product surface", () => {
  const { chineseHome } = renderFixture();
  const previewSource = readFileSync(join(root, "src/components/KnowledgeBaseProductPreview.jsx"), "utf8");
  assert.match(chineseHome, /data-product-page-shell="wiki"/);
  assert.match(chineseHome, /data-product-page-shell="graph"/);
  for (const tab of ["documents", "wiki", "graph"]) assert.equal((chineseHome.match(new RegExp(`data-kb-tab="${tab}"`, "g")) ?? []).length, 2);
  assert.match(chineseHome, /data-wiki-sidebar="true"/);
  assert.match(chineseHome, /data-wiki-reader="true"/);
  assert.match(chineseHome, /data-wiki-flow-state="page"/);
  assert.doesNotMatch(chineseHome, /data-wiki-flow-state="loading-index"/);
  assert.equal((chineseHome.match(/visual-sidebar kb-preview-app-sidebar/g) ?? []).length, 2);
  assert.equal((chineseHome.match(/visual-knowledge-page kb-preview-knowledge-page/g) ?? []).length, 2);
  assert.equal((chineseHome.match(/wiki-browser kb-preview-wiki-browser/g) ?? []).length, 2);
  for (const classPair of ["wiki-sidebar kb-preview-wiki-sidebar", "wiki-content kb-preview-wiki-content", "wiki-reader kb-preview-wiki-reader", "wiki-graph kb-preview-graph", "wiki-graph-canvas kb-preview-graph-canvas"]) assert.ok(chineseHome.includes(classPair));
  assert.equal((chineseHome.match(/搜索 Wiki 页面\.\.\./g) ?? []).length, 2);
  assert.match(chineseHome, /搜索整张知识图谱\.\.\./);
  assert.match(chineseHome, /长期记忆评估/);
  assert.match(chineseHome, /《小王子》阅读笔记/);
  assert.match(chineseHome, /我的研究备注/);
  assert.match(chineseHome, /下一步验证/);
  assert.match(previewSource, /data-wiki-source-trigger/);
  assert.match(previewSource, /<DemoSourcePreview/);
  assert.doesNotMatch(previewSource, /Listmonk|暴利程度|长期躺赚/);
  assert.equal((chineseHome.match(/data-graph-legend-type=/g) ?? []).length, 5);
  assert.match(chineseHome, /class="obsidian-graph-canvas"/);
  assert.match(chineseHome, /data-playback-state="idle"/);
  assert.match(chineseHome, /data-playback-total="14"/);
  assert.match(chineseHome, /14 \/ 14 个节点/);
  assert.doesNotMatch(chineseHome, /data-graph-action="fit-view"|data-graph-action="toggle-arrows"|data-graph-settings="true"/);
  assert.match(previewSource, /function DemoPointer/);
  assert.match(previewSource, /getBoundingClientRect/);
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

test("homepage headings keep the approved hierarchy and unchanged hero title", () => {
  const en = applyHomepageMarketingRefresh(getStorefrontCopy("en"));
  const zh = applyHomepageMarketingRefresh(getStorefrontCopy("zh-CN"));
  const headings = (copy) => [copy.hero.titleLine1, copy.hero.titleLine2, copy.features.intro.title, copy.platform.intro.title, copy.pricing.intro.title, copy.comparison.title, copy.faq.title, copy.finalCta.title];
  assert.deepEqual(headings(en), ["Turn source material into", "intelligent knowledge assets", "Bring what you know into every question", "Built for the full knowledge loop", "Plans & Pricing", "Plans and features", "Questions before you start", "Put your knowledge to work"]);
  assert.deepEqual(headings(zh), ["把资料转化为", "会思考的知识资产", "让积累的知识，参与每一次思考", "覆盖完整知识闭环", "方案与定价", "方案与功能", "开始前的常见问题", "让知识真正为你工作"]);
  assert.deepEqual([zh.features.items[0].title, zh.features.items[3].title, zh.features.items[2].title], ["从信息噪声中，找到真正影响决策的信号", "让零散积累，逐渐形成完整的知识体系", "让隐藏在知识中的关联自然浮现"]);
});

test("visible Chinese marketing chrome avoids technical feature jargon", () => {
  const zh = applyHomepageMarketingRefresh(getStorefrontCopy("zh-CN"));
  const copy = JSON.stringify({ hero: zh.hero, features: zh.features, platform: zh.platform, faq: zh.faq });
  assert.match(copy, /智能体/);
  assert.doesNotMatch(copy, /(?:^|[^A-Za-z])Agent(?:[^A-Za-z]|$)/);
  assert.doesNotMatch(copy, /工具自主编排|实体关系提取|找不到已有内容/);
});

test("the three independent scenes have research, reading and work-specific fixtures", () => {
  for (const lang of ["zh", "en"]) {
    const { wiki, graph } = KNOWLEDGE_STORIES[lang];
    assert.equal(wiki.content.sourceIds.length, 3);
    assert.equal(Object.keys(graph.content.labels).length, 14);
    assert.equal(REASONING_STORY[lang].steps.length, 3);
    assert.equal(REASONING_STORY[lang].sourceIds.length, 3);
    assert.notEqual(wiki.header.current, graph.header.current);
  }
  assert.match(REASONING_STORY.zh.disclaimer, /模拟/);
  assert.match(KNOWLEDGE_STORIES.zh.wiki.content.note, /演示/);
});

test("capability demos use production-visible states and the unchanged native Obsidian renderer", () => {
  assert.equal(obsidianGraphProgressionSpeed(48), 5);
  assert.equal(obsidianGraphProgressionCursor(0, 14, 48), 1);
  assert.equal(obsidianGraphProgressionCursor(1_000, 14, 48), 6);
  assert.equal(obsidianGraphProgressionCursor(2_600, 14, 48), 14);
  const source = readFileSync(join(root, "src/components/ProductCapabilityDemos.jsx"), "utf8");
  const chat = readFileSync(join(root, "src/components/RealChatCapabilityDemo.jsx"), "utf8");
  const motion = readFileSync(join(root, "src/components/productDemoMotion.js"), "utf8");
  const preview = readFileSync(join(root, "src/components/KnowledgeBaseProductPreview.jsx"), "utf8");
  const graphCanvas = readFileSync(join(root, "src/components/ObsidianGraphCanvas.jsx"), "utf8");
  const renderer = readFileSync(join(root, "src/components/obsidian-graph/obsidianWikiGraphRenderer.ts"), "utf8");
  const styles = readFileSync(join(root, "src/product-demos.css"), "utf8");
  assert.match(chat, /"idle",\s*"typing",\s*"sent",\s*"searching",\s*"comparing",\s*"drafting",\s*"answering",\s*"complete"/);
  assert.match(chat, /visual-chat-composer/);
  assert.match(chat, /visual-rag-pipeline/);
  assert.match(chat, /visual-assistant-message/);
  assert.match(motion, /"page",\s*"moving-source",\s*"hovering-source",\s*"clicking-source",\s*"source-open",\s*"focus-source",\s*"restore"/);
  assert.match(source, /useWikiDemoFlow/);
  assert.match(motion, /useReducedMotion/);
  assert.match(source, /graphAutoPlay=\{inView && !reducedMotion\}/);
  assert.doesNotMatch(preview, /data-wiki-reveal-step/);
  assert.match(preview, /<ObsidianGraphCanvas/);
  assert.match(preview, /canvasRef\.current\?\.replay/);
  assert.match(graphCanvas, /new ObsidianWikiGraphRenderer\(container\)/);
  assert.match(graphCanvas, /renderer\.startProgression/);
  assert.doesNotMatch(graphCanvas, /setInterval|replayTimer/);
  assert.match(renderer, /new Application\(/);
  assert.match(renderer, /OBSIDIAN_GRAPH_WORKER_PATH/);
  assert.ok(existsSync(join(root, "public/vendor/obsidian-1.13.7/graph-sim.js")));
  assert.doesNotMatch(source, /initial=\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(preview, /data-graph-node=/);
  assert.doesNotMatch(styles, /kb-preview-node-arrival|kb-preview-graph-nodes g\.is-visible/);
  assert.doesNotMatch(styles, /grayscale\(1\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none !important/);
});

test("the storefront graph engine stays byte-for-byte aligned with production", () => {
  for (const file of ["obsidianWikiGraphRenderer.ts", "obsidianGraphSettings.ts", "obsidianGraphWorkerProtocol.ts", "obsidianForce.worker.ts", "weknoraGraphTheme.ts"]) {
    assert.equal(readFileSync(join(root, "src/components/obsidian-graph", file), "utf8"), readFileSync(join(root, "../weknora/frontend/src/views/knowledge/wiki/graph", file), "utf8"), `${file} must remain a mechanical copy`);
  }
  assert.deepEqual(readFileSync(join(root, "public/vendor/obsidian-1.13.7/graph-sim.js")), readFileSync(join(root, "../weknora/frontend/public/vendor/obsidian-1.13.7/graph-sim.js")));
});
