#!/usr/bin/env bash
# Exercise the real production transaction through deterministic Docker/curl
# adapters.  The adapters model process/network state only; candidate config is
# still produced by the real prepare-runtime.sh and Compose is rendered by the
# real release-compose.sh interface.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

revision_a='0123456789abcdef0123456789abcdef01234567'
revision_b='89abcdef0123456789abcdef0123456789abcdef'
old_edge_id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
old_app_id='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
old_worker_id='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
postgres_id='dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
orphan_worker_id='eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

fail() { printf '%s\n' "$1" >&2; exit 1; }

# Exercise the real production entrypoint before installing Docker adapters.
# Split roles must prove access to the shared data directories without running
# the legacy recursive chown/skills merge.  The test root is dual-gated and is
# never forwarded by the production workflow or forced command. A temporary
# skip is available only while the iCloud-backed entrypoint file is dataless;
# it never changes production behavior and lets transaction-only cases run.
if [ "${MUSUW_RELEASE_TX_SKIP_ENTRYPOINT_TEST:-0}" != 1 ]; then
entrypoint_root="$tmp_dir/entrypoint-root"
entrypoint_bin="$tmp_dir/entrypoint-bin"
entrypoint_log="$tmp_dir/entrypoint.log"
entrypoint_marker="$tmp_dir/upstream-mutated"
mkdir -p "$entrypoint_root/run/secrets" "$entrypoint_root/data/files" \
    "$entrypoint_root/app/skills/preloaded" "$entrypoint_root/app/scripts" "$entrypoint_bin"
for secret in db_password redis_password jwt_secret oidc_client_id oidc_client_secret deepseek_api_key openrouter_api_key; do
    printf '%s' fixture-secret > "$entrypoint_root/run/secrets/$secret"
done
printf '%s' 0123456789abcdef0123456789abcdef > "$entrypoint_root/run/secrets/system_aes_key"
printf '%s' neo4j/password > "$entrypoint_root/run/secrets/neo4j_auth"
cat > "$entrypoint_bin/gosu" <<'EOF'
#!/bin/sh
set -eu
printf 'gosu:%s\n' "$*" >> "$ENTRYPOINT_GOSU_LOG"
[ "$1" = appuser ] || exit 91
shift
if [ "${1:-}" = test ] && [ "${2:-}" = -w ] && [ "${3:-}" = "${ENTRYPOINT_DENY_PATH:-}" ]; then
    exit 1
fi
exec "$@"
EOF
cat > "$entrypoint_root/app/scripts/docker-entrypoint.sh" <<'EOF'
#!/bin/sh
set -eu
printf '%s\n' upstream >> "$ENTRYPOINT_UPSTREAM_MARKER"
exit 0
EOF
chmod +x "$entrypoint_bin/gosu" "$entrypoint_root/app/scripts/docker-entrypoint.sh"

for role in prepare web worker; do
    : > "$entrypoint_log"
    rm -f "$entrypoint_marker"
    PATH="$entrypoint_bin:/usr/bin:/bin" \
    MUSUW_DEPLOY_GATE_TEST_MODE=1 \
    WEKNORA_ENTRYPOINT_TEST_ROOT="$entrypoint_root" \
    WEKNORA_RUNTIME_ROLE="$role" \
    ENTRYPOINT_GOSU_LOG="$entrypoint_log" \
    ENTRYPOINT_UPSTREAM_MARKER="$entrypoint_marker" \
        "$repo_root/integration/weknora-production/app-entrypoint.sh" /usr/bin/true || \
        fail "split entrypoint rejected a valid $role runtime"
    [ ! -e "$entrypoint_marker" ] || fail "split $role runtime executed the mutating upstream entrypoint"
    grep -Fq 'gosu:appuser /usr/bin/true' "$entrypoint_log" || fail "split $role runtime did not directly drop privileges"
done

: > "$entrypoint_log"
rm -f "$entrypoint_marker"
PATH="$entrypoint_bin:/usr/bin:/bin" \
MUSUW_DEPLOY_GATE_TEST_MODE=1 \
WEKNORA_ENTRYPOINT_TEST_ROOT="$entrypoint_root" \
WEKNORA_RUNTIME_ROLE=all \
ENTRYPOINT_GOSU_LOG="$entrypoint_log" \
ENTRYPOINT_UPSTREAM_MARKER="$entrypoint_marker" \
    "$repo_root/integration/weknora-production/app-entrypoint.sh" /usr/bin/true || \
    fail 'legacy all entrypoint failed'
[ -e "$entrypoint_marker" ] || fail 'legacy all runtime bypassed the upstream compatibility entrypoint'

rmdir "$entrypoint_root/data/files"
if PATH="$entrypoint_bin:/usr/bin:/bin" \
   MUSUW_DEPLOY_GATE_TEST_MODE=1 \
   WEKNORA_ENTRYPOINT_TEST_ROOT="$entrypoint_root" \
   WEKNORA_RUNTIME_ROLE=web \
   ENTRYPOINT_GOSU_LOG="$entrypoint_log" \
   ENTRYPOINT_UPSTREAM_MARKER="$entrypoint_marker" \
       "$repo_root/integration/weknora-production/app-entrypoint.sh" /usr/bin/true 2>/dev/null; then
    fail 'split entrypoint accepted a missing shared data directory'
fi
mkdir -p "$entrypoint_root/data/files"
set +e
PATH="$entrypoint_bin:/usr/bin:/bin" \
MUSUW_DEPLOY_GATE_TEST_MODE=1 \
WEKNORA_ENTRYPOINT_TEST_ROOT="$entrypoint_root" \
WEKNORA_RUNTIME_ROLE=invalid \
ENTRYPOINT_GOSU_LOG="$entrypoint_log" \
ENTRYPOINT_UPSTREAM_MARKER="$entrypoint_marker" \
    "$repo_root/integration/weknora-production/app-entrypoint.sh" /usr/bin/true >/dev/null 2>&1
entrypoint_invalid_status=$?
set -e
[ "$entrypoint_invalid_status" -eq 2 ] || fail 'entrypoint invalid role did not fail with exit code 2 before startup'
fi

write_compose_env() {
    local target="$1"
    cat > "$target" <<'EOF'
WEKNORA_PRODUCTION_RELEASE_ID=weknora-v072-production
WEKNORA_PRODUCTION_FRONTEND_PORT=4191
WEKNORA_PRODUCTION_APP_PORT=18091
WEKNORA_PRODUCTION_POSTGRES_VOLUME=weknora-v072-production-postgres-data
WEKNORA_PRODUCTION_FILES_VOLUME=weknora-v072-production-data-files
WEKNORA_PRODUCTION_DOCREADER_TMP_VOLUME=weknora-v072-production-docreader-tmp
WEKNORA_PRODUCTION_REDIS_VOLUME=weknora-v072-production-redis-data
WEKNORA_PRODUCTION_NEO4J_VOLUME=weknora-v072-production-neo4j-data
WEKNORA_PRODUCTION_SEARXNG_CONFIG_VOLUME=weknora-v072-production-searxng-config
DB_USER=weknora
DB_NAME=WeKnora
APP_EXTERNAL_URL=https://app.musuw.com
FRONTEND_BASE_URL=https://app.musuw.com
MAX_FILE_SIZE_MB=99
WEKNORA_PRODUCTION_SECRET_DIR=/opt/weknora/runtime/secrets
EOF
    chmod 600 "$target"
}

render_compose() {
    local revision="$1" output="$2" fixture
    fixture="$tmp_dir/compose-$revision"
    mkdir -p "$fixture/runtime" "$fixture/candidate"
    write_compose_env "$fixture/candidate/production.env"
    WEKNORA_PRODUCTION_RUNTIME_DIR="$fixture/runtime" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$fixture/candidate" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" config --format json > "$output"
}

