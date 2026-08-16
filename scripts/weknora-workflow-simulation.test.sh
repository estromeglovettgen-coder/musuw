#!/usr/bin/env bash
# Behavior contract for the two operator entry points. All external effects are
# replaced with temporary scripts; this test never starts Docker or opens SSH.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

fake_repo="$tmp_dir/repo"
call_log="$tmp_dir/calls.log"
bin_dir="$tmp_dir/bin"
remote_root="$tmp_dir/remote-opt-weknora"
remote_bin="$tmp_dir/remote-bin"
remote_docker_root="$tmp_dir/remote-docker-root"
remote_capacity_state="$tmp_dir/remote-capacity-state"
test_key="$tmp_dir/test-key"
known_hosts_file="$tmp_dir/known-hosts"
mkdir -p \
    "$fake_repo/scripts/weknora-candidate" \
    "$fake_repo/scripts/weknora-production" \
    "$fake_repo/weknora/frontend/dist/assets" \
    "$fake_repo/auth/dist/assets" \
    "$fake_repo/integration/weknora-production" \
    "$fake_repo/.runtime/weknora-production" \
    "$bin_dir" \
    "$remote_root/releases/current/source" \
    "$remote_root/runtime/secrets" \
    "$remote_bin" \
    "$remote_docker_root"
ln -s "$remote_root/releases/current/source" "$remote_root/current"

cp "$repo_root/scripts/weknora-local.sh" "$fake_repo/scripts/weknora-local.sh"
cp "$repo_root/scripts/weknora-deploy.sh" "$fake_repo/scripts/weknora-deploy.sh"
cp "$repo_root/scripts/weknora-production/lib.sh" "$fake_repo/scripts/weknora-production/lib.sh"
cp "$repo_root/scripts/weknora-production/source-manifest.sh" "$fake_repo/scripts/weknora-production/source-manifest.sh"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > "$fake_repo/scripts/weknora-production/release-ci.sh"
chmod +x "$fake_repo/scripts/weknora-production/source-manifest.sh" "$fake_repo/scripts/weknora-production/release-ci.sh"
cp "$repo_root/scripts/musuw-release-ui" "$fake_repo/scripts/musuw-release-ui"
printf '%s\n' '<html></html>' > "$fake_repo/weknora/frontend/dist/index.html"
printf '%s\n' 'asset' > "$fake_repo/weknora/frontend/dist/assets/app.js"
printf '%s\n' '<html></html>' > "$fake_repo/auth/dist/index.html"
printf '%s\n' 'asset' > "$fake_repo/auth/dist/assets/auth.js"
printf '%s\n' 'public config' > "$fake_repo/.runtime/weknora-production/production.public.env"
printf '%s\n' 'auth config' > "$fake_repo/.runtime/weknora-production/auth-public.env"
printf '%s\n' 'compose' > "$fake_repo/weknora/docker-compose.yml"
printf '%s\n' 'overlay' > "$fake_repo/integration/weknora-production/compose.yaml"

make_candidate_fake() {
    local name="$1"
    cat > "$fake_repo/scripts/weknora-candidate/$name" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "candidate:$(basename "$0"):$*" >> "$WEKNORA_TEST_CALL_LOG"
EOF
    chmod +x "$fake_repo/scripts/weknora-candidate/$name"
}
for helper in prepare-runtime.sh prepare-local-runtime.sh verify-topology.sh clone-rehearsal-volumes.sh compose.sh verify-runtime.sh build-auth-shell.sh; do
    make_candidate_fake "$helper"
done

cat > "$fake_repo/scripts/weknora-production/verify-static.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' 'production:verify-static' >> "$WEKNORA_TEST_CALL_LOG"
EOF
chmod +x "$fake_repo/scripts/weknora-production/verify-static.sh"
cat > "$fake_repo/scripts/weknora-production/build-static.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' 'production:build-static' >> "$WEKNORA_TEST_CALL_LOG"
EOF
chmod +x "$fake_repo/scripts/weknora-production/build-static.sh"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > "$fake_repo/scripts/weknora-production/update-current.sh"
chmod +x "$fake_repo/scripts/weknora-production/update-current.sh"
cp "$repo_root/scripts/weknora-production/update-ui-current.sh" "$fake_repo/scripts/weknora-production/update-ui-current.sh"

