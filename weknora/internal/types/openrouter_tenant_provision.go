package types

// OpenRouterTenantProvisionFailure reports a single existing tenant that could
// not be migrated to a provider-managed inference key. It deliberately carries
// no key material.
type OpenRouterTenantProvisionFailure struct {
	TenantID uint64 `json:"tenant_id"`
	Error    string `json:"error"`
}

// OpenRouterTenantProvisionSummary is returned by the explicit SystemAdmin
// migration operation. Provisioning is intentionally opt-in rather than an
// application-startup side effect so production tenants are never touched just
// because a new binary was deployed.
type OpenRouterTenantProvisionSummary struct {
	Scanned            int                                `json:"scanned"`
	Provisioned        int                                `json:"provisioned"`
	AlreadyProvisioned int                                `json:"already_provisioned"`
	SkippedInactive    int                                `json:"skipped_inactive"`
	Failures           []OpenRouterTenantProvisionFailure `json:"failures,omitempty"`
}
