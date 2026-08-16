#!/usr/bin/env bash
# Copy a verified bundle to a new remote staging directory.  It never starts a
# service, deletes a remote path, or copies secret files.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 2 ] || weknora_production_die 'usage: transfer.sh <bundle-directory> <ssh-user@host>'
bundle_dir="$(cd "$1" && pwd -P)"
remote="$2"
case "$remote" in
    ''|*[!A-Za-z0-9@._:-]*) weknora_production_die 'SSH target is unsafe' ;;
esac

for command in ssh rsync jq sha256sum; do
    weknora_production_require_command "$command"
done
"$script_dir/verify-bundle.sh" "$bundle_dir"

bundle_id="$(jq -er '.bundle_id' "$bundle_dir/manifest.json")"
remote_root="${WEKNORA_PRODUCTION_RELEASE_ROOT:-/opt/weknora/releases}"
weknora_production_safe_remote_path "$remote_root" || weknora_production_die 'remote release root is outside the approved path'
remote_bundle="$remote_root/$bundle_id/data"
weknora_production_safe_remote_path "$remote_bundle" || weknora_production_die 'remote bundle target is outside the approved path'

ssh_args=()
ssh_key="${WEKNORA_DEPLOY_SSH_KEY:-${WEKNORA_PRODUCTION_SSH_KEY:-}}"
if [ -n "$ssh_key" ]; then
    weknora_production_require_file "$ssh_key"
    ssh_args+=( -i "$ssh_key" )
fi
ssh_port="${WEKNORA_DEPLOY_SSH_PORT:-${WEKNORA_PRODUCTION_SSH_PORT:-}}"
if [ -n "$ssh_port" ]; then
    case "$ssh_port" in
        *[!0-9]*|'') weknora_production_die 'SSH port is invalid' ;;
    esac
    [ "$ssh_port" -ge 1 ] && [ "$ssh_port" -le 65535 ] || weknora_production_die 'SSH port is invalid'
    ssh_args+=( -p "$ssh_port" )
fi
known_hosts_file="${WEKNORA_DEPLOY_KNOWN_HOSTS_FILE:-${WEKNORA_PRODUCTION_KNOWN_HOSTS_FILE:-${HOME:-}/.ssh/known_hosts}}"
weknora_production_require_file "$known_hosts_file"
ssh_args+=(
    -o BatchMode=yes
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=$known_hosts_file"
)

ssh "${ssh_args[@]}" "$remote" "test ! -e '$remote_bundle' && install -d -m 700 -- '$remote_bundle'"
ssh_transport='ssh'
for argument in "${ssh_args[@]}"; do
    printf -v escaped_argument '%q' "$argument"
    ssh_transport+=" $escaped_argument"
done
rsync -a --no-owner --no-group --chmod=Du=rwx,Dgo=,Fu=rw,Fgo= -e "$ssh_transport" \
    "$bundle_dir/" "$remote:$remote_bundle/"
ssh "${ssh_args[@]}" "$remote" "cd '$remote_bundle' && sha256sum -c SHA256SUMS >/dev/null"

printf '%s\n' 'verified v79 rehearsal bundle transferred; no production service was started'