# Ignore nested local material so the test proves the manifest materializer,
# rather than rsync excludes, is the only release transfer boundary.
printf '%s\n' 'weknora/frontend/.env.local' 'auth/debug.dump' > "$fake_repo/.gitignore"
printf '%s\n' 'ignored nested env' > "$fake_repo/weknora/frontend/.env.local"
printf '%s\n' 'ignored nested dump' > "$fake_repo/auth/debug.dump"

cat > "$bin_dir/ssh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'ssh:' >> "$WEKNORA_TEST_CALL_LOG"
printf ' %q' "$@" >> "$WEKNORA_TEST_CALL_LOG"
printf '\n' >> "$WEKNORA_TEST_CALL_LOG"
remote_command="${!#}"
if [[ "$remote_command" == musuw-gate\ preflight\ update\ * ]]; then
    printf '%s\n' "gate:preflight:$remote_command" >> "$WEKNORA_TEST_CALL_LOG"
    printf '%s\n' 'df -Pk /' >> "$WEKNORA_TEST_CALL_LOG"
    printf '%s\n' "df -Pk $WEKNORA_TEST_REMOTE_DOCKER_ROOT" >> "$WEKNORA_TEST_CALL_LOG"
    printf '%s\n' 'df:/' >> "$WEKNORA_TEST_CALL_LOG"
    printf '%s\n' "df:$WEKNORA_TEST_REMOTE_DOCKER_ROOT" >> "$WEKNORA_TEST_CALL_LOG"
    case "$(cat "$WEKNORA_TEST_REMOTE_CAPACITY_STATE")" in
        high) ;;
        low)
            printf '%s\n' 'docker:buildx prune --all --force' >> "$WEKNORA_TEST_CALL_LOG"
            printf '%s\n' 'docker:image prune --force' >> "$WEKNORA_TEST_CALL_LOG"
            if [ "${WEKNORA_TEST_CAPACITY_MODE:-normal}" = recover ]; then
                printf '%s\n' high > "$WEKNORA_TEST_REMOTE_CAPACITY_STATE"
            fi
            printf '%s\n' 'df -Pk /' >> "$WEKNORA_TEST_CALL_LOG"
            printf '%s\n' "df -Pk $WEKNORA_TEST_REMOTE_DOCKER_ROOT" >> "$WEKNORA_TEST_CALL_LOG"
            printf '%s\n' 'df:/' >> "$WEKNORA_TEST_CALL_LOG"
            printf '%s\n' "df:$WEKNORA_TEST_REMOTE_DOCKER_ROOT" >> "$WEKNORA_TEST_CALL_LOG"
            [ "${WEKNORA_TEST_CAPACITY_MODE:-normal}" = recover ] || exit 1
            ;;
        invalid) exit 1 ;;
        *) exit 1 ;;
    esac
    printf '%s\n' 'gate:current=/opt/weknora/current runtime=/opt/weknora/runtime' >> "$WEKNORA_TEST_CALL_LOG"
elif [[ "$remote_command" == musuw-gate\ promote\ update\ * ]]; then
    printf '%s\n' "gate:promote:$remote_command" >> "$WEKNORA_TEST_CALL_LOG"
    printf '%s\n' "$remote_command /opt/weknora/releases" >> "$WEKNORA_TEST_CALL_LOG"
elif [[ "$remote_command" == musuw-gate\ run\ update\ * ]]; then
    printf '%s\n' "gate:run:$remote_command release-ci.sh" >> "$WEKNORA_TEST_CALL_LOG"
elif [[ "$remote_command" == *'df -Pk'* ]]; then
    remote_command="${remote_command//\/opt\/weknora/$WEKNORA_TEST_REMOTE_ROOT}"
    PATH="$WEKNORA_TEST_REMOTE_BIN:$PATH" bash -c "$remote_command"
