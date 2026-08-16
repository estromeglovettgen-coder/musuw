#!/usr/bin/env bash
# Activate a source-only daily update after it builds successfully on the
# production amd64 host. This script never creates, removes or migrates data
# volumes and never reads a secret value directly.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'update-current accepts no arguments'

repo_root="$(cd "$script_dir/../.." && pwd -P)"
runtime_dir="$(weknora_production_runtime_dir)"
release_protocol="${WEKNORA_PRODUCTION_RELEASE_PROTOCOL:-legacy}"
case "$release_protocol" in
    legacy|staged) ;;
    *) weknora_production_die 'production release protocol is invalid' ;;
esac
current_link='/opt/weknora/current'
release_root='/opt/weknora/releases'
lock_dir="$runtime_dir/update.lock"
backup_dir=''
old_target=''
old_app_id=''
old_ui_id=''
config_changed=false
current_switched=false
completed=false
lock_held=false
runtime_recreate_started=false
staged_started=false
cutover_invoked=false

image_tag="$(weknora_production_image_tag)"
app_image="weknora-v072-production-app:$image_tag"
ui_image="weknora-v072-production-ui:$image_tag"
app_previous='weknora-v072-production-app:deploy-previous'
ui_previous='weknora-v072-production-ui:deploy-previous'
app_container='weknora-v072-production-app'
frontend_container='weknora-v072-production-frontend'
postgres_container='weknora-v072-production-postgres'
edge_network='musnow-production_edge'
cutover_state="$runtime_dir/cutover-state.json"

for command_name in docker curl jq cmp find readlink mktemp date; do
    weknora_production_require_command "$command_name"
done

case "$repo_root" in
    "$release_root"/*/source) ;;
    *) weknora_production_die 'daily update source is outside the approved release root' ;;
esac
[ -L "$current_link" ] || weknora_production_die 'daily update requires an existing /opt/weknora/current symlink'
old_target="$(readlink -f "$current_link")"
case "$old_target" in
    "$release_root"/*/source) ;;
    *) weknora_production_die 'current source target is outside the approved release root' ;;
esac
[ -d "$old_target" ] || weknora_production_die 'current source target is unavailable'
[ "$repo_root" != "$old_target" ] || weknora_production_die 'release is already current'

for required in \
    "$repo_root/weknora/docker-compose.yml" \
    "$repo_root/weknora/config/builtin_models.yaml" \
    "$repo_root/weknora/frontend/dist/index.html" \
    "$repo_root/auth/dist/index.html" \
    "$repo_root/integration/weknora-production/compose.yaml" \
    "$repo_root/integration/weknora-production/compose.edge.yaml" \
    "$repo_root/deploy/production.public.env" \
    "$repo_root/deploy/auth-public.env" \
    "$repo_root/scripts/weknora-production/prepare-runtime.sh" \
    "$repo_root/scripts/weknora-production/build-images.sh"; do
    weknora_production_require_file "$required"
done
if [ "$release_protocol" = 'staged' ]; then
    for required in \
        "$repo_root/scripts/weknora-production/start-staged.sh" \
        "$repo_root/scripts/weknora-production/cutover.sh" \
        "$repo_root/scripts/weknora-production/rollback.sh"; do
        weknora_production_require_file "$required"
    done
fi

[ -d "$runtime_dir" ] && [ "$(weknora_production_file_mode "$runtime_dir")" = '700' ] || weknora_production_die 'production runtime directory permissions are unsafe'
[ -d "$runtime_dir/secrets" ] && [ "$(weknora_production_file_mode "$runtime_dir/secrets")" = '700' ] || weknora_production_die 'production secret directory permissions are unsafe'

for volume in \
    weknora-v072-production-postgres-data \
    weknora-v072-production-data-files \
    weknora-v072-production-docreader-tmp \
    weknora-v072-production-redis-data \
    weknora-v072-production-neo4j-data; do
    docker volume inspect "$volume" >/dev/null
done

weknora_production_require_additive_versioned_migrations "$old_target" "$repo_root"
expected_migration_version="$(weknora_production_latest_versioned_migration "$repo_root")"

