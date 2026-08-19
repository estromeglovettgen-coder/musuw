package types

import "encoding/json"

// MarshalJSON makes the server-only OpenRouter tenant credential impossible to
// leak through an accidental direct JSON serialization of a Tenant. Normal
// tenant HTTP responses already go through DTO/redaction helpers, but create
// paths historically returned the freshly-created Tenant object itself.
//
// Keep database persistence unchanged: Tenant.Credentials is still stored by
// GORM through CredentialsConfig.Value; this hook applies only when a Tenant is
// serialized as JSON for an HTTP response or another JSON consumer.
func (t Tenant) MarshalJSON() ([]byte, error) {
	type tenantJSON Tenant
	out := tenantJSON(t)
	out.Credentials = CredentialsConfigForResponse(t.Credentials, false)
	return json.Marshal(out)
}
