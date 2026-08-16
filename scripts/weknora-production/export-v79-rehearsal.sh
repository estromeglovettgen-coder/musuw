#!/usr/bin/env bash
# Export the already accepted local v0.7.2/v79 candidate as a small,
# non-secret transfer bundle.  The source volumes are mounted read-only; a
# failed run intentionally leaves its unique incomplete bundle for inspection.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

repo_root="$(weknora_production_repo_root)"
candidate_env="${WEKNORA_V79_CANDIDATE_ENV:-$repo_root/.runtime/weknora/candidate.env}"
bundle_root="${WEKNORA_V79_BUNDLE_ROOT:-$(weknora_production_runtime_dir)/bundles}"
bundle_id="${1:-weknora-v072-v79-$(date -u +%Y%m%dT%H%M%SZ)}"

[ "$#" -le 1 ] || weknora_production_die 'usage: export-v79-rehearsal.sh [safe-bundle-id]'
weknora_production_safe_id "$bundle_id" || weknora_production_die 'bundle identity is unsafe'
case "$bundle_id" in
    weknora-v072-v79-*) ;;
    *) weknora_production_die 'bundle identity must be scoped to v0.7.2/v79' ;;
esac

for command in docker jq tar sha256sum; do
    weknora_production_require_command "$command"
done
weknora_production_require_file "$candidate_env"

candidate_postgres_volume="$(weknora_production_require_env_value "$candidate_env" WEKNORA_CANDIDATE_POSTGRES_VOLUME)"
candidate_files_volume="$(weknora_production_require_env_value "$candidate_env" WEKNORA_CANDIDATE_FILES_VOLUME)"
candidate_neo4j_volume="$(weknora_production_require_env_value "$candidate_env" WEKNORA_CANDIDATE_NEO4J_VOLUME)"

[ "$candidate_postgres_volume" = 'weknora-v072-candidate-postgres-data' ] || weknora_production_die 'candidate PostgreSQL source volume is unexpected'
[ "$candidate_files_volume" = 'weknora-v072-candidate-data-files' ] || weknora_production_die 'candidate data-files source volume is unexpected'
[ "$candidate_neo4j_volume" = 'weknora-v072-candidate-neo4j-data' ] || weknora_production_die 'candidate Neo4j source volume is unexpected'

for source_volume in "$candidate_postgres_volume" "$candidate_files_volume" "$candidate_neo4j_volume"; do
    docker volume inspect "$source_volume" >/dev/null 2>&1 || weknora_production_die 'accepted candidate source volume is unavailable'
done

postgres_container='weknora-v072-candidate-postgres'
app_container='weknora-v072-candidate-app'
neo4j_container='weknora-v072-candidate-neo4j'
for container in "$postgres_container" "$app_container" "$neo4j_container"; do
    [ "$(docker inspect "$container" --format '{{ index .Config.Labels "com.docker.compose.project" }}')" = 'weknora-v072-candidate' ] || weknora_production_die 'source container is not part of the isolated candidate'
done

app_image_version="$(docker image inspect weknora-v072-candidate-app:3d5d8bf --format '{{ index .Config.Labels "org.opencontainers.image.version" }}')"
app_image_revision="$(docker image inspect weknora-v072-candidate-app:3d5d8bf --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
[ "$app_image_version" = 'v0.7.2' ] || weknora_production_die 'candidate image is not v0.7.2'
[ "$app_image_revision" = '3d5d8bfcdfeeea266b292b71cea616847af28d0f' ] || weknora_production_die 'candidate image is not the approved upstream revision'
[ "$(docker inspect "$postgres_container" --format '{{.State.Running}}')" = 'true' ] || weknora_production_die 'candidate PostgreSQL must be running for logical export'

app_was_running="$(docker inspect "$app_container" --format '{{.State.Running}}')"
neo4j_was_running="$(docker inspect "$neo4j_container" --format '{{.State.Running}}')"
app_stopped=false
neo4j_stopped=false

resume_candidate() {
    local resume_failed=false
    if [ "$neo4j_stopped" = true ]; then
        if ! docker start "$neo4j_container" >/dev/null; then
            resume_failed=true
        fi
        neo4j_stopped=false
    fi
    if [ "$app_stopped" = true ]; then
        if ! docker start "$app_container" >/dev/null; then
            resume_failed=true
        fi
        app_stopped=false
    fi
    [ "$resume_failed" = false ]
}

on_exit() {
    local status=$?
    trap - EXIT
    if ! resume_candidate; then
        printf '%s\n' 'candidate service resume failed; inspect the isolated candidate before proceeding' >&2
        status=1
    fi
    exit "$status"
}
trap on_exit EXIT

umask 077
install -d -m 700 "$bundle_root"
bundle_dir="$bundle_root/$bundle_id"
[ ! -e "$bundle_dir" ] || weknora_production_die 'bundle directory already exists; choose a new identity'
install -d -m 700 "$bundle_dir"
install -d -m 700 "$bundle_dir/neo4j"

# Freeze the only local candidate writers while PostgreSQL and file storage are
# read.  Neo4j must be offline for its official admin dump.  No source volume
# is ever mounted writable by this script.
if [ "$app_was_running" = true ]; then
    docker stop --time 30 "$app_container" >/dev/null
    app_stopped=true
fi
if [ "$neo4j_was_running" = true ]; then
    docker stop --time 30 "$neo4j_container" >/dev/null
    neo4j_stopped=true
fi
[ -z "$(docker ps -q --filter "volume=$candidate_neo4j_volume")" ] || weknora_production_die 'candidate Neo4j source volume remains attached to a running container'

