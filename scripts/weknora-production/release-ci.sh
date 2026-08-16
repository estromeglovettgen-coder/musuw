#!/usr/bin/env bash
# Restricted GitHub Actions entry point for a full server release.  The
# compatibility update-current.sh entry point remains available for the
# server-local legacy path; CI is always forced through staged/cutover.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'release-ci accepts no arguments'

runtime_dir="$(weknora_production_runtime_dir)"
update_script="$script_dir/update-current.sh"
rollback_script="$script_dir/rollback.sh"
manifest_script="$script_dir/source-manifest.sh"
for required in "$update_script" "$rollback_script" "$manifest_script"; do
    weknora_production_require_file "$required"
done
for command_name in jq sha256sum; do
    weknora_production_require_command "$command_name"
done

completed=false
cleanup() {
    local status=$?
    trap - EXIT
    if [ "$status" -ne 0 ] && [ "$completed" = false ]; then
        # update-current's staged trap normally performs this first.  Calling
        # the idempotent seam again makes a post-probe failure safe even when
        # the wrapper itself receives the signal.
        WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$rollback_script" || \
            printf '%s\n' 'release-ci rollback did not complete; inspect cutover-state.json' >&2
    fi
    exit "$status"
}
trap cleanup EXIT

# Re-hash every allowlisted file after rsync, before any image build or edge
# mutation. This binds the remote release to the runner's immutable bundle.
source_bundle_sha256="$(WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$manifest_script" verify "$script_dir/../..")"

# The release id/revision are inherited from the deploy seam. No shell command
# or path is accepted from the workflow beyond this fixed allowlisted mode.
WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
WEKNORA_PRODUCTION_RELEASE_PROTOCOL='staged' \
    "$update_script"

# This final GET is intentionally outside the server-side cutover script: it
# proves the public origin, not only the Docker edge alias. A failing probe
# enters the trap above and restores the exact prior edge owner.
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 \
    https://app.musuw.com/health >/dev/null

completed=true
printf '%s\n' "CI staged release green: loopback verification, serialized cutover and public health probe passed source_bundle_sha256=$source_bundle_sha256"
