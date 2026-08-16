#!/usr/bin/env bash
# One-way restore into the exact new WeKnora production volumes.  Existing
# volumes are always refused; a failed restore is retained for inspection and
# cannot overwrite the legacy deployment or a previous target import.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 1 ] || weknora_production_die 'usage: restore.sh <verified-bundle-directory>'
bundle_dir="$(cd "$1" && pwd -P)"
"$script_dir/verify-bundle.sh" "$bundle_dir"

for command in docker jq; do
    weknora_production_require_command "$command"
done

runtime_dir="$(weknora_production_runtime_dir)"
production_env="$runtime_dir/production.env"
weknora_production_require_file "$production_env"

postgres_volume="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_POSTGRES_VOLUME)"
files_volume="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_FILES_VOLUME)"
docreader_tmp_volume="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_DOCREADER_TMP_VOLUME)"
redis_volume="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_REDIS_VOLUME)"
neo4j_volume="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_NEO4J_VOLUME)"
for pair in \
    "postgres-data:$postgres_volume" \
    "data-files:$files_volume" \
    "docreader-tmp:$docreader_tmp_volume" \
    "redis-data:$redis_volume" \
    "neo4j-data:$neo4j_volume"; do
    role="${pair%%:*}"
    volume="${pair#*:}"
    weknora_production_assert_exact_volume "$role" "$volume"
    docker volume inspect "$volume" >/dev/null 2>&1 && weknora_production_die 'target production volume already exists; restore is intentionally one-shot'
done

if docker ps -a --format '{{.Names}}' | grep -q '^weknora-v072-production-'; then
    weknora_production_die 'new production containers already exist; refusing to overwrite their state'
fi

bundle_id="$(jq -er '.bundle_id' "$bundle_dir/manifest.json")"
for pair in \
    "postgres-data:$postgres_volume" \
    "data-files:$files_volume" \
    "docreader-tmp:$docreader_tmp_volume" \
    "redis-data:$redis_volume" \
    "neo4j-data:$neo4j_volume"; do
    role="${pair%%:*}"
    volume="${pair#*:}"
    docker volume create \
        --label com.musnow.purpose=weknora-v072-production-import \
        --label "com.musnow.bundle-id=$bundle_id" \
        --label "com.musnow.role=$role" \
        "$volume" >/dev/null
done

compose="$script_dir/compose.sh"
"$compose" up -d postgres
for _ in $(seq 1 60); do
    if [ "$(docker inspect weknora-v072-production-postgres --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}')" = 'healthy' ]; then
        break
    fi
    sleep 2
done
[ "$(docker inspect weknora-v072-production-postgres --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}')" = 'healthy' ] || weknora_production_die 'isolated target PostgreSQL did not become healthy'

# ParadeDB initializes its configured database with extension-owned schemas.
# The verified logical dump contains those same extensions and schemas, so the
# restore target must be a genuinely empty database.
docker exec weknora-v072-production-postgres sh -ec '
    dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB"
    createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" --template=template0 "$POSTGRES_DB"
'
docker exec -i weknora-v072-production-postgres sh -ec 'pg_restore --exit-on-error --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' < "$bundle_dir/postgres-v79.pg.dump"
target_migration="$(docker exec weknora-v072-production-postgres sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version || chr(58) || dirty FROM schema_migrations ORDER BY version DESC LIMIT 1"')"
[ "$target_migration" = '79:false' ] || weknora_production_die 'restored PostgreSQL is not cleanly migrated through version 79'

docker run --rm \
    --mount "type=volume,src=$files_volume,dst=/target" \
    --mount "type=bind,src=$bundle_dir,dst=/bundle,readonly" \
    alpine:3.20 sh -ec '
        set -eu
        test -z "$(find /target -mindepth 1 -maxdepth 1 -print -quit)"
        tar -xpf /bundle/data-files.tar -C /target
        cd /target
        sha256sum -c /bundle/data-files.manifest >/dev/null
    '

docker run --rm --entrypoint neo4j-admin \
    --mount "type=bind,src=$bundle_dir/neo4j,dst=/bundle,readonly" \
    neo4j:2025.10.1 database load neo4j --from-path=/bundle --info >/dev/null
docker run --rm --entrypoint neo4j-admin \
    --mount "type=volume,src=$neo4j_volume,dst=/data" \
    --mount "type=bind,src=$bundle_dir/neo4j,dst=/bundle,readonly" \
    neo4j:2025.10.1 database load neo4j --from-path=/bundle >/dev/null

printf '%s\n' 'v79 bundle restored to new isolated production volumes; no app, frontend, edge route, or legacy volume was changed'
