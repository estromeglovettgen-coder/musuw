package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/utils"
)

// ProvisionOpenRouterKeysForExistingTenants is the explicit migration path for
// tenants that predate provider-managed inference keys. It is intentionally not
// called from startup: production operators must invoke the SystemAdmin action
// only after OPENROUTER_MANAGEMENT_API_KEY and SYSTEM_AES_KEY are confirmed.
func (s *tenantService) ProvisionOpenRouterKeysForExistingTenants(
	ctx context.Context,
) (*types.OpenRouterTenantProvisionSummary, error) {
	if s.keys == nil {
		return nil, fmt.Errorf("OPENROUTER_MANAGEMENT_API_KEY is not configured")
	}
	if utils.GetAESKey() == nil {
		return nil, fmt.Errorf("SYSTEM_AES_KEY must contain exactly 32 bytes before provisioning OpenRouter tenant keys")
	}

	tenants, err := s.repo.ListTenants(ctx)
	if err != nil {
		return nil, fmt.Errorf("list tenants for OpenRouter provisioning: %w", err)
	}

	summary := &types.OpenRouterTenantProvisionSummary{
		Scanned:  len(tenants),
		Failures: make([]types.OpenRouterTenantProvisionFailure, 0),
	}
	for _, tenant := range tenants {
		if tenant == nil {
			continue
		}
		if strings.TrimSpace(tenant.Status) != "active" {
			summary.SkippedInactive++
			continue
		}
		if tenant.Credentials != nil && tenant.Credentials.OpenRouter != nil {
			if tenant.Credentials.GetOpenRouter() != nil {
				summary.AlreadyProvisioned++
				continue
			}
			// A hash with an unreadable/blank API key usually means an AES-key
			// rotation or corrupted credential. Creating another provider key
			// here would orphan the existing budget boundary, so fail this row
			// for explicit operator repair instead.
			summary.Failures = append(summary.Failures, types.OpenRouterTenantProvisionFailure{
				TenantID: tenant.ID,
				Error:    "existing OpenRouter credentials are incomplete; refusing duplicate provider key",
			})
			continue
		}
		if err := s.provisionOpenRouterTenantKey(ctx, tenant); err != nil {
			summary.Failures = append(summary.Failures, types.OpenRouterTenantProvisionFailure{
				TenantID: tenant.ID,
				Error:    err.Error(),
			})
			continue
		}
		summary.Provisioned++
	}
	return summary, nil
}
