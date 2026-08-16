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
transaction_script="$script_dir/release-transaction.sh"
rollback_script="$script_dir/rollback.sh"
manifest_script="$script_dir/source-manifest.sh"
for required in "$rollback_script" "$manifest_script"; do
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
        # The v2 transaction owns its full source/config/process/edge rollback.
        # Keep the old rollback seam only for a legacy state left by an
        # operator-local invocation; never replay it over a v2 transaction.
        if [ ! -d "$runtime_dir/release-transactions" ]; then
            WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$rollback_script" || \
                printf '%s\n' 'release-ci rollback did not complete; inspect cutover-state.json' >&2
        fi
    fi
    exit "$status"
}
trap cleanup EXIT

# Re-hash every allowlisted file after rsync, before any image build or edge
# mutation. This binds the remote release to the runner's immutable bundle.
source_bundle_sha256="$(WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" "$manifest_script" verify "$script_dir/../..")"

# The release id/revision are inherited from the deploy seam. No shell command,
# role, project, container or path is accepted from the workflow beyond this
# fixed allowlisted mode.  release-transaction.sh derives the per-SHA Compose
# project and performs the full snapshot/build/stage/cutover/worker/commit
# transaction; rollback.sh remains the legacy edge compatibility seam and is
# referenced here so an interrupted handoff can still be audited explicitly.
if [ -f "$transaction_script" ]; then
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_PROTOCOL='staged' \
        "$transaction_script"
elif [ "${WEKNORA_PRODUCTION_TRANSACTION_TEST_FALLBACK:-0}" = 1 ] && [ "${MUSUW_DEPLOY_GATE_TEST_MODE:-0}" = 1 ]; then
    # Tiny legacy lifecycle fixtures intentionally copy only the original
    # staged helpers. Production promoted releases always carry the v2
    # transaction; this branch keeps those historical simulations useful.
    update_script="$script_dir/update-current.sh"
    weknora_production_require_file "$update_script"
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_PROTOCOL='staged' \
        "$update_script"
else
    weknora_production_die 'v2 release transaction helper is unavailable; refusing legacy production release'
fi

completed=true
printf '%s\n' "CI staged release green: transactional public revision probes and atomic commit passed source_bundle_sha256=$source_bundle_sha256"
