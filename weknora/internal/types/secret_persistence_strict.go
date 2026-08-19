package types

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Tencent/WeKnora/internal/utils"
)

// encryptStoredSecretStrict is the write-side security boundary for secrets
// embedded in JSON/JSONB value objects. A non-empty plaintext secret must never
// degrade to plaintext persistence when SYSTEM_AES_KEY is missing or encryption
// fails. Read-side scanners remain deliberately lenient so an operator can
// still load and repair rows after a key rotation problem.
func encryptStoredSecretStrict(field, value string) (string, error) {
	if value == "" || value == RedactedSecretPlaceholder || strings.HasPrefix(value, utils.EncPrefix) {
		return value, nil
	}
	key := utils.GetAESKey()
	if key == nil {
		return "", fmt.Errorf("%s: SYSTEM_AES_KEY must contain exactly 32 bytes before persisting secrets", field)
	}
	encrypted, err := utils.EncryptAESGCM(value, key)
	if err != nil {
		return "", fmt.Errorf("%s: encrypt stored secret: %w", field, err)
	}
	if encrypted == value || !strings.HasPrefix(encrypted, utils.EncPrefix) {
		return "", fmt.Errorf("%s: encryption did not produce encrypted storage", field)
	}
	return encrypted, nil
}

// MarshalJSON closes the historical fail-open path in CredentialsConfig.Value:
// even if its best-effort pre-encryption did not run, JSONB serialization itself
// refuses to emit plaintext credentials.
func (c CredentialsConfig) MarshalJSON() ([]byte, error) {
	type credentialsAlias CredentialsConfig
	out := credentialsAlias(c)

	if out.WeKnoraCloud != nil {
		cloud := *out.WeKnoraCloud
		secret, err := encryptStoredSecretStrict("tenant.credentials.weknoracloud.app_secret", cloud.AppSecret)
		if err != nil {
			return nil, err
		}
		cloud.AppSecret = secret
		out.WeKnoraCloud = &cloud
	}
	if out.OpenRouter != nil {
		openrouter := *out.OpenRouter
		secret, err := encryptStoredSecretStrict("tenant.credentials.openrouter.api_key", openrouter.APIKey)
		if err != nil {
			return nil, err
		}
		openrouter.APIKey = secret
		out.OpenRouter = &openrouter
	}
	return json.Marshal(out)
}

// MarshalJSON gives APIPrincipalConfig.Value the same fail-closed persistence
// contract for the tenant-scoped HMAC signing secret.
func (c APIPrincipalConfig) MarshalJSON() ([]byte, error) {
	type apiPrincipalAlias APIPrincipalConfig
	out := apiPrincipalAlias(c)
	secret, err := encryptStoredSecretStrict("tenant.api_principal_config.hmac_secret", out.HMACSecret)
	if err != nil {
		return nil, err
	}
	out.HMACSecret = secret
	return json.Marshal(out)
}

// MarshalJSON gives ModelParameters.Value the same fail-closed persistence
// contract for arbitrary provider credentials retained for SystemAdmin catalog
// management. C-end callers are separately restricted to platform builtin
// OpenRouter models.
func (c ModelParameters) MarshalJSON() ([]byte, error) {
	type modelParametersAlias ModelParameters
	out := modelParametersAlias(c)

	apiKey, err := encryptStoredSecretStrict("model.parameters.api_key", out.APIKey)
	if err != nil {
		return nil, err
	}
	appSecret, err := encryptStoredSecretStrict("model.parameters.app_secret", out.AppSecret)
	if err != nil {
		return nil, err
	}
	out.APIKey = apiKey
	out.AppSecret = appSecret
	return json.Marshal(out)
}
