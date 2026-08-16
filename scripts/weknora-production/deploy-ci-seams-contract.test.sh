#!/usr/bin/env bash
# Contract/simulation for the GitHub runner -> server release seam.  It does
# not contact SSH, Docker or Cloudflare; all assertions are local and
# deliberately fail against the pre-CI hard-coded deployment surface.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
deploy_script="$repo_root/scripts/weknora-deploy.sh"
transfer_script="$script_dir/transfer.sh"
compose_file="$repo_root/integration/weknora-production/compose.yaml"
app_dockerfile="$repo_root/integration/weknora-production/Dockerfile.app.runtime"
frontend_dockerfile="$repo_root/integration/weknora-production/Dockerfile.frontend"
build_static="$script_dir/build-static.sh"
release_ci="$script_dir/release-ci.sh"
release_transaction="$script_dir/release-transaction.sh"
update_current="$script_dir/update-current.sh"
source_manifest="$script_dir/source-manifest.sh"
ssh_gate="$script_dir/server/musuw-deploy-ssh-gate"
root_gate="$script_dir/server/musuw-deploy-gate"
verify_gate="$script_dir/server/verify-musuw-deploy-gate.sh"
bootstrap_contract="$script_dir/server/bootstrap-musuw-deploy-contract.test.sh"
integrity_contract="$script_dir/source-manifest-integrity.test.sh"

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

grep -Fq 'WEKNORA_DEPLOY_SSH_PORT' "$deploy_script" || fail 'deploy seam does not expose WEKNORA_DEPLOY_SSH_PORT'
grep -Fq 'WEKNORA_DEPLOY_KNOWN_HOSTS_FILE' "$deploy_script" || fail 'deploy seam does not expose WEKNORA_DEPLOY_KNOWN_HOSTS_FILE'
grep -Fq 'WEKNORA_DEPLOY_SSH_KEY' "$deploy_script" || fail 'deploy seam does not expose the restricted SSH key input'
grep -Fq 'WEKNORA_DEPLOY_REMOTE' "$deploy_script" || fail 'deploy seam does not expose the restricted SSH target input'
grep -Fq 'WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY' "$deploy_script" || fail 'legacy UI seam does not expose a dedicated root key input'
grep -Fq 'WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE' "$deploy_script" || fail 'legacy UI seam does not expose a dedicated root target input'
if grep -Fq '/Users/yangdi/.ssh/musnow-aliyun-prod-ed25519' "$deploy_script" ||
   grep -Fq 'root@8.217.61.45' "$deploy_script"; then
    fail 'deploy seam contains a workstation root-key or implicit root-target fallback'
fi
grep -Fq "update requires WEKNORA_DEPLOY_SSH_KEY" "$deploy_script" || fail 'full deploy does not fail closed without its restricted key'
grep -Fq "update-ui requires WEKNORA_DEPLOY_LEGACY_ROOT_SSH_KEY" "$deploy_script" || fail 'legacy UI deploy does not fail closed without its separate root key'
grep -Fq "update-ui requires WEKNORA_DEPLOY_LEGACY_ROOT_REMOTE" "$deploy_script" || fail 'legacy UI deploy does not fail closed without its separate root target'
grep -Fq -- '-o BatchMode=yes' "$deploy_script" || fail 'deploy SSH is not non-interactive'
grep -Fq -- '-o StrictHostKeyChecking=yes' "$deploy_script" || fail 'deploy SSH is not host-pinned'
grep -Fq -- '-o UserKnownHostsFile=' "$deploy_script" || fail 'deploy SSH does not use the supplied known-hosts file'
grep -Fq -- '-F /dev/null' "$deploy_script" || fail 'deploy SSH does not bypass mutable user SSH config'
grep -Fq -- '-o IdentitiesOnly=yes' "$deploy_script" || fail 'deploy SSH does not pin the configured identity'
grep -Fq 'WEKNORA_DEPLOY_KNOWN_HOSTS_FILE' "$transfer_script" || fail 'bundle transfer seam does not share known-hosts pinning'
grep -Fq -- '-o BatchMode=yes' "$transfer_script" || fail 'bundle transfer SSH is not non-interactive'
if grep -Eq 'ssh-keyscan|StrictHostKeyChecking=no|BatchMode=no' "$deploy_script" "$transfer_script"; then
    fail 'deployment seam contains an unsafe host-key fallback'
fi

grep -Fq 'remote_gate preflight update' "$deploy_script" || fail 'full deploy does not use the restricted preflight verb'
grep -Fq 'remote_gate promote update' "$deploy_script" || fail 'full deploy does not use the restricted promote verb'
grep -Fq 'remote_gate run update' "$deploy_script" || fail 'full deploy does not use the restricted run verb'
grep -Fq '/var/lib/musuw-deploy/incoming' "$deploy_script" || fail 'full deploy does not upload into the deploy spool'
grep -Fq "minimum_capacity_floor_kib='12582912'" "$deploy_script" || fail 'runner does not pin the production capacity floor'
grep -Fq 'weknora_production_require_clean_checkout' "$deploy_script" || fail 'full deploy does not enforce a clean Git checkout'
grep -Fq 'update-ui is a legacy root-only operator path' "$deploy_script" || fail 'UI compatibility path is not explicitly root-only'
grep -Fq 'ls-files -z' "$source_manifest" || fail 'source manifest does not enumerate tracked Git files'
if grep -Fq 'find "$root"' "$source_manifest" || grep -Fq 'find "$repo_root"' "$source_manifest"; then
    fail 'source manifest still walks the mutable worktree with find'
fi
if grep -Fq 'capacity_is_sufficient()' "$deploy_script" ||
   grep -Fq 'docker buildx prune --all --force' "$deploy_script"; then
    fail 'full deploy still embeds a privileged capacity/preflight shell'
