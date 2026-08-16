#!/usr/bin/env bash
# Local-only contract for the restricted runner -> production gate. It never
# contacts SSH, Docker or a production filesystem.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
ssh_gate="$script_dir/server/musuw-deploy-ssh-gate"
root_gate="$script_dir/server/musuw-deploy-gate"

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

[ -x "$ssh_gate" ] || fail 'restricted SSH gate is not executable'
[ -x "$root_gate" ] || fail 'privileged deploy gate is not executable'

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/musuw-deploy-gate.XXXXXX")"
root_dir="$tmp_dir/remote"
bin_dir="$tmp_dir/bin"
mkdir -p "$bin_dir"

make_remote_tree() {
    local target="$1"
    mkdir -p \
        "$target/opt/weknora/releases/old/source" \
        "$target/opt/weknora/runtime/secrets" \
        "$target/var/lib/musuw-deploy/incoming"
    chmod 700 "$target/opt/weknora/runtime" "$target/opt/weknora/runtime/secrets"
    ln -s "$target/opt/weknora/releases/old/source" "$target/opt/weknora/current"
    mkdir -p "$target/docker-root"
}

make_remote_tree "$root_dir"

verify_root="$tmp_dir/installed"
mkdir -p "$verify_root/usr/local/libexec" "$verify_root/usr/local/sbin" \
    "$verify_root/var/lib/musuw-deploy/.ssh" "$verify_root/var/lib/musuw-deploy/incoming" \
    "$verify_root/etc/sudoers.d"
cp "$ssh_gate" "$verify_root/usr/local/libexec/musuw-deploy-ssh-gate"
cp "$root_gate" "$verify_root/usr/local/sbin/musuw-deploy-gate"
printf '%s\n' 'restrict,command="/usr/local/libexec/musuw-deploy-ssh-gate" ssh-ed25519 AAAATEST deploy' \
    > "$verify_root/var/lib/musuw-deploy/.ssh/authorized_keys"
printf '%s\n' \
    'Defaults!/usr/local/sbin/musuw-deploy-gate secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"' \
    'musuw-deploy ALL=(root) NOPASSWD: /usr/local/sbin/musuw-deploy-gate' \
    > "$verify_root/etc/sudoers.d/musuw-deploy"
chmod 755 "$verify_root/usr/local/libexec/musuw-deploy-ssh-gate" "$verify_root/usr/local/sbin/musuw-deploy-gate"
chmod 644 "$verify_root/var/lib/musuw-deploy/.ssh/authorized_keys"
chmod 440 "$verify_root/etc/sudoers.d/musuw-deploy"
MUSUW_DEPLOY_GATE_VERIFY_TEST_MODE=1 MUSUW_DEPLOY_GATE_VERIFY_ROOT="$verify_root" \
    "$script_dir/server/verify-musuw-deploy-gate.sh" >/dev/null

cat > "$bin_dir/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}:${2:-}" in
    info:--format) printf '%s\n' "$MUSUW_GATE_TEST_ROOT/docker-root" ;;
    buildx:prune) printf '%s\n' 'docker-buildx-prune' >> "$MUSUW_GATE_TEST_LOG" ;;
    image:prune) printf '%s\n' 'docker-image-prune' >> "$MUSUW_GATE_TEST_LOG" ;;
    *) printf '%s\n' "unexpected docker command: $*" >&2; exit 1 ;;
esac
EOF
cat > "$bin_dir/df" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "df:$*" >> "$MUSUW_GATE_TEST_LOG"
printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on'
case "$(cat "$MUSUW_GATE_TEST_CAPACITY")" in
    high) printf '%s\n' '/dev/mock 99999999 1000000 98000000 2% /' ;;
    low) printf '%s\n' '/dev/mock 40901312 40000000 901312 98% /' ;;
    invalid) : ;;
    *) exit 1 ;;
esac
EOF
chmod +x "$bin_dir/docker" "$bin_dir/df"

