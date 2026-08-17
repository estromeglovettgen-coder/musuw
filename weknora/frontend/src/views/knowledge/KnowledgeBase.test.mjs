import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entry = readFileSync(new URL("./KnowledgeBase.vue", import.meta.url), "utf8");
const source = readFileSync(new URL("./KnowledgeBaseMechanical.vue", import.meta.url), "utf8");
const cards = readFileSync(new URL("./components/DocumentCardView.vue", import.meta.url), "utf8");

test("knowledge detail entry contains no legacy page UI", () => {
  assert.match(entry, /<KnowledgeBaseMechanical\s*\/>/);
  assert.doesNotMatch(entry, /KnowledgeBaseReference|doc-filter-bar|knowledge-main|document-breadcrumb|knowledge-card/);
});

test("knowledge detail uses the source-level reference page hierarchy", () => {
  assert.match(source, /class="reference-kb-header"/);
  assert.match(source, /class="reference-kb-tabs"/);
  assert.match(source, /class="reference-doc-stage"/);
  assert.match(source, /class="reference-directory"/);
  assert.match(source, /class="reference-toolbar"/);
  assert.match(source, /class="reference-document-workspace"/);
  assert.match(cards, /class="reference-card-grid"/);
  assert.match(cards, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});

test("knowledge detail removes visible TDesign controls from the mechanical page", () => {
  for (const legacyTag of ["t-input", "t-select", "t-popup", "t-loading", "t-skeleton", "t-date-range-picker"]) {
    assert.doesNotMatch(source, new RegExp(`<${legacyTag}`));
  }
  assert.match(source, /ReferenceIcon/);
  assert.match(source, /class="reference-search-field"/);
  assert.match(source, /class="reference-select-field"/);
});

test("knowledge detail keeps real project data paths and product-only filters", () => {
  assert.match(source, /KbUploadSourceDropdown/);
  assert.match(source, /@files="uploadFiles"/);
  assert.match(source, /@url="importUrl"/);
  assert.match(source, /@manual="createManual"/);
  assert.match(source, /v-model="selectedParseStatus"/);
  assert.match(source, /const selectedSource = ref\(''\)/);
  assert.match(source, /const updatedTimeRange = ref<string\[\]>\(\[\]\)/);
  assert.match(source, /source: selectedSource\.value \|\| undefined/);
  assert.match(source, /start_time: start \? /);
  assert.match(source, /end_time: end \? /);
});

test("original behavior contracts survive the UI replacement", () => {
  assert.match(source, /weknora\.kb\.docs\.viewMode/);
  assert.match(source, /batchTagDialogVisible/);
  assert.match(source, /updateKnowledgeTagBatch\(\{ updates \}\)/);
  assert.match(source, /weknora:knowledge-file-drop/);
  assert.match(source, /openURLImportDialog/);
  assert.match(source, /knowledgeFileUploaded/);
  assert.match(source, /uiStore\.clearSelectedTagIds\(\)/);
});

test("folder visibility and graph/trace renderer remain product-owned", () => {
  assert.match(source, /showFolderTree && !folderTreeCollapsed/);
  assert.match(source, /activeKbTab !== 'documents'/);
  assert.match(source, /<WikiBrowser/);
  assert.match(source, /<DocContent/);
  assert.doesNotMatch(source, /wiki-graph-canvas|tree-container/);
});
