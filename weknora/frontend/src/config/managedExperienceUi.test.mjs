import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const menuStore = read("../stores/menu.ts");
const settingsStore = read("../stores/settings.ts");
const router = read("../router/index.ts");
const sidebar = read("../components/menu.vue");
const inputField = read("../components/Input-field.vue");
const userMenu = read("../components/UserMenu.vue");
const settingsView = read("../views/settings/Settings.vue");
const platformView = read("../views/platform/index.vue");
const generalSettings = read("../views/settings/GeneralSettings.vue");
const knowledgeBase = read("../views/knowledge/KnowledgeBase.vue");
const knowledgeBaseList = read("../views/knowledge/KnowledgeBaseList.vue");
const knowledgeBaseListController = read("../assets/business-baselines/KnowledgeBaseList.pre-view.vue");
const workspaceOnboarding = read("../views/auth/WorkspaceOnboarding.vue");
const commandPaletteStore = read("../stores/commandPalette.ts");
const commandPalette = read("../components/GlobalCommandPalette.vue");
const inputBusiness = read("../assets/business-baselines/Input-field.pre-view.vue");
const sidebarBusiness = read("../assets/business-baselines/menu.pre-view.vue");

/**
 * Musuw product exposure policy:
 * - Lite is the consumer surface: New Chat + Knowledge Base are the only
 *   top-level product entries; Settings exposes General, Usage, Models, and User Profile.
 * - Standard keeps the complete upstream WeKnora source surface so operators
 *   can restore it by switching edition instead of reconstructing deleted code.
 * - Security-sensitive enforcement is server-side; these tests lock the
 *   frontend non-discoverability/deep-link contract only.
 */

test("Lite sidebar is fail-closed to New Chat and Knowledge Base", () => {
  assert.match(menuStore, /const liteVisiblePaths = new Set\(\['creatChat', 'knowledge-bases'\]\)/);
  assert.match(menuStore, /authStore\.isLiteMode && !liteVisiblePaths\.has\(item\.path\)/);
  assert.match(sidebar, /!authStore\.isLiteMode && showSessionSourceFilter && !batchMode/);

  // Standard restoration remains possible because upstream menu definitions
  // are retained rather than deleted from source.
  for (const titleKey of ['menu.agents', 'menu.organizations', 'menu.settings', 'menu.logout']) {
    assert.ok(menuStore.includes(`titleKey: '${titleKey}'`), `standard menu source lost ${titleKey}`);
  }
});

