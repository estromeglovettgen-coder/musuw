package main

import (
	"fmt"
	"strings"

	"github.com/Tencent/WeKnora/internal/runtime"
)

type startupContract struct {
	Role     runtime.RuntimeRole
	Plan     runtime.LifecyclePlan
	Revision string
}

func resolveStartupContract(getenv func(string) string, compiledRevision string) (startupContract, error) {
	if getenv == nil {
		return startupContract{}, fmt.Errorf("startup environment resolver is nil")
	}
	role, err := runtime.ParseRuntimeRole(getenv(runtime.RuntimeRoleEnv))
	if err != nil {
		return startupContract{}, err
	}
	plan := runtime.NewLifecyclePlan(role)
	if err := runtime.ValidateRoleConfiguration(plan, getenv); err != nil {
		return startupContract{}, err
	}
	revision, err := runtime.ValidateRevisionProvenance(role, getenv("WEKNORA_PRODUCTION_REVISION"), compiledRevision)
	if err != nil {
		return startupContract{}, err
	}
	return startupContract{Role: role, Plan: plan, Revision: strings.ToLower(revision)}, nil
}
