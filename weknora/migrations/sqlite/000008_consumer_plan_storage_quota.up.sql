-- Align persisted tenant storage quotas with the current consumer plan matrix.
-- SQLite cannot alter an existing column default without rebuilding tenants;
-- the flattened fresh schema carries the new 1 GiB default. Unknown or
-- missing plan values intentionally use the Free quota.
UPDATE tenants
SET storage_quota = CASE
    WHEN LOWER(TRIM(COALESCE(plan, ''))) = 'plus' THEN 10737418240
    WHEN LOWER(TRIM(COALESCE(plan, ''))) = 'pro' THEN 32212254720
    WHEN LOWER(TRIM(COALESCE(plan, ''))) = 'max' THEN 107374182400
    ELSE 1073741824
END
WHERE deleted_at IS NULL;
