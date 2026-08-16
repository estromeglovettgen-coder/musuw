import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inputField = readFileSync(new URL("./Input-field.vue", import.meta.url), "utf8");
const settingsStore = readFileSync(new URL("../stores/settings.ts", import.meta.url), "utf8");
const streamClient = readFileSync(new URL("../api/chat/streame.ts", import.meta.url), "utf8");
const chatView = readFileSync(new URL("../views/chat/index.vue", import.meta.url), "utf8");

test("managed chat keeps platform web search enabled", () => {
  const selectAgentStart = settingsStore.indexOf("selectAgent(agentId: string");
  const getSelectedAgentStart = settingsStore.indexOf("getSelectedAgentId()", selectAgentStart);
  const selectAgentAction = settingsStore.slice(selectAgentStart, getSelectedAgentStart);

  assert.notEqual(selectAgentStart, -1);
  assert.notEqual(getSelectedAgentStart, -1);
  assert.match(selectAgentAction, /this\.settings\.webSearchEnabled = true/);
  assert.doesNotMatch(inputField, /class="control-btn websearch-btn"/);
});

test("shared-agent web search button waits for source readiness metadata", () => {
  const showWebSearchStart = inputField.indexOf("const showWebSearchButton = computed");
  const showWebSearchEnd = inputField.indexOf("const showImageUploadButton", showWebSearchStart);
  const showWebSearchButton = inputField.slice(showWebSearchStart, showWebSearchEnd);

  assert.notEqual(showWebSearchStart, -1);
  assert.notEqual(showWebSearchEnd, -1);
  assert.match(showWebSearchButton, /isWebSearchReadinessKnown/);
  assert.match(showWebSearchButton, /selectedSharedAgent\.value\?\.web_search_ready/);
});

test("managed chat exposes only V4 Flash and V4 Pro and keeps thinking exclusive to Pro", () => {
  assert.match(settingsStore, /thinkingEnabled:\s*boolean/);
  assert.match(settingsStore, /thinkingEnabled:\s*true/);
  assert.match(inputField, /const thinkingEnabled = computed/);
  assert.match(inputField, /const V4_FLASH_MODEL_ID = "builtin-deepseek-v4-flash"/);
  assert.match(inputField, /const V4_PRO_MODEL_ID = "builtin-deepseek-v4-pro"/);
  assert.match(inputField, /@click="selectAgentMode\('quick-answer'\)"/);
  assert.match(inputField, /@click="selectAgentMode\('smart-reasoning'\)"/);
  assert.match(inputField, />\s*V4 Flash\s*</);
  assert.match(inputField, />\s*V4 Pro\s*</);
  assert.equal((inputField.match(/@click="selectAgentMode\('/g) || []).length, 2);
  assert.match(inputField, /v-if="isProMode"[\s\S]*v-model="thinkingEnabled"/);
  assert.doesNotMatch(inputField, /v-for="model in availableModels"/);
  assert.doesNotMatch(inputField, /toggleModelSelector/);

  const modeSwitchStart = inputField.indexOf('const selectAgentMode = async');
  const modeSwitchEnd = inputField.indexOf('// 选择智能体（新版）', modeSwitchStart);
  const modeSwitch = inputField.slice(modeSwitchStart, modeSwitchEnd);
  assert.notEqual(modeSwitchStart, -1);
  assert.notEqual(modeSwitchEnd, -1);
  assert.match(modeSwitch, /settingsStore\.selectAgent\(builtinAgentId\)/);
  assert.match(modeSwitch, /if \(mode === "quick-answer"\) \{\s*thinkingEnabled\.value = false;/);
  assert.match(modeSwitch, /selectedModelId\.value =\s*mode === "smart-reasoning"\s*\? V4_PRO_MODEL_ID\s*:\s*V4_FLASH_MODEL_ID/);

  const modelSyncStart = inputField.indexOf("const ensureModelSelection = () =>");
  const modelSyncEnd = inputField.indexOf("const handleModelChange", modelSyncStart);
  const modelSync = inputField.slice(modelSyncStart, modelSyncEnd);
  assert.notEqual(modelSyncStart, -1);
  assert.notEqual(modelSyncEnd, -1);
  assert.match(modelSync, /if \(!isProMode\.value && thinkingEnabled\.value\) \{\s*thinkingEnabled\.value = false;/);

  assert.match(inputField, /emit\(["']send-msg["'],[\s\S]*thinkingEnabled\.value/);
  assert.match(chatView, /thinking:\s*thinkingEnabled/);
  assert.match(streamClient, /thinking\?:\s*boolean/);
  assert.match(streamClient, /postBody\.thinking = params\.thinking/);
});
