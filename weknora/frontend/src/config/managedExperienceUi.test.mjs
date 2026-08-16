import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const menuStore = read("../stores/menu.ts");
const router = read("../router/index.ts");
const inputField = read("../components/Input-field.vue");
const commandPalette = read("../components/GlobalCommandPalette.vue");
const userMenu = read("../components/UserMenu.vue");
const newUserGuide = read("../components/NewUserGuide.vue");
const settingsStore = read("../stores/settings.ts");
const settingsStorage = read("../stores/settingsStorage.ts");
const settingsView = read("../views/settings/Settings.vue");
const generalSettings = read("../views/settings/GeneralSettings.vue");
const sidebar = read("../components/menu.vue");
const commands = read("../components/GlobalCommandPalette/commands.ts");
const knowledgeBaseList = read("../views/knowledge/KnowledgeBaseList.vue");
const platformShell = read("../views/platform/index.vue");

test("agent management and selection are absent from the managed user experience", () => {
  assert.doesNotMatch(menuStore, /titleKey:\s*'menu\.agents'/);
  assert.doesNotMatch(router, /import\("\.\.\/views\/agent\/AgentList\.vue"\)/);
  assert.match(router, /path:\s*["']agents["'][\s\S]*redirect:\s*["']\/platform\/creatChat["']/);
  assert.doesNotMatch(inputField, /<AgentSelector\b/);
  assert.doesNotMatch(commandPalette, /<ResultGroup[^>]+agents/);
  assert.doesNotMatch(newUserGuide, /key:\s*'agents'/);
});

test("chat exposes exactly two managed modes and only Pro exposes deep thinking", () => {
  assert.match(inputField, /V4 Flash/);
  assert.match(inputField, /V4 Pro/);
  assert.equal((inputField.match(/@click="selectAgentMode\('/g) || []).length, 2);
  assert.match(inputField, /@click="selectAgentMode\('quick-answer'\)"/);
  assert.match(inputField, /@click="selectAgentMode\('smart-reasoning'\)"/);
  assert.match(inputField, /v-if="isProMode"[\s\S]*v-model="thinkingEnabled"/);
  assert.doesNotMatch(inputField, /v-for="model in availableModels"/);
  assert.doesNotMatch(inputField, /toggleModelSelector/);
  assert.match(inputField, /class="control-btn image-upload-btn"/);
  assert.match(inputField, /class="control-btn attachment-upload-btn"/);
  assert.doesNotMatch(userMenu, /handleQuickNav\('models'\)/);
});

test("managed chat keeps web search enabled without exposing a per-user switch", () => {
  assert.match(settingsStore, /webSearchEnabled:\s*true/);
  assert.match(settingsStorage, /loaded\.webSearchEnabled = true/);
  assert.doesNotMatch(inputField, /class="control-btn websearch-btn"/);
});

test("settings expose only language and theme and normalize every deep link to general", () => {
  assert.match(settingsView, /const normalizeSettingsSection = \([^)]*\) => ['"]general['"]/);
  assert.match(settingsView, /section:\s*['"]general['"]/);
  assert.match(settingsView, /<GeneralSettings\s*\/>/);
  assert.doesNotMatch(
    settingsView,
    /<ModelSettings\b|<TenantInfo\b|<UserProfile\b|<TenantMembers\b/,
  );
  assert.doesNotMatch(
    settingsView,
    /<SystemSettings\b|<IntegrationSettingsSection\b|<WebSearchSettings\b/,
  );
  assert.match(generalSettings, /language\.language/);
  assert.match(generalSettings, /theme\.theme/);
  assert.doesNotMatch(
    generalSettings,
    /font\.|autoCheckUpdate|useFont|useSettingsStore|useAuthStore/,
  );
});

test("shared-space and knowledge-base filter navigation have no managed UI or deep link", () => {
  assert.doesNotMatch(menuStore, /titleKey:\s*['"]menu\.organizations['"]/);
  assert.doesNotMatch(sidebar, /<TenantSelector\b/);
  assert.doesNotMatch(commands, /id:\s*['"]open-(?:agents|organizations)['"]/);
  assert.match(
    router,
    /path:\s*['"]organizations['"][\s\S]*?redirect:\s*['"]\/platform\/knowledge-bases['"]/,
  );
  assert.doesNotMatch(router, /OrganizationList\.vue/);
  assert.doesNotMatch(knowledgeBaseList, /<ListSpaceSidebar\b/);
  assert.match(knowledgeBaseList, /const defaultScope:\s*['"]mine['"]/);
  assert.match(knowledgeBaseList, /spaceSelection\.value\s*!==\s*['"]mine['"]/);
  assert.match(knowledgeBaseList, /creatorFilter\.value\s*!==\s*['"]all['"]/);
});

test("the user dropdown has exactly settings and logout for every role", () => {
  assert.equal((userMenu.match(/class="menu-item/g) || []).length, 2);
  assert.match(userMenu, /@click="handleSettings"/);
  assert.match(userMenu, /@click="handleLogout"/);
  assert.doesNotMatch(
    userMenu,
    /CreateTenantDialog|handleQuickNav|handleSystemAdmin|openDocs|openGithub/,
  );
  assert.doesNotMatch(userMenu, /isSystemAdmin|hasRole|canAccessAllTenants|tenantSubmenu/);
});

test("the consumer shell has no invitation or workspace-management surface", () => {
  assert.doesNotMatch(platformShell, /GlobalInvitationBell/);
});
