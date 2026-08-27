import { safeRemoveItem, safeSetItem } from "@/composables/preferenceStorage";
import { BUILTIN_QUICK_ANSWER_ID, BUILTIN_SMART_REASONING_ID } from "@/api/agent";

export const SETTINGS_STORAGE_KEY = "WeKnora_settings";

/** Deep-clone settings so nested arrays/objects are not shared with defaults. */
export function cloneSettings<T>(settings: T): T {
  return JSON.parse(JSON.stringify(settings));
}

export function isStoredSettingsRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type ReconcilableSettings = {
  selectedTags?: unknown;
  selectedMCPServices?: unknown;
  selectedSkills?: unknown;
  selectedTools?: unknown;
  selectedFileKbMap?: unknown;
  enableMemory?: unknown;
  isAgentEnabled: boolean;
  selectedAgentId?: string;
  selectedAgentSourceTenantId?: unknown;
  webSearchEnabled?: unknown;
  conversationModels?: {
    thinkingEnabled?: unknown;
    reasoningEffort?: unknown;
    consumerSceneModelIds?: unknown;
  };
};

function reconcileLoadedSettings<T extends ReconcilableSettings>(loaded: T): T {
  loaded.selectedTags ||= [];
  loaded.selectedMCPServices ||= [];
  loaded.selectedSkills ||= (loaded.selectedTools as string[] | undefined) || [];
  loaded.selectedFileKbMap ||= {};

  // Keep the stored reasoning controls internally consistent while migrating
  // old browser preferences.
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
  if (!isStoredSettingsRecord(loaded.conversationModels.consumerSceneModelIds)) {
    loaded.conversationModels.consumerSceneModelIds = {};
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
  if (removedLegacyMemorySetting) {
    delete loaded.enableMemory;
  }
  if (removedLegacyMemorySetting || reconciledAgentMode || reconciledThinking) {
    safeSetItem(SETTINGS_STORAGE_KEY, JSON.stringify(loaded));
  }
  return loaded;
}

function resetStoredSettings<T extends ReconcilableSettings>(
  defaultSettings: T,
  reason: unknown,
): T {
  console.error(
    "[Musuw] Failed to parse stored settings, resetting to defaults:",
    reason,
  );
  safeRemoveItem(SETTINGS_STORAGE_KEY);
  return reconcileLoadedSettings(cloneSettings(defaultSettings));
}

/** Load settings from localStorage, reconcile native Agent state, fall back on corruption. */
export function loadAndReconcileSettings<T extends ReconcilableSettings>(
  defaultSettings: T,
): T {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return reconcileLoadedSettings(cloneSettings(defaultSettings));
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredSettingsRecord(parsed)) {
      return resetStoredSettings(
        defaultSettings,
        new Error("stored value is not a settings object"),
      );
    }
    return reconcileLoadedSettings(parsed as T);
  } catch (e) {
    return resetStoredSettings(defaultSettings, e);
  }
}
