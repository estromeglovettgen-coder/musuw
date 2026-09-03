import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KnowledgeBase.vue", import.meta.url), "utf8");
const nativeController = readFileSync(
  new URL("../../assets/business-baselines/KnowledgeBase.pre-view.vue", import.meta.url),
  "utf8",
);

test("knowledge detail keeps the compact reference toolbar without the user-hidden date filter", () => {
  assert.match(source, /class="visual-knowledge-toolbar"[\s\S]*?visual-knowledge-toolbar__left/);
  assert.match(source, /data-guide="kb-detail-add-doc"/);
  assert.match(source, /visual-knowledge-toolbar__left[\s\S]*?visual-knowledge-toolbar__right/);
  assert.match(source, /fileTypeFilterPanelVisible[\s\S]*?visual-knowledge-filter-button/);
  assert.match(source, /parseStatusFilterPanelVisible[\s\S]*?visual-knowledge-filter-button/);
  assert.doesNotMatch(source, /<t-select\b/);
  assert.doesNotMatch(source, /visual-knowledge-date|<t-date-range-picker/);
});

test("knowledge detail lets the empty state open the existing document picker", () => {
  assert.match(source, /class="visual-knowledge-empty"[\s\S]*?<EmptyKnowledge v-else @upload="uploadSourceRef\?\.openFileDialog\(\)" \/>/);
  assert.match(
    readFileSync(new URL("./components/KbUploadSourceDropdown.vue", import.meta.url), "utf8"),
    /defineExpose\(\{\s*openFileDialog,\s*openUrlDialog\s*\}\)/,
  );
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

test("knowledge detail delegates setup plus empty and collapsed folder behavior to the native controller", () => {
  const wrapper = source.slice(0, source.indexOf('<template>'));
  assert.doesNotMatch(wrapper, /showFolderTree:\s*computed/);
  assert.doesNotMatch(wrapper, /currentChildFolders:\s*computed/);
  assert.doesNotMatch(wrapper, /childFolders|ROOT_FOLDER_PATH/);
  assert.match(wrapper, /const legacySetup = legacy\.setup/);
  assert.match(wrapper, /setup\(props:[\s\S]*?return \{[\s\S]*?\.\.\.state/);
  assert.match(nativeController, /const showFolderTree = computed\(\(\) => !isFAQ\.value && hasFolders\.value\)/);
  assert.match(nativeController, /if \(showFolderTree\.value && !folderTreeCollapsed\.value\) return \[\]/);
});

test("knowledge detail does not duplicate settings in the top-right header", () => {
  assert.doesNotMatch(source, /class="visual-knowledge-header__settings"/);
  assert.match(
    source,
    /missingStorageEngine[\s\S]*?@click="handleOpenKBSettings"/,
    "the native missing-storage remediation must retain its settings hand-off",
  );
});

test("knowledge detail consumes identifier-free Lite runtime and storage readiness", () => {
  assert.match(nativeController, /isKnowledgeBaseRuntimeReady, isKnowledgeBaseStorageReady/);
  assert.match(nativeController, /return !isKnowledgeBaseStorageReady\(kbInfo\.value\)/);
  assert.match(nativeController, /if \(!isKnowledgeBaseRuntimeReady\(kbInfo\.value\)\)/);
  assert.doesNotMatch(nativeController, /!kbInfo\.value\.summary_model_id/);
});

test("knowledge detail remediation alerts use the shared dark card surface", () => {
  assert.match(
    source,
    /:global\(:root\[theme-mode="dark"\] \.visual-knowledge-alerts button\)\s*\{[\s\S]*?border-color:\s*var\(--mvc-line\)[\s\S]*?background:\s*var\(--mvc-surface-raised\)[\s\S]*?color:\s*var\(--mvc-text\)/,
  );
  assert.match(
    source,
    /:global\(:root\[theme-mode="dark"\] \.visual-knowledge-alerts strong\)\s*\{[\s\S]*?color:\s*var\(--mvc-text-strong\)/,
  );
});
