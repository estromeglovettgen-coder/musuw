package types

// ConsumerScene identifies one of the fixed platform-owned consumer model
// call paths. Keep this closed set small: callers must not be able to invent
// policy namespaces by sending arbitrary strings.
type ConsumerScene string

const (
	ConsumerSceneChat ConsumerScene = "chat"
	ConsumerSceneRAG  ConsumerScene = "rag"
	ConsumerSceneWiki ConsumerScene = "wiki"
)

// ConsumerScenes returns the fixed scene order used by settings and options
// responses. A fresh slice prevents callers from mutating package state.
func ConsumerScenes() []ConsumerScene {
	return []ConsumerScene{ConsumerSceneChat, ConsumerSceneRAG, ConsumerSceneWiki}
}

// Valid reports whether the scene is one of the three supported consumer
// paths.
func (s ConsumerScene) Valid() bool {
	switch s {
	case ConsumerSceneChat, ConsumerSceneRAG, ConsumerSceneWiki:
		return true
	default:
		return false
	}
}

func (s ConsumerScene) FreeDefaultKey() string {
	return "consumer_models." + string(s) + ".free_default"
}

func (s ConsumerScene) PaidOptionsKey() string {
	return "consumer_models." + string(s) + ".paid_options"
}

// ConsumerModelOption is the intentionally narrow scene-options response.
// It contains display/capability state only; provider configuration and
// credentials remain behind the existing model service.
type ConsumerModelOption struct {
	ModelID      string `json:"model_id"`
	DisplayName  string `json:"display_name"`
	Selectable   bool   `json:"selectable"`
	Locked       bool   `json:"locked"`
	RequiredPlan string `json:"required_plan"`
	SceneDefault bool   `json:"is_scene_default"`
	Effective    bool   `json:"is_effective"`
}
