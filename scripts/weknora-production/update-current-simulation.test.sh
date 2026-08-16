#!/usr/bin/env bash
# Execute the real daily-update helper in a Linux container with Docker/curl
# replaced at their external seams. This covers atomic current switching,
# image fallback, configuration rollback and cutover-state identity refresh
# without opening SSH or touching production.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_image='neo4j:2025.10.1'
docker image inspect "$test_image" >/dev/null

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
test_revision='0123456789abcdef0123456789abcdef01234567'
opt_root="$tmp_dir/opt-weknora"
old_source="$opt_root/releases/old/source"
new_source="$opt_root/releases/new/source"
runtime_dir="$opt_root/runtime"
fake_bin="$opt_root/test-bin"
call_log="$runtime_dir/simulation.log"
compose_count="$runtime_dir/compose-count"

mkdir -p \
    "$old_source/weknora/migrations/versioned" \
    "$old_source/scripts/weknora-production" \
    "$new_source/weknora/migrations" \
    "$new_source/weknora/config" \
    "$new_source/weknora/frontend/dist" \
    "$new_source/auth/dist" \
    "$new_source/integration/weknora-production" \
    "$new_source/scripts/weknora-production" \
    "$new_source/deploy" \
    "$runtime_dir/secrets" \
    "$fake_bin"
chmod 700 "$runtime_dir" "$runtime_dir/secrets"
ln -s /opt/weknora/releases/old/source "$opt_root/current"

write_migrations() {
    rm -rf "$old_source/weknora/migrations" "$new_source/weknora/migrations"
    mkdir -p \
        "$old_source/weknora/migrations/versioned" \
        "$old_source/weknora/migrations/mysql" \
        "$new_source/weknora/migrations/versioned" \
        "$new_source/weknora/migrations/mysql"

    printf '%s\n' 'migration-79-up' > "$old_source/weknora/migrations/versioned/000079_fixture.up.sql"
    printf '%s\n' 'migration-79-down' > "$old_source/weknora/migrations/versioned/000079_fixture.down.sql"
    printf '%s\n' 'mysql-bootstrap' > "$old_source/weknora/migrations/mysql/00-init-db.sql"
    cp "$old_source/weknora/migrations/versioned/000079_fixture.up.sql" \
        "$new_source/weknora/migrations/versioned/000079_fixture.up.sql"
    cp "$old_source/weknora/migrations/versioned/000079_fixture.down.sql" \
        "$new_source/weknora/migrations/versioned/000079_fixture.down.sql"
    cp "$old_source/weknora/migrations/mysql/00-init-db.sql" \
        "$new_source/weknora/migrations/mysql/00-init-db.sql"

    printf '%s\n' 'migration-80-up' > "$new_source/weknora/migrations/versioned/000080_fixture.up.sql"
    printf '%s\n' 'migration-80-down' > "$new_source/weknora/migrations/versioned/000080_fixture.down.sql"
    printf '%s\n' 'migration-81-up' > "$new_source/weknora/migrations/versioned/000081_fixture.up.sql"
    printf '%s\n' 'migration-81-down' > "$new_source/weknora/migrations/versioned/000081_fixture.down.sql"
    printf '%s\n' 'migration-79-down' > "$new_source/weknora/migrations/versioned/000079_fixture.down.sql"
}

write_migrations
printf '%s\n' 'compose' > "$new_source/weknora/docker-compose.yml"
printf '%s\n' 'builtin_models: []' > "$new_source/weknora/config/builtin_models.yaml"
printf '%s\n' '<html></html>' > "$new_source/weknora/frontend/dist/index.html"
printf '%s\n' '<html></html>' > "$new_source/auth/dist/index.html"
printf '%s\n' 'compose' > "$new_source/integration/weknora-production/compose.yaml"
printf '%s\n' 'edge' > "$new_source/integration/weknora-production/compose.edge.yaml"
printf '%s\n' 'auth-public' > "$new_source/deploy/auth-public.env"

cp "$script_dir/lib.sh" "$script_dir/update-current.sh" "$script_dir/release-ci.sh" "$script_dir/source-manifest.sh" "$new_source/scripts/weknora-production/"

write_public_env() {
    local target="$1"
    local max_file_size="${2:-50}"
    cat > "$target" <<EOF
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
LOG_LEVEL=info
TZ=Asia/Shanghai
WEKNORA_PRODUCTION_SEARXNG_PORT=8891
EOF
}

write_runtime_env() {
    cat > "$runtime_dir/production.env" <<'EOF'
WEKNORA_PRODUCTION_APP_PORT=18091
WEKNORA_PRODUCTION_FRONTEND_PORT=4191
EOF
    chmod 600 "$runtime_dir/production.env"
}

write_cutover_state() {
    local frontend_id="$1"
    jq -n --arg frontend_id "$frontend_id" '{
        schema: 1,
        phase: "cutover_active",
        new_container_name: "weknora-v072-production-frontend",
        new_container_id: $frontend_id
    }' > "$runtime_dir/cutover-state.json"
    chmod 600 "$runtime_dir/cutover-state.json"
}

