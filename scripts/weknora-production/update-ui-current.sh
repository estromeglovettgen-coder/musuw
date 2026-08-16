#!/usr/bin/env bash
# Activate a visual-only source update. It accepts no application, migration or
# runtime-configuration delta, builds only the native frontend image, and
# recreates only that frontend container. The old source and image remain
# available until public health has passed, so failure is reversible.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'update-ui-current accepts no arguments'

repo_root="$(cd "$script_dir/../.." && pwd -P)"
runtime_dir="$(weknora_production_runtime_dir)"
current_link='/opt/weknora/current'
release_root='/opt/weknora/releases'
lock_dir="$runtime_dir/update-ui.lock"
old_target=''
old_ui_id=''
current_switched=false
frontend_recreate_started=false
completed=false
lock_held=false

image_tag="$(weknora_production_image_tag)"
ui_image="weknora-v072-production-ui:$image_tag"
ui_previous='weknora-v072-production-ui:deploy-previous'
frontend_container='weknora-v072-production-frontend'
postgres_container='weknora-v072-production-postgres'
edge_network='musnow-production_edge'
cutover_state="$runtime_dir/cutover-state.json"

for command_name in docker curl jq cmp diff find readlink mktemp date; do
    weknora_production_require_command "$command_name"
done

case "$repo_root" in
    "$release_root"/*/source) ;;
    *) weknora_production_die 'UI update source is outside the approved release root' ;;
esac
[ -L "$current_link" ] || weknora_production_die 'UI update requires an existing /opt/weknora/current symlink'
old_target="$(readlink -f "$current_link")"
case "$old_target" in
    "$release_root"/*/source) ;;
    *) weknora_production_die 'current source target is outside the approved release root' ;;
esac
[ -d "$old_target" ] || weknora_production_die 'current source target is unavailable'
[ "$repo_root" != "$old_target" ] || weknora_production_die 'UI release is already current'
[ -f "$old_target/weknora/config/builtin_models.yaml" ] || weknora_production_die 'UI update requires a current full release with the platform model catalog'

for required in \
    "$repo_root/weknora/docker-compose.yml" \
    "$repo_root/weknora/frontend/dist/index.html" \
    "$repo_root/auth/dist/index.html" \
    "$repo_root/integration/weknora-production/compose.yaml" \
    "$repo_root/integration/weknora-production/compose.edge.yaml" \
    "$repo_root/scripts/weknora-production/compose.sh"; do
    weknora_production_require_file "$required"
done
[ -r "$runtime_dir/production.public.env" ] || weknora_production_die 'serving production public configuration is unavailable'
[ -r "$runtime_dir/auth-public.env" ] || weknora_production_die 'serving auth public configuration is unavailable'
weknora_production_require_unique_env_keys "$runtime_dir/auth-public.env"
for auth_key in VITE_AUTH_PUBLIC_ORIGIN VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_WEKNORA_OAUTH_CLIENT_ID; do
    weknora_production_require_env_value "$runtime_dir/auth-public.env" "$auth_key" >/dev/null
done
[ "$(weknora_production_require_env_value "$runtime_dir/auth-public.env" VITE_AUTH_PUBLIC_ORIGIN)" = 'https://app.musuw.com' ] || weknora_production_die 'production auth public origin must remain https://app.musuw.com'

[ -d "$runtime_dir" ] && [ "$(weknora_production_file_mode "$runtime_dir")" = '700' ] || weknora_production_die 'production runtime directory permissions are unsafe'
[ -d "$runtime_dir/secrets" ] && [ "$(weknora_production_file_mode "$runtime_dir/secrets")" = '700' ] || weknora_production_die 'production secret directory permissions are unsafe'

# The source itself is a full server-side snapshot made from the serving
# release. These checks make that fact an executable contract: no migration or
# public runtime/configuration byte may change on this faster path.
require_same_tree() {
    local previous="$1"
    local candidate="$2"
    local failure="$3"
    [ -d "$previous" ] && [ -d "$candidate" ] || weknora_production_die "$failure"
    diff -qr "$previous" "$candidate" >/dev/null || weknora_production_die "$failure"
}

require_same_tree \
    "$old_target/weknora/migrations" \
    "$repo_root/weknora/migrations" \
    'UI update may not change migration history'
require_same_tree \
    "$old_target/integration/weknora-production" \
    "$repo_root/integration/weknora-production" \
    'UI update may not change production integration configuration'
require_ui_only_source_delta() {
    local diff_file line
    diff_file="$(mktemp "$runtime_dir/update-ui-delta.XXXXXX")"
    if ! diff -qr "$old_target" "$repo_root" > "$diff_file"; then
        while IFS= read -r line; do
            [ -n "$line" ] || continue
            case "$line" in
                *"$old_target/weknora/frontend/"*|*"$repo_root/weknora/frontend/"*|\
                *"$old_target/auth/"*|*"$repo_root/auth/"*|\
                *"$old_target/scripts/weknora-production/update-ui-current.sh"*|\
                *"$repo_root/scripts/weknora-production/update-ui-current.sh"*|\
                "Only in $old_target/weknora: frontend"|\
                "Only in $repo_root/weknora: frontend"|\
                "Only in $old_target: auth"|\
                "Only in $repo_root: auth"|\
                "Only in $repo_root/scripts/weknora-production: update-ui-current.sh")
                    ;;
                *)
                    find "$diff_file" -delete 2>/dev/null || true
                    weknora_production_die 'UI update contains a source change outside the explicit UI allowlist'
                    ;;
            esac
        done < "$diff_file"
    fi
    find "$diff_file" -delete 2>/dev/null || true
}

