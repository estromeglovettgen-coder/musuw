package interfaces

import (
	"context"

	"github.com/Tencent/WeKnora/internal/types"
)

// ConsumerModelResolver is the server-authoritative seam for the fixed
// platform consumer scenes. Implementations validate policy against the
// current builtin OpenRouter KnowledgeQA catalog before returning a model.
type ConsumerModelResolver interface {
	ResolveConsumerModel(ctx context.Context, scene types.ConsumerScene, requestedID string) (*types.Model, error)
	ListConsumerModelOptions(ctx context.Context, scene types.ConsumerScene) ([]*types.ConsumerModelOption, error)
	AllowsFreeConsumerModel(ctx context.Context, model *types.Model) (bool, error)
}
