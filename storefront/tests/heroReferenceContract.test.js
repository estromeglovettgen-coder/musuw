import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getStorefrontCopy } from "../src/i18n.js";
import { applyHomepageMarketingRefresh } from "../src/homepageMarketingRefresh.js";

const root = new URL("../", import.meta.url).pathname;

function source(path) {
  return readFileSync(join(root, path), "utf8");
}

test("hero copy keeps the approved two-line title and six localized typewriter phrases", () => {
  const en = applyHomepageMarketingRefresh(getStorefrontCopy("en"));
  const zh = applyHomepageMarketingRefresh(getStorefrontCopy("zh-CN"));

  assert.equal(en.hero.titleLine1, "Turn source material into");
  assert.equal(en.hero.titleLine2, "intelligent knowledge assets");
  assert.deepEqual(en.hero.titleFocusSegments, ["intelligent", "knowledge", "assets"]);
  assert.deepEqual(en.hero.typewriterPhrases, [
    "Agents · Wiki · Graph",
    "Turn documents into a living Wiki",
    "Retrieve precise cited answers",
    "Let agents reason with evidence",
    "Reveal hidden links in the graph",
    "Keep knowledge evolving",
  ]);

  assert.equal(zh.hero.titleLine1, "把资料转化为");
  assert.equal(zh.hero.titleLine2, "会思考的知识资产");
  assert.deepEqual(zh.hero.titleFocusSegments, ["会", "思考的", "知识资产"]);
  assert.deepEqual(zh.hero.typewriterPhrases, [
    "智能体 · Wiki · 图谱",
    "文档变成 Wiki",
    "找到每个精确答案",
    "智能体带证据推理",
    "图谱连接隐藏关系",
    "知识随使用持续进化",
  ]);
});