make_helper() {
    local target="$1"
    cat > "$target" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$(basename "$0"):$*" >> /opt/weknora/runtime/simulation.log
EOF
    chmod +x "$target"
}
for helper in prepare-runtime.sh build-images.sh; do
    make_helper "$new_source/scripts/weknora-production/$helper"
done
for helper in start-staged.sh cutover.sh rollback.sh; do
    make_helper "$new_source/scripts/weknora-production/$helper"
done

cat > "$new_source/scripts/weknora-production/compose.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "compose:$*" >> /opt/weknora/runtime/simulation.log
count="$(cat /opt/weknora/runtime/compose-count)"
printf '%s\n' "$((count + 1))" > /opt/weknora/runtime/compose-count
EOF
chmod +x "$new_source/scripts/weknora-production/compose.sh"
cp "$new_source/scripts/weknora-production/compose.sh" "$old_source/scripts/weknora-production/compose.sh"

cat > "$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
    volume)
        [ "${2:-}" = inspect ]
        ;;
    image)
        [ "${2:-}" = inspect ]
        case "${3:-}" in
            "weknora-v072-production-app:${WEKNORA_PRODUCTION_REVISION:-local}") printf '%064d\n' 0 | tr 0 a ;;
            "weknora-v072-production-ui:${WEKNORA_PRODUCTION_REVISION:-local}") printf '%064d\n' 0 | tr 0 b ;;
            *) exit 1 ;;
        esac
        ;;
    info)
        [ "${2:-}" = --format ]
        printf '%s\n' /var/lib/docker
        ;;
    tag)
        printf '%s\n' "docker-tag:${2:-}:${3:-}" >> /opt/weknora/runtime/simulation.log
        ;;
    inspect)
        target="${2:-}"
        format="${4:-}"
        count="$(cat /opt/weknora/runtime/compose-count)"
        case "$format" in
            '{{.Id}}')
                case "$count" in
                    0) printf '%064d\n' 0 | tr 0 c ;;
                    1) printf '%064d\n' 0 | tr 0 d ;;
                    *) printf '%064d\n' 0 | tr 0 e ;;
                esac
                ;;
            '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}')
                printf '%s\n' healthy
                ;;
            '{{json .NetworkSettings.Networks}}')
                printf '%s\n' '{"musnow-production_edge":{"Aliases":["web"]}}'
                ;;
            *)
                printf '%s\n' "unexpected inspect: $target $format" >&2
                exit 1
                ;;
        esac
        ;;
    exec)
        if [[ "$*" == *'schema_migrations'* ]]; then
            printf '%s\n' "${SIM_MIGRATION_STATE:-81|f}"
        elif [[ "$*" == *'FROM models'* ]]; then
            printf '%s\n' "${SIM_MODEL_CATALOG_COUNT:-6}"
        else
            printf '%s\n' "unexpected exec: $*" >&2
            exit 1
        fi
        ;;
    *)
        printf '%s\n' "unexpected docker command: $*" >&2
        exit 1
        ;;
esac
EOF

cat > "$fake_bin/df" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on'
if [ "${SIM_LOW_CAPACITY:-0}" = 1 ]; then
    printf '%s\n' '/dev/mock 40901312 40000000 901312 98% /'
else
    printf '%s\n' '/dev/mock 99999999 1000000 98000000 2% /'
fi
EOF

cat > "$fake_bin/curl" <<'EOF'
#!/usr/bin/env bash
last=''
for argument in "$@"; do last="$argument"; done
if [ "${SIM_FAIL_PUBLIC:-0}" = 1 ] && [ "$last" = 'https://app.musuw.com/health' ]; then
    exit 22
fi
exit 0
EOF
chmod +x "$fake_bin/docker" "$fake_bin/curl"
chmod +x "$fake_bin/df"

git -C "$new_source" init -q
git -C "$new_source" config user.email fixture@example.test
git -C "$new_source" config user.name fixture
git -C "$new_source" add -A
git -C "$new_source" commit -qm fixture

run_update() {
    local entrypoint="${1:-update-current.sh}"
    docker run --rm --user 0:0 \
        -v "$opt_root:/opt/weknora" \
        -e PATH='/opt/weknora/test-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' \
        -e WEKNORA_PRODUCTION_RUNTIME_DIR=/opt/weknora/runtime \
        -e WEKNORA_PRODUCTION_REVISION="$test_revision" \
        -e SIM_FAIL_PUBLIC="${SIM_FAIL_PUBLIC:-0}" \
        -e SIM_LOW_CAPACITY="${SIM_LOW_CAPACITY:-0}" \
        -e SIM_MODEL_CATALOG_COUNT="${SIM_MODEL_CATALOG_COUNT:-6}" \
        --entrypoint /bin/bash "$test_image" \
        "/opt/weknora/releases/new/source/scripts/weknora-production/$entrypoint"
}