fi
EOF
cat > "$bin_dir/rsync" <<'EOF'
#!/usr/bin/env bash
printf 'rsync:' >> "$WEKNORA_TEST_CALL_LOG"
printf ' %q' "$@" >> "$WEKNORA_TEST_CALL_LOG"
printf '\n' >> "$WEKNORA_TEST_CALL_LOG"
EOF
cat > "$bin_dir/npm" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "npm:$PWD:$*" >> "$WEKNORA_TEST_CALL_LOG"
EOF
chmod +x "$bin_dir/ssh" "$bin_dir/rsync" "$bin_dir/npm"

cat > "$remote_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}:${2:-}" in
    info:--format)
        printf '%s\n' "$WEKNORA_TEST_REMOTE_DOCKER_ROOT"
        ;;
    buildx:prune)
        [ "${3:-}" = --all ] && [ "${4:-}" = --force ] && [ -z "${5:-}" ]
        printf '%s\n' 'docker:buildx prune --all --force' >> "$WEKNORA_TEST_CALL_LOG"
        if [ "${WEKNORA_TEST_CAPACITY_MODE:-normal}" = recover ]; then
            printf '%s\n' high > "$WEKNORA_TEST_REMOTE_CAPACITY_STATE"
        fi
        ;;
    image:prune)
        [ "${3:-}" = --force ]
        printf '%s\n' 'docker:image prune --force' >> "$WEKNORA_TEST_CALL_LOG"
        ;;
    *)
        printf '%s\n' "unexpected remote docker command: $*" >&2
        exit 1
        ;;
esac
EOF
cat > "$remote_bin/df" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "df:${*: -1}" >> "$WEKNORA_TEST_CALL_LOG"
printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on'
case "$(cat "$WEKNORA_TEST_REMOTE_CAPACITY_STATE")" in
    low) printf '%s\n' '/dev/mock 40901312 40000000 901312 98% /' ;;
    invalid) : ;;
    *) printf '%s\n' '/dev/mock 99999999 1000000 98000000 2% /' ;;
esac
EOF
chmod +x "$remote_bin/docker" "$remote_bin/df"

git -C "$fake_repo" init -q
git -C "$fake_repo" config user.email fixture@example.test
git -C "$fake_repo" config user.name fixture
git -C "$fake_repo" add -A
git -C "$fake_repo" commit -qm fixture
fixture_revision="$(git -C "$fake_repo" rev-parse HEAD)"

export WEKNORA_TEST_CALL_LOG="$call_log"
export PATH="$bin_dir:$PATH"
export WEKNORA_TEST_REMOTE_ROOT="$remote_root"
export WEKNORA_TEST_REMOTE_BIN="$remote_bin"
export WEKNORA_TEST_REMOTE_DOCKER_ROOT="$remote_docker_root"
export WEKNORA_TEST_REMOTE_CAPACITY_STATE="$remote_capacity_state"
# CI's GITHUB_SHA identifies the outer checkout, not this isolated fixture.
# Pin the deploy seam to the fixture commit so its clean-checkout gate remains
# exercised without weakening the production revision contract.
export WEKNORA_DEPLOY_REVISION="$fixture_revision"
# Keep the simulation independent from a developer or hosted runner's SSH home.
# This is a pinned fixture only; production still fails closed when the caller
# does not provide WEKNORA_DEPLOY_KNOWN_HOSTS_FILE.
umask 077
: > "$test_key"
printf '%s\n' 'example.test ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA simulation-fixture' > "$known_hosts_file"
chmod 600 "$test_key" "$known_hosts_file"
export WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file"

