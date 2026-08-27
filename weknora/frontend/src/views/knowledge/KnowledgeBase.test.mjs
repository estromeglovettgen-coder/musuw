import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KnowledgeBase.vue", import.meta.url), "utf8");

test("knowledge detail keeps the compact reference toolbar without the user-hidden date filter", () => {
  assert.match(source, /class="visual-knowledge-toolbar"[\s\S]*?visual-knowledge-toolbar__left/);
  assert.match(source, /data-guide="kb-detail-add-doc"/);
  assert.match(source, /visual-knowledge-toolbar__left[\s\S]*?visual-knowledge-toolbar__right/);
  assert.match(source, /overlayClassName: 'visual-knowledge-select-popup visual-knowledge-select-popup--type'/);
  assert.match(source, /\.visual-knowledge-select-popup\.t-select__dropdown[\s\S]*?max-height: 256px !important/);
  assert.doesNotMatch(source, /visual-knowledge-date|<t-date-range-picker/);
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

test("knowledge detail derives folder data independently from the collapsed sidebar layout", () => {
  assert.match(source, /showFolderTree:\s*computed\(\(\) => !Boolean\(unref\(state\.isFAQ\)\)\)/);
  assert.match(source, /currentChildFolders:\s*computed\([\s\S]*?childFolders\(/);
  assert.doesNotMatch(source.slice(0, source.indexOf('<template>')), /folderTreeCollapsed/);
});

test("knowledge detail does not duplicate settings in the top-right header", () => {
  assert.doesNotMatch(source, /class="visual-knowledge-header__settings"/);
  assert.match(
    source,
    /missingStorageEngine[\s\S]*?@click="handleOpenKBSettings"/,
    "the native missing-storage remediation must retain its settings hand-off",
  );
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
