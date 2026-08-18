import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KnowledgeBase.vue", import.meta.url), "utf8");

test("knowledge detail keeps every filter and action in the two-level toolbar", () => {
  assert.match(source, /class="doc-filter-bar"[\s\S]*?doc-filter-bar__filters/);
  assert.match(source, /data-guide="kb-detail-add-doc"/);
  assert.match(source, /doc-filter-bar__filters[\s\S]*?doc-filter-bar__trailing/);
  assert.match(source, /class="doc-date-range/);
});

test("knowledge detail uses the restrained document empty state component", () => {
  assert.match(source, /<EmptyKnowledge\s+v-else\s*\/>/);
});

test("graph view keeps the original layout chrome instead of inheriting document-only spacing", () => {
  assert.match(source, /class="knowledge-layout"[\s\S]*?documents-layout/);
  assert.match(source, /isWiki && \(activeKbTab === 'wiki' \|\| activeKbTab === 'graph'\)/);
});