export PATH="$bin_dir:$PATH"
export MUSUW_GATE_TEST_ROOT="$root_dir"
export MUSUW_GATE_TEST_LOG="$tmp_dir/gate.log"
export MUSUW_GATE_TEST_CAPACITY="$tmp_dir/capacity"
printf '%s\n' high > "$MUSUW_GATE_TEST_CAPACITY"
: > "$MUSUW_GATE_TEST_LOG"

expect_reject() {
    local command="$1"
    if MUSUW_DEPLOY_GATE_TEST_MODE=1 \
        MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
        SSH_ORIGINAL_COMMAND="$command" \
        "$ssh_gate" >/dev/null 2>&1; then
        fail "restricted gate accepted: $command"
    fi
}

expect_accept() {
    local command="$1"
    MUSUW_DEPLOY_GATE_TEST_MODE=1 \
        MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
        SSH_ORIGINAL_COMMAND="$command" \
        "$ssh_gate" >/dev/null
}

# Parser rejects shell escapes, path traversal, read/sender mode and destructive
# rsync flags before it can reach sudo or a server-side process.
expect_reject 'bash -c id'
expect_reject 'sh -c id'
expect_reject 'musuw-gate preflight update ../release deadbeef 1'
expect_reject 'musuw-gate preflight update safe-id 0123456789012345678901234567890123456789 1;id'
expect_reject 'musuw-gate preflight update low-capacity 0123456789012345678901234567890123456789 1'
cat > "$bin_dir/accept-wrapper" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$bin_dir/accept-wrapper"
export MUSUW_DEPLOY_GATE_WRAPPER="$bin_dir/accept-wrapper"
expect_reject 'musuw-gate preflight update digest-shaped 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef 12582912'
unset MUSUW_DEPLOY_GATE_WRAPPER
expect_reject 'rsync --server --sender -l . /etc/'
expect_reject 'rsync --server -l --delete . /var/lib/musuw-deploy/incoming/safe/source/weknora/'
expect_reject 'rsync --server -l --rsync-path=/bin/sh . /var/lib/musuw-deploy/incoming/safe/source/weknora/'
expect_reject 'rsync --server -l . /var/lib/musuw-deploy/incoming/../escape/source/weknora/'
for forbidden_flag in -R -K -L -b -e -f; do
    expect_reject "rsync --server -l $forbidden_flag . /var/lib/musuw-deploy/incoming/safe/source/weknora/"
done

# A harmless push command reaches the test rsync executable and is constrained
# to the incoming spool. The test mode wrapper does not require sudo.
rsync_log="$tmp_dir/rsync.log"
cat > "$bin_dir/rsync-test" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$MUSUW_GATE_TEST_RSYNC_LOG"
EOF
chmod +x "$bin_dir/rsync-test"
export MUSUW_GATE_TEST_RSYNC_LOG="$rsync_log"
MUSUW_DEPLOY_GATE_TEST_MODE=1 \
MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
MUSUW_DEPLOY_GATE_RSYNC_BIN="$bin_dir/rsync-test" \
SSH_ORIGINAL_COMMAND='rsync --server -l --partial -p -D -r -t --dirs . /var/lib/musuw-deploy/incoming/safe/source/weknora/' \
    "$ssh_gate" >/dev/null
grep -Fq '/var/lib/musuw-deploy/incoming/safe/source/weknora/' "$rsync_log" || fail 'safe rsync push did not reach the constrained server'
SSH_ORIGINAL_COMMAND='rsync --server -l --partial -p -D -r -t --dirs . /var/lib/musuw-deploy/incoming/safe/source/' \
    MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    MUSUW_DEPLOY_GATE_RSYNC_BIN="$bin_dir/rsync-test" \
    "$ssh_gate" >/dev/null
grep -Fq '/var/lib/musuw-deploy/incoming/safe/source/' "$rsync_log" || fail 'safe root rsync push did not reach the constrained server'

# Ubuntu rsync 3.2.7 combines the server flags into this exact generated
# token; the gate accepts it only when the complete known protocol shape is
# present (not a standalone dangerous short flag).
SSH_ORIGINAL_COMMAND='rsync --server -vlDtpre.iLsfxCIvu --partial . /var/lib/musuw-deploy/incoming/safe/source/' \
    MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    MUSUW_DEPLOY_GATE_RSYNC_BIN="$bin_dir/rsync-test" \
    "$ssh_gate" >/dev/null
