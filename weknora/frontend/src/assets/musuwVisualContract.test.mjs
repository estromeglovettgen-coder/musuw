import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const theme = read("./theme/theme.css");
const visual = read("./musuw-visual.less");
const main = read("../main.ts");
const useTheme = read("../composables/useTheme.ts");
const sidebar = read("../components/menu.vue");
const wikiBrowser = read("../views/knowledge/wiki/WikiBrowser.vue");

test("uses the reference Musuw typefaces and cool-neutral visual tokens", () => {
  assert.match(main, /@fontsource-variable\/inter/);
  assert.match(main, /@fontsource-variable\/jetbrains-mono/);
  assert.match(main, /@fontsource-variable\/noto-sans-sc/);
  assert.match(theme, /--musuw-ink:\s*#1f2937/);
  assert.match(theme, /--musuw-muted:\s*#6b7280/);
  assert.match(theme, /--musuw-line:\s*#e5e7eb/);
  assert.match(theme, /--musuw-line-strong:\s*#d1d5db/);
  assert.match(theme, /--musuw-accent:\s*#2563eb/);
  assert.match(theme, /--musuw-space-unit:\s*8px/);
  assert.match(theme, /--musuw-radius-control:\s*8px/);
  assert.match(theme, /--musuw-radius-card:\s*12px/);
  assert.match(theme, /:root\[theme-mode="dark"\]\s*\{\s*color-scheme:\s*dark/);
});

test("keeps the knowledge graph outside the Musuw presentation layer", () => {
  assert.doesNotMatch(visual, /\.wiki-graph(?:[\s.{:#>+~]|$)/);
  assert.doesNotMatch(visual, /\.chat\s+\.tree-container/);
  assert.doesNotMatch(visual, /\.chat\s+\.streaming-steps-container/);
  assert.match(visual, /\.t-drawer:not\(\.wiki-graph-drawer\)/);
  assert.match(visual, /\.t-select__dropdown:not\(\.wiki-graph-search-dropdown\)/);
  assert.doesNotMatch(visual, /\.t-drawer\s+\.t-/);
  assert.match(wikiBrowser, /overlayClassName:\s*'wiki-graph-search-dropdown'/);
  assert.match(wikiBrowser, /drawer-class-name="wiki-graph-drawer"/);
});

test("lets CSS own the web canvas instead of a theme startup inline style", () => {
  assert.doesNotMatch(useTheme, /document\.documentElement\.style\.background/);
  assert.doesNotMatch(useTheme, /document\.body\.style\.background/);
  assert.doesNotMatch(useTheme, /getElementById\(['"]app['"]\)/);
  assert.match(useTheme, /WindowSetBackgroundColour\(251, 252, 254, 255\)/);
  assert.match(useTheme, /WindowSetBackgroundColour\(21, 22, 25, 255\)/);
});

test("keeps the compact Musuw wordmark in the native Vue sidebar", () => {
  assert.match(sidebar, /class="visual-sidebar__brand"/);
  assert.match(sidebar, />Musuw 穆苏瓦</);
});
