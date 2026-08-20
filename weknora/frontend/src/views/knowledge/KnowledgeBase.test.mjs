import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KnowledgeBase.vue", import.meta.url), "utf8");

test("knowledge detail keeps every filter and action in the two-level toolbar", () => {
  assert.match(source, /class="visual-knowledge-toolbar"[\s\S]*?visual-knowledge-toolbar__left/);
  assert.match(source, /data-guide="kb-detail-add-doc"/);
  assert.match(source, /visual-knowledge-toolbar__left[\s\S]*?visual-knowledge-toolbar__right/);
  assert.match(source, /class="visual-knowledge-date/);
});

test("knowledge detail uses the restrained document empty state component", () => {
  assert.match(source, /class="visual-knowledge-empty"[\s\S]*?<EmptyKnowledge v-else \/>/);
});

test("graph view keeps the original layout chrome instead of inheriting document-only spacing", () => {
  assert.match(
    source,
    /v-if="isWiki && \(activeKbTab === 'wiki' \|\| activeKbTab === 'graph'\)" class="visual-knowledge-wiki-host"/,
  );
  assert.match(
    source,
    /v-if="activeKbTab === 'documents' \|\| !isWiki" class="visual-knowledge-documents"/,
  );
});