grep -Fq -- '-vlDtpre.iLsfxCIvu' "$rsync_log" || fail 'Ubuntu combined rsync server flags were rejected'
SSH_ORIGINAL_COMMAND='rsync --server -lDtpre.iLsfxCIvu --partial --timeout=120 . /var/lib/musuw-deploy/incoming/safe/source/' \
    MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    MUSUW_DEPLOY_GATE_RSYNC_BIN="$bin_dir/rsync-test" \
    "$ssh_gate" >/dev/null
grep -Fq -- '-lDtpre.iLsfxCIvu' "$rsync_log" || fail 'Ubuntu combined rsync flags without verbose were rejected'
expect_reject 'rsync --server -vlDtpre.iLsfxCIvuR --partial . /var/lib/musuw-deploy/incoming/safe/source/'
expect_reject 'rsync --server -lLptrDv --partial . /var/lib/musuw-deploy/incoming/safe/source/'
expect_reject 'rsync --server -lDtpre.iLsfxCIvu --partial --timeout=1 . /var/lib/musuw-deploy/incoming/safe/source/'

make_source_bundle() {
    local source="$1" runtime="$2" manifest_dir="$3"
    mkdir -p \
        "$source/weknora" "$source/auth" "$source/integration/weknora-production" \
        "$source/scripts/weknora-production" "$source/deploy" "$runtime"
    printf '%s\n' 'APP_EXTERNAL_URL=https://app.musuw.com' > "$runtime/production.public.env"
    printf '%s\n' 'VITE_SUPABASE_URL=https://example.supabase.co' > "$runtime/auth-public.env"
    cp "$runtime/production.public.env" "$source/deploy/production.public.env"
    cp "$runtime/auth-public.env" "$source/deploy/auth-public.env"
    cp "$script_dir/source-manifest.sh" "$source/scripts/weknora-production/source-manifest.sh"
    cp "$script_dir/lib.sh" "$source/scripts/weknora-production/lib.sh"
    cat > "$source/scripts/weknora-production/release-ci.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' ran > "$MUSUW_GATE_TEST_RUN_MARKER"
EOF
    chmod +x "$source/scripts/weknora-production/release-ci.sh"
    printf '%s\n' example > "$source/weknora/.env.example"
    printf '%s\n' 'services: {}' > "$source/integration/weknora-production/compose.yaml"
    mkdir -p "$source/weknora/frontend/dist/assets" "$source/auth/dist/assets"
    printf '%s\n' '<html></html>' > "$source/weknora/frontend/dist/index.html"
    printf '%s\n' 'asset' > "$source/weknora/frontend/dist/assets/app.js"
    printf '%s\n' '<html></html>' > "$source/auth/dist/index.html"
    printf '%s\n' 'asset' > "$source/auth/dist/assets/app.js"
    git -C "$source" init -q
    git -C "$source" config user.email fixture@example.test
    git -C "$source" config user.name fixture
    git -C "$source" add -A
    git -C "$source" commit -qm fixture
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
        bash "$source/scripts/weknora-production/source-manifest.sh" generate \
        "$source" "$runtime" 'safe-release' \
        '0123456789012345678901234567890123456789' update "$manifest_dir" >/dev/null
    cp "$manifest_dir/source-manifest.sha256" "$source/deploy/source-manifest.sha256"
    cp "$manifest_dir/release-manifest.json" "$source/deploy/release-manifest.json"
    cp "$manifest_dir/release-manifest.json.sha256" "$source/deploy/release-manifest.json.sha256"
    rm -rf "$source/.git"
}

printf '%s\n' high > "$MUSUW_GATE_TEST_CAPACITY"
if MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    "$root_gate" preflight update direct-low 0123456789012345678901234567890123456789 1 2>/dev/null; then
    fail 'privileged gate accepted a caller-controlled capacity below the production floor'
