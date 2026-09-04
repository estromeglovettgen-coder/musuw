import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SETTINGS_STORAGE_KEY = "WeKnora_settings";
const BUILTIN_QUICK_ANSWER_ID = "builtin-quick-answer";
const BUILTIN_SMART_REASONING_ID = "builtin-smart-reasoning";
const DEFAULT_CHAT_MODEL_ID = "builtin-deepseek-v4-flash";
const settingsStorageSource = readFileSync(new URL("./settingsStorage.ts", import.meta.url), "utf8");

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function isStoredSettingsRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function reconcileLoadedSettings(loaded, defaults = makeDefaults(), options = {}, sourceWasStored = true) {
  const isLiteMode = options.isLiteMode ?? localStorage.getItem("weknora_lite_mode") === "true";
  loaded.selectedTags ||= [];
  loaded.selectedMCPServices ||= [];
  loaded.selectedSkills ||= loaded.selectedTools || [];
  loaded.selectedFileKbMap ||= {};

  const defaultConversation = isStoredSettingsRecord(defaults.conversationModels)
    ? defaults.conversationModels
    : {};
  const loadedConversation = isStoredSettingsRecord(loaded.conversationModels)
    ? loaded.conversationModels
    : null;
  const storedConversation = sourceWasStored ? loadedConversation : null;
  const storedThinkingExplicit = typeof storedConversation?.thinkingEnabled === "boolean";
  const storedReasoningExplicit = typeof storedConversation?.reasoningEffort === "string"
    && storedConversation.reasoningEffort.trim() !== "";
  let reconciledThinking = false;
  if (!storedConversation) {
    loaded.conversationModels = !sourceWasStored || isLiteMode
      ? cloneSettings(defaultConversation)
      : { thinkingEnabled: true };
    reconciledThinking = true;
  } else {
    loaded.conversationModels = isLiteMode
      ? { ...cloneSettings(defaultConversation), ...storedConversation }
      : storedConversation;
    if (typeof loaded.conversationModels.thinkingEnabled !== "boolean") {
      loaded.conversationModels.thinkingEnabled = isLiteMode
        ? false
        : true;
      reconciledThinking = true;
    }
  }
  if (!storedReasoningExplicit
    || typeof loaded.conversationModels.reasoningEffort !== "string"
    || loaded.conversationModels.reasoningEffort.trim() === "") {
    loaded.conversationModels.reasoningEffort = isLiteMode && !storedThinkingExplicit
      ? "none"
      : loaded.conversationModels.thinkingEnabled === false ? "none" : "high";
    reconciledThinking = true;
  }
  if (isLiteMode && !storedConversation) {
    loaded.conversationModels.selectedChatModelId =
      loaded.conversationModels.selectedChatModelId || DEFAULT_CHAT_MODEL_ID;
  } else if (isLiteMode && (
    typeof loaded.conversationModels.selectedChatModelId !== "string"
    || !loaded.conversationModels.selectedChatModelId.trim()
  )) {
    loaded.conversationModels.selectedChatModelId =
      defaultConversation.selectedChatModelId || DEFAULT_CHAT_MODEL_ID;
    reconciledThinking = true;
  }
  const thinkingEnabled = loaded.conversationModels.reasoningEffort !== "none";
  if (loaded.conversationModels.thinkingEnabled !== thinkingEnabled) {
    loaded.conversationModels.thinkingEnabled = thinkingEnabled;
    reconciledThinking = true;
  }

  const storedAgentID = typeof loaded.selectedAgentId === "string"
    ? loaded.selectedAgentId.trim()
    : "";
  const reconciledAgentMode = !storedAgentID || loaded.selectedAgentSourceTenantId !== null;
  loaded.selectedAgentId = storedAgentID || BUILTIN_SMART_REASONING_ID;
  loaded.selectedAgentSourceTenantId = null;
  if (loaded.selectedAgentId === BUILTIN_QUICK_ANSWER_ID) {
    loaded.isAgentEnabled = false;
  } else if (loaded.selectedAgentId === BUILTIN_SMART_REASONING_ID) {
    loaded.isAgentEnabled = true;
  } else if (typeof loaded.isAgentEnabled !== "boolean") {
    loaded.isAgentEnabled = true;
  }

  const removedLegacyMemorySetting = Object.prototype.hasOwnProperty.call(loaded, "enableMemory");
  if (removedLegacyMemorySetting) delete loaded.enableMemory;
  if (sourceWasStored && (removedLegacyMemorySetting || reconciledAgentMode || reconciledThinking)) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(loaded));
  }
  return loaded;
}

function resetStoredSettings(defaultSettings, options = {}) {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  return reconcileLoadedSettings(cloneSettings(defaultSettings), defaultSettings, options, false);
}

function loadAndReconcileSettings(defaultSettings, options = {}) {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return reconcileLoadedSettings(cloneSettings(defaultSettings), defaultSettings, options, false);
    const parsed = JSON.parse(raw);
    if (!isStoredSettingsRecord(parsed)) return resetStoredSettings(defaultSettings, options);
    return reconcileLoadedSettings(parsed, defaultSettings, options, true);
  } catch {
    return resetStoredSettings(defaultSettings, options);
  }
}

