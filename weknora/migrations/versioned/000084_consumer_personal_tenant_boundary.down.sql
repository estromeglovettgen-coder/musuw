-- Roll back the Musuw C-end personal-tenant boundary rows.
-- Deleting them restores the previous resolver behavior (ENV first, then the
-- registry defaults of max_owned_per_user=10 and self_service_creation=true).

DELETE FROM system_settings
WHERE key IN (
    'tenant.max_owned_per_user',
    'tenant.self_service_creation_enabled'
);
