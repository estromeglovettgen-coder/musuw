import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entry = readFileSync(new URL("./KnowledgeBase.vue", import.meta.url), "utf8");
const source = readFileSync(new URL("./KnowledgeBaseReference.vue", import.meta.url), "utf8");

test("knowledge detail entry contains no legacy page UI", () => {
  assert.match(entry, /<KnowledgeBaseReference\s*\/>/);
  assert.doesNotMatch(entry, /doc-filter-bar|knowledge-main|document-breadcrumb|knowledge-card/);
});

test("knowledge detail uses the copied reference page hierarchy", () => {
  assert.match(source, /class="ref-kb-header"/);
  assert.match(source, /class="ref-tabs"/);
  assert.match(source, /class="ref-doc-stage"/);
  assert.match(source, /class="ref-directory"/);
  assert.match(source, /class="ref-toolbar"/);
  assert.match(source, /class="ref-document-workspace"/);
  assert.match(source, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("knowledge detail keeps real project controls while using the reference shell", () => {
  assert.match(source, /KbUploadSourceDropdown/);
  assert.match(source, /@files="uploadFiles"/);
  assert.match(source, /@url="importUrl"/);
  assert.match(source, /@manual="createManual"/);
  assert.match(source, /v-model="selectedParseStatus"/);
  assert.match(source, /v-model="selectedSource"/);
  assert.match(source, /v-model="updatedTimeRange"/);
});

test("folder visibility and graph renderer remain product-owned", () => {
  assert.match(source, /showFolderTree && !folderTreeCollapsed/);
  assert.match(source, /activeKbTab !== 'documents'/);
  assert.match(source, /<WikiBrowser/);
  assert.doesNotMatch(source, /wiki-graph-canvas|tree-container/);
});
