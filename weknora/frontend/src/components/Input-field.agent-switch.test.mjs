import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inputField = readFileSync(new URL("./Input-field.vue", import.meta.url), "utf8");
const inputBusiness = readFileSync(new URL("../assets/business-baselines/Input-field.pre-view.vue", import.meta.url), "utf8");
const settingsStore = readFileSync(new URL("../stores/settings.ts", import.meta.url), "utf8");
const streamClient = readFileSync(new URL("../api/chat/streame.ts", import.meta.url), "utf8");
const chatView = readFileSync(new URL("../views/chat/index.vue", import.meta.url), "utf8");
const chatBusiness = readFileSync(new URL("../assets/business-baselines/ChatIndex.pre-view.vue", import.meta.url), "utf8");

test("managed chat keeps Standard web search while Lite stays fail-closed", () => {
  const selectAgentStart = settingsStore.indexOf("selectAgent(agentId: string");
  const getSelectedAgentStart = settingsStore.indexOf("getSelectedAgentId()", selectAgentStart);
  const selectAgentAction = settingsStore.slice(selectAgentStart, getSelectedAgentStart);

  assert.notEqual(selectAgentStart, -1);
  assert.notEqual(getSelectedAgentStart, -1);
  assert.match(selectAgentAction, /this\.settings\.webSearchEnabled = !useAuthStore\(\)\.isLiteMode/);
  assert.doesNotMatch(inputField, /class="control-btn websearch-btn"/);
  assert.match(inputField, /v-if="!authStore\.isLiteMode && showWebSearchButton"/);
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

test("consumer chat locks the full-capability Agent and sends model-specific reasoning effort", () => {
  assert.match(settingsStore, /thinkingEnabled:\s*boolean/);
  assert.match(settingsStore, /thinkingEnabled:\s*true/);
  assert.match(settingsStore, /reasoningEffort:\s*"high"/);
  assert.match(settingsStore, /selectedAgentId:\s*BUILTIN_SMART_REASONING_ID/);
  assert.match(inputBusiness, /const thinkingEnabled = computed/);
  assert.match(inputBusiness, /get: \(\) => BUILTIN_SMART_REASONING_ID/);
  assert.match(inputBusiness, /const reasoningEffort = computed/);
  assert.match(inputBusiness, /const reasoningOptions = computed/);
  assert.match(inputBusiness, /reasoning\.supported_efforts/);
  assert.match(inputBusiness, /default_effort/);
  assert.match(inputBusiness, /model\.is_builtin === true/);
  assert.match(inputBusiness, /provider\?\.trim\(\)\.toLowerCase\(\) === "openrouter"/);
  assert.match(inputField, /v-for="model in availableModels"/);
  assert.match(inputField, /modelPickerView = 'models'/);
  assert.match(inputField, /modelPickerView = 'reasoning'/);
  assert.doesNotMatch(inputField, /__add_model__|__thinking-switch|<AgentSelector/);
  assert.match(inputBusiness, /emit\(["']send-msg["'],[\s\S]*reasoningEffort\.value/);
  assert.match(chatView, /thinking: any, reasoningEffort: any\) => sendMsg\(query, modelId, mentionedItems, imageFiles, attachmentFiles, thinking, reasoningEffort\)/);
  assert.match(chatBusiness, /thinking:\s*thinkingEnabled/);
  assert.match(chatBusiness, /reasoning_effort:\s*reasoningEffort/);
  assert.match(streamClient, /thinking\?:\s*boolean/);
  assert.match(streamClient, /postBody\.thinking = params\.thinking/);
  assert.match(streamClient, /reasoning_effort\?:\s*string/);
  assert.match(streamClient, /postBody\.reasoning_effort = params\.reasoning_effort/);
});

test("model selector distinguishes the initial catalog load from missing configuration", () => {
  const labelStart = inputBusiness.indexOf("const selectedModelDisplayName = computed");
  const labelEnd = inputBusiness.indexOf("const modelDisplayName", labelStart);
  const selectedModelLabel = inputBusiness.slice(labelStart, labelEnd);

  assert.notEqual(labelStart, -1);
  assert.notEqual(labelEnd, -1);
  assert.match(inputBusiness, /const modelsLoadSettled = ref\(false\)/);
  assert.match(inputBusiness, /modelsLoadSettled\.value = true/);
  assert.match(selectedModelLabel, /if \(!modelsLoadSettled\.value\) return t\("common\.loading"\)/);
  assert.ok(
    selectedModelLabel.indexOf('t("common.loading")') <
      selectedModelLabel.indexOf('t("input.notConfigured")'),
  );
});