fi
if grep -Fq 'WEKNORA_PRODUCTION_RUNTIME_DIR=' "$deploy_script" && grep -Fq 'remote_update_helper' "$deploy_script"; then
    # The UI compatibility branch may retain its server-local helper call, but
    # the full update branch must invoke only the fixed gate verbs.
    grep -Fq 'remote_gate run update' "$deploy_script" || fail 'full update still exposes a caller-selected remote helper'
fi

for gate_file in "$ssh_gate" "$root_gate" "$verify_gate" "$bootstrap_contract" "$integrity_contract"; do
    [ -x "$gate_file" ] || fail "restricted gate file is not executable: $gate_file"
done
grep -Fq 'SSH_ORIGINAL_COMMAND' "$ssh_gate" || fail 'SSH forced-command gate does not parse the original command'
grep -Fq -- '--sender' "$ssh_gate" || fail 'SSH gate does not reject rsync sender mode'
grep -Fq -- '--rsync-path=' "$ssh_gate" || fail 'SSH gate does not reject rsync command hooks'
grep -Fq 'release source contains a symbolic link' "$root_gate" || fail 'root gate does not reject release symlinks'
grep -Fq 'bash "$manifest_script" verify' "$root_gate" || fail 'root gate does not verify the transferred manifest'
grep -Fq "minimum_capacity_floor_kib='12582912'" "$root_gate" || fail 'root gate does not pin the production capacity floor'
grep -Fq "minimum_capacity_floor_kib='12582912'" "$ssh_gate" || fail 'SSH gate does not pin the production capacity floor'
grep -Fq "PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'" "$root_gate" || fail 'root gate does not pin a safe command path'
grep -Fq 'bootstrap must run as root' "$script_dir/server/bootstrap-musuw-deploy.sh" || fail 'bootstrap does not fail closed for non-root callers'

grep -Fq 'release-ci.sh' "$deploy_script" || fail 'full deploy does not use the CI staged release adapter'
grep -Fq "WEKNORA_PRODUCTION_RELEASE_PROTOCOL='staged'" "$release_ci" || fail 'CI release adapter does not force the staged protocol'
grep -Fq 'start-staged.sh' "$update_current" || fail 'staged release does not invoke start-staged'
grep -Fq 'cutover.sh' "$update_current" || fail 'staged release does not invoke serialized cutover'
grep -Fq 'rollback.sh' "$release_ci" "$update_current" || fail 'staged release does not expose idempotent rollback'
grep -Fq 'https://app.musuw.com/readyz' "$release_transaction" || fail 'release transaction has no rollbackable public revision probe'
grep -Fq 'rollback_transaction' "$release_transaction" || fail 'release transaction does not own public-probe rollback'
transaction_line="$(grep -n '"$transaction_script"' "$release_ci" | tail -n 1 | cut -d: -f1)"
if tail -n "+$((transaction_line + 1))" "$release_ci" | grep -Fq 'curl '; then
    fail 'CI release adapter has an unrollbackable post-transaction probe'
fi
grep -Fq 'source-manifest.sh' "$deploy_script" || fail 'full deploy does not generate an allowlisted source checksum manifest'
grep -Fq 'source-manifest.sh" materialize' "$deploy_script" || fail 'full/UI deploy does not materialize a manifest-backed temporary tree'
grep -Fq 'deploy_tree/' "$deploy_script" || fail 'deploy seam does not rsync the materialized tree'
if grep -Fq '"$repo_root/weknora/' "$deploy_script" ||
   grep -Fq '"$repo_root/auth/' "$deploy_script"; then
    fail 'deploy seam still rsyncs a mutable source worktree'
fi
grep -Fq 'manifest_script=' "$release_ci" || fail 'CI release adapter does not select the source manifest verifier'
grep -Fq '"$manifest_script" verify' "$release_ci" || fail 'CI release adapter does not reverify the transferred source manifest'
grep -Fq 'source_bundle_sha256' "$source_manifest" || fail 'source manifest does not expose a total bundle checksum'

grep -Fq 'WEKNORA_DEPLOY_RUNTIME_DIR' "$deploy_script" || fail 'runner public runtime directory is not injectable'
grep -Fq 'WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir"' "$deploy_script" || fail 'runner runtime directory is not passed to static checks'
grep -Fq '/opt/weknora/runtime' "$deploy_script" || fail 'server-owned runtime directory is not explicit'

if grep -Fq '3d5d8bf' "$compose_file" "$app_dockerfile" "$frontend_dockerfile" "$build_static"; then
    fail 'production image/static paths still contain the stale 3d5d8bf revision'
fi
grep -Fq 'WEKNORA_PRODUCTION_REVISION' "$compose_file" || fail 'Compose does not consume the immutable revision'
grep -Fq 'org.opencontainers.image.revision' "$frontend_dockerfile" || fail 'frontend image does not carry its revision label'
grep -Fq 'WEKNORA_PRODUCTION_REVISION' "$build_static" || fail 'static build does not consume the immutable revision'

lib_file="$script_dir/lib.sh"
revision="$(env -u WEKNORA_PRODUCTION_REVISION -u WEKNORA_DEPLOY_REVISION GITHUB_SHA=0123456789abcdef0123456789abcdef01234567 \
    bash -c '. "$1"; weknora_production_revision' bash "$lib_file")"
[ "$revision" = '0123456789abcdef0123456789abcdef01234567' ] || fail 'GITHUB_SHA was not selected as the release revision'
if WEKNORA_PRODUCTION_REVISION=unsafe/revision bash -c '. "$1"; weknora_production_revision' bash "$lib_file" >/dev/null 2>&1; then
    fail 'unsafe release revision was accepted'
fi

printf '%s\n' 'deployment CI seam contract green'