compose_a="$tmp_dir/compose-a.json"
compose_b="$tmp_dir/compose-b.json"
render_compose "$revision_a" "$compose_a"
render_compose "$revision_b" "$compose_b"
jq -e '
    .services.web.build.args.COMMIT_ID_ARG == "0123456789abcdef0123456789abcdef01234567" and
    .services.frontend.environment.APP_HOST == .services.web.container_name and
    .services.frontend.environment.APP_HOST == "musuw-r-0123456789ab-web" and
    (.services.web.networks | keys) == ["release"] and
    (.services.frontend.networks | keys) == ["release"] and
    .networks.release.name == "musuw-r-0123456789ab-private" and
    .networks.release.external != true and .networks.data.external == true and
    ([.services.web.networks[]?.aliases[]?] | index("web") == null)
' "$compose_a" >/dev/null || fail 'release A Compose config does not isolate frontend-to-web DNS'
jq -e '
    .services.web.build.args.COMMIT_ID_ARG == "89abcdef0123456789abcdef0123456789abcdef" and
    .services.frontend.environment.APP_HOST == .services.web.container_name and
    .services.frontend.environment.APP_HOST == "musuw-r-89abcdef0123-web" and
    (.services.web.networks | keys) == ["release"] and
    (.services.frontend.networks | keys) == ["release"] and
    .networks.release.name == "musuw-r-89abcdef0123-private" and
    .networks.release.external != true and .networks.data.external == true and
    ([.services.web.networks[]?.aliases[]?] | index("web") == null)
' "$compose_b" >/dev/null || fail 'release B Compose config does not isolate frontend-to-web DNS'
[ "$(jq -r '.services.frontend.environment.APP_HOST' "$compose_a")" != "$(jq -r '.services.frontend.environment.APP_HOST' "$compose_b")" ] || \
    fail 'successive release projects share a web DNS identity'

# The dedicated production Dockerfile receives COMMIT_ID_ARG from Compose,
# exports it as COMMIT_ID, and invokes this real Make target. Adapt only the
# final Go command to prove the full revision reaches handler.CommitID's linker
# assignment without building the whole image in this deterministic harness.
revision_probe_bin="$tmp_dir/revision-probe-bin"
revision_link_log="$tmp_dir/revision-link.log"
mkdir -p "$revision_probe_bin"
cat > "$revision_probe_bin/go" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = version ]; then
    printf '%s\n' 'go version go1.26 fixture/amd64'
else
    printf '%s\n' "$*" >> "$REVISION_LINK_LOG"
fi
EOF
chmod +x "$revision_probe_bin/go"
(
    cd "$repo_root/weknora"
    PATH="$revision_probe_bin:$PATH" REVISION_LINK_LOG="$revision_link_log" \
    COMMIT_ID="$revision_a" make -s build-prod
)
grep -F "github.com/Tencent/WeKnora/internal/handler.CommitID=$revision_a" "$revision_link_log" >/dev/null || \
    fail 'make build-prod truncated the immutable revision in Go ldflags'

revision_64='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
if WEKNORA_PRODUCTION_REVISION="$revision_64" bash -c \
    '. "$1"; weknora_production_revision >/dev/null' bash "$script_dir/lib.sh" 2>/dev/null; then
    fail 'release revision contract accepted a 64-hex digest that split runtime roles reject'
fi
if render_compose "$revision_64" "$tmp_dir/compose-64.json" 2>/dev/null; then
    fail 'release Compose accepted a 64-hex revision that its split runtime cannot start'
fi

fake_bin="$tmp_dir/fake-bin"
mkdir -p "$fake_bin"

cat > "$fake_bin/mv" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = -Tf ]; then
    if /bin/mv --version >/dev/null 2>&1; then
        exec /bin/mv -Tf "$2" "$3"
    fi
    exec /bin/mv -fh "$2" "$3"
fi
exec /bin/mv "$@"
EOF

cat > "$fake_bin/df" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on'
if [ "${SIM_FAIL_PHASE:-}" = disk ]; then
    printf '%s\n' '/dev/fake 20000000 19999999 1 100% /'
else
    printf '%s\n' '/dev/fake 50000000 1000000 49000000 2% /'
fi
EOF

cat > "$fake_bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'curl:%s\n' "$*" >> "$FAKE_DOCKER_LOG"
url=''
include_headers=false
for argument in "$@"; do
    case "$argument" in
        -i) include_headers=true ;;
        http://*|https://*) url="$argument" ;;
    esac
done
[ -n "$url" ] || exit 2

web_readyz() {
    jq -cn --arg revision "$WEKNORA_PRODUCTION_REVISION" '{
      status:"ready",role:"web",revision:$revision,accepting_traffic:true,
      release_marker:$revision,
      dependencies:{revision:"ready",database:"ready",redis:"ready",storage:"ready",duckdb:"ready",system_settings_subscriber:"ready",im_routes:"ready",http_listener:"ready"}
    }'
}

if [ "$url" = 'https://app.musuw.com/readyz' ]; then
    edge_owner="$(cat "$FAKE_DOCKER_STATE/edge_owner")"
    edge_project="$(cat "$FAKE_DOCKER_STATE/containers/$edge_owner/project")"
    if [ "${SIM_FAIL_PHASE:-}" = public ] && [[ "$edge_project" == musuw-r-* ]]; then
        exit 22
    fi
    web_readyz
elif [[ "$url" == */readyz ]]; then
    web_readyz
elif [[ "$url" == */api/v1/auth/oidc/config ]]; then
    printf '%s\n' '{"success":true,"enabled":true}'
elif [[ "$url" == */api/v1/auth/oidc/url ]]; then
    if [ "$include_headers" = true ]; then
        printf '%s\r\n' 'HTTP/1.1 200 OK'
        printf '%s\r\n' 'Content-Type: application/json'
        printf '%s\r\n' 'Set-Cookie: weknora_oidc_binding=fixture-binding; Path=/; Secure; HttpOnly; SameSite=Lax'
        printf '\r\n'
    fi
    printf '%s\n' '{"success":true,"authorization_url":"https://identity.example.test/authorize?code_challenge=fixture&code_challenge_method=S256"}'
elif [[ "$url" == */health ]]; then
    printf '%s\n' '{"status":"ok"}'
elif [[ "$url" == */auth/start ]]; then
    printf '%s\n' '<html><main id="root"></main></html>'