fi
preflight_cmd='musuw-gate preflight update safe-release 0123456789012345678901234567890123456789 12582912'
expect_accept "$preflight_cmd"
spool="$root_dir/var/lib/musuw-deploy/incoming/safe-release"
mkdir -p "$spool/source/scripts/weknora-production" "$spool/source/deploy"
bundle_runtime="$tmp_dir/bundle-runtime"
manifest_dir="$tmp_dir/manifest"
make_source_bundle "$spool/source" "$bundle_runtime" "$manifest_dir"

MUSUW_DEPLOY_GATE_TEST_MODE=1 \
MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
MUSUW_GATE_TEST_RUN_MARKER="$tmp_dir/run.marker" \
    "$root_gate" promote update safe-release 0123456789012345678901234567890123456789
test -d "$root_dir/opt/weknora/releases/safe-release/source" || fail 'promote did not create an immutable release'
test ! -e "$spool/source" || fail 'promote left writable source in the spool'
test ! -w "$root_dir/opt/weknora/releases/safe-release/source/weknora" || fail 'promoted source remains writable after freeze'

# An uploaded symlink is rejected before manifest verification; this is a
# separate release id so the previous promoted release remains untouched.
printf '%s\n' high > "$MUSUW_GATE_TEST_CAPACITY"
MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    "$root_gate" preflight update symlink-release 0123456789012345678901234567890123456789 12582912
symlink_spool="$root_dir/var/lib/musuw-deploy/incoming/symlink-release/source"
mkdir -p "$symlink_spool"
ln -s /etc/passwd "$symlink_spool/escape"
if MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    "$root_gate" promote update symlink-release 012345678901234567890123456789 2>/dev/null; then
    fail 'promote accepted an uploaded symlink'
fi

# FIFOs/devices/sockets are rejected as well; only regular manifest files may
# cross the privileged promote seam.
printf '%s\n' high > "$MUSUW_GATE_TEST_CAPACITY"
MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    "$root_gate" preflight update special-release 0123456789012345678901234567890123456789 12582912
special_spool="$root_dir/var/lib/musuw-deploy/incoming/special-release/source"
mkdir -p "$special_spool"
mkfifo "$special_spool/escape.pipe"
if MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    "$root_gate" promote update special-release 0123456789012345678901234567890123456789 2>/dev/null; then
    fail 'promote accepted an uploaded special file'
fi

# Secret-volume and capacity checks fail closed before any source transfer.
secret_root="$tmp_dir/secret-root"
make_remote_tree "$secret_root"
printf '%s\n' high > "$MUSUW_GATE_TEST_CAPACITY"
mv "$secret_root/opt/weknora/runtime/secrets" "$secret_root/opt/weknora/runtime/secrets-dir"
ln -s "$secret_root/opt/weknora/runtime/secrets-dir" "$secret_root/opt/weknora/runtime/secrets"
if MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$secret_root" \
    "$root_gate" preflight update bad-secret 0123456789012345678901234567890123456789 12582912 2>/dev/null; then
    fail 'preflight accepted a symlinked secret volume'
fi

low_root="$tmp_dir/low-root"
make_remote_tree "$low_root"
printf '%s\n' low > "$MUSUW_GATE_TEST_CAPACITY"
if MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$low_root" \
    "$root_gate" preflight update low-capacity 0123456789012345678901234567890123456789 12582912 2>/dev/null; then
    fail 'preflight accepted persistently low capacity'
fi
grep -Fq docker-buildx-prune "$MUSUW_GATE_TEST_LOG" || fail 'low capacity did not perform one cache cleanup attempt'

# A release helper failure does not mutate current; the existing release-ci
# trap remains the owner of cutover rollback, while the wrapper is fail-closed.
MUSUW_DEPLOY_GATE_TEST_MODE=1 MUSUW_DEPLOY_GATE_ROOT="$root_dir" \
    MUSUW_GATE_TEST_RUN_MARKER="$tmp_dir/run.marker" \
    "$root_gate" run update safe-release 0123456789012345678901234567890123456789
test -f "$tmp_dir/run.marker" || fail 'run did not invoke the fixed release helper'
test "$(readlink "$root_dir/opt/weknora/current")" = "$root_dir/opt/weknora/releases/old/source" || \
    fail 'gate run changed current before the release helper'

printf '%s\n' 'restricted musuw-deploy gate simulation green'
