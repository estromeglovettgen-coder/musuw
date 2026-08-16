#!/usr/bin/env bash
# Switch only the existing Cloudflare Tunnel DNS alias from the retained old
# web container to the already-verified native frontend. The old container,
# image, configuration and data services are never stopped or removed here.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'cutover accepts no arguments'

runtime_dir="$(weknora_production_runtime_dir)"
production_env="$runtime_dir/production.env"
verify_runtime="$script_dir/verify-runtime.sh"
rollback_script="$script_dir/rollback.sh"
edge_network='musnow-production_edge'
edge_alias='web'
new_container_name='weknora-v072-production-frontend'
state_file="$runtime_dir/cutover-state.json"
lock_dir="$runtime_dir/cutover.lock"
cutover_started=false
lock_held=false

for command_name in docker jq mktemp date; do
    weknora_production_require_command "$command_name"
done
for required_file in "$production_env" "$verify_runtime" "$rollback_script"; do
    weknora_production_require_file "$required_file"
done

safe_container_id() {
    [[ "$1" =~ ^[0-9a-f]{12,64}$ ]]
}

safe_container_name() {
    [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]
}

container_networks() {
    docker inspect "$1" --format '{{json .NetworkSettings.Networks}}'
}

container_on_edge() {
    local networks
    networks="$(container_networks "$1")"
    jq -e --arg network "$edge_network" 'has($network)' <<<"$networks" >/dev/null
}

container_has_edge_alias() {
    local container="$1"
    local alias="$2"
    local networks
    networks="$(container_networks "$container")"
    jq -e --arg network "$edge_network" --arg alias "$alias" '
        ((.[$network].Aliases // []) | index($alias)) != null
    ' <<<"$networks" >/dev/null
}

edge_alias_owner() {
    local endpoint_id
    local -a matches=()

    docker network inspect "$edge_network" >/dev/null
    while IFS= read -r endpoint_id; do
        [ -n "$endpoint_id" ] || continue
        if container_has_edge_alias "$endpoint_id" "$edge_alias"; then
            matches+=("$endpoint_id")
        fi
    done < <(docker network inspect "$edge_network" --format '{{range $id, $_ := .Containers}}{{$id}}{{"\n"}}{{end}}')

    if [ "${#matches[@]}" -ne 1 ]; then
        weknora_production_die 'the existing public edge must have exactly one web alias owner before cutover'
    fi
    safe_container_id "${matches[0]}" || weknora_production_die 'existing public web identity is unsafe'
    printf '%s' "${matches[0]}"
}

write_state() {
    local old_id="$1"
    local old_name="$2"
    local old_image="$3"
    local aliases_json="$4"
    local new_id="$5"
    local state_tmp
    local now

    state_tmp="$(mktemp "$runtime_dir/cutover-state.json.XXXXXX")"
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    umask 077
    jq -n \
        --arg network "$edge_network" \
        --arg alias "$edge_alias" \
        --arg old_container_id "$old_id" \
        --arg old_container_name "$old_name" \
        --arg old_image "$old_image" \
        --argjson old_aliases "$aliases_json" \
        --arg new_container_id "$new_id" \
        --arg new_container_name "$new_container_name" \
        --arg now "$now" \
        '{
            schema: 1,
            phase: "prepared",
            network: $network,
            public_alias: $alias,
            old_container_id: $old_container_id,
            old_container_name: $old_container_name,
            old_image: $old_image,
            old_aliases: $old_aliases,
            new_container_id: $new_container_id,
            new_container_name: $new_container_name,
            prepared_at: $now,
            writes_enabled: false
        }' > "$state_tmp"
    chmod 600 "$state_tmp"
    mv "$state_tmp" "$state_file"
}

mark_phase() {
    local phase="$1"
    local state_tmp
    local now

    state_tmp="$(mktemp "$runtime_dir/cutover-state.json.XXXXXX")"
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq --arg phase "$phase" --arg now "$now" '.phase = $phase | .updated_at = $now' "$state_file" > "$state_tmp"
    chmod 600 "$state_tmp"
    mv "$state_tmp" "$state_file"
}

cleanup() {
    local status=$?
    trap - EXIT
    if [ "$lock_held" = true ]; then
        rmdir "$lock_dir" 2>/dev/null || true
        lock_held=false
    fi
    if [ "$status" -ne 0 ] && [ "$cutover_started" = true ]; then
        # The rollback script is idempotent and reads the state captured before
        # any edge mutation. It disconnects the new endpoint before restoring
        # the exact old aliases, without stopping either application stack.
        WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$rollback_script" || true
    fi
    exit "$status"
}
trap cleanup EXIT

[ -d "$runtime_dir" ] || weknora_production_die 'production runtime directory is unavailable'
[ "$(weknora_production_file_mode "$runtime_dir")" = '700' ] || weknora_production_die 'production runtime directory permissions are unsafe'

if [ -e "$state_file" ]; then
    prior_phase="$(jq -r '.phase // empty' "$state_file" 2>/dev/null || true)"
    case "$prior_phase" in
        rolled_back) ;;
        *) weknora_production_die 'a cutover state already exists; run rollback before another handoff' ;;
    esac