function makeDefaults() {
  return {
    isAgentEnabled: true,
    selectedAgentId: BUILTIN_SMART_REASONING_ID,
    selectedAgentSourceTenantId: null,
    webSearchEnabled: false,
    selectedTags: [],
    selectedMCPServices: [],
    selectedSkills: [],
    selectedFileKbMap: {},
    conversationModels: {
      summaryModelId: "",
      rerankModelId: "",
      selectedChatModelId: "",
      thinkingEnabled: true,
      reasoningEffort: "high",
      consumerSceneModelIds: {},
    },
    nested: { items: ["a"] },
  };
}

function installMockLocalStorage() {
  const store = {};
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = value; },
      removeItem: (key) => { delete store[key]; },
    },
    configurable: true,
    writable: true,
  });
  return store;
}

test("isStoredSettingsRecord rejects non-object JSON values", () => {
  assert.equal(isStoredSettingsRecord(null), false);
  assert.equal(isStoredSettingsRecord([]), false);
  assert.equal(isStoredSettingsRecord("x"), false);
  assert.equal(isStoredSettingsRecord({}), true);
});

test("cloneSettings deep-clones nested structures", () => {
  const defaults = makeDefaults();
  const cloned = cloneSettings(defaults);
  cloned.nested.items.push("b");
  assert.deepEqual(defaults.nested.items, ["a"]);
});

test("fresh settings use WeKnora main 81142df WebSearch default while keeping Musuw thinking", () => {
  const store = installMockLocalStorage();
  const defaults = makeDefaults();
  const loaded = loadAndReconcileSettings(defaults);
  loaded.selectedTags.push("tag-1");

  assert.deepEqual(defaults.selectedTags, []);
  assert.equal(loaded.webSearchEnabled, false);
  assert.equal(loaded.conversationModels.thinkingEnabled, true);
  assert.equal(loaded.conversationModels.reasoningEffort, "high");
  assert.equal(loaded.selectedAgentId, BUILTIN_SMART_REASONING_ID);
  assert.equal(loaded.isAgentEnabled, true);
  assert.equal(store[SETTINGS_STORAGE_KEY], undefined);
});

test("corrupt/non-object storage resets to authority defaults", () => {
  for (const raw of ["{broken", "null"]) {
    const store = installMockLocalStorage();
    store[SETTINGS_STORAGE_KEY] = raw;
    const loaded = loadAndReconcileSettings(makeDefaults());
    assert.equal(loaded.webSearchEnabled, false);
    assert.equal(loaded.conversationModels.thinkingEnabled, true);
  }
});

test("valid stored WebSearch preference is preserved in both directions", () => {
  for (const value of [true, false]) {
    const store = installMockLocalStorage();
    store[SETTINGS_STORAGE_KEY] = JSON.stringify({
      isAgentEnabled: false,
      selectedAgentId: BUILTIN_QUICK_ANSWER_ID,
      webSearchEnabled: value,
      conversationModels: { thinkingEnabled: true },
    });
    const loaded = loadAndReconcileSettings(makeDefaults());
    assert.equal(loaded.webSearchEnabled, value);
  }
});

test("consumer settings preserve a tenant-local Agent selection and remove shared scope", () => {
  const store = installMockLocalStorage();
  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    selectedAgentId: "custom-agent",
    isAgentEnabled: true,
    selectedAgentSourceTenantId: "other-tenant",
    webSearchEnabled: false,
    conversationModels: { thinkingEnabled: true },
  });
  const loaded = loadAndReconcileSettings(makeDefaults());
  assert.equal(loaded.selectedAgentId, "custom-agent");
  assert.equal(loaded.isAgentEnabled, true);
  assert.equal(loaded.selectedAgentSourceTenantId, null);
  assert.equal(loaded.webSearchEnabled, false);
});

test("both native builtin modes retain their own execution mode", () => {
  const store = installMockLocalStorage();
  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    selectedAgentId: BUILTIN_SMART_REASONING_ID,
    isAgentEnabled: false,
    webSearchEnabled: false,
    conversationModels: { thinkingEnabled: true },
  });
  const pro = loadAndReconcileSettings(makeDefaults());
  assert.equal(pro.selectedAgentId, BUILTIN_SMART_REASONING_ID);
  assert.equal(pro.isAgentEnabled, true);

  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    selectedAgentId: BUILTIN_QUICK_ANSWER_ID,
    isAgentEnabled: true,
    webSearchEnabled: false,
    conversationModels: { thinkingEnabled: true },
  });
  const quick = loadAndReconcileSettings(makeDefaults());
  assert.equal(quick.selectedAgentId, BUILTIN_QUICK_ANSWER_ID);
  assert.equal(quick.isAgentEnabled, false);
});

