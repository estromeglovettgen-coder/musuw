-- The quota backfill is intentionally not reversed: an operator may have
-- adjusted a tenant quota after the migration, and the previous value cannot
-- be recovered without a second quota history table. Restoring the schema
-- default is safe and does not touch stored usage or tenant data.
ALTER TABLE tenants ALTER COLUMN storage_quota SET DEFAULT 5368709120;
