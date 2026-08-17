import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const main = read("../main.ts");
const manifest = read("./musuw-reference-mechanical.css");

const importNames = [...manifest.matchAll(/@import\s+"\.\/(musuw-reference-[^"]+\.css)";/g)].map(
  (match) => match[1],
);
const mechanical = importNames.map((name) => read(`./${name}`)).join("\n");
const withoutComments = mechanical.replace(/\/\*[\s\S]*?\*\//g, "");

test("uses only the mechanical reference layer for Task 1 overrides", () => {
  const dropdown = main.indexOf('import "@/assets/dropdown-menu.less"');
  const chatSyntax = main.indexOf('import "@/components/css/chat-hljs-dark.less"');
  const reference = main.indexOf('import "@/assets/musuw-reference-mechanical.css"');

  assert.equal(
    main.includes('import "@/assets/musuw-visual.less"'),
    false,
    "legacy hand-authored Musuw visual skin must not compete with the copied reference UI",
  );
  assert.ok(reference > dropdown, "reference UI must win over shared dropdown chrome");
  assert.ok(reference > chatSyntax, "reference UI must load after shared chat syntax chrome");
  assert.equal(main.includes('import "@/assets/musuw-reference-core.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-workbench.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-header.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-knowledge-v2.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-knowledge-v3.less"'), false);
  assert.equal(main.includes('import "@/assets/musuw-reference-knowledge-v4.less"'), false);
});

test("loads every mechanical reference shard and only a minimal DOM bridge", () => {
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
    "musuw-reference-mechanical-10a.css",
    "musuw-reference-mechanical-10b.css",
    "musuw-reference-mechanical-10c.css",
    "musuw-reference-mechanical-11a.css",
    "musuw-reference-mechanical-11b.css",
    "musuw-reference-mechanical-12.css",
    "musuw-reference-dom-bridge.css",
  ]) {
    assert.ok(importNames.includes(shard), `${shard} must stay in the mechanical manifest`);
  }
});

test("matches the copied reference shell, conversation and knowledge geometry", () => {
  assert.match(mechanical, /html #app \.aside_box\{[\s\S]*?width:calc\(var\(--spacing\) \* 64\) !important/);
  assert.match(mechanical, /html #app \.aside_box\.aside_box--collapsed\{[\s\S]*?width:calc\(var\(--spacing\) \* 14\) !important/);
  assert.match(mechanical, /html #app \.dialogue-answers\{[\s\S]*?max-width:var\(--container-3xl\) !important/);
  assert.match(mechanical, /html #app \.chat \.rich-input-container,[\s\S]*?background-color:#f4f5f7 !important/);
  assert.match(mechanical, /\.rich-input-container \.t-textarea__inner[\s\S]*?min-height:44px !important[\s\S]*?max-height:180px !important/);
  assert.match(mechanical, /\.kb-folder-tree:not\(\.is-collapsed\)\{[\s\S]*?width:calc\(var\(--spacing\) \* 56\) !important/);
  assert.match(mechanical, /\.doc-card-list\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\) !important/);
  assert.match(mechanical, /\.knowledge-card\{[\s\S]*?height:calc\(var\(--spacing\) \* 48\) !important/);
  assert.match(mechanical, /body \.settings-overlay \.settings-modal\{[\s\S]*?height:520px !important[\s\S]*?max-width:var\(--container-4xl\) !important/);
  assert.match(mechanical, /body \.settings-overlay \.settings-sidebar\{[\s\S]*?width:calc\(var\(--spacing\) \* 56\) !important/);
});

test("preserves project conditional rendering and does not restyle task-excluded renderers", () => {
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.agent-stream-display(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.streaming-steps-container(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.tree-container(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.wiki-graph(?:-canvas|-legend|-search-container)?(?=[\s.{:#>+~]|$)/m);
  assert.equal(mechanical.includes("showFolderTree"), false, "presentation CSS must not own folder visibility state");
  assert.equal(mechanical.includes("localStorage"), false, "presentation CSS must not mutate persisted product state");
});
