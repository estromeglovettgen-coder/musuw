import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SETTINGS_STORAGE_KEY = "WeKnora_settings";
const BUILTIN_QUICK_ANSWER_ID = "builtin-quick-answer";
const BUILTIN_SMART_REASONING_ID = "builtin-smart-reasoning";
const settingsStorageSource = readFileSync(new URL("./settingsStorage.ts", import.meta.url), "utf8");

function reconcileBuiltinAgentMode(settings) {
  const agentId = settings.selectedAgentId || BUILTIN_QUICK_ANSWER_ID;
  if (agentId === BUILTIN_QUICK_ANSWER_ID && settings.isAgentEnabled) {
    settings.isAgentEnabled = false;
    return true;
  }
  if (agentId === BUILTIN_SMART_REASONING_ID && !settings.isAgentEnabled) {
    settings.isAgentEnabled = true;
    return true;
  }
  return false;
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function isStoredSettingsRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function withAuthorityDefaults(defaults) {
  const cloned = cloneSettings(defaults);
  cloned.webSearchEnabled = false;
  return cloned;
}

function reconcileLoadedSettings(loaded) {
  loaded.selectedTags ||= [];
  loaded.selectedMCPServices ||= [];
  loaded.selectedSkills ||= loaded.selectedTools || [];
  loaded.selectedFileKbMap ||= {};

  let reconciledThinking = false;
  if (!isStoredSettingsRecord(loaded.conversationModels)) {
    loaded.conversationModels = { thinkingEnabled: true };
    reconciledThinking = true;
  } else if (typeof loaded.conversationModels.thinkingEnabled !== "boolean") {
    loaded.conversationModels.thinkingEnabled = true;
    reconciledThinking = true;
  }

  const removedLegacyMemorySetting = Object.prototype.hasOwnProperty.call(loaded, "enableMemory");
  if (removedLegacyMemorySetting) delete loaded.enableMemory;
  const reconciledAgentMode = reconcileBuiltinAgentMode(loaded);
  if (removedLegacyMemorySetting || reconciledAgentMode || reconciledThinking) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(loaded));
  }
  return loaded;
}

function resetStoredSettings(defaultSettings) {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  return reconcileLoadedSettings(withAuthorityDefaults(defaultSettings));
}

function loadAndReconcileSettings(defaultSettings) {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return reconcileLoadedSettings(withAuthorityDefaults(defaultSettings));
    const parsed = JSON.parse(raw);
    if (!isStoredSettingsRecord(parsed)) return resetStoredSettings(defaultSettings);
    return reconcileLoadedSettings(parsed);
  } catch {
    return resetStoredSettings(defaultSettings);
  }
}

function makeDefaults() {
  return {
    isAgentEnabled: false,
    selectedAgentId: BUILTIN_QUICK_ANSWER_ID,
    selectedAgentSourceTenantId: undefined,
    webSearchEnabled: true, // store constant may differ; storage authority overrides fresh defaults
    selectedTags: [],
    selectedMCPServices: [],
    selectedSkills: [],
    selectedFileKbMap: {},
    conversationModels: { thinkingEnabled: true },
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

test("fresh settings use WeKnora v0.7.2 WebSearch default while keeping Musuw thinking", () => {
  const store = installMockLocalStorage();
  const defaults = makeDefaults();
  const loaded = loadAndReconcileSettings(defaults);
  loaded.selectedTags.push("tag-1");

  assert.deepEqual(defaults.selectedTags, []);
  assert.equal(loaded.webSearchEnabled, false);
  assert.equal(loaded.conversationModels.thinkingEnabled, true);
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

test("custom and shared Agent selections are preserved instead of normalized away", () => {
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
  assert.equal(loaded.selectedAgentSourceTenantId, "other-tenant");
  assert.equal(loaded.webSearchEnabled, false);
});

test("builtin quick/pro mode consistency still reconciles without narrowing Agent choice", () => {
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
});

test("source code contains no managed Agent/WebSearch forced-reset branch", () => {
  assert.doesNotMatch(settingsStorageSource, /selectedAgentSourceTenantId\s*=\s*(?:null|undefined)/);
  assert.doesNotMatch(settingsStorageSource, /webSearchEnabled\s*=\s*true/);
  assert.match(settingsStorageSource, /cloned\.webSearchEnabled\s*=\s*false/);
  assert.match(settingsStorageSource, /thinkingEnabled/);
});
