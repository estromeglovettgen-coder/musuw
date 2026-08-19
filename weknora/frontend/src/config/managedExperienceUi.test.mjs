import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const menuStore = read("../stores/menu.ts");
const router = read("../router/index.ts");
const inputField = read("../components/Input-field.vue");
const userMenu = read("../components/UserMenu.vue");
const settingsView = read("../views/settings/Settings.vue");
const generalSettings = read("../views/settings/GeneralSettings.vue");
const knowledgeBaseList = read("../views/knowledge/KnowledgeBaseList.vue");
const knowledgeBaseListController = read("../assets/business-baselines/KnowledgeBaseList.pre-view.vue");
const commandPaletteStore = read("../stores/commandPalette.ts");

/**
 * Musuw product exposure policy:
 * - Lite is the consumer surface: New Chat + Knowledge Base are the only
 *   top-level product entries; Settings exposes General/Language only.
 * - Standard keeps the complete upstream WeKnora source surface so operators
 *   can restore it by switching edition instead of reconstructing deleted code.
 * - Security-sensitive enforcement is server-side; these tests lock the
 *   frontend non-discoverability/deep-link contract only.
 */

test("Lite sidebar is fail-closed to New Chat and Knowledge Base", () => {
  assert.match(menuStore, /const liteVisiblePaths = new Set\(\['creatChat', 'knowledge-bases'\]\)/);
  assert.match(menuStore, /authStore\.isLiteMode && !liteVisiblePaths\.has\(item\.path\)/);

  // Standard restoration remains possible because upstream menu definitions
  // are retained rather than deleted from source.
  for (const titleKey of ['menu.agents', 'menu.organizations', 'menu.settings', 'menu.logout']) {
    assert.ok(menuStore.includes(`titleKey: '${titleKey}'`), `standard menu source lost ${titleKey}`);
  }
});

test("server Edition owns Lite activation and can clear stale browser Lite state", () => {
  assert.match(router, /await ensureProductEdition\(authStore\)/);
  assert.match(router, /edition === 'lite' \|\| edition === 'standard'/);
  assert.match(router, /authStore\.setLiteMode\(edition === 'lite'\)/);
  assert.doesNotMatch(router, /if \(isLiteEdition\(authStore\) \|\| editionProbeDone\) return/);
});

test("Lite route guard blocks hidden pages and normalizes Settings deep links", () => {
  for (const allowed of [
    "path === '/platform/creatChat'",
    "path.startsWith('/platform/chat/')",
    "path === '/platform/knowledge-bases'",
    "path.startsWith('/platform/knowledge-bases/')",
    "path === '/platform/settings'",
  ]) {
    assert.ok(router.includes(allowed), `Lite route allow-list lost ${allowed}`);
  }
  assert.match(router, /if \(!isAllowedLitePath\(to\.path\)\)[\s\S]*next\(AUTHENTICATED_HOME_PATH\)/);
  assert.match(router, /\(section && section !== 'general'\) \|\| tab/);

  // Standard routes remain in the bundle/source for quick restoration.
  assert.match(router, /AgentList\.vue/);
  assert.match(router, /OrganizationList\.vue/);
});

test("Lite Settings exposes General only and General exposes Language only", () => {
  assert.match(settingsView, /if \(authStore\.isLiteMode\) \{[\s\S]*key: 'general'/);
  assert.match(settingsView, /if \(authStore\.isLiteMode\) return 'general'/);
  assert.match(settingsView, /if \(authStore\.isLiteMode\) return key === 'general'/);

  assert.match(generalSettings, /language\.language/);
  assert.match(generalSettings, /handleLanguageChange/);
  for (const standardOnlyControl of ['theme.theme', 'font.uiFont', 'font.monoFont', 'font.fontSize']) {
    assert.ok(generalSettings.includes(standardOnlyControl), `standard preference source lost ${standardOnlyControl}`);
  }
  assert.ok(
    (generalSettings.match(/v-if="!authStore\.isLiteMode"/g) || []).length >= 4,
    'theme/font controls must remain Standard-only in General Settings',
  );
  assert.doesNotMatch(generalSettings, /isAutoCheckUpdateEnabled|toggleAutoCheckUpdate/);
});

test("Lite UserMenu keeps account exit but does not rediscover management surfaces", () => {
  assert.match(userMenu, /<div\s+[\s\S]*class="visual-user-menu__account"/);
  assert.match(userMenu, /<button v-if="!authStore\.isLiteMode" type="button" class="visual-user-menu__guide"/);
  assert.match(userMenu, /!authStore\.isLiteMode && canManageMembers/);
  assert.match(userMenu, /!authStore\.isLiteMode && canManageModels/);
  assert.match(userMenu, /<template v-if="!authStore\.isLiteMode">[\s\S]*openDocs[\s\S]*openGithub/);
  assert.match(userMenu, /handleQuickNav\('general'\)/);
  assert.match(userMenu, /class="visual-user-menu__item is-danger" @click="handleLogout"/);
  assert.match(userMenu, /handoffToExternalAuth\('logout'\)/);
});

test("Lite disables Command Palette as an alternate discovery path", () => {
  assert.match(commandPaletteStore, /const auth = useAuthStore\(\)/);
  assert.match(commandPaletteStore, /if \(auth\.isLiteMode\) \{[\s\S]*open\.value = false[\s\S]*return/);
});

test("chat and Knowledge Base business surfaces remain present inside the exposed product", () => {
  // Lite narrows product entry points; it does not rewrite the allowed chat/KB
  // controllers. Runtime Agent/model reads may still back chat internally.
  assert.match(inputField, /v-for="model in availableModels"/);
  assert.match(inputField, /thinkingEnabled/);
  assert.match(knowledgeBaseList, /<ListSpaceSidebar\b/);
  assert.match(knowledgeBaseList, /v-model="spaceSelection"/);
  assert.match(knowledgeBaseListController, /'favorites'/);
  assert.match(knowledgeBaseListController, /'recents'/);
  assert.match(knowledgeBaseListController, /listOrganizationSharedKnowledgeBases\(val\)/);
});