test("server Edition owns Lite activation and clears stale browser workspace state", () => {
  assert.match(router, /await ensureProductEdition\(authStore\)/);
  assert.match(router, /edition === 'lite' \|\| edition === 'standard'/);
  assert.match(router, /const isLite = edition === 'lite'/);
  assert.match(router, /applyResolvedProductEdition\(authStore, isLite\)/);
  assert.match(router, /authStore\.setLiteMode\(isLite\)/);
  assert.match(router, /if \(!isLite\) return/);
  assert.match(router, /authStore\.setSelectedTenant\(null\)/);
  assert.match(router, /reconcileLiteChatSettings\(settingsStore\.getSettings\(\)\)/);
  assert.match(router, /if \(restored\) \{\s*await ensureProductEdition\(authStore\)/);
  assert.doesNotMatch(router, /if \(isLiteEdition\(authStore\) \|\| editionProbeDone\) return/);
  assert.doesNotMatch(sidebarBusiness, /getSystemInfo/);
});

test("cached Edition is reapplied after logout resets the auth store", () => {
  assert.match(router, /let resolvedLiteMode: boolean \| null = null/);
  assert.match(
    router,
    /if \(editionProbeDone\) \{\s*if \(resolvedLiteMode !== null\) applyResolvedProductEdition\(authStore, resolvedLiteMode\)\s*return\s*\}/,
  );
  assert.match(router, /resolvedLiteMode = isLite/);
});

test("agent selection keeps web search disabled in Lite", () => {
  assert.match(
    settingsStore,
    /selectAgent\([\s\S]{0,450}this\.settings\.webSearchEnabled = !useAuthStore\(\)\.isLiteMode;/,
  );
  assert.match(inputField, /v-if="!authStore\.isLiteMode && showWebSearchButton"/);
});

test("Lite conversation restore cannot re-enable hidden capabilities", () => {
  assert.match(
    settingsStore,
    /applyLastRequestState\([\s\S]*?if \(useAuthStore\(\)\.isLiteMode\) \{[\s\S]*?reconcileLiteChatSettings/,
  );
});

test("Lite sidebar does not request hidden IM or embed channel metadata", () => {
  assert.match(
    sidebarBusiness,
    /if \(authStore\.isLiteMode\) \{[\s\S]*imPlatforms\.value = \[\];[\s\S]*embedChannelNames\.value = \{\};[\s\S]*return;/,
  );
});

test("Lite route guard blocks hidden pages and allows only consumer Settings sections", () => {
  for (const allowed of [
    "path === '/platform/creatChat'",
    "path.startsWith('/platform/chat/')",
    "path === '/platform/knowledge-bases'",
    "path.startsWith('/platform/knowledge-bases/')",
    "path === '/platform/settings'",
    "path === '/plans'",
    "path === '/checkout'",
  ]) {
    assert.ok(router.includes(allowed), `Lite route allow-list lost ${allowed}`);
  }
  assert.match(router, /if \(!isAllowedLitePath\(to\.path\)\)[\s\S]*next\(AUTHENTICATED_HOME_PATH\)/);
  assert.match(router, /section !== 'general' && section !== 'usage' && section !== 'userprofile'/);

  // Standard routes remain in the bundle/source for quick restoration.
  assert.match(router, /AgentList\.vue/);
  assert.match(router, /OrganizationList\.vue/);
});

test("Lite Settings exposes General, Usage, Models, and User Profile while General exposes Language only", () => {
  assert.match(settingsView, /if \(authStore\.isLiteMode\) \{[\s\S]*key: 'general'[\s\S]*key: 'usage'[\s\S]*key: 'models'[\s\S]*key: 'userprofile'/);
  assert.match(settingsView, /if \(authStore\.isLiteMode && section !== 'usage' && section !== 'userprofile' && section !== 'models'\) return 'general'/);
  assert.match(settingsView, /if \(authStore\.isLiteMode\) return key === 'general' \|\| key === 'usage' \|\| key === 'userprofile' \|\| key === 'models'/);
  assert.match(settingsView, /\{ key: 'models', icon: 'cpu', label: t\('settings\.modelManagement'\) \}/);
  assert.match(settingsView, /<ModelSettings v-else-if="currentSection === 'models'"/);
  assert.match(settingsView, /<UsageBillingSettings v-else-if="currentSection === 'usage'"/);

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

test("Settings has one active mount on the dedicated route", () => {
  assert.match(platformView, /<Settings v-if="route\.path !== '\/platform\/settings'" \/>/);
  assert.equal((router.match(/views\/settings\/Settings\.vue/g) || []).length, 1);
});

test("Lite UserMenu keeps account exit but does not rediscover management surfaces", () => {
  assert.match(userMenu, /<div\s+[\s\S]*class="visual-user-menu__account(?: [^"]*)?"/);
  assert.match(userMenu, /<button v-if="!authStore\.isLiteMode" type="button" class="visual-user-menu__guide"/);
  assert.match(userMenu, /!authStore\.isLiteMode && canManageMembers/);
  assert.match(userMenu, /!authStore\.isLiteMode && canManageModels/);
  assert.match(userMenu, /<template v-if="!authStore\.isLiteMode">[\s\S]*openDocs[\s\S]*openGithub/);
  assert.match(userMenu, /handleQuickNav\('general'\)/);
  assert.match(userMenu, /handleQuickNav\('usage'\)/);
  assert.match(userMenu, /openPlans/);
  assert.match(userMenu, /router\.push\('\/plans'\)/);
  assert.match(userMenu, /class="visual-user-menu__item is-danger" @click="handleLogout"/);
  assert.match(userMenu, /handoffToExternalAuth\('logout'\)/);
});

test("Lite chat exposes one Codex-style model/reasoning picker without Agent management", () => {
  assert.match(inputField, /v-if="!authStore\.isLiteMode" type="button" @click\.stop\.prevent="handleGoToAgentSettings\('knowledge'\)"/);
  assert.match(inputField, /class="visual-chat-composer__model-picker"/);
  assert.match(inputField, /modelPickerView === 'overview'/);
  assert.match(inputField, /modelPickerView === 'models'/);
  assert.match(inputField, /modelPickerView = 'reasoning'/);
  assert.doesNotMatch(inputField, /<AgentSelector\b|__thinking-switch|__add_model__/);
});

test("Lite Knowledge Base keeps diagnostics visible without opening hidden admin settings", () => {
  assert.match(knowledgeBase, /:disabled="authStore\.isLiteMode" @click="goToParserSettings"/);
  assert.match(knowledgeBase, /<strong v-if="!authStore\.isLiteMode">\{\{ \$t\('knowledgeBase\.goToParserSettings'\) \}\}/);
  assert.match(knowledgeBase, /:disabled="authStore\.isLiteMode" @click="handleOpenKBSettings"/);
  assert.match(knowledgeBase, /<strong v-if="!authStore\.isLiteMode">\{\{ \$t\('knowledgeBase\.goToStorageSettings'\) \}\}/);
});

test("Lite tenantless fallback does not expose workspace create or invitation management", () => {
  assert.match(workspaceOnboarding, /v-if="!authStore\.isLiteMode" class="workspace-actions"/);
  assert.match(workspaceOnboarding, /<CreateTenantDialog v-if="!authStore\.isLiteMode"/);
  assert.match(workspaceOnboarding, /<MyInvitationsDialog v-if="!authStore\.isLiteMode"/);
  assert.match(workspaceOnboarding, /if \(!authStore\.isLiteMode\) \{[\s\S]*fetchPendingInvitationCount/);
  assert.match(workspaceOnboarding, /handleLogout/);
});

test("Lite disables Command Palette as an alternate discovery path", () => {
  assert.match(commandPaletteStore, /const auth = useAuthStore\(\)/);
  assert.match(commandPaletteStore, /if \(auth\.isLiteMode\) \{[\s\S]*open\.value = false[\s\S]*return/);
  assert.match(commandPalette, /<RetrievalSettings v-if="drawerVisible && !authStore\.isLiteMode"/);
  assert.match(inputBusiness, /if \(authStore\.isLiteMode\) \{[\s\S]*mcpServices\.value = \[\][\s\S]*return/);
});

test("chat and Knowledge Base business surfaces remain present inside the exposed product", () => {
  // Lite narrows product entry points; it does not rewrite the allowed chat/KB
  // controllers. Runtime Agent/model reads may still back chat internally.
  assert.match(inputField, /v-for="model in availableModels"/);
  assert.match(inputField, /reasoningEffort/);
  assert.match(knowledgeBaseList, /<ListSpaceSidebar\b/);
  assert.match(knowledgeBaseList, /v-model="spaceSelection"/);
  assert.match(knowledgeBaseListController, /'favorites'/);
  assert.match(knowledgeBaseListController, /'recents'/);
  assert.match(knowledgeBaseListController, /listOrganizationSharedKnowledgeBases\(val\)/);
});
