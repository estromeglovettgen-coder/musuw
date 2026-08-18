-- Migration: 000084_consumer_personal_tenant_boundary
-- Musuw C-end v1 treats the automatically-created personal tenant as the
-- billing/resource boundary. Ordinary users must not mint additional tenants,
-- otherwise Free storage and OpenRouter monthly credit can be multiplied by
-- creating extra workspaces.
--
-- system_settings DB rows intentionally override ENV and registry defaults.
-- System administrators retain the platform-level tenant-management path.

INSERT INTO system_settings (
    key,
    value,
    value_type,
    category,
    description,
    is_secret,
    requires_restart,
    last_modified_by
) VALUES
    (
        'tenant.max_owned_per_user',
        '1'::jsonb,
        'int',
        'tenant',
        'Musuw C-end v1: one personal tenant per ordinary user. Additional workspaces are not a consumer entitlement boundary.',
        false,
        false,
        ''
    ),
    (
        'tenant.self_service_creation_enabled',
        'false'::jsonb,
        'bool',
        'tenant',
        'Musuw C-end v1: ordinary users cannot create extra workspaces; the personal tenant is created by the registration flow.',
        false,
        false,
        ''
    )
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret,
    requires_restart = EXCLUDED.requires_restart,
    updated_at = CURRENT_TIMESTAMP;
