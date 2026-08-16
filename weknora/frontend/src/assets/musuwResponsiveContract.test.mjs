import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const visual = read("./musuw-visual.less");
const menu = read("../components/menu.vue");
const input = read("../components/Input-field.vue");

test("create knowledge-base tile keeps a dashed neutral presentation after shell overrides", () => {
  assert.match(
    visual,
    /#app\s+\.kb-card\.kb-create-card\s*\{[^}]*border:\s*1px\s+dashed/i,
    "create tile needs a higher-specificity dashed base rule",
  );
  assert.match(
    visual,
    /#app\s+\.kb-card\.kb-create-card:hover[^}]*border(?:-style)?:\s*(?:1px\s+)?dashed/i,
    "create tile hover must stay dashed",
  );
  assert.match(
    visual,
    /#app\s+\.kb-card\.kb-create-card:focus-visible[^}]*border(?:-style)?:\s*(?:1px\s+)?dashed/i,
    "create tile focus must stay dashed",
  );
  assert.doesNotMatch(
    visual,
    /#app\s+\.kb-card\.kb-create-card[^}]*!important/,
    "the cascade fix must not rely on !important",
  );
});

test("sidebar enters narrow view collapsed without rewriting desktop preference", () => {
  assert.match(menu, /const\s+SIDEBAR_NARROW_BREAKPOINT\s*=\s*760/);
  assert.match(menu, /uiStore\.sidebarCollapsed\s*=\s*true/);
  assert.match(
    menu,
    /const\s+toggleSidebar\s*=\s*\(\)\s*=>\s*\{[\s\S]*?sidebarWasNarrow[\s\S]*?uiStore\.sidebarCollapsed\s*=\s*!uiStore\.sidebarCollapsed/,
    "the existing toggle remains usable on narrow screens without persisting a temporary override",
  );
  assert.match(menu, /window\.addEventListener\("resize"/);
  assert.match(menu, /window\.removeEventListener\("resize"/);
  assert.match(
    menu,
    /let\s+storedPreference:\s*string\s*\|\s*null\s*=\s*null[\s\S]*?try\s*\{[\s\S]*?window\.localStorage\.getItem\("sidebar_collapsed"\)[\s\S]*?\}\s*catch\s*\{[\s\S]*?\}/,
    "blocked storage must fall back to the live sidebar state",
  );
  assert.doesNotMatch(
    menu,
    /sidebarCollapsed\s*=\s*true[\s\S]{0,160}uiStore\.collapseSidebar\(\)/,
    "narrow-screen initialization should not persist over the desktop preference",
  );
});

test("compact composer uses a non-overlapping wrapped toolbar", () => {
  assert.match(input, /@media\s*\(max-width:\s*420px\)/);
  assert.match(
    input,
    /@media\s*\(max-width:\s*420px\)[\s\S]*?\.control-bar[\s\S]*?position:\s*static/,
  );
  assert.match(
    input,
    /@media\s*\(max-width:\s*420px\)[\s\S]*?\.control-left[\s\S]*?width:\s*100%/,
  );
  assert.match(
    input,
    /@media\s*\(max-width:\s*420px\)[\s\S]*?\.control-bar[\s\S]*?max-height:\s*none/,
  );
});
