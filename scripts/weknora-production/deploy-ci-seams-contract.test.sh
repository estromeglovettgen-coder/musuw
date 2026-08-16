#!/usr/bin/env bash
# Contract for the two-verb runner -> server release seam. This is local-only:
# it never contacts SSH, Docker, or a production filesystem.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
deploy_script="$repo_root/scripts/weknora-deploy.sh"
release_ci="$script_dir/release-ci.sh"
source_manifest="$script_dir/source-manifest.sh"
ssh_gate="$script_dir/server/musuw-deploy-ssh-gate"
root_gate="$script_dir/server/musuw-deploy-gate"
bootstrap="$script_dir/server/bootstrap-musuw-deploy.sh"
verify_gate="$script_dir/server/verify-musuw-deploy-gate.sh"

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

for required in "$deploy_script" "$release_ci" "$source_manifest" "$ssh_gate" "$root_gate" "$bootstrap" "$verify_gate"; do
    [ -x "$required" ] || fail "deployment seam file is not executable: $required"
done

grep -Fq 'Usage: scripts/weknora-deploy.sh <full-sha>' "$deploy_script" || fail 'runner interface is not SHA-only'
grep -Fq 'source-manifest.sh" materialize' "$deploy_script" || fail 'runner does not materialize the manifest-backed tree'
if grep -Eq 'weknora/frontend/dist|auth/dist|append_generated_tree' "$deploy_script" "$source_manifest"; then
    fail 'server source upload still contains GitHub-built browser output'
fi
grep -Fq '/var/lib/musuw-deploy/incoming' "$deploy_script" || fail 'runner does not upload through the fixed incoming spool'
grep -Fq 'remote_gate prepare' "$deploy_script" || fail 'runner does not invoke the prepare gate verb'
grep -Fq 'remote_gate deploy' "$deploy_script" || fail 'runner does not invoke the deploy gate verb'
grep -Fq 'WEKNORA_DEPLOY_GHCR_TOKEN' "$deploy_script" || fail 'runner does not provide a short-lived GHCR token'
grep -Fq 'release-ci.sh' "$deploy_script" || fail 'runner does not select the fixed release helper'
grep -Fq 'source-manifest.sh' "$release_ci" || fail 'release helper does not select source verification'
grep -Fq '"$manifest_script" verify' "$release_ci" || fail 'release helper does not verify the transferred manifest'
grep -Fq 'prepare-runtime.sh' "$release_ci" || fail 'release helper does not prepare runtime configuration'
grep -Fq 'compose.sh" --edge pull app frontend' "$release_ci" || fail 'release helper does not pull both exact GHCR images'
grep -Fq 'docker login ghcr.io' "$release_ci" || fail 'release helper does not authenticate to GHCR through stdin'
grep -Fq 'mktemp -d /run/musuw-ghcr.' "$release_ci" || fail 'GHCR Docker config is not created in the temporary runtime filesystem'
grep -Fq 'find "$docker_config" -depth -delete' "$release_ci" || fail 'GHCR Docker config is not removed on exit'
grep -Fq -- '--no-build' "$release_ci" || fail 'release helper still permits a server-side build'
if grep -Fq 'build-images.sh' "$release_ci"; then
    fail 'release helper still invokes the removed server image build'
fi
grep -Fq 'compose.sh" --edge' "$release_ci" || fail 'release helper does not invoke fixed Compose'
grep -Fq 'atomic current' "$release_ci" || fail 'release helper does not document atomic current activation'

for forbidden in 'musuw-gate preflight' 'musuw-gate promote' 'musuw-gate run' \
    release-transaction rollback.sh cutover.sh start-staged.sh update-current.sh; do
    if grep -Fq "$forbidden" "$deploy_script" "$release_ci"; then
        fail "legacy release verb remains reachable: $forbidden"
    fi
done

grep -Fq "safe_revision" "$ssh_gate" || fail 'SSH gate does not validate full revisions'
grep -Fq 'prepare|deploy)' "$ssh_gate" || fail 'SSH gate does not expose prepare/deploy'
grep -Fq 'musuw-gate' "$ssh_gate" || fail 'SSH gate does not parse the fixed command prefix'
grep -Fq '/var/lib/musuw-deploy/incoming' "$ssh_gate" || fail 'SSH gate has no fixed rsync destination'
grep -Fq 'source-manifest.sh" verify' "$root_gate" || fail 'root gate does not verify the transferred manifest'
grep -Fq 'release-ci.sh' "$root_gate" || fail 'root gate does not invoke the fixed release helper'
grep -Fq 'current_target' "$root_gate" || fail 'root gate does not reject replacing current in place'
grep -Fq 'prepare)' "$root_gate" || fail 'root gate does not implement prepare'
grep -Fq 'deploy)' "$root_gate" || fail 'root gate does not implement deploy'
grep -Fq 'GHCR token is missing' "$root_gate" || fail 'root gate does not receive the GHCR token over stdin'
grep -Fq 'prepare' "$bootstrap" || fail 'bootstrap does not install the prepare protocol'
grep -Fq 'deploy' "$bootstrap" || fail 'bootstrap does not install the deploy protocol'
grep -Fq 'prepare' "$verify_gate" || fail 'gate verifier does not check prepare'
grep -Fq 'deploy' "$verify_gate" || fail 'gate verifier does not check deploy'

if grep -Eq '(^|[[:space:]])(eval|bash[[:space:]]+-c|sh[[:space:]]+-c)([[:space:]]|$)' "$ssh_gate" "$root_gate"; then
    fail 'deployment gate contains an arbitrary shell execution primitive'
fi
if grep -Eq 'ssh-keyscan|StrictHostKeyChecking=no|BatchMode=no' "$deploy_script"; then
    fail 'runner contains an unsafe host-key fallback'
fi
grep -Fq -- '-o BatchMode=yes' "$deploy_script" || fail 'runner SSH is not non-interactive'
grep -Fq -- '-o StrictHostKeyChecking=yes' "$deploy_script" || fail 'runner SSH is not host-pinned'
grep -Fq -- '-o UserKnownHostsFile=' "$deploy_script" || fail 'runner SSH does not use its known-hosts file'
grep -Fq -- '-F /dev/null' "$deploy_script" || fail 'runner SSH does not bypass mutable user configuration'
grep -Fq -- '-o IdentitiesOnly=yes' "$deploy_script" || fail 'runner SSH does not pin its identity'
grep -Fq 'ls-files -z' "$source_manifest" || fail 'source manifest does not enumerate tracked files'

printf '%s\n' 'deployment CI seam contract green'
