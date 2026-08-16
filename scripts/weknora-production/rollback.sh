#!/usr/bin/env bash
# Reattach the retained old public web container without stopping either stack.
# Safe to run repeatedly: once the old `web` alias is restored it is a no-op.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'rollback accepts no arguments'

runtime_dir="$(weknora_production_runtime_dir)"
state_file="$runtime_dir/cutover-state.json"
lock_dir="$runtime_dir/cutover.lock"
edge_network='musnow-production_edge'
edge_alias='web'
lock_held=false

for command_name in docker jq mktemp date; do
    weknora_production_require_command "$command_name"
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

container_has_all_aliases() {
    local container="$1"
    local expected_aliases="$2"
    local networks
    networks="$(container_networks "$container")"
    jq -e --arg network "$edge_network" --argjson expected "$expected_aliases" '
        (.[$network].Aliases // []) as $actual |
        $expected | all(.[]; . as $alias | ($actual | index($alias)) != null)
    ' <<<"$networks" >/dev/null
}

web_alias_owners() {
    local endpoint_id
    docker network inspect "$edge_network" >/dev/null
    while IFS= read -r endpoint_id; do
        [ -n "$endpoint_id" ] || continue
        networks="$(container_networks "$endpoint_id")"
        if jq -e --arg network "$edge_network" --arg alias "$edge_alias" '
            ((.[$network].Aliases // []) | index($alias)) != null
        ' <<<"$networks" >/dev/null; then
            printf '%s\n' "$endpoint_id"
        fi
    done < <(docker network inspect "$edge_network" --format '{{range $id, $_ := .Containers}}{{$id}}{{"\n"}}{{end}}')
}

connect_old_with_saved_aliases() {
    local old_id="$1"
    local aliases_json="$2"
    local alias
    local -a command=(docker network connect)

    while IFS= read -r alias; do
        command+=(--alias "$alias")
    done < <(jq -r '.[]' <<<"$aliases_json")
    command+=("$edge_network" "$old_id")
    "${command[@]}"
}

mark_rolled_back() {
    local state_tmp
    local now
    state_tmp="$(mktemp "$runtime_dir/cutover-state.json.XXXXXX")"
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq --arg now "$now" '.phase = "rolled_back" | .rolled_back_at = $now' "$state_file" > "$state_tmp"
    chmod 600 "$state_tmp"
    mv "$state_tmp" "$state_file"
}

cleanup() {
    local status=$?
    trap - EXIT
    if [ "$lock_held" = true ]; then
        rmdir "$lock_dir" 2>/dev/null || true
    fi
    exit "$status"
}
trap cleanup EXIT

[ -d "$runtime_dir" ] || weknora_production_die 'production runtime directory is unavailable'
[ "$(weknora_production_file_mode "$runtime_dir")" = '700' ] || weknora_production_die 'production runtime directory permissions are unsafe'

if [ ! -e "$state_file" ]; then
    printf '%s\n' 'rollback no-op: no recorded native cutover state exists'
    exit 0
fi

if ! jq -e --arg network "$edge_network" --arg alias "$edge_alias" '
    .schema == 1 and
    .network == $network and
    .public_alias == $alias and
    (.old_container_id | type == "string" and test("^[0-9a-f]{12,64}$")) and
    (.new_container_id | type == "string" and test("^[0-9a-f]{12,64}$")) and
    (.old_container_name | type == "string" and test("^[A-Za-z0-9][A-Za-z0-9_.-]*$")) and
    (.new_container_name == "weknora-v072-production-frontend") and
    (.old_image | type == "string" and length > 0) and
    (.old_aliases | type == "array" and length > 0 and index($alias) != null and
        all(.[]; type == "string" and test("^[A-Za-z0-9][A-Za-z0-9_.-]*$")))
' "$state_file" >/dev/null; then
    weknora_production_die 'cutover state is invalid; refusing an unsafe route mutation'
fi

if ! mkdir "$lock_dir" 2>/dev/null; then
    weknora_production_die 'another cutover or rollback operation is already active'
fi
lock_held=true

old_id="$(jq -r '.old_container_id' "$state_file")"
old_name="$(jq -r '.old_container_name' "$state_file")"
new_id="$(jq -r '.new_container_id' "$state_file")"
new_name="$(jq -r '.new_container_name' "$state_file")"
old_aliases="$(jq -c '.old_aliases' "$state_file")"
if ! safe_container_id "$old_id" || ! safe_container_id "$new_id" || ! safe_container_name "$old_name" || ! safe_container_name "$new_name"; then
    weknora_production_die 'cutover state identity is unsafe'
fi

docker network inspect "$edge_network" >/dev/null
docker inspect "$old_id" >/dev/null
actual_old_name="$(docker inspect "$old_id" --format '{{.Name}}')"
actual_old_name="${actual_old_name#/}"
[ "$actual_old_name" = "$old_name" ] || weknora_production_die 'retained old web identity does not match cutover state'
[ "$(docker inspect "$old_id" --format '{{.State.Running}}')" = 'true' ] || weknora_production_die 'retained old web container is not running; refusing to declare rollback complete'

# Refuse to touch an unrelated endpoint which has acquired the public alias.
while IFS= read -r owner; do
    [ -n "$owner" ] || continue
    if [ "$owner" != "$old_id" ] && [ "$owner" != "$new_id" ]; then
        weknora_production_die 'public edge has an unknown web alias owner; refusing rollback mutation'
    fi
done < <(web_alias_owners)

# Confirm the recorded native endpoint is still the intended fixed frontend
# before disconnecting it. If it no longer exists, restoring the old endpoint
# remains safe; any different replacement is deliberately left untouched.
if docker inspect "$new_id" >/dev/null 2>&1; then
    actual_new_name="$(docker inspect "$new_id" --format '{{.Name}}')"
    actual_new_name="${actual_new_name#/}"
    [ "$actual_new_name" = "$new_name" ] || weknora_production_die 'native frontend identity does not match cutover state'
    new_project="$(docker inspect "$new_id" --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
    [ "$new_project" = 'weknora-v072-production' ] || weknora_production_die 'recorded native frontend is not owned by the fixed production project'
    if container_on_edge "$new_id"; then
        docker network disconnect "$edge_network" "$new_id"
    fi
fi

# Docker cannot add aliases to an existing endpoint, so a partially restored
# old endpoint is detached and reattached only after the native endpoint is
# absent from the edge. The old container itself never stops.
if container_on_edge "$old_id" && ! container_has_all_aliases "$old_id" "$old_aliases"; then
    docker network disconnect "$edge_network" "$old_id"
fi
if ! container_on_edge "$old_id"; then
    connect_old_with_saved_aliases "$old_id" "$old_aliases"
fi

if ! container_on_edge "$old_id" || ! container_has_all_aliases "$old_id" "$old_aliases"; then
    weknora_production_die 'rollback did not restore the exact retained public web aliases'
fi
if docker inspect "$new_id" >/dev/null 2>&1 && container_on_edge "$new_id"; then
    weknora_production_die 'rollback left the native frontend attached to the public edge'
fi

mark_rolled_back
printf '%s\n' "rollback green: retained old web container ${old_name} again owns ${edge_alias}; native frontend is staged only"
