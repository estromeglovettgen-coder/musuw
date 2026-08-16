#!/usr/bin/env bash
# Exercise the UI-only update helper with its Docker/curl seams replaced. This
# test never opens SSH or touches a production container.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_image='neo4j:2025.10.1'
docker image inspect "$test_image" >/dev/null

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
test_revision='0123456789abcdef0123456789abcdef01234567'
opt_root="$tmp_dir/opt-weknora"
old_source="$opt_root/releases/old/source"
new_source="$opt_root/releases/ui/source"
runtime_dir="$opt_root/runtime"
fake_bin="$opt_root/test-bin"
call_log="$runtime_dir/simulation.log"

mkdir -p \
    "$old_source/weknora/frontend/dist" \
    "$old_source/weknora/migrations/versioned" \
    "$old_source/weknora/config" \
    "$old_source/auth/dist" \
    "$old_source/integration/weknora-production" \
    "$old_source/scripts/weknora-production" \
    "$new_source" \
    "$runtime_dir/secrets" \
    "$fake_bin"
chmod 700 "$runtime_dir" "$runtime_dir/secrets"
ln -s /opt/weknora/releases/old/source "$opt_root/current"

write_source() {
    local target="$1"
    mkdir -p \
        "$target/weknora/frontend/dist/assets" \
        "$target/weknora/migrations/versioned" \
        "$target/weknora/config" \
        "$target/auth/dist/assets" \
        "$target/integration/weknora-production" \
        "$target/scripts/weknora-production"
    printf '%s\n' 'compose' > "$target/weknora/docker-compose.yml"
    printf '%s\n' '<html>old</html>' > "$target/weknora/frontend/dist/index.html"
    printf '%s\n' 'old-ui' > "$target/weknora/frontend/dist/assets/app.js"
    printf '%s\n' '<html>auth</html>' > "$target/auth/dist/index.html"
    printf '%s\n' 'auth-ui' > "$target/auth/dist/assets/auth.js"
    printf '%s\n' 'migration-79-up' > "$target/weknora/migrations/versioned/000079_fixture.up.sql"
    printf '%s\n' 'migration-79-down' > "$target/weknora/migrations/versioned/000079_fixture.down.sql"
    printf '%s\n' 'builtin_models: []' > "$target/weknora/config/builtin_models.yaml"
    printf '%s\n' 'compose-overlay' > "$target/integration/weknora-production/compose.yaml"
    printf '%s\n' 'edge-overlay' > "$target/integration/weknora-production/compose.edge.yaml"
}

write_source "$old_source"
cp "$script_dir/lib.sh" "$old_source/scripts/weknora-production/"
cp -R "$old_source/." "$new_source/"
printf '%s\n' 'new-ui' > "$new_source/weknora/frontend/dist/assets/app.js"

cp "$script_dir/lib.sh" "$script_dir/update-ui-current.sh" "$new_source/scripts/weknora-production/"
cat > "$new_source/scripts/weknora-production/compose.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "compose:$*" >> /opt/weknora/runtime/simulation.log
EOF
chmod +x "$new_source/scripts/weknora-production/compose.sh"
cp "$new_source/scripts/weknora-production/compose.sh" "$old_source/scripts/weknora-production/compose.sh"

printf '%s\n' 'DB_DRIVER=postgres' > "$runtime_dir/production.public.env"
printf '%s\n' \
    'VITE_AUTH_PUBLIC_ORIGIN=https://app.musuw.com' \
    'VITE_SUPABASE_URL=https://identity.example' \
    'VITE_SUPABASE_PUBLISHABLE_KEY=static-public-browser-key' \
    'VITE_WEKNORA_OAUTH_CLIENT_ID=static-native-oidc-client' > "$runtime_dir/auth-public.env"
cat > "$runtime_dir/production.env" <<'EOF'
WEKNORA_PRODUCTION_FRONTEND_PORT=4191
EOF
chmod 600 "$runtime_dir/production.public.env" "$runtime_dir/auth-public.env" "$runtime_dir/production.env"

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

write_cutover_state "$(printf '%064d' 0 | tr 0 a)"

