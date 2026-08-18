import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const gitBlobSha = (text) =>
  createHash("sha1")
    .update(`blob ${Buffer.byteLength(text)}\0`)
    .update(text)
    .digest("hex");

const main = read("../main.ts");
const manifest = read("./musuw-reference-mechanical.css");
const importNames = [...manifest.matchAll(/@import\s+"\.\/(musuw-reference-[^"]+\.css)";/g)].map(
  (match) => match[1],
);
const mechanical = importNames.map((name) => read(`./${name}`)).join("\n");
const withoutComments = mechanical.replace(/\/\*[\s\S]*?\*\//g, "");

test("uses the mechanically compiled reference layer instead of legacy UI skins", () => {
  const dropdown = main.indexOf('import "@/assets/dropdown-menu.less"');
  const chatSyntax = main.indexOf('import "@/components/css/chat-hljs-dark.less"');
  const reference = main.indexOf('import "@/assets/musuw-reference-mechanical.css"');

  assert.equal(main.includes('import "@/assets/musuw-visual.less"'), false);
  assert.ok(reference > dropdown, "reference UI must win over shared dropdown chrome");
  assert.ok(reference > chatSyntax, "reference UI must load after shared chat syntax chrome");
  assert.equal(main.includes('import "@/assets/musuw-reference-core.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-workbench.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-header.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-knowledge-v2.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-knowledge-v3.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-knowledge-v4.less"'), false);
  assert.equal(manifest.includes("musuw-reference-dom-bridge.css"), false);
});

test("loads every mechanically compiled visual-reference shard and no legacy DOM bridge", () => {
  for (const shard of [
    "musuw-reference-mechanical-01.css",
    "musuw-reference-mechanical-02.css",
    "musuw-reference-mechanical-03.css",
    "musuw-reference-mechanical-04.css",
    "musuw-reference-mechanical-05.css",
    "musuw-reference-mechanical-06.css",
    "musuw-reference-mechanical-07.css",
    "musuw-reference-mechanical-08.css",
    "musuw-reference-mechanical-09a.css",
    "musuw-reference-mechanical-09b.css",
    "musuw-reference-mechanical-09c.css",
    "musuw-reference-mechanical-09d.css",
    "musuw-reference-mechanical-09e.css",
    "musuw-reference-mechanical-10a.css",
    "musuw-reference-mechanical-10b.css",
    "musuw-reference-mechanical-10c.css",
    "musuw-reference-mechanical-11a.css",
    "musuw-reference-mechanical-11b.css",
    "musuw-reference-mechanical-12.css",
    "musuw-reference-mechanical-13.css",
    "musuw-reference-mechanical-13b.css",
    "musuw-reference-mechanical-14.css",
  ]) {
    assert.ok(importNames.includes(shard), `${shard} must stay in the mechanical manifest`);
  }
  assert.equal(importNames.length, 22);
});

test("matches copied reference shell, conversation, knowledge and settings geometry", () => {
  assert.match(mechanical, /html #app \.aside_box\{[\s\S]*?width:calc\(var\(--spacing\) \* 64\) !important/);
  assert.match(mechanical, /html #app \.aside_box\.aside_box--collapsed\{[\s\S]*?width:calc\(var\(--spacing\) \* 14\) !important/);
  assert.match(mechanical, /html #app \.dialogue-answers\{[\s\S]*?max-width:var\(--container-3xl\) !important/);
  assert.match(mechanical, /html #app \.chat \.rich-input-container,[\s\S]*?background-color:#f4f5f7 !important/);
  assert.match(mechanical, /\.rich-input-container \.t-textarea__inner[\s\S]*?max-height:180px !important[\s\S]*?min-height:44px !important/);
  assert.match(mechanical, /\.kb-folder-tree:not\(\.is-collapsed\)\{[\s\S]*?width:calc\(var\(--spacing\) \* 56\) !important/);
  assert.match(mechanical, /\.doc-card-list\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\) !important/);
  assert.match(mechanical, /\.knowledge-card\{[\s\S]*?height:calc\(var\(--spacing\) \* 48\) !important/);
  assert.match(mechanical, /body \.settings-overlay \.settings-modal\{[\s\S]*?height:520px !important[\s\S]*?max-width:var\(--container-4xl\) !important/);
  assert.match(mechanical, /body \.settings-overlay \.settings-sidebar\{[\s\S]*?width:calc\(var\(--spacing\) \* 56\) !important/);
  assert.match(mechanical, /body \.settings-overlay \.settings-sidebar \.nav-item:nth-child\(2\)::before/);
  assert.match(mechanical, /body \.settings-overlay \.model-settings \.model-card\{[\s\S]*?border:1px solid var\(--color-gray-200\) !important/);
  assert.match(mechanical, /\.ai-markdown-template\.markdown-content h1\{[\s\S]*?font-size:var\(--text-lg\) !important/);
  assert.match(mechanical, /\.ai-markdown-template\.markdown-content h2\{[\s\S]*?font-size:var\(--text-base\) !important/);
  assert.match(mechanical, /\.ai-markdown-template\.markdown-content h3\{[\s\S]*?font-size:var\(--text-sm\) !important/);
  assert.match(mechanical, /\.bot_msg:hover > div > \.answer-toolbar\{opacity:100% !important/);
  assert.match(mechanical, /--font-sans:var\(--app-font-family/);
});

test("preserves product conditional rendering and task-excluded renderers", () => {
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.agent-stream-display(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.streaming-steps-container(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.tree-container(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.wiki-graph(?:-canvas|-legend|-search-container)?(?=[\s.{:#>+~]|$)/m);
  assert.equal(mechanical.includes("showFolderTree"), false);
  assert.equal(mechanical.includes("localStorage"), false);
});

test("Task 1 presentation work cannot replace business implementations", () => {
  const expected = new Map([
    ["../components/menu.vue", "c3914d4d4824890307790d2b8d6dcccfa35e91bf"],
    ["../components/Input-field.vue", "a34d09f5f9dbe44d4b3835213fdab662c4b7446a"],
    ["../components/UserMenu.vue", "f5c813ced2e0e7b98af86e814aa7b4f788661752"],
    ["../components/ChatHeader.vue", "79aec898f1e90c21a9f63fa77bce0dca509750c4"],
    ["../components/ChatReferencesDrawer.vue", "9001acea76aae131cc7420f3e1ffd275b58fce52"],
    ["../components/ChatCitationFloat.vue", "b2a42b84fc7a76ecbe8fb5f1c8079dddf6ef555b"],
    ["../composables/useChatCitationPopover.ts", "b1142ec34ee9dec81600e6f3bda0c418cd478967"],
    ["../components/KnowledgeBaseSelector.vue", "98fc31d76351af5988a3b2445daa147048bab6fd"],
    ["../components/MentionSelector.vue", "d165e6e1d27be75acafc62298946fde2235c7167"],
    ["../components/ModelSelector.vue", "402713d0904156e32aba974b144b3e745511e344"],
    ["../views/chat/components/botmsg.vue", "f696550fc980c2a648ce19a631729950fe3b0e6b"],
    ["../views/chat/components/usermsg.vue", "6dd0f2e44e4fc382d6f40702aa4b5eebc2467fea"],
    ["../views/creatChat/creatChat.vue", "3e2d251be91bdae1edca1fbf8b814c5293d1c769"],
    ["../views/knowledge/KnowledgeBase.vue", "c6c7c53a9f1eda91b645733256eb04221bf816da"],
    ["../views/knowledge/components/DocumentCardView.vue", "7fdddb98988e06b2cd6b99b7ab991574abc58964"],
    ["../views/knowledge/components/DocumentListView.vue", "dc553565d2c1818878c3c34631dc4d33010f96c6"],
    ["../views/knowledge/components/KbFolderTree.vue", "7475054ca4afb6ebb133fb47c394e2f57c1d8aea"],
    ["../views/settings/Settings.vue", "bdc6871a99f8035950b114643de25b5cca3202d3"],
    ["../views/settings/GeneralSettings.vue", "056481068d56bfcb9f89a60285bbfead419fa352"],
    ["../views/settings/ModelSettings.vue", "6c6cd4255277e24d754b0017eac708148d92e935"],
    ["../components/settings/SettingDrawer.vue", "f4469a321c483fd2d7f8db179e79549f01b2296e"],
  ]);

  for (const [path, sha] of expected) {
    assert.equal(gitBlobSha(read(path)), sha, `${path} must remain byte-for-byte on the Task 1 business baseline`);
  }
});