assert_capacity_cleanup_sequence() {
    local first_df_line buildx_line image_line last_df_line
    first_df_line="$(awk '/^df:/{ print NR; exit }' "$call_log")"
    buildx_line="$(awk '/^docker:buildx prune --all --force$/{ print NR; exit }' "$call_log")"
    image_line="$(awk '/^docker:image prune --force$/{ print NR; exit }' "$call_log")"
    last_df_line="$(awk '/^df:/{ line=NR } END { print line }' "$call_log")"
    [ -n "$first_df_line" ] && [ -n "$buildx_line" ] && [ -n "$image_line" ] && [ -n "$last_df_line" ]
    [ "$first_df_line" -lt "$buildx_line" ]
    [ "$buildx_line" -lt "$image_line" ]
    [ "$image_line" -lt "$last_df_line" ]
}

"$fake_repo/scripts/weknora-local.sh" up
grep -Fx 'candidate:prepare-local-runtime.sh:' "$call_log" >/dev/null
grep -Fx 'candidate:verify-topology.sh:' "$call_log" >/dev/null
grep -Fx 'candidate:compose.sh:up -d --no-build' "$call_log" >/dev/null
grep -Fx 'candidate:compose.sh:up -d --no-build --no-deps --force-recreate frontend' "$call_log" >/dev/null
grep -Fx 'candidate:verify-runtime.sh:' "$call_log" >/dev/null
if grep -q 'clone-rehearsal-volumes' "$call_log"; then
    printf '%s\n' 'local workflow still depends on a one-time rehearsal volume' >&2
    exit 1
fi

: > "$call_log"
"$fake_repo/scripts/weknora-local.sh" rebuild
grep -Fx "npm:$fake_repo/weknora/frontend:run build" "$call_log" >/dev/null
grep -Fx 'candidate:build-auth-shell.sh:' "$call_log" >/dev/null
grep -Fx 'candidate:compose.sh:build frontend app' "$call_log" >/dev/null
grep -Fx 'candidate:compose.sh:up -d --no-build' "$call_log" >/dev/null
grep -Fx 'candidate:verify-runtime.sh:' "$call_log" >/dev/null

: > "$call_log"
"$fake_repo/scripts/weknora-local.sh" logs app
"$fake_repo/scripts/weknora-local.sh" down
grep -Fx 'candidate:compose.sh:logs --follow --tail=200 app' "$call_log" >/dev/null
grep -Fx 'candidate:compose.sh:stop' "$call_log" >/dev/null

: > "$call_log"
if WEKNORA_DEPLOY_MIN_FREE_KIB=1 \
    WEKNORA_DEPLOY_RELEASE_ID=weknora-update-below-floor \
    WEKNORA_DEPLOY_REMOTE=musuw-deploy@example.test \
    WEKNORA_DEPLOY_SSH_KEY="$test_key" \
    WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/weknora-deploy.sh" update >/dev/null 2>&1; then
    printf '%s\n' 'expected runner to reject a capacity reserve below the production floor' >&2
    exit 1
fi
if [ -s "$call_log" ]; then
    printf '%s\n' 'below-floor runner rejection performed an external operation' >&2
    exit 1
fi

printf '%s\n' low > "$remote_capacity_state"
if WEKNORA_TEST_CAPACITY_MODE=exhausted \
    WEKNORA_DEPLOY_RELEASE_ID=weknora-update-low-capacity \
    WEKNORA_DEPLOY_REMOTE=musuw-deploy@example.test \
    WEKNORA_DEPLOY_SSH_KEY="$test_key" \
    WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/weknora-deploy.sh" update >/dev/null 2>&1; then
    printf '%s\n' 'expected persistently low production capacity to reject a full release before transfer' >&2
    exit 1
fi
grep -q 'df.*Pk' "$call_log"
grep -Fx 'docker:buildx prune --all --force' "$call_log" >/dev/null
grep -Fx 'docker:image prune --force' "$call_log" >/dev/null
[ "$(grep -c '^df:' "$call_log")" -ge 2 ]
assert_capacity_cleanup_sequence
if grep -q '^rsync:' "$call_log" || grep -q 'update-current.sh' "$call_log"; then
    printf '%s\n' 'persistently low-capacity release performed a transfer or activation' >&2
    exit 1
fi

