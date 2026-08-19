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
const sidebar = read("../components/menu.vue");
const knowledgeBaseList = read("../views/knowledge/KnowledgeBaseList.vue");
const knowledgeBaseListController = read("../assets/business-baselines/KnowledgeBaseList.pre-view.vue");
const commandPalette = read("../components/GlobalCommandPalette.vue");
const commands = read("../components/GlobalCommandPalette/commands.ts");
const newUserGuide = read("../components/NewUserGuide.vue");
const settingsStorage = read("../stores/settingsStorage.ts");

/**
 * Historical note: this file used to enforce a Musuw-only "managed experience"
 * that intentionally hid native WeKnora capabilities. That policy conflicts
 * with the current product contract: @视觉文件 owns appearance, while the union
 * of WeKnora v0.7.2 + first-Musuw visible behavior owns capabilities.
 *
 * Keep this test name/file so old CI references remain stable, but make it a
 * regression guard against reintroducing that narrowing.
 */

test("native Agent management and selection remain reachable through the visual skin", () => {
  assert.match(menuStore, /titleKey:\s*'menu\.agents'/);
  assert.match(router, /import\("\.\.\/views\/agent\/AgentList\.vue"\)/);
  assert.match(router, /path:\s*["']agents["'][\s\S]*name:\s*["']agentList["']/);
  assert.match(inputField, /<AgentSelector\b/);
  assert.match(inputField, /@select="handleSelectAgent"/);
  assert.match(inputField, /@not-ready="handleAgentNotReady"/);
});

test("chat keeps native model/Agent/WebSearch behavior plus first-Musuw thinking behavior", () => {
  assert.match(inputField, /v-for="model in availableModels"/);
  assert.match(inputField, /toggleModelSelector/);
  assert.match(inputField, /<AgentSelector\b/);
  assert.match(inputField, /v-if="showWebSearchButton"/);
  assert.match(inputField, /toggleWebSearch/);
  assert.match(inputField, /v-if="isProMode" class="visual-chat-composer__thinking"/);
  assert.match(inputField, /thinkingEnabled/);
});

test("settings restore the native section set in the reference SettingsModal shell", () => {
  for (const component of [
    'GeneralSettings', 'UserProfile', 'TenantInfo', 'TenantMembers', 'ChatHistorySettings',
    'ModelSettings', 'OllamaSettings', 'WeKnoraCloudSettings', 'IntegrationSettingsSection',
    'VectorStoreSettings', 'ParserEngineSettings', 'StorageEngineSettings', 'WebSearchSettings',
    'McpSettings', 'SystemSettings', 'RuntimeQueues', 'PlatformAPIKeys', 'SystemAuditLog', 'SystemInfo',
  ]) {
    assert.match(settingsView, new RegExp(`<${component}\\b`), `settings lost ${component}`);
  }
  assert.match(settingsView, /width:\s*min\(896px,\s*100%\)/);
  assert.match(settingsView, /height:\s*520px/);
  assert.match(settingsView, /flex:\s*0 0 224px/);
});

test("General Settings retains native preferences instead of consumer-plan replacement UI", () => {
  for (const token of ['language.language', 'theme.theme', 'useFont', 'setFontSize', 'autoCheckUpdate']) {
    assert.match(generalSettings, new RegExp(token.replace('.', '\\.')));
  }
  assert.doesNotMatch(generalSettings, /getCurrentEntitlement|visual-plan-card/);
});

test("shared spaces and knowledge scopes stay navigable", () => {
  assert.match(menuStore, /titleKey:\s*['"]menu\.organizations['"]/);
  assert.match(sidebar, /<TenantSelector\b/);
  assert.match(sidebar, /handleMenuClick\('organizations'\)/);
  assert.match(router, /OrganizationList\.vue/);
  assert.match(knowledgeBaseList, /<ListSpaceSidebar\b/);
  assert.match(knowledgeBaseList, /v-model="spaceSelection"/);
  assert.match(knowledgeBaseListController, /'favorites'/);
  assert.match(knowledgeBaseListController, /'recents'/);
  assert.match(knowledgeBaseListController, /listOrganizationSharedKnowledgeBases\(val\)/);
  assert.doesNotMatch(knowledgeBaseListController, /spaceSelection\.value\s*!==\s*["']mine["']/);
});

test("user dropdown keeps account/workspace/help/system actions instead of two-item narrowing", () => {
  for (const token of [
    "handleQuickNav('userprofile')",
    "handleQuickNav('general')",
    "handleQuickNav('tenant')",
    "handleQuickNav('members')",
    "handleQuickNav('models')",
    'CreateTenantDialog',
    'handleSystemAdmin',
    'openDocs',
    'openGithub',
    'switchToTenant',
    "handoffToExternalAuth('logout')",
  ]) {
    assert.ok(userMenu.includes(token), `UserMenu narrowing regression: ${token}`);
  }
});

test("Command Palette keeps native Agent search, Organizations gating and product tour commands", () => {
  for (const token of [
    "isGroupVisible('agents')",
    'agentMatches.length',
    "return ['chunks', 'messages', 'kbs', 'agents', 'sessions', 'commands']",
    'agents: agentMatches.value.length',
    'openAgent(a.id)',
    "path: '/platform/creatChat', query: { agent_id: agentId }",
  ]) assert.ok(commandPalette.includes(token), `Command Palette narrowing regression: ${token}`);
  for (const id of ['open-agents', 'open-organizations', 'open-product-tour']) {
    assert.ok(commands.includes(`id: '${id}'`), `quick command disappeared: ${id}`);
  }
  assert.ok(commandPalette.includes("cmds.filter((c) => c.id !== 'open-organizations')"));
});

test("global invitation and onboarding surfaces stay mounted", () => {
  assert.ok(newUserGuide.includes("key: 'agents'"));
  assert.ok(newUserGuide.includes("key: 'models'"));
  assert.ok(newUserGuide.includes('<GlobalInvitationBell />'));
  assert.ok(newUserGuide.includes('<AgentListContextualGuideBridge />'));
});

test("settings storage no longer forces the managed Agent/WebSearch experience", () => {
  assert.doesNotMatch(settingsStorage, /selectedAgentSourceTenantId\s*=\s*undefined/);
  assert.doesNotMatch(settingsStorage, /webSearchEnabled\s*=\s*true/);
  assert.match(settingsStorage, /cloned\.webSearchEnabled\s*=\s*false/);
  assert.match(settingsStorage, /thinkingEnabled/);
});
