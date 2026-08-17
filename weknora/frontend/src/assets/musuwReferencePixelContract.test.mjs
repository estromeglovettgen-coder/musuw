import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const core = read("./musuw-reference-core.less");
const workbench = read("./musuw-reference-workbench.less");
const header = read("./musuw-reference-header.less");
const pixel = core + "\n" + workbench + "\n" + header;
const main = read("../main.ts");

const withoutComments = pixel.replace(/\/\*[\s\S]*?\*\//g, "");

test("loads the mechanical pixel-authority layer after the broad Musuw skin", () => {
  const base = main.indexOf('import "@/assets/musuw-visual.less"');
  const dropdown = main.indexOf('import "@/assets/dropdown-menu.less"');
  const chatSyntax = main.indexOf('import "@/components/css/chat-hljs-dark.less"');
  const mechanical = main.indexOf('import "@/assets/musuw-reference-mechanical.css"');
  assert.ok(base >= 0, "base Musuw presentation layer stays loaded");
  assert.ok(mechanical > base, "mechanical pixel reference must load after the base presentation layer");
  assert.ok(mechanical > dropdown, "mechanical pixel reference must win over shared dropdown chrome");
  assert.ok(mechanical > chatSyntax, "mechanical pixel reference must load after shared product chrome");
  assert.equal(main.includes('import "@/assets/musuw-reference-core.less"'), false, "legacy hand-authored reference core is not loaded");
  assert.equal(main.includes('import "@/assets/musuw-reference-workbench.less"'), false, "legacy hand-authored workbench is not loaded");
  assert.equal(main.includes('import "@/assets/musuw-reference-header.less"'), false, "legacy hand-authored header patch is not loaded");
});

test("matches the exported reference shell and conversation geometry", () => {
  assert.match(pixel, /\.aside_box\s*\{[\s\S]*?min-width:\s*256px;[\s\S]*?width:\s*256px;[\s\S]*?padding:\s*12px;/);
  assert.match(pixel, /\.aside_box\.aside_box--collapsed\s*\{[\s\S]*?width:\s*56px;/);
  assert.match(pixel, /\.dialogue-answers\s*\{[\s\S]*?max-width:\s*768px;/);
  assert.match(pixel, /\.rich-input-container[\s\S]*?border-radius:\s*20px;[\s\S]*?background:\s*#f4f5f7;/);
  assert.match(pixel, /\.t-textarea__inner[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?max-height:\s*180px\s*!important;/);
  assert.match(pixel, /\.user_msg\s*\{[\s\S]*?max-width:\s*85%;[\s\S]*?padding:\s*10px\s+18px;[\s\S]*?border-radius:\s*18px;/);
});

test("matches the exported reference knowledge and settings geometry", () => {
  assert.match(pixel, /\.kb-card-wrap\s*\{[\s\S]*?gap:\s*18px;/);
  assert.match(pixel, /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.kb-card-wrap\s*\{[\s\S]*?repeat\(3,/);
  assert.match(pixel, /\.kb-card\s*\{[\s\S]*?height:\s*136px;[\s\S]*?padding:\s*18px;[\s\S]*?border-radius:\s*12px;/);
  assert.match(pixel, /\.kb-card\.kb-create-card\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*32px;[\s\S]*?right:\s*32px;/);
  assert.match(pixel, /\.knowledge-main\s*\{[\s\S]*?gap:\s*12px;[\s\S]*?border:\s*0;/);
  assert.match(pixel, /\.kb-folder-tree\s*\{[\s\S]*?width:\s*224px;[\s\S]*?border-radius:\s*16px;/);
  assert.match(pixel, /\.doc-filter-bar\s*\{[\s\S]*?padding:\s*10px\s+10px\s+10px\s+102px;[\s\S]*?border-radius:\s*16px;/);
  assert.match(pixel, /\.doc-card-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/);
  assert.match(pixel, /\.knowledge-card,[\s\S]*?\.folder-card\s*\{[\s\S]*?height:\s*192px;[\s\S]*?border-radius:\s*16px;/);
  assert.match(header, /document-breadcrumb:has\(\.breadcrumb-tab\)::after[\s\S]*?width:\s*224px;[\s\S]*?height:\s*38px;[\s\S]*?border-radius:\s*12px;/);
  assert.match(header, /\.breadcrumb-tab\s*\{[\s\S]*?min-height:\s*30px;[\s\S]*?padding:\s*6px\s+14px;[\s\S]*?border-radius:\s*8px;/);
  assert.match(pixel, /\.settings-modal\s*\{[\s\S]*?max-width:\s*896px;[\s\S]*?height:\s*520px;[\s\S]*?border-radius:\s*24px;/);
  assert.match(pixel, /\.settings-sidebar\s*\{[\s\S]*?width:\s*224px;[\s\S]*?padding:\s*24px;/);
});

test("does not restyle the two task-excluded renderers", () => {
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.agent-stream-display(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.streaming-steps-container(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.tree-container(?=[\s.{:#>+~]|$)/m);
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.wiki-graph(?:-canvas|-legend|-search-container)?(?=[\s.{:#>+~]|$)/m);
});