# This daily path only recreates app/frontend. Refuse changes that are consumed
# by retained data/sidecar containers or that select a different data authority;
# those belong to the full native-stack release workflow.
for fixed_config_key in \
    DB_DRIVER DB_HOST DB_PORT DB_USER DB_NAME \
    REDIS_ADDR STREAM_MANAGER_TYPE REDIS_DB REDIS_PREFIX WEKNORA_REDIS_NAMESPACE \
    NEO4J_ENABLE NEO4J_URI NEO4J_USERNAME \
    STORAGE_TYPE LOCAL_STORAGE_BASE_DIR \
    MAX_FILE_SIZE_MB LOG_LEVEL TZ WEKNORA_PRODUCTION_SEARXNG_PORT; do
    old_config_value="$(weknora_production_env_value "$runtime_dir/production.public.env" "$fixed_config_key")"
    new_config_value="$(weknora_production_env_value "$repo_root/deploy/production.public.env" "$fixed_config_key")"
    if [ "$old_config_value" != "$new_config_value" ]; then
        weknora_production_die 'configuration requires a full native-stack release'
    fi
done
unset old_config_value new_config_value fixed_config_key

refresh_cutover_state() {
    local frontend_id state_tmp now
    [ -f "$cutover_state" ] || return 0
    frontend_id="$(docker inspect "$frontend_container" --format '{{.Id}}')"
    [[ "$frontend_id" =~ ^[0-9a-f]{12,64}$ ]] || return 1
    state_tmp="$(mktemp "$runtime_dir/cutover-state.json.XXXXXX")"
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    if ! jq --arg frontend_id "$frontend_id" --arg now "$now" '
        if .schema == 1 and
           .phase == "cutover_active" and
           .new_container_name == "weknora-v072-production-frontend"
        then
            .new_container_id = $frontend_id | .updated_at = $now
        else
            error("cutover state is not active native state")
        end
    ' "$cutover_state" > "$state_tmp"; then
        find "$state_tmp" -delete 2>/dev/null || true
        return 1
    fi
    chmod 600 "$state_tmp"
    mv "$state_tmp" "$cutover_state"
}

restore_previous() {
    local restore_status=0
    set +e
    if [ "$config_changed" = true ] && [ -n "$backup_dir" ] && [ -d "$backup_dir" ]; then
        for file_name in production.public.env auth-public.env production.env; do
            if [ -f "$backup_dir/$file_name" ]; then
                install -m 600 "$backup_dir/$file_name" "$runtime_dir/$file_name" || restore_status=1
            fi
        done
    fi
    if [ "$current_switched" = true ] && [ -n "$old_target" ]; then
        previous_link="$runtime_dir/current.rollback.$$"
        ln -s "$old_target" "$previous_link" && mv -Tf "$previous_link" "$current_link" || restore_status=1
    fi
    if [ -n "$old_app_id" ] && [ -n "$old_ui_id" ]; then
        docker tag "$old_app_id" "$app_image" || restore_status=1
        docker tag "$old_ui_id" "$ui_image" || restore_status=1
        if [ "$runtime_recreate_started" = true ] && [ -x "$current_link/scripts/weknora-production/compose.sh" ]; then
            WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
                "$current_link/scripts/weknora-production/compose.sh" --edge \
                up -d --no-deps --force-recreate app frontend || restore_status=1
            refresh_cutover_state || restore_status=1
        fi
    fi
    set -e
    return "$restore_status"
}

cleanup() {
    local status=$?
    trap - EXIT
    if [ "$status" -ne 0 ] && [ "$completed" = false ]; then
        printf '%s\n' 'daily update failed; restoring previous source, public configuration and images' >&2
        if [ "$release_protocol" = 'staged' ] && [ "$cutover_invoked" = true ]; then
            WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
                "$current_link/scripts/weknora-production/rollback.sh" || \
                printf '%s\n' 'automatic staged-cutover rollback failed; inspect cutover-state.json and the retained edge owner' >&2
        fi
        restore_previous || printf '%s\n' 'automatic daily-update rollback also failed; inspect the retained current target and previous image tags' >&2
    fi
    if [ -n "$backup_dir" ] && [ -d "$backup_dir" ]; then
        find "$backup_dir" -depth -delete 2>/dev/null || true
    fi
    if [ "$lock_held" = true ]; then
        rmdir "$lock_dir" 2>/dev/null || true
    fi
    exit "$status"
}
trap cleanup EXIT

if ! mkdir "$lock_dir" 2>/dev/null; then
    weknora_production_die 'another daily update is already active'
fi
lock_held=true

weknora_production_require_disk_reserve

backup_dir="$(mktemp -d "$runtime_dir/update-backup.XXXXXX")"
chmod 700 "$backup_dir"
for file_name in production.public.env auth-public.env production.env; do
    weknora_production_require_file "$runtime_dir/$file_name"
    cp -p "$runtime_dir/$file_name" "$backup_dir/$file_name"
done