require_ui_only_source_delta

# The browser deliberately exposes only the two platform answer modes. A
# UI-only update must therefore never be allowed to point at an older app
# release that has no seeded catalog for those modes (or their ingestion
# dependencies). This is a read-only check against the serving Postgres
# container; a full release is the sole recovery path when it fails.
platform_model_catalog_sql="SELECT count(*) FROM models WHERE deleted_at IS NULL AND is_builtin = true AND status = 'active' AND ((id = 'builtin-deepseek-v4-pro' AND type = 'KnowledgeQA') OR (id = 'builtin-deepseek-v4-flash' AND type = 'KnowledgeQA') OR (id = 'builtin-openrouter-embedding' AND type = 'Embedding') OR (id = 'builtin-openrouter-rerank' AND type = 'Rerank') OR (id = 'builtin-openrouter-vlm' AND type = 'VLLM') OR (id = 'builtin-openrouter-asr' AND type = 'ASR'));"
platform_model_catalog_count="$(docker exec -e PLATFORM_MODEL_CATALOG_SQL="$platform_model_catalog_sql" "$postgres_container" sh -ec 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$PLATFORM_MODEL_CATALOG_SQL"')" || weknora_production_die 'cannot verify the active platform model catalog'
[ "$platform_model_catalog_count" = '6' ] || weknora_production_die 'UI update requires the active six-model platform catalog; perform a full release first'

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
    local restore_status=0 previous_link
    set +e
    if [ "$current_switched" = true ] && [ -n "$old_target" ]; then
        previous_link="$runtime_dir/current-ui.rollback.$$"
        ln -s "$old_target" "$previous_link" && mv -Tf "$previous_link" "$current_link" || restore_status=1
    fi
    if [ -n "$old_ui_id" ]; then
        docker tag "$old_ui_id" "$ui_image" || restore_status=1
        if [ "$frontend_recreate_started" = true ] && [ -x "$current_link/scripts/weknora-production/compose.sh" ]; then
            WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
                "$current_link/scripts/weknora-production/compose.sh" --edge \
                up -d --no-deps --force-recreate frontend || restore_status=1
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
        printf '%s\n' 'UI update failed; restoring previous source and frontend image' >&2
        restore_previous || printf '%s\n' 'automatic UI rollback also failed; inspect retained current target and deploy-previous UI tag' >&2
    fi
    if [ "$lock_held" = true ]; then
        rmdir "$lock_dir" 2>/dev/null || true
    fi
    exit "$status"
}
trap cleanup EXIT

if ! mkdir "$lock_dir" 2>/dev/null; then
    weknora_production_die 'another production update is already active'
fi
lock_held=true

old_ui_id="$(docker image inspect "$ui_image" --format '{{.Id}}')"
docker tag "$old_ui_id" "$ui_previous"

# This is intentionally the only image build on the fast path. It runs before
# traffic changes and never invokes the app/Go image target.
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    "$repo_root/scripts/weknora-production/compose.sh" build frontend

next_link="$runtime_dir/current-ui.next.$$"
ln -s "$repo_root" "$next_link"
mv -Tf "$next_link" "$current_link"
current_switched=true

frontend_recreate_started=true
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    "$current_link/scripts/weknora-production/compose.sh" --edge \
    up -d --no-deps --force-recreate frontend

wait_for_healthy() {
    local deadline=$(( $(date +%s) + 180 ))
    local health
    while [ "$(date +%s)" -lt "$deadline" ]; do
        health="$(docker inspect "$frontend_container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
        case "$health" in
            healthy) return 0 ;;
            unhealthy|exited|dead) return 1 ;;
        esac
        sleep 2
    done
    return 1
}

wait_for_healthy || weknora_production_die 'updated frontend did not become healthy'
frontend_port="$(weknora_production_require_env_value "$runtime_dir/production.env" WEKNORA_PRODUCTION_FRONTEND_PORT)"
curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/health" >/dev/null

frontend_networks="$(docker inspect "$frontend_container" --format '{{json .NetworkSettings.Networks}}')"
jq -e --arg network "$edge_network" '
    has($network) and ((.[$network].Aliases // []) | index("web")) != null
' <<<"$frontend_networks" >/dev/null || weknora_production_die 'updated frontend did not retain the public edge alias'

refresh_cutover_state || weknora_production_die 'updated frontend could not refresh the retained cutover identity'
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/health >/dev/null

completed=true
printf '%s\n' "UI update green: $repo_root is current; app, volumes, secrets and runtime configuration were untouched"
