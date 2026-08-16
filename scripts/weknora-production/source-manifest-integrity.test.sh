#!/usr/bin/env bash
# TDD contract for the full-release source boundary. The fixture models the
# clean GitHub checkout used by production and proves dirty/untracked source,
# revision mismatch and worktree-walking manifests fail closed.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/musuw-source-integrity.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

fixture="$tmp_dir/repo"
runtime="$tmp_dir/runtime"
output="$tmp_dir/manifest"
mkdir -p \
    "$fixture/weknora/frontend" \
    "$fixture/auth" \
    "$fixture/integration/weknora-production" \
    "$fixture/scripts/weknora-production" \
    "$runtime"

printf '%s\n' 'tracked source' > "$fixture/weknora/app.go"
printf '%s\n' 'tracked auth' > "$fixture/auth/app.ts"
printf '%s\n' 'services: {}' > "$fixture/integration/weknora-production/compose.yaml"
printf '%s\n' 'auth/*.dump' 'weknora/frontend/.env.local' > "$fixture/.gitignore"
cp "$script_dir/lib.sh" "$fixture/scripts/weknora-production/lib.sh"
cp "$script_dir/source-manifest.sh" "$fixture/scripts/weknora-production/source-manifest.sh"
printf '%s\n' 'PUBLIC_APP=https://app.musuw.com' > "$runtime/production.public.env"
printf '%s\n' 'PUBLIC_AUTH=https://auth.musuw.com' > "$runtime/auth-public.env"

git -C "$fixture" init -q
git -C "$fixture" config user.email fixture@example.test
git -C "$fixture" config user.name fixture
git -C "$fixture" add -A
git -C "$fixture" commit -qm 'clean fixture'
revision="$(git -C "$fixture" rev-parse HEAD)"

expect_reject() {
    local message="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        printf '%s\n' "$message" >&2
        exit 1
    fi
}

run_clean_check() {
    local root="$1"
    local selected_revision="$2"
    bash -c '. "$1"; weknora_production_require_clean_checkout "$2" "$3"' \
        bash "$script_dir/lib.sh" "$root" "$selected_revision"
}

# A clean immutable checkout is the GitHub production acceptance path.
run_clean_check "$fixture" "$revision"

# Build output is the only untracked surface tolerated by the full-release
# check; it is never selected by source-manifest.sh.
mkdir -p "$fixture/weknora/frontend/dist/assets" "$fixture/auth/node_modules/pkg"
printf '%s\n' '<html></html>' > "$fixture/weknora/frontend/dist/index.html"
printf '%s\n' 'generated' > "$fixture/weknora/frontend/dist/assets/app.js"
mkdir -p "$fixture/auth/dist/assets"
printf '%s\n' '<html></html>' > "$fixture/auth/dist/index.html"
printf '%s\n' 'generated' > "$fixture/auth/dist/assets/app.js"
printf '%s\n' 'dependency' > "$fixture/auth/node_modules/pkg/index.js"
run_clean_check "$fixture" "$revision"

# Untracked secret/debug material is not a generated exception.
printf '%s\n' 'debug secret' > "$fixture/weknora/debug.dump"
expect_reject 'clean-check accepted an untracked debug/secret file' \
    run_clean_check "$fixture" "$revision"
rm -f "$fixture/weknora/debug.dump"

# Both worktree edits and staged source edits fail before source-manifest or
# build/upload can run.
printf '%s\n' 'modified' > "$fixture/weknora/app.go"
expect_reject 'clean-check accepted a modified tracked source file' \
    run_clean_check "$fixture" "$revision"
git -C "$fixture" restore --worktree weknora/app.go
printf '%s\n' 'staged' > "$fixture/weknora/app.go"
git -C "$fixture" add weknora/app.go
expect_reject 'clean-check accepted a staged tracked source file' \
    run_clean_check "$fixture" "$revision"
git -C "$fixture" restore --staged --worktree weknora/app.go

# A requested revision that is not the checked-out HEAD is never deployable.
expect_reject 'clean-check accepted a revision mismatch' \
    run_clean_check "$fixture" 0000000000000000000000000000000000000000

# Manifest generation is driven by tracked Git paths plus the two explicit
# generated browser overlays, never by a mutable worktree-wide find. The
# ignored debug file must not appear, while generated dist files are hashed.
mkdir -p "$output"
revision_64='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
expect_reject 'source manifest accepted a 64-hex digest that the production runtime rejects' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release "$revision_64" update "$output-64"
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output" >/dev/null
grep -Fq 'weknora/app.go' "$output/source-manifest.sha256"
grep -Fq 'weknora/frontend/dist/index.html' "$output/source-manifest.sha256"
grep -Fq 'auth/dist/index.html' "$output/source-manifest.sha256"
if grep -Fq 'debug.dump' "$output/source-manifest.sha256"; then
    printf '%s\n' 'source manifest included ignored debug/secret worktree content' >&2
    exit 1
fi

# Generated overlays are fail-closed inputs: missing roots, symlinks and
# special files are never silently omitted from a release.
mv "$fixture/auth/dist" "$fixture/auth/dist.missing"
expect_reject 'source manifest accepted a missing generated dist root' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output"
mv "$fixture/auth/dist.missing" "$fixture/auth/dist"
ln -s "$fixture/weknora/app.go" "$fixture/auth/dist/escape"
expect_reject 'source manifest accepted a generated dist symlink' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output"
rm "$fixture/auth/dist/escape"
mkfifo "$fixture/auth/dist/pipe"
expect_reject 'source manifest accepted a generated dist special file' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output"
rm "$fixture/auth/dist/pipe"
printf '%s\n' 'secret' > "$fixture/auth/dist/.env.local"
expect_reject 'source manifest accepted a generated dist env file' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output"
rm "$fixture/auth/dist/.env.local"
printf '%s\n' 'secret' > "$fixture/auth/dist/debug.dump"
expect_reject 'source manifest accepted a generated dist dump file' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output"
rm "$fixture/auth/dist/debug.dump"
printf '%s\n' 'unknown' > "$fixture/auth/dist/debug.bin"
expect_reject 'source manifest accepted a generated dist unknown extension' \
    env WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" generate \
    "$fixture" "$runtime" fixture-release local update "$output"
rm "$fixture/auth/dist/debug.bin"

# Materialization copies only manifest-listed files into a fresh release tree;
# ignored nested env/dump material never reaches the upload source.
printf '%s\n' 'ignored nested env' > "$fixture/weknora/frontend/.env.local"
printf '%s\n' 'ignored nested dump' > "$fixture/auth/debug.dump"
materialized_root="$tmp_dir/materialized"
materialized_tree="$materialized_root/fixture-release/source"
materialized_manifest="$tmp_dir/materialized-manifest"
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" \
    "$fixture/scripts/weknora-production/source-manifest.sh" materialize \
    "$fixture" "$runtime" fixture-release "$revision" update \
    "$materialized_manifest" "$materialized_tree" >/dev/null
[ -f "$materialized_tree/weknora/frontend/dist/index.html" ]
[ -f "$materialized_tree/auth/dist/index.html" ]
[ ! -e "$materialized_tree/weknora/frontend/.env.local" ]
[ ! -e "$materialized_tree/auth/debug.dump" ]
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime" WEKNORA_PRODUCTION_REVISION="$revision" \
    "$fixture/scripts/weknora-production/source-manifest.sh" verify \
    "$materialized_tree" >/dev/null

printf '%s\n' 'source manifest integrity contract green: clean GitHub checkout accepted; dirty, staged, untracked source and revision mismatch rejected'