fi

if ! mkdir "$lock_dir" 2>/dev/null; then
    weknora_production_die 'another cutover or rollback operation is already active'
fi
lock_held=true

# The new stack remains private until this exact handoff. This gate also
# checks health, static entry points, OIDC S256 construction, and the current
# source's maximum versioned migration.
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$verify_runtime"

docker network inspect "$edge_network" >/dev/null
new_id="$(docker inspect "$new_container_name" --format '{{.Id}}')"
safe_container_id "$new_id" || weknora_production_die 'native frontend identity is unsafe'
new_project="$(docker inspect "$new_container_name" --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
[ "$new_project" = 'weknora-v072-production' ] || weknora_production_die 'native frontend is not owned by the fixed production project'
new_running="$(docker inspect "$new_container_name" --format '{{.State.Running}}')"
[ "$new_running" = 'true' ] || weknora_production_die 'native frontend is not running'
if container_on_edge "$new_id"; then
    weknora_production_die 'native frontend is already on the public edge; refusing ambiguous handoff'
fi

old_id="$(edge_alias_owner)"
[ "$old_id" != "$new_id" ] || weknora_production_die 'existing public edge unexpectedly points at the native frontend'
old_name="$(docker inspect "$old_id" --format '{{.Name}}')"
old_name="${old_name#/}"
safe_container_name "$old_name" || weknora_production_die 'existing public web container name is unsafe'
old_running="$(docker inspect "$old_id" --format '{{.State.Running}}')"
[ "$old_running" = 'true' ] || weknora_production_die 'existing public web container is not running; refusing to remove its route'
old_image="$(docker inspect "$old_id" --format '{{.Config.Image}}')"
[ -n "$old_image" ] || weknora_production_die 'existing public web image identity is unavailable'
old_networks="$(container_networks "$old_id")"
old_aliases="$(jq -c --arg network "$edge_network" '.[$network].Aliases // []' <<<"$old_networks")"
if ! jq -e --arg alias "$edge_alias" '
    type == "array" and length > 0 and index($alias) != null and
    all(.[]; type == "string" and test("^[A-Za-z0-9][A-Za-z0-9_.-]*$"))
' <<<"$old_aliases" >/dev/null; then
    weknora_production_die 'existing public web aliases are invalid for a safe rollback'
fi

write_state "$old_id" "$old_name" "$old_image" "$old_aliases" "$new_id"
cutover_started=true

# This is the only public-routing mutation. The retained old container stays
# running, but loses the external DNS alias before the native frontend gains it.
docker network disconnect "$edge_network" "$old_id"
mark_phase 'old_detached'

docker network connect --alias "$edge_alias" "$edge_network" "$new_id"
mark_phase 'new_attached'

if container_on_edge "$old_id" || ! container_on_edge "$new_id" || ! container_has_edge_alias "$new_id" "$edge_alias"; then
    weknora_production_die 'public edge alias handoff did not reach the exact expected topology'
fi

# Verify the edge DNS name from inside the new frontend's own edge attachment.
# It proves `web:8080` now resolves to the native Nginx surface without making
# an Internet request or exposing an authorization code.
docker exec "$new_id" /bin/sh -ec '
    wget -q -T 5 -O - http://web:8080/health |
      grep -q "\"status\"[[:space:]]*:[[:space:]]*\"ok\""
'

mark_phase 'cutover_active'

printf '%s\n' "public edge alias ${edge_alias} now targets native frontend ${new_container_name}; retained old web container ${old_name} remains running and recoverable"
