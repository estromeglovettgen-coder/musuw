import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const visual = read("./musuw-visual.less");
const menu = read("../components/menu.vue");
const menuBusiness = read("./business-baselines/menu.pre-view.vue");
const input = read("../components/Input-field.vue");

test("create knowledge-base action matches the compact dark reference control", () => {
  assert.match(
    visual,
    /#app\s+\.kb-card\.kb-create-card\s*\{[^}]*position:\s*fixed[^}]*height:\s*40px[^}]*background:\s*var\(--musuw-ink-strong\)/i,
    "desktop uses the native create action as the compact reference button",
  );
  assert.match(
    visual,
    /#app\s+\.kb-card\.kb-create-card:hover[^}]*background:\s*var\(--musuw-ink\)/i,
    "create action retains a visible interactive state",
  );
  assert.match(
    visual,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?#app\s+\.kb-card\.kb-create-card\s*\{[^}]*position:\s*static[^}]*width:\s*100%/i,
    "narrow layouts keep the existing action reachable in document flow",
  );
  assert.doesNotMatch(
    visual,
    /#app\s+\.kb-card\.kb-create-card[^}]*!important/,
    "the cascade fix must not rely on !important",
  );
});

test("sidebar enters narrow view collapsed without rewriting desktop preference", () => {
  assert.match(menuBusiness, /const\s+SIDEBAR_NARROW_BREAKPOINT\s*=\s*760/);
  assert.match(menuBusiness, /uiStore\.sidebarCollapsed\s*=\s*true/);
  assert.match(
    menuBusiness,
    /const\s+toggleSidebar\s*=\s*\(\)\s*=>\s*\{[\s\S]*?sidebarWasNarrow[\s\S]*?uiStore\.sidebarCollapsed\s*=\s*!uiStore\.sidebarCollapsed/,
    "the existing toggle remains usable on narrow screens without persisting a temporary override",
  );
  assert.match(menuBusiness, /window\.addEventListener\("resize"/);
  assert.match(menuBusiness, /window\.removeEventListener\("resize"/);
  assert.match(
    menuBusiness,
    /let\s+storedPreference:\s*string\s*\|\s*null\s*=\s*null[\s\S]*?try\s*\{[\s\S]*?window\.localStorage\.getItem\("sidebar_collapsed"\)[\s\S]*?\}\s*catch\s*\{[\s\S]*?\}/,
    "blocked storage must fall back to the live sidebar state",
  );
  assert.doesNotMatch(
    menuBusiness,
    /sidebarCollapsed\s*=\s*true[\s\S]{0,160}uiStore\.collapseSidebar\(\)/,
    "narrow-screen initialization should not persist over the desktop preference",
  );
});

test("compact composer uses a non-overlapping wrapped toolbar", () => {
  assert.match(input, /@media\s*\(max-width:\s*430px\)/);
  assert.match(
    input,
    /@media\s*\(max-width:\s*430px\)[^\n]*?\.visual-chat-composer__toolbar[^\n]*?flex-wrap:\s*wrap/,
  );
  assert.match(
    input,
    /@media\s*\(max-width:\s*430px\)[^\n]*?\.visual-chat-composer__tools[^\n]*?flex:\s*1 1 100%/,
  );
  assert.match(
    input,
    /@media\s*\(max-width:\s*430px\)[^\n]*?\.visual-chat-composer__submit[^\n]*?margin-left:\s*auto/,
  );
});
