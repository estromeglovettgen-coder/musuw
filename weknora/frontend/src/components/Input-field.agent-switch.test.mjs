import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inputField = readFileSync(new URL("./Input-field.vue", import.meta.url), "utf8");
const inputBusiness = readFileSync(new URL("../assets/business-baselines/Input-field.pre-view.vue", import.meta.url), "utf8");
const settingsStore = readFileSync(new URL("../stores/settings.ts", import.meta.url), "utf8");
const streamClient = readFileSync(new URL("../api/chat/streame.ts", import.meta.url), "utf8");
const chatView = readFileSync(new URL("../views/chat/index.vue", import.meta.url), "utf8");
const chatBusiness = readFileSync(new URL("../assets/business-baselines/ChatIndex.pre-view.vue", import.meta.url), "utf8");

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
  const showWebSearchStart = inputBusiness.indexOf("const showWebSearchButton = computed");
  const showWebSearchEnd = inputBusiness.indexOf("const showImageUploadButton", showWebSearchStart);
  const showWebSearchButton = inputBusiness.slice(showWebSearchStart, showWebSearchEnd);

  assert.notEqual(showWebSearchStart, -1);
  assert.notEqual(showWebSearchEnd, -1);
  assert.match(showWebSearchButton, /isWebSearchReadinessKnown/);
  assert.match(showWebSearchButton, /selectedSharedAgent\.value\?\.web_search_ready/);
});

test("managed chat keeps V4 modes, model selection, and Pro-only thinking", () => {
  assert.match(settingsStore, /thinkingEnabled:\s*boolean/);
  assert.match(settingsStore, /thinkingEnabled:\s*true/);
  assert.match(inputBusiness, /const thinkingEnabled = computed/);
  assert.match(inputBusiness, /const V4_FLASH_MODEL_ID = "builtin-deepseek-v4-flash"/);
  assert.match(inputBusiness, /const V4_PRO_MODEL_ID = "builtin-deepseek-v4-pro"/);
  assert.match(inputField, /selectedAgent\?\.name \|\| \(isProMode \? 'V4 Pro' : 'V4 Flash'\)/);
  assert.match(inputField, /v-if="isProMode"[\s\S]*thinkingEnabled/);
  assert.match(inputField, /v-for="model in availableModels"/);
  assert.match(inputField, /toggleModelSelector/);
  assert.match(inputField, /v-if="authStore\.isSystemAdmin"[\s\S]*__add_model__/);

  const modeSwitchStart = inputBusiness.indexOf('const selectAgentMode = async');
  const modeSwitchEnd = inputBusiness.indexOf('// 选择智能体（新版）', modeSwitchStart);
  const modeSwitch = inputBusiness.slice(modeSwitchStart, modeSwitchEnd);
  assert.notEqual(modeSwitchStart, -1);
  assert.notEqual(modeSwitchEnd, -1);
  assert.match(modeSwitch, /settingsStore\.selectAgent\(builtinAgentId\)/);
  assert.match(modeSwitch, /if \(mode === "quick-answer"\) \{\s*thinkingEnabled\.value = false;/);
  assert.match(modeSwitch, /const preferredModelId =[\s\S]*V4_PRO_MODEL_ID : V4_FLASH_MODEL_ID/);
  assert.match(modeSwitch, /resolveChatModelId\(preferredModelId, availableModels\.value\)/);
  assert.match(modeSwitch, /selectedModelId\.value = allowedModelId/);

  const modelSyncStart = inputBusiness.indexOf("const ensureModelSelection = () =>");
  const modelSyncEnd = inputBusiness.indexOf("const handleModelChange", modelSyncStart);
  const modelSync = inputBusiness.slice(modelSyncStart, modelSyncEnd);
  assert.notEqual(modelSyncStart, -1);
  assert.notEqual(modelSyncEnd, -1);
  assert.match(modelSync, /if \(!isProMode\.value && thinkingEnabled\.value\) \{\s*thinkingEnabled\.value = false;/);

  assert.match(inputBusiness, /emit\(["']send-msg["'],[\s\S]*thinkingEnabled\.value/);
  assert.match(chatView, /thinking: any\) => sendMsg\(query, modelId, mentionedItems, imageFiles, attachmentFiles, thinking\)/);
  assert.match(chatBusiness, /thinking:\s*thinkingEnabled/);
  assert.match(streamClient, /thinking\?:\s*boolean/);
  assert.match(streamClient, /postBody\.thinking = params\.thinking/);
});