cat > "$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
    image)
        [ "${2:-}" = inspect ] && [ "${3:-}" = "weknora-v072-production-ui:${WEKNORA_PRODUCTION_REVISION:-local}" ]
        printf '%064d\n' 0 | tr 0 a
        ;;
    tag)
        printf '%s\n' "docker-tag:${2:-}:${3:-}" >> /opt/weknora/runtime/simulation.log
        ;;
    inspect)
        format="${4:-}"
        case "$format" in
            '{{.Id}}') printf '%064d\n' 0 | tr 0 b ;;
            '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}') printf '%s\n' healthy ;;
            '{{json .NetworkSettings.Networks}}') printf '%s\n' '{"musnow-production_edge":{"Aliases":["web"]}}' ;;
            *) printf '%s\n' "unexpected inspect: $*" >&2; exit 1 ;;
        esac
        ;;
    exec)
        printf '%s\n' "${SIM_MODEL_CATALOG_COUNT:-6}"
        ;;
    *) printf '%s\n' "unexpected docker: $*" >&2; exit 1 ;;
esac
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

run_update() {
    docker run --rm --user 0:0 \
        -v "$opt_root:/opt/weknora" \
        -e PATH='/opt/weknora/test-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' \
        -e WEKNORA_PRODUCTION_RUNTIME_DIR=/opt/weknora/runtime \
        -e WEKNORA_PRODUCTION_REVISION="$test_revision" \
        -e SIM_FAIL_PUBLIC="${SIM_FAIL_PUBLIC:-0}" \
        -e SIM_MODEL_CATALOG_COUNT="${SIM_MODEL_CATALOG_COUNT:-6}" \
        --entrypoint /bin/bash "$test_image" \
        /opt/weknora/releases/ui/source/scripts/weknora-production/update-ui-current.sh
}

reset_fixture() {
    rm -f "$opt_root/current"
    ln -s /opt/weknora/releases/old/source "$opt_root/current"
    find "$new_source" -mindepth 1 -delete
    cp -R "$old_source/." "$new_source/"
    cp "$script_dir/lib.sh" "$script_dir/update-ui-current.sh" "$new_source/scripts/weknora-production/"
    cp "$old_source/scripts/weknora-production/compose.sh" "$new_source/scripts/weknora-production/compose.sh"
    printf '%s\n' 'new-ui' > "$new_source/weknora/frontend/dist/assets/app.js"
    printf '%s\n' 'DB_DRIVER=postgres' > "$runtime_dir/production.public.env"
    printf '%s\n' \
        'VITE_AUTH_PUBLIC_ORIGIN=https://app.musuw.com' \
        'VITE_SUPABASE_URL=https://identity.example' \
        'VITE_SUPABASE_PUBLISHABLE_KEY=static-public-browser-key' \
        'VITE_WEKNORA_OAUTH_CLIENT_ID=static-native-oidc-client' > "$runtime_dir/auth-public.env"
    : > "$call_log"
    write_cutover_state "$(printf '%064d' 0 | tr 0 a)"
}

run_update >/dev/null
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/ui/source' ]
grep -Fx 'compose:build frontend' "$call_log" >/dev/null
grep -Fx 'compose:--edge up -d --no-deps --force-recreate frontend' "$call_log" >/dev/null
if grep -Eq 'compose:.*(app|down| rm|volume)|docker:.*volume' "$call_log"; then
    printf '%s\n' 'UI release touched an app or data operation' >&2
    exit 1
fi

reset_fixture
if SIM_MODEL_CATALOG_COUNT=5 run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected missing platform model catalog to reject the UI update before image work' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
if SIM_FAIL_PUBLIC=1 run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected public health failure to roll back UI update' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ "$(grep -c '^compose:' "$call_log")" -eq 3 ]
grep -Fq 'docker-tag:' "$call_log"

reset_fixture
printf '%s\n' 'backend-change' > "$new_source/weknora/backend.txt"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected non-UI source change to be rejected' >&2
    exit 1
fi
[ "$(readlink "$opt_root/current")" = '/opt/weknora/releases/old/source' ]
[ ! -s "$call_log" ]

reset_fixture
printf '%s\n' 'changed' > "$new_source/weknora/migrations/versioned/000079_fixture.up.sql"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected migration change to be rejected' >&2
    exit 1
fi
[ ! -s "$call_log" ]

reset_fixture
mkdir -p "$old_source/deploy" "$new_source/deploy"
printf '%s\n' 'DB_DRIVER=postgres' > "$old_source/deploy/production.public.env"
printf '%s\n' 'DB_DRIVER=changed' > "$new_source/deploy/production.public.env"
if run_update >/dev/null 2>&1; then
    printf '%s\n' 'expected public configuration change to be rejected' >&2
    exit 1
fi
[ ! -s "$call_log" ]

printf '%s\n' 'UI update simulation green: explicit UI allowlist, immutable migration/configuration, frontend-only build/recreate, source/image rollback'