install -m 600 "$repo_root/deploy/production.public.env" "$runtime_dir/production.public.env"
install -m 600 "$repo_root/deploy/auth-public.env" "$runtime_dir/auth-public.env"
config_changed=true

WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    "$repo_root/scripts/weknora-production/prepare-runtime.sh"

old_app_id="$(docker image inspect "$app_image" --format '{{.Id}}')"
old_ui_id="$(docker image inspect "$ui_image" --format '{{.Id}}')"
docker tag "$old_app_id" "$app_previous"
docker tag "$old_ui_id" "$ui_previous"

# The expensive Go build happens natively on the amd64 server while the old
# containers and current symlink continue serving traffic.
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    "$repo_root/scripts/weknora-production/build-images.sh"

next_link="$runtime_dir/current.next.$$"
ln -s "$repo_root" "$next_link"
mv -Tf "$next_link" "$current_link"
current_switched=true

if [ "$release_protocol" = 'staged' ]; then
    # The CI entry point uses the existing loopback-only staged stack and the
    # serialized alias handoff. Neither helper accepts arbitrary operator
    # commands; each owns its own health/lock/rollback contract.
    staged_started=true
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
        "$current_link/scripts/weknora-production/start-staged.sh"
    cutover_invoked=true
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
        "$current_link/scripts/weknora-production/cutover.sh"
else
    runtime_recreate_started=true
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
        "$current_link/scripts/weknora-production/compose.sh" --edge \
        up -d --no-deps --force-recreate app frontend

    wait_for_healthy() {
        local container="$1"
        local deadline=$(( $(date +%s) + 240 ))
        local health
        while [ "$(date +%s)" -lt "$deadline" ]; do
            health="$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
            case "$health" in
                healthy) return 0 ;;
                unhealthy|exited|dead) return 1 ;;
            esac
            sleep 2
        done
        return 1
    }

    wait_for_healthy "$app_container" || weknora_production_die 'updated native app did not become healthy'
    wait_for_healthy "$frontend_container" || weknora_production_die 'updated native frontend did not become healthy'

    app_port="$(weknora_production_require_env_value "$runtime_dir/production.env" WEKNORA_PRODUCTION_APP_PORT)"
    frontend_port="$(weknora_production_require_env_value "$runtime_dir/production.env" WEKNORA_PRODUCTION_FRONTEND_PORT)"
    curl -fsS --connect-timeout 5 "http://127.0.0.1:${app_port}/health" >/dev/null
    curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/health" >/dev/null
fi

migration_state="$(docker exec "$postgres_container" sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version, dirty FROM schema_migrations"')"
[ "$migration_state" = "${expected_migration_version}|f" ] || weknora_production_die 'updated runtime did not reach the release migration version cleanly'

# The app loader seeds this exact catalog from config/builtin_models.yaml at
# startup. Health alone cannot prove that the non-fatal loader found its file,
# so fail and roll back rather than serving a frontend whose two answer modes
# or zero-config knowledge-base pipeline are unavailable.
platform_model_catalog_sql="SELECT count(*) FROM models WHERE deleted_at IS NULL AND is_builtin = true AND status = 'active' AND ((id = 'builtin-deepseek-v4-pro' AND type = 'KnowledgeQA') OR (id = 'builtin-deepseek-v4-flash' AND type = 'KnowledgeQA') OR (id = 'builtin-openrouter-embedding' AND type = 'Embedding') OR (id = 'builtin-openrouter-rerank' AND type = 'Rerank') OR (id = 'builtin-openrouter-vlm' AND type = 'VLLM') OR (id = 'builtin-openrouter-asr' AND type = 'ASR'));"
platform_model_catalog_count="$(docker exec -e PLATFORM_MODEL_CATALOG_SQL="$platform_model_catalog_sql" "$postgres_container" sh -ec 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$PLATFORM_MODEL_CATALOG_SQL"')" || weknora_production_die 'cannot verify the active platform model catalog'
[ "$platform_model_catalog_count" = '6' ] || weknora_production_die 'updated runtime did not activate the six-model platform catalog'

frontend_networks="$(docker inspect "$frontend_container" --format '{{json .NetworkSettings.Networks}}')"
jq -e --arg network "$edge_network" '
    has($network) and ((.[$network].Aliases // []) | index("web")) != null
' <<<"$frontend_networks" >/dev/null || weknora_production_die 'updated frontend did not retain the public edge alias'

refresh_cutover_state || weknora_production_die 'updated frontend could not refresh the retained cutover identity'
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/health >/dev/null

completed=true
printf '%s\n' "daily update green: $repo_root is current; production volumes and secret directory were preserved"
