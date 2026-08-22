type LiteChatCapabilitySettings = {
  webSearchEnabled: false
  selectedMCPServices: never[]
  selectedSkills: never[]
  selectedTools: never[]
  selectedAgentSourceTenantId: null
}

/**
 * Lite deliberately hides capabilities that its server gate rejects. Remove
 * stale Standard-edition selections when the server resolves this browser to
 * Lite, while preserving the user's model and knowledge-base choices.
 */
export function reconcileLiteChatSettings<T extends object>(
  settings: T,
): Omit<T, keyof LiteChatCapabilitySettings> & LiteChatCapabilitySettings {
  return {
    ...settings,
    webSearchEnabled: false,
    selectedMCPServices: [],
    selectedSkills: [],
    selectedTools: [],
    selectedAgentSourceTenantId: null,
  }
}
