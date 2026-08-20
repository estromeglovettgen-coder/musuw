package service

import (
	"context"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
)

func TestConsumerModelPolicyRequiresBuiltinOpenRouterModel(t *testing.T) {
	svc := &modelService{}

	cases := []struct {
		name    string
		model   *types.Model
		allowed bool
	}{
		{
			name: "platform openrouter builtin",
			model: &types.Model{
				IsBuiltin:  true,
				Parameters: types.ModelParameters{Provider: "openrouter"},
			},
			allowed: true,
		},
		{
			name: "manual openrouter model",
			model: &types.Model{
				IsBuiltin:  false,
				Parameters: types.ModelParameters{Provider: "openrouter"},
			},
			allowed: false,
		},
		{
			name: "builtin non-openrouter model",
			model: &types.Model{
				IsBuiltin:  true,
				Parameters: types.ModelParameters{Provider: "openai"},
			},
			allowed: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			allowed, err := svc.consumerPlanAllowsModel(context.Background(), tc.model)
			if err != nil {
				t.Fatalf("consumerPlanAllowsModel returned error: %v", err)
			}
			if allowed != tc.allowed {
				t.Fatalf("allowed=%v want=%v", allowed, tc.allowed)
			}
		})
	}
}
