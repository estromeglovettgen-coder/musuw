#!/usr/bin/env bash
# Focused in-memory-Docker simulation for the public alias handoff. It proves
# the two safety properties this release script owns: a failed new endpoint
# restores the old route automatically, and rollback is repeatable.
set -euo pipefail

edge_network='musnow-production_edge'

fake_container_key() {
    local reference="$1"
    jq -r --arg reference "$reference" '
        .containers | to_entries[] |
        select(.key == $reference or .value.id == $reference or .value.name == $reference) | .key
    ' "$SIM_DOCKER_STATE" | head -n 1
}

fake_require_container() {
    local key
    key="$(fake_container_key "$1")"
    [ -n "$key" ] || exit 44
    printf '%s' "$key"
}

fake_update() {
    local filter="$1"
    shift
    local state_tmp
    state_tmp="$(mktemp "${SIM_DOCKER_STATE}.XXXXXX")"
    jq "$@" "$filter" "$SIM_DOCKER_STATE" > "$state_tmp"
    mv "$state_tmp" "$SIM_DOCKER_STATE"
}

fake_networks() {
    local key
    key="$(fake_require_container "$1")"
    jq -c --arg key "$key" --arg network "$edge_network" '
        .containers[$key] |
        if .edge then {($network): {Aliases: .aliases}} else {} end
    ' "$SIM_DOCKER_STATE"
}

fake_docker() {
    local command_name="${1:-}"
    shift || true
    case "$command_name" in
        network)
            case "${1:-}" in
                inspect)
                    [ "${2:-}" = "$edge_network" ] || exit 45
                    if [ "${3:-}" = '--format' ]; then
                        jq -r '.containers | to_entries[] | select(.value.edge == true) | .value.id' "$SIM_DOCKER_STATE"
                    else
                        printf '%s\n' '{}'
                    fi
                    ;;
                disconnect)
                    [ "${2:-}" = "$edge_network" ] || exit 45
                    key="$(fake_require_container "${3:-}")"
                    # shellcheck disable=SC2016 # jq variables intentionally stay literal.
                    fake_update '.containers[$key].edge = false | .containers[$key].aliases = []' --arg key "$key"
                    ;;
                connect)
                    shift
                    aliases='[]'
                    while [ "${1:-}" = '--alias' ]; do
                        alias_json="$(jq -cn --arg alias "$2" '$alias')"
                        aliases="$(jq -cn --argjson aliases "$aliases" --argjson alias "$alias_json" '$aliases + [$alias]')"
                        shift 2
                    done
                    [ "${1:-}" = "$edge_network" ] || exit 45
                    key="$(fake_require_container "${2:-}")"
                    # shellcheck disable=SC2016 # jq variables intentionally stay literal.
                    fake_update '.containers[$key].edge = true | .containers[$key].aliases = $aliases' --arg key "$key" --argjson aliases "$aliases"
                    ;;
                *) exit 45 ;;
            esac
            ;;
        inspect)
            key="$(fake_require_container "${1:-}")"
            shift
            if [ "${1:-}" != '--format' ]; then
                printf '%s\n' '{}'
                return
            fi
            case "${2:-}" in
                '{{json .NetworkSettings.Networks}}') fake_networks "$key" ;;
                '{{.Id}}') jq -r --arg key "$key" '.containers[$key].id' "$SIM_DOCKER_STATE" ;;
                '{{.Name}}') jq -r --arg key "$key" '"/" + .containers[$key].name' "$SIM_DOCKER_STATE" ;;
                '{{.Config.Image}}') jq -r --arg key "$key" '.containers[$key].image' "$SIM_DOCKER_STATE" ;;
                '{{.State.Running}}') jq -r --arg key "$key" '.containers[$key].running' "$SIM_DOCKER_STATE" ;;
                '{{ index .Config.Labels "com.docker.compose.project" }}') jq -r --arg key "$key" '.containers[$key].project' "$SIM_DOCKER_STATE" ;;
                *) exit 45 ;;
            esac
            ;;
        exec)
            [ "${SIM_EDGE_FAILURE:-0}" != '1' ]
            ;;
        *) exit 45 ;;
    esac
}

if [ "${SIM_DOCKER_MODE:-}" = 'docker' ]; then
    fake_docker "$@"
    exit
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
runtime_dir="$tmp_dir/runtime"
scripts_dir="$tmp_dir/scripts"
bin_dir="$tmp_dir/bin"
state_json="$tmp_dir/docker-state.json"
mkdir -p "$runtime_dir" "$scripts_dir" "$bin_dir"
chmod 700 "$runtime_dir"
: > "$runtime_dir/production.env"

cp "$script_dir/lib.sh" "$script_dir/cutover.sh" "$script_dir/rollback.sh" "$scripts_dir/"
ln -s /usr/bin/true "$scripts_dir/verify-runtime.sh"
ln -s "$script_dir/cutover-simulation.test.sh" "$bin_dir/docker"
chmod +x "$scripts_dir/cutover.sh" "$scripts_dir/rollback.sh"

old_id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
new_id='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

initialize_state() {
    jq -n --arg old_id "$old_id" --arg new_id "$new_id" '
        {
          containers: {
            old: {
              id: $old_id,
              name: "musnow-production-web-1",
              image: "musnow-m35-production-web:source",
              project: "musnow-production",
              running: true,
              edge: true,
              aliases: ["musnow-production-web-1", "web"]
            },
            new: {
              id: $new_id,
              name: "weknora-v072-production-frontend",
              image: "weknora-v072-production-ui:simulation",
              project: "weknora-v072-production",
              running: true,
              edge: false,
              aliases: []
            }
          }
        }
    ' > "$state_json"
}

assert_route() {
    local old_edge="$1"
    local new_edge="$2"
    jq -e --argjson old_edge "$old_edge" --argjson new_edge "$new_edge" '
        .containers.old.edge == $old_edge and
        .containers.new.edge == $new_edge and
        ((if $old_edge then .containers.old.aliases else .containers.new.aliases end) | index("web")) != null
    ' "$state_json" >/dev/null
}

export PATH="$bin_dir:$PATH"
export SIM_DOCKER_MODE=docker
export SIM_DOCKER_STATE="$state_json"
export WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir"

initialize_state
"$scripts_dir/cutover.sh" >/dev/null
assert_route false true
jq -e '.phase == "cutover_active"' "$runtime_dir/cutover-state.json" >/dev/null

"$scripts_dir/rollback.sh" >/dev/null
assert_route true false
jq -e '.phase == "rolled_back"' "$runtime_dir/cutover-state.json" >/dev/null
"$scripts_dir/rollback.sh" >/dev/null
assert_route true false

initialize_state
rm -f "$runtime_dir/cutover-state.json"
if SIM_EDGE_FAILURE=1 "$scripts_dir/cutover.sh" >/dev/null 2>&1; then
    printf '%s\n' 'expected simulated edge health failure to fail cutover' >&2
    exit 1
fi
assert_route true false
jq -e '.phase == "rolled_back"' "$runtime_dir/cutover-state.json" >/dev/null

printf '%s\n' 'cutover simulation green: handoff, repeatable rollback, automatic rollback on edge health failure'