: > "$call_log"
printf '%s\n' invalid > "$remote_capacity_state"
if WEKNORA_DEPLOY_RELEASE_ID=weknora-update-invalid-capacity \
    WEKNORA_DEPLOY_REMOTE=musuw-deploy@example.test \
    WEKNORA_DEPLOY_SSH_KEY="$test_key" \
    WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/weknora-deploy.sh" update >/dev/null 2>&1; then
    printf '%s\n' 'expected indeterminate production capacity to reject a full release before transfer' >&2
    exit 1
fi
grep -q '^df:' "$call_log"
if grep -q '^docker:' "$call_log" || grep -q '^rsync:' "$call_log" || grep -q 'update-current.sh' "$call_log"; then
    printf '%s\n' 'indeterminate-capacity release performed cleanup, transfer, or activation' >&2
    exit 1
fi

: > "$call_log"
printf '%s\n' low > "$remote_capacity_state"
WEKNORA_TEST_CAPACITY_MODE=recover \
WEKNORA_DEPLOY_RELEASE_ID=weknora-update-recovered-capacity \
WEKNORA_DEPLOY_REMOTE=musuw-deploy@example.test \
WEKNORA_DEPLOY_SSH_KEY="$test_key" \
WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/weknora-deploy.sh" update

grep -Fx 'production:verify-static' "$call_log" >/dev/null
grep -Fx 'production:build-static' "$call_log" >/dev/null
grep -Fx 'docker:buildx prune --all --force' "$call_log" >/dev/null
grep -Fx 'docker:image prune --force' "$call_log" >/dev/null
[ "$(grep -c '^df:' "$call_log")" -ge 3 ]
assert_capacity_cleanup_sequence
grep -q '/opt/weknora/current' "$call_log"
grep -q '/opt/weknora/releases' "$call_log"
grep -q '/opt/weknora/runtime' "$call_log"
grep -q 'gate:run:.*release-ci.sh' "$call_log"
grep -q '/var/lib/musuw-deploy/incoming/weknora-update-recovered-capacity/source' "$call_log"
grep -q 'weknora-deploy-tree' "$call_log"
if grep -q "$fake_repo/weknora/" "$call_log" ||
   grep -q "$fake_repo/auth/" "$call_log" ||
   grep -q '.env.local' "$call_log" ||
   grep -q 'debug.dump' "$call_log"; then
    printf '%s\n' 'full release transfer exposed mutable worktree or ignored nested material' >&2
    exit 1
fi
if grep -q -- "--link-dest=/opt/weknora/current" "$call_log"; then
    printf '%s\n' 'full restricted transfer still links directly from the serving tree' >&2
    exit 1
fi
if grep -q '^rsync:.*\/secrets' "$call_log"; then
    printf '%s\n' 'deploy transfer exposed a secret path' >&2
    exit 1
fi

: > "$call_log"
printf '%s\n' high > "$remote_capacity_state"
WEKNORA_DEPLOY_RELEASE_ID=weknora-update-normal-capacity \
WEKNORA_DEPLOY_REMOTE=musuw-deploy@example.test \
WEKNORA_DEPLOY_SSH_KEY="$test_key" \
WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/weknora-deploy.sh" update

[ "$(grep -c '^df:' "$call_log")" -ge 2 ]
if grep -q '^docker:' "$call_log"; then
    printf '%s\n' 'sufficient-capacity full release performed Docker capacity maintenance' >&2
    exit 1
fi

: > "$call_log"
printf '%s\n' high > "$remote_capacity_state"
# The legacy UI path must not silently reuse the restricted production key or
# target. Supplying only those variables fails before any build or SSH effect.
if WEKNORA_DEPLOY_RELEASE_ID=weknora-ui-missing-legacy-inputs \
    WEKNORA_DEPLOY_REMOTE=musuw-deploy@example.test \
    WEKNORA_DEPLOY_SSH_KEY="$test_key" \
    WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/musuw-release-ui" >/dev/null 2>&1; then
    printf '%s\n' 'legacy UI path reused restricted SSH inputs' >&2
    exit 1
