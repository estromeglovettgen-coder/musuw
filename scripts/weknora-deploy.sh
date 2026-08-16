#!/usr/bin/env bash
# Build browser assets locally, upload only non-secret source/configuration to a
# fresh release directory, then ask the server to build and activate it. The
# production runtime directory, secrets and named volumes are never uploaded,
# replaced or deleted by this interface.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
production_dir="$repo_root/scripts/weknora-production"
runtime_dir="${WEKNORA_DEPLOY_RUNTIME_DIR:-${WEKNORA_PRODUCTION_RUNTIME_DIR:-$repo_root/.runtime/weknora-production}}"
# shellcheck source=scripts/weknora-production/lib.sh
. "$production_dir/lib.sh"

usage() {
    cat <<'EOF'
Usage: scripts/weknora-deploy.sh update | update-ui

  update     Full source release: rebuilds the native app and frontend.
  update-ui  UI-only release: accepts only the two browser source trees,
             rebuilds/recreates frontend only, and leaves the app untouched.

Environment overrides:
  WEKNORA_DEPLOY_REMOTE       Restricted musuw-deploy SSH target (required for update)
  WEKNORA_DEPLOY_SSH_KEY      Restricted deploy private key path (required for update)
  WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE  Explicit root target (required for update-ui)
  WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY Explicit root key path (required for update-ui)
  WEKNORA_DEPLOY_SSH_PORT     Optional SSH port
  WEKNORA_DEPLOY_KNOWN_HOSTS_FILE  Pinned SSH known_hosts file (no keyscan fallback)
  WEKNORA_DEPLOY_RUNTIME_DIR  Runner-only directory containing public env files
  WEKNORA_DEPLOY_REVISION     Full immutable source SHA (defaults to GITHUB_SHA)
  WEKNORA_DEPLOY_RELEASE_ID   Optional safe release directory name
  WEKNORA_DEPLOY_MIN_FREE_KIB Minimum free production capacity for full
                              releases (default: 12582912 KiB / 12 GiB; cannot
                              be lower)
EOF
}

die() {
    printf '%s\n' "$1" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die 'required deployment command is unavailable'
}

safe_id() {
    case "$1" in
        ''|*[!A-Za-z0-9._-]*|.*|*-|*.) return 1 ;;
        *..*) return 1 ;;
        *) [ "${#1}" -le 128 ] ;;
    esac
}

mode="${1:-}"
case "$mode" in
    update|update-ui) ;;
    *)
    case "${1:-}" in -h|--help|help) usage; exit 0 ;; esac
    usage >&2
    exit 2
    ;;
esac
[ "$#" -eq 1 ] || { usage >&2; exit 2; }

for command_name in ssh rsync; do
    require_command "$command_name"
done

if [ "$mode" = 'update-ui' ]; then
    remote="${WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE:-}"
    ssh_key="${WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY:-}"
    [ -n "$remote" ] || die 'update-ui requires WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE'
    [ -n "$ssh_key" ] || die 'update-ui requires WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY'
else
    remote="${WEKNORA_DEPLOY_REMOTE:-}"
    ssh_key="${WEKNORA_DEPLOY_SSH_KEY:-}"
    [ -n "$remote" ] || die 'update requires WEKNORA_DEPLOY_REMOTE'
    [ -n "$ssh_key" ] || die 'update requires WEKNORA_DEPLOY_SSH_KEY'
fi
minimum_capacity_floor_kib='12582912'
minimum_free_kib="${WEKNORA_DEPLOY_MIN_FREE_KIB:-12582912}"
case "$mode" in
    update) release_prefix='weknora-update' ;;
    update-ui) release_prefix='weknora-ui' ;;
esac
revision="$(weknora_production_revision)"
release_id="${WEKNORA_DEPLOY_RELEASE_ID:-$release_prefix-$revision}"
release_root='/opt/weknora/releases'
legacy_release_source="$release_root/$release_id/source"
spool_root='/var/lib/musuw-deploy/incoming'
if [ "$mode" = 'update' ]; then
    release_source="$spool_root/$release_id/source"
else
    release_source="$legacy_release_source"
fi
current_link='/opt/weknora/current'
remote_runtime='/opt/weknora/runtime'

case "$remote" in
    ''|*[!A-Za-z0-9@._:-]*) die 'SSH target is unsafe' ;;
esac
if [ "$mode" = 'update-ui' ]; then
    case "$remote" in
        root@*) ;;
        *) die 'update-ui is a legacy root-only operator path' ;;
    esac
fi
safe_id "$release_id" || die 'release id is unsafe'
[ -f "$ssh_key" ] && [ -r "$ssh_key" ] || die 'SSH private key is unavailable'
known_hosts_file="${WEKNORA_DEPLOY_KNOWN_HOSTS_FILE:-${HOME:-}/.ssh/known_hosts}"
[ -f "$known_hosts_file" ] && [ -r "$known_hosts_file" ] || die 'SSH known-hosts file is unavailable'
case "$minimum_free_kib" in
    ''|*[!0-9]*) die 'minimum production free capacity is invalid' ;;
esac
[ "$minimum_free_kib" -ge "$minimum_capacity_floor_kib" ] || \
    die "minimum production free capacity must be at least ${minimum_capacity_floor_kib} KiB"

if [ "$mode" = 'update' ]; then
    weknora_production_require_clean_checkout "$repo_root" "$revision"
fi

release_helper="$production_dir/release-ci.sh"
if [ "$mode" = 'update-ui' ]; then
    release_helper="$production_dir/update-ui-current.sh"
fi

for required in \
    "$runtime_dir/production.public.env" \
    "$runtime_dir/auth-public.env" \
    "$release_helper"; do
    [ -f "$required" ] && [ -r "$required" ] || die 'required deployment input is unavailable'