elif [[ "$url" == http://127.0.0.1:* || "$url" = 'https://app.musuw.com/' ]]; then
    printf '%s\n' '<html><main id="root"></main></html>'
else
    exit 22
fi
EOF

cat > "$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state="$FAKE_DOCKER_STATE"
log="$FAKE_DOCKER_LOG"
printf 'docker:%s\n' "$*" >> "$log"

hash_value() {
    printf '%s' "$1" | sha256sum | awk '{print $1}'
}

resolve_container() {
    local ref="$1" directory
    if [ -d "$state/containers/$ref" ]; then
        printf '%s' "$ref"
        return 0
    fi
    for directory in "$state"/containers/*; do
        [ -d "$directory" ] || continue
        if [ "$(cat "$directory/name")" = "$ref" ]; then
            basename "$directory"
            return 0
        fi
    done
    return 1
}

create_container() {
    local role="$1" project="$WEKNORA_RELEASE_PROJECT" revision="$WEKNORA_PRODUCTION_REVISION"
    local id name image image_id directory
    id="$(hash_value "$revision-$role")"
    name="$project-$role"
    case "$role" in
        frontend) image="$project-frontend:$revision" ;;
        *) image="$project-web:$revision" ;;
    esac
    image_id="sha256:$(hash_value "$image")"
    directory="$state/containers/$id"
    mkdir -p "$directory"
    printf '%s' "$name" > "$directory/name"
    printf '%s' "$role" > "$directory/service"
    printf '%s' "$project" > "$directory/project"
    printf '%s' "$image" > "$directory/image"
    printf '%s' "$image_id" > "$directory/image_id"
    printf '%s' false > "$directory/running"
    printf '%s' healthy > "$directory/health"
    printf '%s' "$revision" > "$directory/revision"
    printf '%s' false > "$directory/data_connected"
    case "$role" in
        web|frontend) printf '%s' true > "$directory/release_connected" ;;
        *) printf '%s' false > "$directory/release_connected" ;;
    esac
}

container_networks() {
    local id="$1" name service project edge data_connected release_connected networks
    name="$(cat "$state/containers/$id/name")"
    service="$(cat "$state/containers/$id/service")"
    project="$(cat "$state/containers/$id/project")"
    edge="$(cat "$state/edge_owner")"
    data_connected="$(cat "$state/containers/$id/data_connected")"
    release_connected="$(cat "$state/containers/$id/release_connected")"
    networks='{}'
    if [ "$release_connected" = true ]; then
        networks="$(jq -cn --argjson all "$networks" --arg network "$project-private" --arg name "$name" --arg service "$service" \
            '$all + {($network): {Aliases:[$name,$service]}}')"
    fi
    if [ "$data_connected" = true ]; then
        networks="$(jq -cn --argjson all "$networks" --arg name "$name" \
            '$all + {"weknora-v072-production-internal": {Aliases:[$name]}}')"
    fi
    if [ "$edge" = "$id" ]; then
        networks="$(jq -cn --argjson all "$networks" --arg name "$name" \
            '$all + {"musnow-production_edge": {Aliases:[$name,"web"]}}')"
    fi
    printf '%s\n' "$networks"
}

case "${1:-}" in
    info)
        printf '%s\n' "$state/docker-root"
        ;;
    volume)
        [ "${2:-}" = inspect ]
        ;;
    image)
        [ "${2:-}" = inspect ]
        ref="${3:-}"
        format=''
        [ "${4:-}" = --format ] && format="${5:-}"
        case "$format" in
            '{{.Id}}')
                if [[ "$ref" == sha256:* ]]; then printf '%s\n' "$ref"; else printf 'sha256:%s\n' "$(hash_value "$ref")"; fi
                ;;
            *org.opencontainers.image.revision*)
                if [[ "$ref" == legacy-* ]]; then
                    printf '\n'
                elif [ "${SIM_FAIL_PHASE:-}" != image_label ]; then
                    printf '%s\n' "${ref##*:}"
                fi
                ;;
            *RepoDigests*) printf 'fixture@sha256:%s\n' "$(hash_value "$ref")" ;;
            '') ;;
            *) exit 1 ;;
        esac
        ;;
    inspect)
        ref="${2:-}"
        id="$(resolve_container "$ref")" || exit 1
        format=''
        [ "${3:-}" = --format ] && format="${4:-}"
        directory="$state/containers/$id"
        case "$format" in
            '') ;;
            '{{.Id}}') printf '%s\n' "$id" ;;
            '{{.Name}}') printf '/%s\n' "$(cat "$directory/name")" ;;
            '{{ index .Config.Labels "com.docker.compose.service" }}') cat "$directory/service"; printf '\n' ;;
            '{{ index .Config.Labels "com.docker.compose.project" }}') cat "$directory/project"; printf '\n' ;;
            '{{.Config.Image}}') cat "$directory/image"; printf '\n' ;;
            '{{.State.Running}}') cat "$directory/running"; printf '\n' ;;
            '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}') cat "$directory/health"; printf '\n' ;;
            '{{.Image}}') cat "$directory/image_id"; printf '\n' ;;
            '{{json .NetworkSettings.Networks}}') container_networks "$id" ;;
            *) printf 'unsupported docker inspect format: %s\n' "$format" >&2; exit 1 ;;
        esac
        ;;
    ps)
        project=''
        service=''
        for argument in "$@"; do
            case "$argument" in
                label=com.docker.compose.project=*) project="${argument##*=}" ;;
                label=com.docker.compose.service=*) service="${argument##*=}" ;;
            esac
        done
        for directory in "$state"/containers/*; do
            [ -d "$directory" ] || continue
            [ -z "$project" ] || [ "$(cat "$directory/project")" = "$project" ] || continue
            [ -z "$service" ] || [ "$(cat "$directory/service")" = "$service" ] || continue
            if [[ " $* " == *' -q '* ]] || [[ " $* " == *' -aq '* ]]; then
                basename "$directory"
            else
                cat "$directory/name"; printf '\n'
            fi
        done
        ;;
    network)
        action="${2:-}"
        case "$action" in
            inspect)
                network="${3:-}"
                case "$network" in
                    musnow-production_edge|weknora-v072-production-internal) ;;
                    *) exit 1 ;;
                esac
                if [ "$network" = musnow-production_edge ] && [[ " $* " == *' --format '* ]]; then
                    cat "$state/edge_owner"; printf '\n'
                fi
                ;;
            disconnect)
                network="${@: -2:1}"
                ref="${@: -1}"
                id="$(resolve_container "$ref")" || exit 1
                [ "$(cat "$state/edge_owner")" = "$id" ] || exit 1
                : > "$state/edge_owner"
                ;;
            connect)
                network="${@: -2:1}"
                ref="${@: -1}"
                id="$(resolve_container "$ref")" || exit 1
                project="$(cat "$state/containers/$id/project")"
                case "$network" in
                    musnow-production_edge)
                        if [ "${SIM_FAIL_PHASE:-}" = cutover ] && [[ "$project" == musuw-r-* ]]; then
                            exit 1
                        fi
                        printf '%s' "$id" > "$state/edge_owner"
                        ;;
                    weknora-v072-production-internal)
                        printf '%s' true > "$state/containers/$id/data_connected"
                        ;;
                    *) exit 1 ;;
                esac
                ;;
            *) exit 1 ;;
        esac
        ;;
    compose)
        command_name=''
        for argument in "$@"; do
            case "$argument" in build|run|create|start|config) command_name="$argument"; break ;; esac
        done
        case "$command_name" in
            build)
                [ "${SIM_FAIL_PHASE:-}" != build ] || exit 1
                : > "$state/images-built"
                ;;
            run)
                [ "${SIM_FAIL_PHASE:-}" != prepare ] || exit 1
                ;;
            create)
                if [[ " $* " == *' web frontend'* ]]; then
                    create_container web
                    create_container frontend
                    [ "${SIM_FAIL_PHASE:-}" != stage ] || exit 1
                elif [[ " $* " == *' worker'* ]]; then
                    create_container worker
                else
                    exit 1
                fi
                ;;
            start)
                if [[ " $* " == *' web frontend'* ]]; then
                    for role in web frontend; do
                        id="$(resolve_container "$WEKNORA_RELEASE_PROJECT-$role")" || exit 1
                        printf '%s' true > "$state/containers/$id/running"
                    done
                elif [[ " $* " == *' worker'* ]]; then
                    id="$(resolve_container "$WEKNORA_RELEASE_PROJECT-worker")" || exit 1
                    printf '%s' true > "$state/containers/$id/running"
                    [ "${SIM_FAIL_PHASE:-}" != worker ] || exit 1
                else
                    exit 1
                fi
                ;;
            *) exit 1 ;;
        esac
        ;;
    stop)
        ref="${@: -1}"
        id="$(resolve_container "$ref")" || exit 1
        role="$(cat "$state/containers/$id/service")"
        project="$(cat "$state/containers/$id/project")"
        if [ -n "${SIM_STOP_FAIL_ROLE:-}" ] && [ "$SIM_STOP_FAIL_ROLE" = "$role" ] && [[ "$project" == musuw-r-* ]]; then
            printf 'docker-stop-failed:%s\n' "$id" >> "$log"
            exit 1
        fi
        printf '%s' false > "$state/containers/$id/running"
        ;;
    start)
        id="$(resolve_container "${2:-}")" || exit 1
        printf '%s' true > "$state/containers/$id/running"
        ;;
    exec)
        if [[ " $* " == *schema_migrations* ]]; then
            printf '%s\n' '1|f'
        elif [[ " $* " == *PLATFORM_MODEL_CATALOG_SQL* ]] || [[ " $* " == *'FROM models'* ]]; then
            printf '%s\n' '6'
        elif [[ " $* " == *127.0.0.1:8081/readyz* ]]; then
            jq -cn --arg revision "$WEKNORA_PRODUCTION_REVISION" '{
              status:"ready",role:"worker",revision:$revision,accepting_traffic:false,
              release_marker:$revision,
              dependencies:{revision:"ready",database:"ready",redis:"ready",storage:"ready",duckdb:"ready",asynq:"ready",datasource_scheduler:"ready",temporary_cleanup:"ready",housekeeping:"ready",audit_retention:"ready",wiki_recovery:"ready",im_background:"disabled",interrupted_task_reset:"ready",worker_listener:"ready"}
            }'
        else
            exit 1
        fi
        ;;
    *)
        printf 'unsupported docker command: %s\n' "$*" >&2
        exit 1
        ;;
esac
EOF

chmod +x "$fake_bin/docker" "$fake_bin/curl" "$fake_bin/df" "$fake_bin/mv"

# A Linux production host guarantees flock but not the macOS-only lockf
# utility. Keep an isolated command path to prove flock-only preflight works.
lock_only_bin="$tmp_dir/lock-only-bin"
mkdir -p "$lock_only_bin"
for command_name in bash sh env jq mktemp date readlink ln cp install find grep awk head df cmp sync sha256sum sort stat sleep wc tr dirname basename chmod mkdir rm rmdir cut cat; do
    command_path="$(command -v "$command_name")"
    [ -n "$command_path" ] || fail "lock-only command is unavailable: $command_name"
    ln -s "$command_path" "$lock_only_bin/$command_name"
done
for command_name in docker curl mv; do ln -s "$fake_bin/$command_name" "$lock_only_bin/$command_name"; done
cat > "$lock_only_bin/flock" <<'EOF'
#!/bin/sh
exec /usr/bin/lockf -s -t 0 9
EOF
chmod +x "$lock_only_bin/flock"

write_public_env() {
    local target="$1" max_file_size="$2" supabase_host="$3"
    cat > "$target" <<EOF
WEKNORA_PRODUCTION_RELEASE_ID=weknora-v072-production
WEKNORA_PRODUCTION_FRONTEND_PORT=4191
WEKNORA_PRODUCTION_APP_PORT=18091
WEKNORA_PRODUCTION_POSTGRES_VOLUME=weknora-v072-production-postgres-data
WEKNORA_PRODUCTION_FILES_VOLUME=weknora-v072-production-data-files
WEKNORA_PRODUCTION_DOCREADER_TMP_VOLUME=weknora-v072-production-docreader-tmp
WEKNORA_PRODUCTION_REDIS_VOLUME=weknora-v072-production-redis-data
WEKNORA_PRODUCTION_NEO4J_VOLUME=weknora-v072-production-neo4j-data
WEKNORA_PRODUCTION_SEARXNG_CONFIG_VOLUME=weknora-v072-production-searxng-config
WEKNORA_PRODUCTION_SEARXNG_PORT=8891
DB_DRIVER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=weknora
DB_NAME=WeKnora
REDIS_ADDR=redis:6379
STREAM_MANAGER_TYPE=redis
REDIS_DB=0
REDIS_PREFIX=stream:
WEKNORA_REDIS_NAMESPACE=weknora-v072-production
NEO4J_ENABLE=true
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
STORAGE_TYPE=local
LOCAL_STORAGE_BASE_DIR=/data/files
MAX_FILE_SIZE_MB=$max_file_size
GIN_MODE=release
LOG_LEVEL=info
TZ=Asia/Shanghai
AUTO_MIGRATE=true
AUTO_RECOVER_DIRTY=true
DISABLE_REGISTRATION=true
WEKNORA_AUTH_DEFAULT_TENANT_MODE=create_personal
APP_EXTERNAL_URL=https://app.musuw.com
FRONTEND_BASE_URL=https://app.musuw.com
OIDC_AUTH_ENABLE=true
OIDC_AUTH_ISSUER_URL=https://$supabase_host/auth/v1
OIDC_AUTH_DISCOVERY_URL=https://$supabase_host/auth/v1/.well-known/openid-configuration
OIDC_AUTH_PROVIDER_DISPLAY_NAME=Musuw
OIDC_AUTH_SCOPES=openid profile email
OIDC_USER_INFO_MAPPING_USER_NAME=name
OIDC_USER_INFO_MAPPING_EMAIL=email
DOCREADER_ADDR=docreader:50051
DOCREADER_TRANSPORT=grpc
EOF
    chmod 600 "$target"
}

write_auth_env() {
    local target="$1" client_id="$2" supabase_host="$3"
    cat > "$target" <<EOF
VITE_AUTH_PUBLIC_ORIGIN=https://app.musuw.com
VITE_SUPABASE_URL=https://$supabase_host
VITE_SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key
VITE_WEKNORA_OAUTH_CLIENT_ID=$client_id
EOF
    chmod 600 "$target"
}

write_container_record() {
    local state="$1" id="$2" name="$3" service="$4" project="$5" image="$6"
    local directory
    directory="$state/containers/$id"
    mkdir -p "$directory"
    printf '%s' "$name" > "$directory/name"
    printf '%s' "$service" > "$directory/service"
    printf '%s' "$project" > "$directory/project"
    printf '%s' "$image" > "$directory/image"
    printf 'sha256:%s' "$id" > "$directory/image_id"
    printf '%s' true > "$directory/running"
    printf '%s' healthy > "$directory/health"
    printf '%s' old > "$directory/revision"
    printf '%s' true > "$directory/data_connected"
    printf '%s' false > "$directory/release_connected"
}

make_release_source() {
    local target="$1" max_file_size="$2"
    mkdir -p "$target/scripts/weknora-production" "$target/integration/weknora-production" \
        "$target/deploy" "$target/weknora/migrations/versioned"
    cp "$script_dir/lib.sh" "$script_dir/prepare-runtime.sh" "$script_dir/release-compose.sh" \
        "$script_dir/release-transaction.sh" "$script_dir/source-manifest.sh" "$target/scripts/weknora-production/"
    cp "$repo_root/integration/weknora-production/compose.release.yaml" \
        "$target/integration/weknora-production/compose.release.yaml"
    chmod +x "$target/scripts/weknora-production/"*.sh
    printf '%s\n' 'SELECT 1;' > "$target/weknora/migrations/versioned/000001_fixture.up.sql"
    printf '%s\n' 'SELECT 1;' > "$target/weknora/migrations/versioned/000001_fixture.down.sql"
    printf '%s\n' 'fixture-manifest' > "$target/deploy/source-manifest.sha256"
    write_public_env "$target/deploy/production.public.env" "$max_file_size" candidate.supabase.test
    write_auth_env "$target/deploy/auth-public.env" candidate-client candidate.supabase.test

    # Materialized v2 candidates carry a complete source/release manifest so a
    # later predecessor must pass strict content verification. Exclude the
    # three generated manifest files themselves from the source index.
    : > "$target/deploy/source-manifest.sha256"
    while IFS= read -r -d '' path; do
        relative="${path#"$target/"}"
        case "$relative" in
            deploy/source-manifest.sha256|deploy/release-manifest.json|deploy/release-manifest.json.sha256) continue ;;
        esac
        printf '%s  %s\n' "$(sha256sum "$path" | awk '{print $1}')" "$relative" >> "$target/deploy/source-manifest.sha256"
    done < <(find "$target" -type f -print0 | LC_ALL=C sort -z)
    bundle_sha="$(sha256sum "$target/deploy/source-manifest.sha256" | awk '{print $1}')"
    file_count="$(wc -l < "$target/deploy/source-manifest.sha256" | tr -d ' ')"
    source_bytes=0
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        relative="${line#*  }"
        bytes="$(wc -c < "$target/$relative" | tr -d ' ')"
        source_bytes=$((source_bytes + bytes))
    done < "$target/deploy/source-manifest.sha256"
    jq -n --arg revision "$revision_a" --arg bundle_sha "$bundle_sha" --argjson file_count "$file_count" --argjson bytes "$source_bytes" \
        '{schema_version:"musuw.source-bundle.v1",release_id:"weknora-v072-production",revision:$revision,mode:"update",source_bundle_sha256:$bundle_sha,source_file_count:$file_count,source_bytes:$bytes}' \
        > "$target/deploy/release-manifest.json"
    sha256sum "$target/deploy/release-manifest.json" > "$target/deploy/release-manifest.json.sha256"
}

init_case() {
    local name="$1" case_root runtime state old_source
    case_root="$tmp_dir/case-$name"
    runtime="$case_root/opt/weknora/runtime"
    state="$case_root/fake-docker"
    old_source="$case_root/opt/weknora/releases/legacy/source"
    mkdir -p "$runtime/secrets" "$state/containers" "$state/docker-root" \
        "$old_source/weknora/migrations/versioned"
    chmod 700 "$runtime" "$runtime/secrets"
    printf '%s\n' 'SELECT 1;' > "$old_source/weknora/migrations/versioned/000001_fixture.up.sql"
    printf '%s\n' 'SELECT 1;' > "$old_source/weknora/migrations/versioned/000001_fixture.down.sql"
    ln -s "$old_source" "$case_root/opt/weknora/current"
    write_public_env "$runtime/production.public.env" 41 runtime-drift.supabase.test
    write_auth_env "$runtime/auth-public.env" runtime-drift-client runtime-drift.supabase.test
    printf '%s\n' 'CURRENT_CONFIG=runtime-drift' > "$runtime/production.env"
    chmod 600 "$runtime/production.env"

    printf '%s' database-password > "$runtime/secrets/db_password"
    printf '%s' redis-password > "$runtime/secrets/redis_password"
    printf '%s' 0123456789abcdef0123456789abcdef > "$runtime/secrets/system_aes_key"
    printf '%s' jwt-secret > "$runtime/secrets/jwt_secret"
    printf '%s' neo4j/password > "$runtime/secrets/neo4j_auth"
    printf '%s' candidate-client > "$runtime/secrets/oidc_client_id"
    printf '%s' candidate-client-secret > "$runtime/secrets/oidc_client_secret"
    printf '%s' searxng-secret > "$runtime/secrets/searxng_secret"
    printf '%s' deepseek-key > "$runtime/secrets/deepseek_api_key"
    printf '%s' openrouter-key > "$runtime/secrets/openrouter_api_key"
    chmod 600 "$runtime/secrets/"*

    # The edge owner is intentionally unlabeled as a role while retaining the
    # observed native project. This covers first-release normalization without
    # fabricating a service label; app and worker remain labeled owners.
    write_container_record "$state" "$old_edge_id" legacy-native-frontend '' weknora-v072-production legacy-ui:old
    write_container_record "$state" "$old_app_id" legacy-native-app app weknora-v072-production legacy-app:old
    write_container_record "$state" "$old_worker_id" legacy-native-worker worker weknora-v072-production legacy-app:old
    write_container_record "$state" "$postgres_id" weknora-v072-production-postgres postgres weknora-v072-production postgres:old
    printf '%s' "$old_edge_id" > "$state/edge_owner"
    : > "$case_root/docker.log"
    printf '%s' "$case_root"
}

run_transaction() {
    local case_root="$1" release_id="$2" revision="$3" expected="$4" phase="${5:-}" stop_fail_role="${6:-}"
    local source runtime
    source="$case_root/opt/weknora/releases/$release_id/source"
    runtime="$case_root/opt/weknora/runtime"
    local -a command=(env
        PATH="${MUSUW_RELEASE_TX_TEST_PATH:-$fake_bin:/usr/bin:/bin:/usr/sbin:/sbin}"
        MUSUW_DEPLOY_GATE_TEST_MODE=1
        MUSUW_DEPLOY_GATE_ROOT="$case_root"
        WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime"
        WEKNORA_PRODUCTION_RELEASE_ID="$release_id"
        WEKNORA_PRODUCTION_REVISION="$revision"
        WEKNORA_PRODUCTION_MIN_FREE_KIB=10
        WEKNORA_PRODUCTION_TRANSACTION_TEST_FAULT="${phase/commit/commit_after_ledger}"
        FAKE_DOCKER_STATE="$case_root/fake-docker"
        FAKE_DOCKER_LOG="$case_root/docker.log"
        SIM_FAIL_PHASE="$phase"
        SIM_STOP_FAIL_ROLE="$stop_fail_role"
        "$source/scripts/weknora-production/release-transaction.sh")
    if [ "$expected" = success ]; then
        "${command[@]}" > "$case_root/$release_id.out" 2> "$case_root/$release_id.err" || {
            sed -n '1,160p' "$case_root/$release_id.err" >&2
            fail "transaction unexpectedly failed: $release_id"
        }
    elif "${command[@]}" > "$case_root/$release_id.out" 2> "$case_root/$release_id.err"; then
        fail "transaction unexpectedly succeeded: $release_id phase=$phase"
    fi
}

# Preflight must select flock when lockf is absent from PATH.
lock_only_root="$(init_case lock-only)"
lock_only_release='release-lock-only'
make_release_source "$lock_only_root/opt/weknora/releases/$lock_only_release/source" 99
MUSUW_RELEASE_TX_TEST_PATH="$lock_only_bin" run_transaction "$lock_only_root" "$lock_only_release" "$revision_a" success

# Background ownership is globally unique: a running worker from an unrelated
# Compose project is an orphan and must block cutover before any new worker can
# start.
orphan_root="$(init_case orphan-worker)"
orphan_release='release-orphan-worker'
write_container_record "$orphan_root/fake-docker" "$orphan_worker_id" orphan-worker worker orphan-project orphan:old
make_release_source "$orphan_root/opt/weknora/releases/$orphan_release/source" 99
run_transaction "$orphan_root" "$orphan_release" "$revision_a" failure
grep -Eiq 'worker ownership|orphan|background' "$orphan_root/$orphan_release.err" || fail 'cross-project running worker was not rejected before cutover'

assert_rolled_back() {
    local case_root="$1" release_id="$2" state_file candidate_project container_dir
    state_file="$case_root/opt/weknora/runtime/release-transactions/$release_id.json"
    if [ ! -f "$state_file" ]; then
        sed -n '1,160p' "$case_root/$release_id.err" >&2
        fail "transaction failed before durable state creation: $release_id"
    fi
    jq -e '.phase == "rolled_back"' "$state_file" >/dev/null || fail "transaction did not mark a complete rollback: $release_id"
    [ "$(cat "$case_root/fake-docker/edge_owner")" = "$old_edge_id" ] || fail "rollback did not restore the exact old edge owner: $release_id"
    [ "$(readlink -f "$case_root/opt/weknora/current")" = "$(cd "$case_root/opt/weknora/releases/legacy/source" && pwd -P)" ] || fail "rollback did not restore current source: $release_id"
    grep -Fx 'MAX_FILE_SIZE_MB=41' "$case_root/opt/weknora/runtime/production.public.env" >/dev/null || fail "rollback did not restore runtime config: $release_id"
    grep -Fq 'curl:-fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/health' "$case_root/docker.log" || fail "rollback did not publicly probe the restored owner: $release_id"
    candidate_project="$(jq -r '.project' "$state_file")"
    for container_dir in "$case_root"/fake-docker/containers/*; do
        [ -d "$container_dir" ] || continue
        [ "$(cat "$container_dir/project")" = "$candidate_project" ] || continue
        [ "$(cat "$container_dir/running")" = false ] || fail "rollback left a candidate process running: $release_id"
    done
}

for phase in build stage cutover edge_after_connect public worker disk image_label; do
    case_root="$(init_case "$phase")"
    release_id="release-$phase"
    source="$case_root/opt/weknora/releases/$release_id/source"
    make_release_source "$source" 99
    run_transaction "$case_root" "$release_id" "$revision_a" failure "$phase"
    assert_rolled_back "$case_root" "$release_id"
    if [ "$phase" = edge_after_connect ]; then
        edge_state="$case_root/opt/weknora/runtime/release-transactions/$release_id.json"
        edge_candidate="$(jq -r '.candidate.frontend_id' "$edge_state")"
        jq -e --arg old "$old_edge_id" --arg new "$edge_candidate" '
            .cutover_intent.expected_old_id == $old and
            .cutover_intent.expected_new_id == $new and
            .cutover_intent.edge_alias == "web" and
            ([.events[].event] | index("cutover_intent") != null)
        ' "$edge_state" >/dev/null || fail 'post-connect rollback lacked a durable pre-mutation cutover intent'
        grep -Fq "docker:network connect --alias web musnow-production_edge $edge_candidate" "$case_root/docker.log" || \
            fail 'post-connect fault did not occur after candidate edge attachment'
    fi
done

# An abrupt process exit after the durable snapshot must release the kernel
# lock without a stale PID directory. The next transaction acquires the same
# lock, reconciles the interrupted state, and proceeds safely.
crash_lock_root="$(init_case crash-lock)"
crash_lock_release='release-crash-lock'
make_release_source "$crash_lock_root/opt/weknora/releases/$crash_lock_release/source" 99
run_transaction "$crash_lock_root" "$crash_lock_release" "$revision_a" failure crash_after_snapshot
[ -f "$crash_lock_root/opt/weknora/runtime/release-transactions/$crash_lock_release.json" ] || fail 'abrupt lock test did not persist its snapshot state'
make_release_source "$crash_lock_root/opt/weknora/releases/$crash_lock_release-b/source" 100
run_transaction "$crash_lock_root" "$crash_lock_release-b" "$revision_b" success
[ -f "$crash_lock_root/opt/weknora/runtime/release-transaction.lock" ] || fail 'transaction did not retain a regular kernel lock file'
[ ! -d "$crash_lock_root/opt/weknora/runtime/release-transaction.lock" ] || fail 'transaction retained a stale PID lock directory'
jq -e '.phase == "committed"' "$crash_lock_root/opt/weknora/runtime/release-transactions/$crash_lock_release-b.json" >/dev/null || fail 'post-crash transaction did not commit after reconciliation'

# A commit failure occurs after current/config/ledger writes. The full legacy
# owner set must be durably recorded, restarted, and verified before edge
# restore; the just-written ledger must be removed because no prior v2 ledger
# existed.
commit_root="$(init_case commit)"
commit_release='release-commit'
make_release_source "$commit_root/opt/weknora/releases/$commit_release/source" 99
run_transaction "$commit_root" "$commit_release" "$revision_a" failure commit
assert_rolled_back "$commit_root" "$commit_release"
commit_state="$commit_root/opt/weknora/runtime/release-transactions/$commit_release.json"
jq -e --arg edge "$old_edge_id" --arg app "$old_app_id" --arg worker "$old_worker_id" '
    (.old.stopped_ids | sort) == ([$edge,$app,$worker] | sort)
' "$commit_state" >/dev/null || fail 'commit rollback did not retain every observed old process/image identity'
commit_snapshot="$(jq -r '.snapshot_file' "$commit_state")"
jq -e '[.old_containers[].image_state.id] | all(type == "string" and startswith("sha256:"))' "$commit_snapshot" >/dev/null || \
    fail 'commit rollback snapshot did not retain actual old image identities'
jq -e '[.old_containers[].image_state] | all(.id | test("^sha256:[0-9a-f]{64}$")) and all(has("repo_digest") and has("repo_digest_status") and has("revision_label") and has("revision_label_status"))' "$commit_snapshot" >/dev/null || \
    fail 'commit rollback snapshot did not retain exact image content and provenance status fields'
jq -e '
    .predecessor_provenance.status == "legacy_content_digest_only" and
    (.predecessor_provenance.revision == null) and
    (.predecessor_provenance.digest | test("^[0-9a-f]{64}$")) and
    (.predecessor_provenance.file_count > 0) and
    (.predecessor_provenance.bytes > 0) and
    (.predecessor_provenance.paths | index("weknora/migrations/versioned/000001_fixture.up.sql") != null) and
    (.source_manifest_sha == null)
' "$commit_snapshot" >/dev/null || fail 'legacy predecessor snapshot did not record content-only provenance without a fabricated source bundle'
[ ! -e "$commit_root/opt/weknora/runtime/release-ledger-v2.json" ] || fail 'commit rollback retained an uncommitted v2 ledger'
for id in "$old_edge_id" "$old_app_id" "$old_worker_id"; do
    [ "$(cat "$commit_root/fake-docker/containers/$id/running")" = true ] || fail 'commit rollback did not restart every old application owner'
done
candidate_worker_id="$(jq -r '.candidate.worker_id' "$commit_state")"
stop_worker_line="$(grep -n "docker:stop --time 60 $candidate_worker_id" "$commit_root/docker.log" | tail -n 1 | cut -d: -f1)"
start_old_line="$(grep -n "docker:start $old_worker_id" "$commit_root/docker.log" | tail -n 1 | cut -d: -f1)"
restore_edge_line="$(grep -n "docker:network connect.*$old_edge_id" "$commit_root/docker.log" | tail -n 1 | cut -d: -f1)"
stop_frontend_line="$(grep -n 'docker:stop --time 60 .*' "$commit_root/docker.log" | tail -n 2 | head -n 1 | cut -d: -f1)"
[ "$stop_worker_line" -lt "$start_old_line" ] && [ "$start_old_line" -lt "$restore_edge_line" ] && [ "$restore_edge_line" -lt "$stop_frontend_line" ] || \
    fail 'rollback order is not candidate worker -> old background -> old edge -> candidate traffic roles'

# If candidate worker stop cannot be proven, rollback must halt before starting
# the old background owner and must not claim rolled_back.
stop_fail_root="$(init_case stop-failure)"
stop_fail_release='release-stop-failure'
make_release_source "$stop_fail_root/opt/weknora/releases/$stop_fail_release/source" 99
run_transaction "$stop_fail_root" "$stop_fail_release" "$revision_a" failure commit worker
stop_fail_state="$stop_fail_root/opt/weknora/runtime/release-transactions/$stop_fail_release.json"
[ "$(jq -r '.phase' "$stop_fail_state")" != rolled_back ] || fail 'failed candidate worker stop was incorrectly marked rolled_back'
if grep -Fq "docker:start $old_worker_id" "$stop_fail_root/docker.log"; then
    fail 'old worker restarted after candidate worker stop failure'
fi
[ "$(cat "$stop_fail_root/fake-docker/edge_owner")" != "$old_edge_id" ] || fail 'edge restored despite candidate worker stop failure'

# A legacy predecessor digest is rechecked before rollback is claimed. A
# changed tree leaves the transaction recoverable and fail-closed.
legacy_drift_root="$(init_case legacy-tree-drift)"
legacy_drift_release='release-legacy-tree-drift'
make_release_source "$legacy_drift_root/opt/weknora/releases/$legacy_drift_release/source" 99
run_transaction "$legacy_drift_root" "$legacy_drift_release" "$revision_a" failure legacy_tree_drift
legacy_drift_state="$legacy_drift_root/opt/weknora/runtime/release-transactions/$legacy_drift_release.json"
[ "$(jq -r '.phase' "$legacy_drift_state")" != rolled_back ] || fail 'legacy tree digest drift was incorrectly marked rolled_back'
grep -Fq 'legacy predecessor tree changed' "$legacy_drift_root/$legacy_drift_release.err" || fail 'legacy tree digest drift did not fail closed during rollback'

# Symlinks and special files are never admissible in the one-time legacy
# normalization path.
legacy_symlink_root="$(init_case legacy-symlink)"
legacy_symlink_release='release-legacy-symlink'
ln -s "$legacy_symlink_root/opt/weknora/releases/legacy/source/weknora/migrations/versioned/000001_fixture.up.sql" \
    "$legacy_symlink_root/opt/weknora/releases/legacy/source/weknora/migrations/versioned/unsafe-link"
make_release_source "$legacy_symlink_root/opt/weknora/releases/$legacy_symlink_release/source" 99
run_transaction "$legacy_symlink_root" "$legacy_symlink_release" "$revision_a" failure
grep -Eiq 'symbolic link|special file' "$legacy_symlink_root/$legacy_symlink_release.err" || fail 'legacy symlink predecessor was not rejected'

# Once v2 state exists, project/source/config/edge/worker ownership is a
# fail-closed contract. Each mutation must be rejected before a new candidate
# can stage, preventing a stale ledger from creating a second worker owner.
run_v2_drift_case() {
    local kind="$1" root release_a release_b ledger
    root="$(init_case "drift-$kind")"
    release_a="release-drift-$kind-a"
    release_b="release-drift-$kind-b"
    make_release_source "$root/opt/weknora/releases/$release_a/source" 99
    run_transaction "$root" "$release_a" "$revision_a" success
    ledger="$root/opt/weknora/runtime/release-ledger-v2.json"
    case "$kind" in
        project) jq '.current.project = "forged-project"' "$ledger" > "$ledger.tmp" && mv -f "$ledger.tmp" "$ledger" ;;
        source) jq '.current.source = "/opt/weknora/releases/forged/source"' "$ledger" > "$ledger.tmp" && mv -f "$ledger.tmp" "$ledger" ;;
        config) printf '%s\n' 'MAX_FILE_SIZE_MB=drifted' >> "$root/opt/weknora/runtime/production.env" ;;
        edge) printf '%s' "$old_edge_id" > "$root/fake-docker/edge_owner" ;;
        worker) jq --arg id "$old_worker_id" '.current.worker_ids = [$id] | .current.worker_id = $id' "$ledger" > "$ledger.tmp" && mv -f "$ledger.tmp" "$ledger" ;;
        *) fail "unknown v2 drift case: $kind" ;;
    esac
    make_release_source "$root/opt/weknora/releases/$release_b/source" 100
    run_transaction "$root" "$release_b" "$revision_b" failure
    [ ! -e "$root/opt/weknora/runtime/release-transactions/$release_b.json" ] || fail "v2 $kind drift created a candidate state"
    grep -Eiq 'drifted|identity is incomplete|edge owner project|edge owner is not running' "$root/$release_b.err" || fail "v2 $kind drift did not fail with an ownership/config diagnostic"
}

for drift_kind in project source config edge worker; do
    run_v2_drift_case "$drift_kind"
done

# After the first v2 commit, the legacy content-only branch is permanently
# unavailable: removing any predecessor manifest must fail closed.
strict_missing_root="$(init_case strict-missing-manifest)"
strict_missing_a='release-strict-missing-a'
strict_missing_b='release-strict-missing-b'
make_release_source "$strict_missing_root/opt/weknora/releases/$strict_missing_a/source" 99
run_transaction "$strict_missing_root" "$strict_missing_a" "$revision_a" success
strict_missing_source="$strict_missing_root/opt/weknora/releases/$strict_missing_a/source"
rm -f "$strict_missing_source/deploy/release-manifest.json"
make_release_source "$strict_missing_root/opt/weknora/releases/$strict_missing_b/source" 100
run_transaction "$strict_missing_root" "$strict_missing_b" "$revision_b" failure
grep -Eiq 'predecessor manifests|release manifest' "$strict_missing_root/$strict_missing_b.err" || fail 'v2 predecessor missing manifest was not rejected'

# A v2 predecessor tree may not gain an unmanifested file after commit. The
# next transaction must fail before claiming any rollback state.
strict_extra_root="$(init_case strict-extra-file)"
strict_extra_a='release-strict-extra-a'
strict_extra_b='release-strict-extra-b'
make_release_source "$strict_extra_root/opt/weknora/releases/$strict_extra_a/source" 99
run_transaction "$strict_extra_root" "$strict_extra_a" "$revision_a" success
strict_extra_source="$strict_extra_root/opt/weknora/releases/$strict_extra_a/source"
printf '%s\n' unmanifested-v2-predecessor-file > "$strict_extra_source/weknora/unmanifested-v2-predecessor.txt"
make_release_source "$strict_extra_root/opt/weknora/releases/$strict_extra_b/source" 100
run_transaction "$strict_extra_root" "$strict_extra_b" "$revision_b" failure
[ ! -e "$strict_extra_root/opt/weknora/runtime/release-transactions/$strict_extra_b.json" ] || \
    [ "$(jq -r '.phase' "$strict_extra_root/opt/weknora/runtime/release-transactions/$strict_extra_b.json")" != rolled_back ] || \
    fail 'v2 predecessor unmanifested file was incorrectly marked rolled_back'
grep -Eiq 'unmanifested|source tree|manifest' "$strict_extra_root/$strict_extra_b.err" || fail 'v2 predecessor unmanifested file was not rejected'

# The same deterministic tree is rechecked if a strict predecessor changes
# after snapshot during rollback; it must remain recoverable, never claimed
# rolled_back.
strict_rollback_root="$(init_case strict-rollback-tree)"
strict_rollback_a='release-strict-rollback-a'
strict_rollback_b='release-strict-rollback-b'
make_release_source "$strict_rollback_root/opt/weknora/releases/$strict_rollback_a/source" 99
run_transaction "$strict_rollback_root" "$strict_rollback_a" "$revision_a" success
make_release_source "$strict_rollback_root/opt/weknora/releases/$strict_rollback_b/source" 100
run_transaction "$strict_rollback_root" "$strict_rollback_b" "$revision_b" failure legacy_tree_drift
strict_rollback_state="$strict_rollback_root/opt/weknora/runtime/release-transactions/$strict_rollback_b.json"
[ "$(jq -r '.phase' "$strict_rollback_state")" != rolled_back ] || fail 'strict predecessor tree drift during rollback was incorrectly marked rolled_back'
grep -Eiq 'legacy predecessor tree changed|v2 predecessor .*drifted|v2 predecessor .*invalid|v2 predecessor .*hash' \
    "$strict_rollback_root/$strict_rollback_b.err" || fail 'strict predecessor rollback tree recheck did not fail closed'

# A replacement image under the same live container identity is still drift:
# v2 must compare web/frontend content IDs, RepoDigest/status and revision
# labels against the ledger before staging the next release.
strict_image_root="$(init_case strict-image-drift)"
strict_image_a='release-strict-image-a'
strict_image_b='release-strict-image-b'
make_release_source "$strict_image_root/opt/weknora/releases/$strict_image_a/source" 99
run_transaction "$strict_image_root" "$strict_image_a" "$revision_a" success
strict_image_web_id="$(printf '%s' "$revision_a-web" | sha256sum | awk '{print $1}')"
printf 'sha256:%064d\n' 7 | tr 0 f > "$strict_image_root/fake-docker/containers/$strict_image_web_id/image_id"
make_release_source "$strict_image_root/opt/weknora/releases/$strict_image_b/source" 100
run_transaction "$strict_image_root" "$strict_image_b" "$revision_b" failure
grep -Eiq 'image|provenance|ledger' "$strict_image_root/$strict_image_b.err" || fail 'v2 live web image replacement was not rejected'

# Two successful releases retain the first web/frontend for rollback while
# transferring the single background owner and edge to the second project.
success_root="$(init_case successive)"
release_a='release-a'
release_b='release-b'
make_release_source "$success_root/opt/weknora/releases/$release_a/source" 99
run_transaction "$success_root" "$release_a" "$revision_a" success
grep -Fx 'WEKNORA_PRODUCTION_RELEASE_ID=weknora-v072-production' \
    "$success_root/opt/weknora/runtime/release-transactions/$release_a/candidate/production.env" >/dev/null || fail 'candidate mutated the stable application release identity'
grep -Fx 'MAX_FILE_SIZE_MB=99' \
    "$success_root/opt/weknora/runtime/release-transactions/$release_a/candidate/production.env" >/dev/null || fail 'candidate did not use manifest-bound public configuration'

make_release_source "$success_root/opt/weknora/releases/$release_b/source" 100
run_transaction "$success_root" "$release_b" "$revision_b" success
project_a='musuw-r-0123456789ab'
project_b='musuw-r-89abcdef0123'
web_a_id="$(printf '%s' "$revision_a-web" | sha256sum | awk '{print $1}')"
frontend_a_id="$(printf '%s' "$revision_a-frontend" | sha256sum | awk '{print $1}')"
worker_a_id="$(printf '%s' "$revision_a-worker" | sha256sum | awk '{print $1}')"
web_b_id="$(printf '%s' "$revision_b-web" | sha256sum | awk '{print $1}')"
frontend_b_id="$(printf '%s' "$revision_b-frontend" | sha256sum | awk '{print $1}')"
worker_b_id="$(printf '%s' "$revision_b-worker" | sha256sum | awk '{print $1}')"
[ "$(cat "$success_root/fake-docker/containers/$web_a_id/running")" = true ] || fail 'second release stopped the retained first web rollback target'
[ "$(cat "$success_root/fake-docker/containers/$frontend_a_id/running")" = true ] || fail 'second release stopped the retained first frontend rollback target'
[ "$(cat "$success_root/fake-docker/containers/$worker_a_id/running")" = false ] || fail 'second release left the first background owner active'
[ "$(cat "$success_root/fake-docker/containers/$worker_b_id/running")" = true ] || fail 'second release did not activate its worker'

# Both rollback candidates remain present, but each frontend shares exactly
# one per-revision network with its own web and no network with the other
# release's web. The stable data network also carries only the exact web
# container name, never Compose's shared `web` service alias.
for pair in "web-a:$web_a_id" "frontend-a:$frontend_a_id" "web-b:$web_b_id" "frontend-b:$frontend_b_id"; do
    label="${pair%%:*}"
    id="${pair#*:}"
    FAKE_DOCKER_STATE="$success_root/fake-docker" FAKE_DOCKER_LOG="$success_root/docker.log" \
        "$fake_bin/docker" inspect "$id" --format '{{json .NetworkSettings.Networks}}' > "$success_root/$label.networks.json"
done
jq -en \
    --slurpfile web_a "$success_root/web-a.networks.json" \
    --slurpfile frontend_a "$success_root/frontend-a.networks.json" \
    --slurpfile web_b "$success_root/web-b.networks.json" \
    --slurpfile frontend_b "$success_root/frontend-b.networks.json" '
    def shared($left; $right): [$left[0] | keys[] | . as $name | select($right[0] | has($name))];
    shared($frontend_a; $web_a) == ["musuw-r-0123456789ab-private"] and
    shared($frontend_b; $web_b) == ["musuw-r-89abcdef0123-private"] and
    shared($frontend_a; $web_b) == [] and
    shared($frontend_b; $web_a) == [] and
    ($web_a[0]["weknora-v072-production-internal"].Aliases == ["musuw-r-0123456789ab-web"]) and
    ($web_b[0]["weknora-v072-production-internal"].Aliases == ["musuw-r-89abcdef0123-web"])
' >/dev/null || fail 'retained release projects can resolve another release web or expose a shared data-network alias'
jq -e --arg project "$project_b" '.current.project == $project' "$success_root/opt/weknora/runtime/release-ledger-v2.json" >/dev/null || fail 'second release did not atomically commit its v2 ledger'
jq -e --arg revision "$revision_b" '
    (.current.image_state.web.id | test("^sha256:[0-9a-f]{64}$")) and
    (.current.image_state.frontend.id | test("^sha256:[0-9a-f]{64}$")) and
    (.current.image_state.worker.id | test("^sha256:[0-9a-f]{64}$")) and
    .current.image_state.web.revision_label == $revision and
    .current.image_state.frontend.revision_label == $revision and
    .current.image_state.worker.revision_label == $revision and
    (.current.image_state.web.repo_digest_status | IN("verified","unavailable")) and
    (.current.image_state.frontend.repo_digest_status | IN("verified","unavailable")) and
    (.current.image_state.worker.repo_digest_status | IN("verified","unavailable"))
' "$success_root/opt/weknora/runtime/release-ledger-v2.json" >/dev/null || fail 'v2 ledger did not retain candidate image IDs, labels, and explicit RepoDigest status'
[ "$(readlink -f "$success_root/opt/weknora/current")" = "$(cd "$success_root/opt/weknora/releases/$release_b/source" && pwd -P)" ] || fail 'second release did not atomically commit current source'

# Replaying an already-committed release id/SHA must fail before touching the
# committed worker, edge or state. A generic EXIT rollback here would stop the
# live per-SHA project, so this is an important idempotency guard.
run_transaction "$success_root" "$release_b" "$revision_b" failure
jq -e '.phase == "committed"' "$success_root/opt/weknora/runtime/release-transactions/$release_b.json" >/dev/null || fail 'same-SHA replay rewrote committed transaction state'
[ "$(cat "$success_root/fake-docker/containers/$worker_b_id/running")" = true ] || fail 'same-SHA replay stopped the committed worker'
jq -e --arg project "$project_b" '.current.project == $project' "$success_root/opt/weknora/runtime/release-ledger-v2.json" >/dev/null || fail 'same-SHA replay changed the committed ledger'

# release-ci must not append a curl after a successful transaction. The curl
# adapter fails unconditionally; success therefore proves there is no
# post-commit probe outside transaction rollback scope.
ci_root="$tmp_dir/release-ci"
mkdir -p "$ci_root/source/scripts/weknora-production" "$ci_root/runtime" "$ci_root/bin"
cp "$script_dir/release-ci.sh" "$script_dir/lib.sh" "$ci_root/source/scripts/weknora-production/"
cat > "$ci_root/source/scripts/weknora-production/source-manifest.sh" <<'EOF'
#!/usr/bin/env bash
printf '%064d\n' 0 | tr 0 e
EOF
cat > "$ci_root/source/scripts/weknora-production/rollback.sh" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
cat > "$ci_root/source/scripts/weknora-production/release-transaction.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' transaction-success
EOF
cat > "$ci_root/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' unexpected-curl >&2
exit 99
EOF
chmod +x "$ci_root/source/scripts/weknora-production/"*.sh "$ci_root/bin/curl"
PATH="$ci_root/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
WEKNORA_PRODUCTION_RUNTIME_DIR="$ci_root/runtime" \
    "$ci_root/source/scripts/weknora-production/release-ci.sh" > "$ci_root/output"
grep -Fq 'CI staged release green:' "$ci_root/output" || fail 'release-ci did not finish after the transaction-owned probes'

printf '%s\n' 'actual release transaction fault harness green: real prepare-runtime, isolated Compose DNS, phase/stop rollback, two successive releases, no post-commit curl'
