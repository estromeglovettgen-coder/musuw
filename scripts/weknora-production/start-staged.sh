#!/usr/bin/env bash
# Start the native stack without ever attaching it to the public edge network.
# Public routing is a separate, reversible operation in cutover.sh.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'start-staged accepts no arguments'

runtime_dir="$(weknora_production_runtime_dir)"
production_env="$runtime_dir/production.env"
compose="$script_dir/compose.sh"
verify_runtime="$script_dir/verify-runtime.sh"
edge_network='musnow-production_edge'
frontend_container='weknora-v072-production-frontend'
started=false
image_tag="$(weknora_production_image_tag)"

for command_name in docker jq; do
    weknora_production_require_command "$command_name"
done
for required_file in "$production_env" "$compose" "$verify_runtime"; do
    weknora_production_require_file "$required_file"
done

frontend_port="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_FRONTEND_PORT)"
app_port="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_APP_PORT)"
for port in "$frontend_port" "$app_port"; do
    if ! [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] || [ "$port" -gt 65535 ]; then
        weknora_production_die 'staged runtime port is invalid'
    fi
done

for role in postgres-data data-files docreader-tmp redis-data neo4j-data; do
    case "$role" in
        postgres-data) env_key='WEKNORA_PRODUCTION_POSTGRES_VOLUME' ;;
        data-files) env_key='WEKNORA_PRODUCTION_FILES_VOLUME' ;;
        docreader-tmp) env_key='WEKNORA_PRODUCTION_DOCREADER_TMP_VOLUME' ;;
        redis-data) env_key='WEKNORA_PRODUCTION_REDIS_VOLUME' ;;
        neo4j-data) env_key='WEKNORA_PRODUCTION_NEO4J_VOLUME' ;;
    esac
    volume_name="$(weknora_production_require_env_value "$production_env" "$env_key")"
    weknora_production_assert_exact_volume "$role" "$volume_name"
    docker volume inspect "$volume_name" >/dev/null
done

for image in \
    "weknora-v072-production-ui:$image_tag" \
    "weknora-v072-production-app:$image_tag" \
    'wechatopenai/weknora-docreader@sha256:b9c4636b65b5d4947d5e09cd311ba6cf37f1f2da37c51d4be2b911d432f12abe'; do
    docker image inspect "$image" >/dev/null
done

# A previous interrupted cutover must be rolled back explicitly. Starting a
# stack that is already reachable at the edge could otherwise hide that state.
if docker inspect "$frontend_container" >/dev/null 2>&1; then
    frontend_networks="$(docker inspect "$frontend_container" --format '{{json .NetworkSettings.Networks}}')"
    if jq -e --arg network "$edge_network" 'has($network)' <<<"$frontend_networks" >/dev/null; then
        weknora_production_die 'native frontend is already attached to the public edge; run rollback before staging again'
    fi
fi

cleanup() {
    local status=$?
    trap - EXIT
    if [ "$status" -ne 0 ] && [ "$started" = true ]; then
        # This project name is fixed by compose.sh. `stop` does not remove
        # external data volumes, images, the old stack, or any edge network.
        "$compose" stop >/dev/null 2>&1 || true
    fi
    exit "$status"
}
trap cleanup EXIT

# Never pass --edge here. The production overlay publishes only loopback ports
# until cutover.sh performs its one explicit alias handoff.
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$compose" up -d --no-build
started=true

WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$verify_runtime"

printf '%s\n' "native v0.7.2 stack is staged on 127.0.0.1:${frontend_port} and 127.0.0.1:${app_port}; public edge remains untouched"