fi
if [ -s "$call_log" ]; then
    printf '%s\n' 'legacy UI missing-input rejection performed an external operation' >&2
    exit 1
fi

WEKNORA_DEPLOY_RELEASE_ID=weknora-ui-test \
WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE=root@example.test \
WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY="$test_key" \
WEKNORA_DEPLOY_KNOWN_HOSTS_FILE="$known_hosts_file" \
    "$fake_repo/scripts/musuw-release-ui"

grep -q '/opt/weknora/releases/weknora-ui-test/source' "$call_log"
grep -q 'update-ui-current.sh' "$call_log"
grep -q 'weknora-deploy-tree' "$call_log"
if grep -q "$fake_repo/weknora/frontend/" "$call_log" ||
   grep -q "$fake_repo/auth/" "$call_log" ||
   grep -q "$fake_repo/integration/weknora-production/" "$call_log" ||
   grep -q '.env.local' "$call_log" ||
   grep -q 'debug.dump' "$call_log"; then
    printf '%s\n' 'UI deploy transferred a non-UI source tree' >&2
    exit 1
fi
if grep -q '^rsync:.*\/secrets' "$call_log"; then
    printf '%s\n' 'UI deploy transfer exposed a secret path' >&2
    exit 1
fi
if grep -q '^docker:' "$call_log" || grep -q '^df:' "$call_log"; then
    printf '%s\n' 'UI deploy performed full-release capacity maintenance' >&2
    exit 1
fi

update_helper="$repo_root/scripts/weknora-production/update-current.sh"
grep -Fq 'weknora-v072-production-postgres-data' "$update_helper"
grep -Fq 'weknora-v072-production-data-files' "$update_helper"
grep -Fq 'weknora_production_require_additive_versioned_migrations' "$update_helper"
grep -Fq 'configuration requires a full native-stack release' "$update_helper"
grep -Fq 'up -d --no-deps --force-recreate app frontend' "$update_helper"
grep -Fq 'refresh_cutover_state' "$update_helper"
grep -Fq 'weknora_production_require_disk_reserve' "$update_helper"
if grep -Eq 'docker[[:space:]]+volume[[:space:]]+(rm|prune)|compose[^\n]*(down|rm)|rm[[:space:]].*(secrets|postgres-data|data-files)' "$update_helper"; then
    printf '%s\n' 'daily update helper contains a data-destructive operation' >&2
    exit 1
fi

deploy_helper="$repo_root/scripts/weknora-deploy.sh"
grep -Fq 'docker buildx prune --all --force' "$repo_root/scripts/weknora-production/server/musuw-deploy-gate"
grep -Fq 'docker image prune --force' "$repo_root/scripts/weknora-production/server/musuw-deploy-gate"
if grep -Eq 'docker[[:space:]]+(system|container|volume)[[:space:]]+prune|docker[[:space:]]+volume[[:space:]]+rm' "$deploy_helper"; then
    printf '%s\n' 'deploy helper contains a disallowed destructive Docker cleanup' >&2
    exit 1
fi

ui_update_helper="$repo_root/scripts/weknora-production/update-ui-current.sh"
grep -Fq 'require_ui_only_source_delta' "$ui_update_helper"
grep -Fq 'UI update may not change migration history' "$ui_update_helper"
grep -Fq 'UI update may not change production integration configuration' "$ui_update_helper"
grep -Fq 'compose.sh" build frontend' "$ui_update_helper"
grep -Fq 'up -d --no-deps --force-recreate frontend' "$ui_update_helper"
if grep -Eq 'build[[:space:]]+.*app|force-recreate[[:space:]]+app|docker[[:space:]]+volume[[:space:]]+(rm|prune)|compose[^\n]*(down|rm)' "$ui_update_helper"; then
    printf '%s\n' 'UI update helper contains an app or data-destructive operation' >&2
    exit 1
fi

printf '%s\n' 'WeKnora workflow simulation green: local lifecycle, source-only transfer, fixed-volume live update contract, UI-only frontend path'
