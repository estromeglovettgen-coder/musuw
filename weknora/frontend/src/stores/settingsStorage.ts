import { safeRemoveItem, safeSetItem } from "@/composables/preferenceStorage";
import { BUILTIN_SMART_REASONING_ID } from "@/api/agent";

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
  conversationModels?: { thinkingEnabled?: unknown; reasoningEffort?: unknown };
};

const withAuthorityDefaults = <T extends ReconcilableSettings>(defaults: T): T => {
  const cloned = cloneSettings(defaults)
  // WeKnora v0.7.2 defaults Web Search off. First-Musuw changed the store
  // constant to true for its managed experience; keep the large store file
  // untouched and restore the effective runtime default at the storage boundary.
  cloned.webSearchEnabled = false
  cloned.selectedAgentId = BUILTIN_SMART_REASONING_ID
  cloned.selectedAgentSourceTenantId = null
  cloned.isAgentEnabled = true
  return cloned
}

function reconcileLoadedSettings<T extends ReconcilableSettings>(loaded: T): T {
  loaded.selectedTags ||= [];
  loaded.selectedMCPServices ||= [];
  loaded.selectedSkills ||= (loaded.selectedTools as string[] | undefined) || [];
  loaded.selectedFileKbMap ||= {};

  // The consumer UI has one full-capability Agent. Keep the old boolean and the
  // new effort value consistent while migrating existing browser preferences.
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

  const reconciledAgentMode =
    loaded.selectedAgentId !== BUILTIN_SMART_REASONING_ID ||
    loaded.selectedAgentSourceTenantId !== null ||
    loaded.isAgentEnabled !== true;
  loaded.selectedAgentId = BUILTIN_SMART_REASONING_ID;
  loaded.selectedAgentSourceTenantId = null;
  loaded.isAgentEnabled = true;

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
    "[settings] Failed to parse WeKnora_settings from localStorage, resetting to defaults:",
    reason,
  );
  safeRemoveItem(SETTINGS_STORAGE_KEY);
  return reconcileLoadedSettings(withAuthorityDefaults(defaultSettings));
}

/** Load settings from localStorage, reconcile builtin agent mode, fall back on corruption. */
export function loadAndReconcileSettings<T extends ReconcilableSettings>(
  defaultSettings: T,
): T {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return reconcileLoadedSettings(withAuthorityDefaults(defaultSettings));
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