done

# Keep development/build-only tooling on the workstation. In particular,
# verify-static uses Docker and jq (with baseline grep), which are deliberately
# not production-host runtime dependencies. Both browser bundles copied by the
# production frontend image
# then come from the verified current local source.
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
WEKNORA_PRODUCTION_REVISION="$revision" \
    "$production_dir/verify-static.sh"
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
WEKNORA_PRODUCTION_REVISION="$revision" \
    "$production_dir/build-static.sh"

ssh_args=(
    -F /dev/null
    -o BatchMode=yes
    -o StrictHostKeyChecking=yes
    -o UserKnownHostsFile="$known_hosts_file"
    -o IdentitiesOnly=yes
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=4
    -i "$ssh_key"
)
if [ -n "${WEKNORA_DEPLOY_SSH_PORT:-}" ]; then
    case "$WEKNORA_DEPLOY_SSH_PORT" in ''|*[!0-9]*) die 'SSH port is invalid' ;; esac
    ssh_args+=( -p "$WEKNORA_DEPLOY_SSH_PORT" )
fi

ssh_transport='ssh'
for argument in "${ssh_args[@]}"; do
    printf -v escaped_argument '%q' "$argument"
    ssh_transport+=" $escaped_argument"
done

remote_gate() {
    local subcommand="$1"
    shift
    local remote_command='musuw-gate'
    local argument escaped_argument
    for argument in "$subcommand" "$@"; do
        printf -v escaped_argument '%q' "$argument"
        remote_command+=" $escaped_argument"
    done
    ssh "${ssh_args[@]}" "$remote" "$remote_command"
}

# The server must already have completed the initial cutover. Daily updates do
# not create /opt/weknora/current, runtime secrets, databases or data volumes.
if [ "$mode" = 'update' ]; then
    remote_gate preflight update "$release_id" "$revision" "$minimum_free_kib"
else
    # A UI release begins as a hard-linked snapshot of the serving source. The
    # following uploads replace only browser source/output files; rsync writes
    # changed files through temporary names, so the old current source remains
    # immutable for rollback. This avoids copying or rebuilding Go/application
    # sources while retaining a complete future current release tree.
    ssh "${ssh_args[@]}" "$remote" "set -eu; test -L '$current_link'; test -d '$remote_runtime/secrets'; test ! -e '$release_source'; current_target=\$(readlink -f '$current_link'); test -d \"\$current_target\"; install -d -m 755 '$release_source'; rsync -a --link-dest=\"\$current_target\" \"\$current_target/\" '$release_source/'"
fi

common_rsync=( -a --partial --timeout=120 --no-owner --no-group -e "$ssh_transport" )
manifest_dir=''
deploy_tree_root=''
deploy_tree=''
cleanup_manifest() {
    if [ -n "$manifest_dir" ] && [ -d "$manifest_dir" ]; then
        find "$manifest_dir" -depth -delete 2>/dev/null || true
    fi
    if [ -n "$deploy_tree_root" ] && [ -d "$deploy_tree_root" ]; then
        find "$deploy_tree_root" -depth -delete 2>/dev/null || true
    fi
}
trap cleanup_manifest EXIT

if [ "$mode" = 'update' ] || [ "$mode" = 'update-ui' ]; then
    manifest_dir="$(mktemp -d "$runtime_dir/source-manifest.XXXXXX")"
    chmod 700 "$manifest_dir"
    # Keep the materialized tree outside the checkout itself.  This makes the
    # no-worktree-rsync boundary auditable even when the runner runtime lives
    # below the repository (as it does in local simulations).
    deploy_tree_root="$(mktemp -d "${TMPDIR:-/tmp}/weknora-deploy-tree.XXXXXX")"
    chmod 700 "$deploy_tree_root"
    deploy_tree="$deploy_tree_root/$release_id/source"
    source_bundle_sha256="$("$production_dir/source-manifest.sh" materialize \
        "$repo_root" "$runtime_dir" "$release_id" "$revision" "$mode" \
        "$manifest_dir" "$deploy_tree")"
fi

rsync_with_retry() {
    local attempt
    for attempt in 1 2 3; do
        if rsync "$@"; then
            return 0
        fi
        sleep "$attempt"
    done
    die 'release upload failed after three resumable attempts'
}

if [ "$mode" = 'update' ]; then
    # Full releases are uploaded only from the fresh manifest-backed tree.
    # The mutable worktree is never an rsync source, so ignored nested env,
    # dumps, dependencies and editor output cannot cross the spool boundary.
    rsync_with_retry "${common_rsync[@]}" \
        "$deploy_tree/" "$remote:$release_source/"
else
    # The legacy root-only UI route uses the same manifest-backed temporary
    # tree. The remote hard-link snapshot supplies unchanged application
    # source; only validated UI source/dist files and the fixed helper are
    # overlaid, so ignored nested files cannot cross the boundary.
    rsync_with_retry "${common_rsync[@]}" \
        "$deploy_tree/" "$remote:$release_source/"
fi

remote_update_helper="$release_source/scripts/weknora-production/release-ci.sh"
if [ "$mode" = 'update-ui' ]; then
    remote_update_helper="$release_source/scripts/weknora-production/update-ui-current.sh"
fi
if [ "$mode" = 'update' ]; then
    remote_gate promote update "$release_id" "$revision"
    remote_gate run update "$release_id" "$revision"
else
    ssh "${ssh_args[@]}" "$remote" "WEKNORA_PRODUCTION_RUNTIME_DIR='$remote_runtime' WEKNORA_PRODUCTION_REVISION='$revision' '$remote_update_helper'"
fi

printf '%s\n' "production $mode green: $release_id is active through $current_link"