migration_state="$(docker exec "$postgres_container" sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version || chr(58) || dirty FROM schema_migrations ORDER BY version DESC LIMIT 1"')"
[ "$migration_state" = '79:false' ] || weknora_production_die 'candidate database is not cleanly migrated through version 79'

docker exec "$postgres_container" sh -ec 'pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' > "$bundle_dir/postgres-v79.pg.dump"
[ -s "$bundle_dir/postgres-v79.pg.dump" ] || weknora_production_die 'PostgreSQL logical dump is empty'

docker run --rm \
    --mount "type=volume,src=$candidate_files_volume,dst=/source,readonly" \
    --mount "type=bind,src=$bundle_dir,dst=/bundle" \
    alpine:3.20 sh -ec '
        set -eu
        cd /source
        find . -xdev -type f -exec sha256sum {} + | LC_ALL=C sort > /bundle/data-files.manifest
        tar -cpf /bundle/data-files.tar .
    '
[ -s "$bundle_dir/data-files.tar" ] || weknora_production_die 'data-files archive is empty'
data_files_count="$(wc -l < "$bundle_dir/data-files.manifest" | tr -d ' ')"
data_files_bytes="$(docker run --rm --mount "type=volume,src=$candidate_files_volume,dst=/source,readonly" alpine:3.20 sh -ec 'find /source -xdev -type f -exec wc -c {} + | awk "NF == 2 { total += \$1 } END { print total + 0 }"')"

# Neo4j's own dump command writes a temporary lock even when the source server
# is stopped.  Clone the stopped source into one uniquely-labelled scratch
# volume first, then let the official tool write only to that scratch copy.
neo4j_scratch_volume="weknora-v072-export-${bundle_id}-neo4j-scratch"
weknora_production_safe_id "$neo4j_scratch_volume" || weknora_production_die 'Neo4j scratch volume identity is unsafe'
docker volume inspect "$neo4j_scratch_volume" >/dev/null 2>&1 && weknora_production_die 'Neo4j scratch volume already exists'
docker volume create \
    --label com.musnow.purpose=weknora-v072-export-scratch \
    --label "com.musnow.bundle-id=$bundle_id" \
    "$neo4j_scratch_volume" >/dev/null
docker run --rm \
    --mount "type=volume,src=$candidate_neo4j_volume,dst=/source,readonly" \
    --mount "type=volume,src=$neo4j_scratch_volume,dst=/target" \
    alpine:3.20 sh -ec '
        set -eu
        cd /source
        tar -cpf - . | tar -xpf - -C /target
    '

# The candidate can resume as soon as its read-only clone exists.  The native
# dump below no longer mounts candidate data at all.
resume_candidate
docker run --rm --entrypoint neo4j-admin \
    --mount "type=volume,src=$neo4j_scratch_volume,dst=/data" \
    --mount "type=bind,src=$bundle_dir/neo4j,dst=/bundle" \
    neo4j:2025.10.1 database dump neo4j --to-path=/bundle >/dev/null
docker volume rm "$neo4j_scratch_volume" >/dev/null
[ -s "$bundle_dir/neo4j/neo4j.dump" ] || weknora_production_die 'Neo4j native dump is empty'

postgres_sha="$(weknora_production_sha256_file "$bundle_dir/postgres-v79.pg.dump")"
files_tar_sha="$(weknora_production_sha256_file "$bundle_dir/data-files.tar")"
files_manifest_sha="$(weknora_production_sha256_file "$bundle_dir/data-files.manifest")"
neo4j_sha="$(weknora_production_sha256_file "$bundle_dir/neo4j/neo4j.dump")"

jq -n \
    --arg bundle_id "$bundle_id" \
    --arg created_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg postgres_sha "$postgres_sha" \
    --arg files_tar_sha "$files_tar_sha" \
    --arg files_manifest_sha "$files_manifest_sha" \
    --arg neo4j_sha "$neo4j_sha" \
    --argjson data_files_count "$data_files_count" \
    --argjson data_files_bytes "$data_files_bytes" \
    '{
      format: "weknora-v0.7.2-v79-rehearsal-bundle/v1",
      bundle_id: $bundle_id,
      created_at: $created_at,
      source: {
        version: "v0.7.2",
        revision: "3d5d8bfcdfeeea266b292b71cea616847af28d0f",
        migration: { version: 79, dirty: false },
        topology: "isolated-weknora-v072-candidate"
      },
      data_files: { file_count: $data_files_count, logical_bytes: $data_files_bytes },
      artifacts: {
        "postgres-v79.pg.dump": $postgres_sha,
        "data-files.tar": $files_tar_sha,
        "data-files.manifest": $files_manifest_sha,
        "neo4j/neo4j.dump": $neo4j_sha
      }
    }' > "$bundle_dir/manifest.json"

{
    printf '%s  %s\n' "$(weknora_production_sha256_file "$bundle_dir/manifest.json")" './manifest.json'
    printf '%s  %s\n' "$postgres_sha" './postgres-v79.pg.dump'
    printf '%s  %s\n' "$files_tar_sha" './data-files.tar'
    printf '%s  %s\n' "$files_manifest_sha" './data-files.manifest'
    printf '%s  %s\n' "$neo4j_sha" './neo4j/neo4j.dump'
} > "$bundle_dir/SHA256SUMS"
find "$bundle_dir" -type f -exec chmod 600 {} +

"$script_dir/verify-bundle.sh" "$bundle_dir"
trap - EXIT

printf '%s\n' "verified v79 rehearsal bundle exported at $bundle_dir"