reset_fixture() {
    find "$opt_root/current" -delete
    ln -s /opt/weknora/releases/old/source "$opt_root/current"
    write_public_env "$runtime_dir/production.public.env" 50
    write_public_env "$new_source/deploy/production.public.env" 50
    printf '%s\n' 'auth-old' > "$runtime_dir/auth-public.env"
    chmod 600 "$runtime_dir/production.public.env" "$runtime_dir/auth-public.env"
    write_migrations
    if [ ! -d "$new_source/.git" ]; then
        git -C "$new_source" init -q
        git -C "$new_source" config user.email fixture@example.test
        git -C "$new_source" config user.name fixture
        git -C "$new_source" add -A
        git -C "$new_source" commit -qm fixture
    fi
    manifest_fixture_dir="$tmp_dir/manifest"
    [ ! -d "$manifest_fixture_dir" ] || find "$manifest_fixture_dir" -depth -delete
    mkdir -m 700 "$manifest_fixture_dir"
    WEKNORA_PRODUCTION_REVISION="$test_revision" \
        "$new_source/scripts/weknora-production/source-manifest.sh" generate \
        "$new_source" "$runtime_dir" new "$test_revision" update "$manifest_fixture_dir" >/dev/null
    cp "$manifest_fixture_dir"/* "$new_source/deploy/"
    cp "$runtime_dir/production.public.env" "$new_source/deploy/production.public.env"
    cp "$runtime_dir/auth-public.env" "$new_source/deploy/auth-public.env"
    # A production materialized tree never carries VCS metadata. Remove the
    # fixture repository after generating its manifest so verify_manifest's
    # exact-file check models the real upload surface.
    find "$new_source/.git" -depth -delete 2>/dev/null || true
    write_runtime_env
    printf '%s\n' 0 > "$compose_count"
    : > "$call_log"
    write_cutover_state "$(printf '%064d' 0 | tr 0 c)"
}

reset_fixture
if SIM_LOW_CAPACITY=1 run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected below-reserve capacity to reject the daily update before image work' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
run_update >/dev/null
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/new/source' ]
jq -e '.new_container_id == ("d" * 64)' "$runtime_dir/cutover-state.json" >/dev/null
grep -Fx 'compose:--edge up -d --no-deps --force-recreate app frontend' "$call_log" >/dev/null

reset_fixture
if SIM_MODEL_CATALOG_COUNT=5 run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected incomplete platform model catalog to roll back the full update' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]

reset_fixture
if SIM_FAIL_PUBLIC=1 run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected public-health failure to roll back and return failure' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
grep -Fx 'auth-old' "$runtime_dir/auth-public.env" >/dev/null
jq -e '.new_container_id == ("e" * 64)' "$runtime_dir/cutover-state.json" >/dev/null
[ "$(grep -c '^compose:' "$call_log")" -eq 2 ]

# The CI entry point must use the staged protocol. A public post-probe failure
# invokes the idempotent rollback seam while leaving the old current symlink in
# place; no legacy direct edge Compose call is allowed on this path.
reset_fixture
run_update release-ci.sh >/dev/null
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/new/source' ]
grep -Fx 'start-staged.sh:' "$call_log" >/dev/null
grep -Fx 'cutover.sh:' "$call_log" >/dev/null
if grep -q '^compose:--edge' "$call_log"; then
    printf '%s\n' 'CI staged release unexpectedly used the legacy direct edge Compose path' >&2
    exit 1
fi

reset_fixture
if SIM_FAIL_PUBLIC=1 run_update release-ci.sh >/dev/null 2>&1; then
    printf '%s\n' 'expected CI public post-probe failure to roll back' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
grep -Fx 'rollback.sh:' "$call_log" >/dev/null
if grep -q '^compose:--edge' "$call_log"; then
    printf '%s\n' 'CI staged rollback unexpectedly used the legacy direct edge Compose path' >&2
    exit 1
fi

reset_fixture
write_public_env "$new_source/deploy/production.public.env" 99
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected sidecar-consumed config change to be rejected' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
printf '%s\n' 'tampered-history' > "$new_source/weknora/migrations/versioned/000079_fixture.up.sql"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected modified migration history to be rejected' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
rm "$new_source/weknora/migrations/versioned/000079_fixture.down.sql"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected deleted migration history to be rejected' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
printf '%s\n' 'new-mysql-file' > "$new_source/weknora/migrations/mysql/01-new.sql"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected non-versioned migration addition to be rejected' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
printf '%s\n' 'inserted-version' > "$new_source/weknora/migrations/versioned/000079_inserted.up.sql"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected non-incrementing versioned migration to be rejected' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

if grep -Eq 'volume-(rm|prune)|compose:.*(down|rm)' "$call_log"; then
    printf '%s\n' 'daily update simulation observed a data-destructive operation' >&2
    exit 1
fi

printf '%s\n' 'daily update simulation green: additive migrations, immutable migration history, staged cutover/public rollback, failure rollback, cutover identity refresh, sidecar-config rejection'
