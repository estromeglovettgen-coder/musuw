#!/usr/bin/env bash
# Verify the staged native runtime through the same loopback seam that will be
# used before public routing changes. This script never attaches an edge
# network, mutates data, sends an OIDC authorization request, or prints a
# credential.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'verify-runtime accepts no arguments'

repo_root="$(cd "$script_dir/../.." && pwd -P)"
runtime_dir="$(weknora_production_runtime_dir)"
production_env="$runtime_dir/production.env"
edge_network='musnow-production_edge'
app_container='weknora-v072-production-app'
frontend_container='weknora-v072-production-frontend'
postgres_container='weknora-v072-production-postgres'
image_tag="$(weknora_production_image_tag)"
app_image="weknora-v072-production-app:$image_tag"
frontend_image="weknora-v072-production-ui:$image_tag"
expected_version='v0.7.2'
expected_revision="$(weknora_production_revision)"

for command_name in docker curl jq grep find mktemp; do
    weknora_production_require_command "$command_name"
done
weknora_production_require_file "$production_env"
expected_migration_version="$(weknora_production_latest_versioned_migration "$repo_root")"
expected_migration_prefix="$(printf '%06d' "$expected_migration_version")"
expected_migration_path="$(find "$repo_root/weknora/migrations/versioned" -maxdepth 1 -type f -name "${expected_migration_prefix}_*.up.sql" -print -quit)"
[ -n "$expected_migration_path" ] || weknora_production_die 'release maximum versioned migration is missing its up file'
expected_migration_name="${expected_migration_path##*/}"

app_port="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_APP_PORT)"
frontend_port="$(weknora_production_require_env_value "$production_env" WEKNORA_PRODUCTION_FRONTEND_PORT)"
for port in "$app_port" "$frontend_port"; do
    if ! [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] || [ "$port" -gt 65535 ]; then
        weknora_production_die 'staged runtime port is invalid'
    fi
done

for image in "$app_image" "$frontend_image"; do
    docker image inspect "$image" >/dev/null
done

image_version="$(docker image inspect "$app_image" --format '{{ index .Config.Labels "org.opencontainers.image.version" }}')"
image_revision="$(docker image inspect "$app_image" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
if [ "$image_version" != "$expected_version" ] || [ "$image_revision" != "$expected_revision" ]; then
    weknora_production_die 'staged app image provenance does not match the selected release revision'
fi
frontend_revision="$(docker image inspect "$frontend_image" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
[ "$frontend_revision" = "$expected_revision" ] || weknora_production_die 'staged frontend image provenance does not match the selected release revision'

for container in "$app_container" "$frontend_container" "$postgres_container"; do
    docker inspect "$container" >/dev/null
    project_name="$(docker inspect "$container" --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
    [ "$project_name" = 'weknora-v072-production' ] || weknora_production_die 'staged container does not belong to the fixed native production project'
    running="$(docker inspect "$container" --format '{{.State.Running}}')"
    [ "$running" = 'true' ] || weknora_production_die 'staged native container is not running'
done

frontend_networks="$(docker inspect "$frontend_container" --format '{{json .NetworkSettings.Networks}}')"
if jq -e --arg network "$edge_network" 'has($network)' <<<"$frontend_networks" >/dev/null; then
    weknora_production_die 'staged native frontend is unexpectedly attached to the public edge'
fi

check_loopback_binding() {
    local container="$1"
    local expected_port="$2"
    local port_bindings
    port_bindings="$(docker inspect "$container" --format '{{json .NetworkSettings.Ports}}')"
    jq -e --arg expected_port "$expected_port" '
        .["8080/tcp"] | type == "array" and length == 1 and
        .[0].HostIp == "127.0.0.1" and .[0].HostPort == $expected_port
    ' <<<"$port_bindings" >/dev/null || weknora_production_die 'staged native service is not bound only to its approved loopback port'
}

check_loopback_binding "$app_container" "$app_port"
check_loopback_binding "$frontend_container" "$frontend_port"

deadline=$(( $(date +%s) + 180 ))
until app_health="$(curl -fsS --connect-timeout 2 "http://127.0.0.1:${app_port}/health")"; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
        weknora_production_die 'staged native app health did not become ready'
    fi
    sleep 2
done
grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$app_health" || weknora_production_die 'staged native app health response is invalid'

root_body="$(mktemp)"
auth_body="$(mktemp)"
oidc_body="$(mktemp)"
oidc_cookies="$(mktemp)"
trap 'rm -f "$root_body" "$auth_body" "$oidc_body" "$oidc_cookies"' EXIT

curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/" > "$root_body"
curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/auth/start" > "$auth_body"
grep -Eq "<(div|main)[^>]+id=[\"'](app|root)[\"']" "$root_body" || weknora_production_die 'native frontend root did not return its static application entry'
grep -Eq "<(div|main)[^>]+id=[\"'](app|root)[\"']" "$auth_body" || weknora_production_die 'retained auth shell did not return its static application entry'

oidc_config="$(curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/api/v1/auth/oidc/config")"
jq -e '.success == true and .enabled == true' <<<"$oidc_config" >/dev/null || weknora_production_die 'native OIDC configuration is not enabled'

# This constructs only the authorization URL and browser binding. It does not
# follow the provider, exchange a code, or disclose the generated verifier.
curl -fsS --connect-timeout 5 -c "$oidc_cookies" \
    --get --data-urlencode 'redirect_uri=https://app.musuw.com/api/v1/auth/oidc/callback' \
    "http://127.0.0.1:${frontend_port}/api/v1/auth/oidc/url" > "$oidc_body"
jq -e '
    .success == true and
    (.authorization_url | type == "string") and
    (.authorization_url | contains("code_challenge=")) and
    (.authorization_url | contains("code_challenge_method=S256"))
' "$oidc_body" >/dev/null || weknora_production_die 'native OIDC URL does not prove S256 PKCE'
grep -q 'weknora_oidc_binding' "$oidc_cookies" || weknora_production_die 'native OIDC URL did not issue an HttpOnly browser binding'

migration_state="$(docker exec "$postgres_container" sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version, dirty FROM schema_migrations"')"
if [ "$migration_state" != "${expected_migration_version}|f" ]; then
    weknora_production_die 'staged native database is not cleanly migrated to the release migration version'
fi

docker exec "$app_container" sh -ec "
    test -x /app/WeKnora
    test -f /app/migrations/versioned/$expected_migration_name
    grep -aq "0.7.2" /app/WeKnora
    grep -aq "$expected_revision" /app/WeKnora
    ! grep -aq "a47981a" /app/WeKnora
"

service_names="$(docker ps --filter label=com.docker.compose.project=weknora-v072-production --format '{{.Names}}' | sort | tr '\n' ' ')"
case "$service_names" in
    *musnow*|*Musnow*) weknora_production_die 'staged native project contains a legacy service' ;;
esac

printf '%s\n' "staged runtime green: v0.7.2 image, loopback-only native UI/app, health, static root/auth, OIDC S256 binding, migration $expected_migration_version"
