package types

import "time"

// OpenRouterTenantKey stores the one provider-enforced inference key assigned
// to a personal tenant. The plaintext key is AES-GCM encrypted at rest and is
// never serialized through a user-facing API.
type OpenRouterTenantKey struct {
	TenantID      uint64    `gorm:"column:tenant_id;primaryKey" json:"-"`
	KeyHash       string    `gorm:"column:key_hash;type:varchar(128);not null;uniqueIndex" json:"-"`
	KeyCiphertext string    `gorm:"column:key_ciphertext;type:text;not null" json:"-"`
	CreatedAt     time.Time `json:"-"`
	UpdatedAt     time.Time `json:"-"`
}

func (OpenRouterTenantKey) TableName() string {
	return "openrouter_tenant_keys"
}
