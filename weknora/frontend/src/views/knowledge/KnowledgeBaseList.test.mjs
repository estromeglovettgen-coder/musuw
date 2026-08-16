import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KnowledgeBaseList.vue", import.meta.url), "utf8");

test("consumer KB creation opens the name-only document flow without model preselection", () => {
  assert.match(
    source,
    /const handleCreateKnowledgeBase = \(\) => \{[\s\S]*?uiStore\.openCreateKB\("document"\);/,
  );
  assert.doesNotMatch(source, /useTenantModelReadiness|modelsReadyLoaded|isReadyForDocumentKb/);
});

test("consumer KB list has no uninitialized-model repair prompt or settings escape hatch", () => {
  assert.doesNotMatch(source, /hasUninitializedKbs|uninitializedBanner|isInitialized\(/);
  assert.doesNotMatch(
    source,
    /knowledgeBase\.settings|handleSettingsById|handleSettings|goSettings|openKBSettings/,
  );
  assert.match(
    source,
    /const handleCardClick = \(kb: KB\) => \{[\s\S]*?pins\.touchRecent\("kb", kb\.id\);[\s\S]*?goDetail\(kb\.id\);/,
  );
});

test("KB list keeps creation in the grid and removes the noisy header/group chrome", () => {
  assert.doesNotMatch(source, /class="header-action-btn"/);
  assert.match(source, /class="kb-card kb-create-card"[\s\S]*?data-guide="kb-list-create"/);
  assert.doesNotMatch(source, /<span>\{\{ \$t\("knowledgeList\.sections\.mine"\) \}\}<\/span>/);
});

test("KB cards do not render decorative graph or multimodal footer badges", () => {
  assert.doesNotMatch(source, /class="feature-badge kg"/);
  assert.doesNotMatch(source, /class="feature-badge multimodal"/);
});