test("hero reuses the captured TikHub timing and LiquidEther parameter contract", () => {
  const hero = source("src/components/HeroScene.jsx");
  const effects = source("src/components/TikHubHeroEffects.jsx");
  const liquid = source("../auth/src/LiquidEther.tsx");
  const styles = source("src/styles.css");

  assert.ok(
    hero.includes('const HERO_LIQUID_COLORS = ["#6366F1", "#818CF8", "#A78BFA"]'),
    "missing captured LiquidEther palette",
  );
  for (const contract of [
    "colors={HERO_LIQUID_COLORS}",
    "mouseForce={8}",
    "cursorSize={80}",
    "viscous={60}",
    "iterationsViscous={32}",
    "iterationsPoisson={32}",
    "resolution={0.5}",
    "autoSpeed={0.3}",
    "autoIntensity={0.6}",
    "takeoverDuration={0.25}",
    "autoResumeDelay={5000}",
    "autoRampDuration={0.6}",
    "typingSpeed={50}",
    "deletingSpeed={35}",
    "pauseDuration={2000}",
    "blurAmount={4}",
    'borderColor="#6366F1"',
    'glowColor="rgba(99, 102, 241, 0.4)"',
    "animationDuration={0.5}",
    "pauseBetweenAnimations={1.2}",
  ]) {
    assert.ok(hero.includes(contract), `missing captured Hero contract: ${contract}`);
  }

  assert.match(effects, /\(animationDuration \+ pauseBetweenAnimations\) \* 1000/);
  assert.match(liquid, /Mouse\.diff\.x \* \(props\.mouse_force \|\| 0\)/);
  assert.match(liquid, /uniforms\.center\.value\.set\(Mouse\.coords\.x, Mouse\.coords\.y\)/);
  assert.doesNotMatch(liquid, /Mouse\.diff\.x \/ 2/);
  assert.match(styles, /\.hero-liquid\s*\{[\s\S]*?inset:\s*0;[\s\S]*?opacity:\s*0\.45;/);
  assert.match(hero, /!reduceMotion \? \(/);
  assert.match(hero, /reduceMotion \? \([\s\S]*?typewriterPhrases\[0\]/);
  assert.match(hero, /<Typewriter[\s\S]*?key=\{locale\}/);
  assert.doesNotMatch(hero, /Sparkle|hero-eyebrow-icon/);
});

test("theme bootstrap and the header toggle share one persisted Musuw theme contract", () => {
  const html = source("index.html");
  const theme = source("src/theme.js");
  const chrome = source("src/components/SiteChrome.jsx");
  const styles = `${source("src/styles.css")}\n${source("src/marketing-refresh.css")}\n${source("src/product-demos.css")}`;

  assert.match(html, /localStorage\.getItem\("musuw-theme"\)/);
  assert.match(theme, /THEME_STORAGE_KEY = "musuw-theme"/);
  assert.match(chrome, /className="theme-toggle"/);
  assert.match(chrome, /Switch to dark mode/);
  assert.match(chrome, /Switch to light mode/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.match(styles, /\.hero-liquid/);
  assert.match(styles, /\.hero-dots/);
  assert.match(styles, /html\[data-theme="dark"\] \.hero-product-demo[\s\S]*?invert\(1\)/);
  assert.match(styles, /html\[data-theme="dark"\] \.musuw-product-shell[\s\S]*?invert\(1\)/);
  assert.match(styles, /\.site-header :is\([\s\S]*?\.nav-actions > \.button[\s\S]*?border-color: var\(--ink\)/);
  assert.match(styles, /html\[data-theme="dark"\] \.button-primary[\s\S]*?background: transparent/);
  assert.match(styles, /html\[data-theme="dark"\] \.feature-bullets li[\s\S]*?var\(--line-strong\)[\s\S]*?var\(--ink-soft\)/);
  assert.match(styles, /html\[data-theme="dark"\] :is\([\s\S]*?\.faq-item[\s\S]*?var\(--line-strong\)/);
});

test("homepage keeps the source typewriter treatment while removing decorative section pills", () => {
  const hero = source("src/components/HeroScene.jsx");
  const home = source("src/components/HomeSections.jsx");
  const refresh = source("src/components/HomeRefreshSections.jsx");
  const styles = `${source("src/styles.css")}\n${source("src/marketing-refresh.css")}`;

  assert.match(styles, /\.hero-eyebrow::before\s*\{[\s\S]*?width:\s*6px;[\s\S]*?height:\s*6px;[\s\S]*?border-radius:\s*50%;/);
  assert.match(styles, /\.hero-eyebrow\s*\{[\s\S]*?gap:\s*8px;[\s\S]*?padding:\s*6px 16px;[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*500;/);
  assert.match(hero, /className="hero-eyebrow"/);

  assert.doesNotMatch(home, /className="feature-label"/);
  assert.doesNotMatch(home, /label=\{copy\.features\.intro\.label\}/);
  assert.doesNotMatch(home, /<p className="section-label">[\s\S]*?copy\.faq\.label/);
  assert.doesNotMatch(refresh, /label=\{copy\.platform\.intro\.label\}/);
});

test("dark hero motion keeps the captured source opacity and muted copy separation", () => {
  const styles = `${source("src/styles.css")}\n${source("src/marketing-refresh.css")}`;

  assert.match(styles, /html\[data-theme="dark"\] \.hero-liquid\s*\{[\s\S]*?opacity:\s*0\.45;/);
  assert.match(styles, /html\[data-theme="dark"\] \.hero-dots\s*\{[\s\S]*?opacity:\s*0\.5;/);
  assert.match(styles, /\.final-cta-card::before\s*\{[\s\S]*?radial-gradient/);
  assert.match(styles, /html\[data-theme="dark"\] :is\([\s\S]*?\.section-body[\s\S]*?\.footer-group a[\s\S]*?color:\s*var\(--ink-soft\)/);
  assert.match(styles, /html\[data-theme="dark"\] \.footer-bottom\s*\{[\s\S]*?color:\s*var\(--ink-faint\)/);
});
