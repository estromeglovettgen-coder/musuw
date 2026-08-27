import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SETTINGS_STORAGE_KEY = "WeKnora_settings";
const BUILTIN_QUICK_ANSWER_ID = "builtin-quick-answer";
const BUILTIN_SMART_REASONING_ID = "builtin-smart-reasoning";
const settingsStorageSource = readFileSync(new URL("./settingsStorage.ts", import.meta.url), "utf8");

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function isStoredSettingsRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
  if (typeof loaded.conversationModels.reasoningEffort !== "string") {
    loaded.conversationModels.reasoningEffort = loaded.conversationModels.thinkingEnabled === false ? "none" : "high";
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
  if (removedLegacyMemorySetting || reconciledAgentMode || reconciledThinking) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(loaded));
  }
  return loaded;
}

function resetStoredSettings(defaultSettings) {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  return reconcileLoadedSettings(cloneSettings(defaultSettings));
}

function loadAndReconcileSettings(defaultSettings) {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return reconcileLoadedSettings(cloneSettings(defaultSettings));
    const parsed = JSON.parse(raw);
    if (!isStoredSettingsRecord(parsed)) return resetStoredSettings(defaultSettings);
    return reconcileLoadedSettings(parsed);
  } catch {
    return resetStoredSettings(defaultSettings);
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
    conversationModels: { thinkingEnabled: true, reasoningEffort: "high" },
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

test("source code preserves native local Agents while removing shared scope", () => {
  assert.match(settingsStorageSource, /loaded\.selectedAgentId\s*=\s*storedAgentID \|\| BUILTIN_SMART_REASONING_ID/);
  assert.match(settingsStorageSource, /loaded\.selectedAgentSourceTenantId\s*=\s*null/);
  assert.match(settingsStorageSource, /loaded\.selectedAgentId === BUILTIN_QUICK_ANSWER_ID/);
  assert.match(settingsStorageSource, /loaded\.selectedAgentId === BUILTIN_SMART_REASONING_ID/);
  assert.doesNotMatch(settingsStorageSource, /webSearchEnabled\s*=/);
  assert.doesNotMatch(settingsStorageSource, /withAuthorityDefaults/);
  assert.match(settingsStorageSource, /thinkingEnabled/);
});