test("first-Musuw thinking preference is backfilled but existing value is preserved", () => {
  const store = installMockLocalStorage();
  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    selectedAgentId: BUILTIN_QUICK_ANSWER_ID,
    isAgentEnabled: false,
    webSearchEnabled: false,
  });
  const migrated = loadAndReconcileSettings(makeDefaults());
  assert.equal(migrated.conversationModels.thinkingEnabled, true);

  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    selectedAgentId: BUILTIN_QUICK_ANSWER_ID,
    isAgentEnabled: false,
    webSearchEnabled: false,
    conversationModels: { thinkingEnabled: false },
  });
  const preserved = loadAndReconcileSettings(makeDefaults());
  assert.equal(preserved.conversationModels.thinkingEnabled, false);
  assert.equal(preserved.conversationModels.reasoningEffort, "none");
});

test("Lite fresh settings start on V4 Flash with reasoning disabled", () => {
  installMockLocalStorage();
  const defaults = makeDefaults();
  const loaded = loadAndReconcileSettings(defaults, { isLiteMode: true });

  assert.equal(loaded.conversationModels.selectedChatModelId, DEFAULT_CHAT_MODEL_ID);
  assert.equal(loaded.conversationModels.thinkingEnabled, false);
  assert.equal(loaded.conversationModels.reasoningEffort, "none");
});

test("Lite mode is inferred from the login bootstrap flag", () => {
  const store = installMockLocalStorage();
  store.weknora_lite_mode = "true";
  const loaded = loadAndReconcileSettings(makeDefaults());

  assert.equal(loaded.conversationModels.selectedChatModelId, DEFAULT_CHAT_MODEL_ID);
  assert.equal(loaded.conversationModels.reasoningEffort, "none");
  assert.equal(loaded.conversationModels.thinkingEnabled, false);
});

test("Lite missing or semi-structured conversation settings use safe defaults", () => {
  const defaults = makeDefaults();
  for (const conversationModels of [
    undefined,
    { selectedChatModelId: "" },
    { selectedChatModelId: 42 },
    { thinkingEnabled: "stale" },
  ]) {
    const store = installMockLocalStorage();
    store[SETTINGS_STORAGE_KEY] = JSON.stringify({
      isAgentEnabled: true,
      selectedAgentId: BUILTIN_SMART_REASONING_ID,
      conversationModels,
    });
    const loaded = loadAndReconcileSettings(defaults, { isLiteMode: true });

    assert.equal(loaded.conversationModels.selectedChatModelId, DEFAULT_CHAT_MODEL_ID);
    assert.equal(loaded.conversationModels.thinkingEnabled, false);
    assert.equal(loaded.conversationModels.reasoningEffort, "none");
  }
});

test("Lite preserves an explicit high reasoning preference", () => {
  const store = installMockLocalStorage();
  const defaults = makeDefaults();
  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    conversationModels: {
      selectedChatModelId: DEFAULT_CHAT_MODEL_ID,
      thinkingEnabled: true,
      reasoningEffort: "high",
    },
  });
  const loaded = loadAndReconcileSettings(defaults, { isLiteMode: true });

  assert.equal(loaded.conversationModels.reasoningEffort, "high");
  assert.equal(loaded.conversationModels.thinkingEnabled, true);
});

test("Lite preserves an explicit legacy thinking toggle when effort is absent", () => {
  const store = installMockLocalStorage();
  const defaults = makeDefaults();
  store[SETTINGS_STORAGE_KEY] = JSON.stringify({
    conversationModels: {
      selectedChatModelId: DEFAULT_CHAT_MODEL_ID,
      thinkingEnabled: true,
    },
  });
  const loaded = loadAndReconcileSettings(defaults, { isLiteMode: true });

  assert.equal(loaded.conversationModels.reasoningEffort, "high");
  assert.equal(loaded.conversationModels.thinkingEnabled, true);
});

test("Standard fresh settings retain the upstream empty-model high-reasoning default", () => {
  installMockLocalStorage();
  const loaded = loadAndReconcileSettings(makeDefaults(), { isLiteMode: false });

  assert.equal(loaded.conversationModels.selectedChatModelId, "");
  assert.equal(loaded.conversationModels.reasoningEffort, "high");
  assert.equal(loaded.conversationModels.thinkingEnabled, true);
});

test("source code preserves native local Agents while removing shared scope", () => {
  assert.match(settingsStorageSource, /loaded\.selectedAgentId\s*=\s*storedAgentID \|\| BUILTIN_SMART_REASONING_ID/);
  assert.match(settingsStorageSource, /loaded\.selectedAgentSourceTenantId\s*=\s*null/);
  assert.match(settingsStorageSource, /loaded\.selectedAgentId === BUILTIN_QUICK_ANSWER_ID/);
  assert.match(settingsStorageSource, /loaded\.selectedAgentId === BUILTIN_SMART_REASONING_ID/);
  assert.doesNotMatch(settingsStorageSource, /webSearchEnabled\s*=/);
  assert.doesNotMatch(settingsStorageSource, /withAuthorityDefaults/);
  assert.match(settingsStorageSource, /thinkingEnabled/);
  assert.match(settingsStorageSource, /isLiteMode/);
  assert.match(settingsStorageSource, /DEFAULT_CHAT_MODEL_ID/);
  assert.match(settingsStorageSource, /selectedChatModelId/);
  assert.match(settingsStorageSource, /storedReasoningExplicit/);
});
