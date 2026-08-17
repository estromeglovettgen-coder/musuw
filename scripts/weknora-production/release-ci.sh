#!/usr/bin/env bash
# Fixed server-side release helper. The only caller-selected value is the
# reviewed full Git SHA; source, runtime, Compose project and service names are
# derived locally from this release tree and the fixed production adapters.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

die() {
    weknora_production_die "$1"
}

[ "$#" -eq 1 ] || die 'usage: release-ci.sh <full-sha>'
revision="$1"
[[ "$revision" =~ ^[0-9a-fA-F]{40}$ ]] || die 'release revision must be a full 40-character Git SHA'
revision="$(printf '%s' "$revision" | tr '[:upper:]' '[:lower:]')"

repo_root="$(cd "$script_dir/../.." && pwd -P)"
release_root='/opt/weknora/releases'
runtime_dir="${WEKNORA_PRODUCTION_RUNTIME_DIR:-/opt/weknora/runtime}"
current_link='/opt/weknora/current'
release_id="musuw-$revision"
manifest_script="$script_dir/source-manifest.sh"
for command_name in awk bash curl date docker find jq sha256sum; do
    weknora_production_require_command "$command_name"
done
for required in \
    "$manifest_script" \
    "$script_dir/prepare-runtime.sh" \
    "$script_dir/compose.sh" \
    "$repo_root/deploy/production.public.env" \
    "$repo_root/deploy/auth-public.env"; do
    weknora_production_require_file "$required"
done

[ -d "$runtime_dir" ] && [ ! -L "$runtime_dir" ] || die 'production runtime directory is unavailable or unsafe'

# The runner streams a short-lived GitHub token over the restricted SSH
# connection. Keep it out of argv, logs and the persistent runtime directory;
# Docker reads the credential only from this temporary config during pull.
IFS= read -r ghcr_username || die 'GHCR username is missing from the deploy stream'
IFS= read -r ghcr_token || die 'GHCR token is missing from the deploy stream'
case "$ghcr_username" in
    ''|*[!A-Za-z0-9._-]*) die 'GHCR username is unsafe' ;;
esac
[ -n "$ghcr_token" ] || die 'GHCR token is empty'
docker_config="$(mktemp -d /run/musuw-ghcr.XXXXXX)"
chmod 700 "$docker_config"
cleanup() {
    local status=$?
    trap - EXIT
    if [ -n "${docker_config:-}" ] && [ -d "$docker_config" ]; then
        DOCKER_CONFIG="$docker_config" docker logout ghcr.io >/dev/null 2>&1 || true
        find "$docker_config" -depth -delete 2>/dev/null || true
    fi
    unset ghcr_username ghcr_token docker_config
    exit "$status"
}
trap cleanup EXIT

# The manifest is checked again after rsync and before touching server runtime
# state. It binds the exact release directory to this caller-supplied SHA.
source_bundle_sha256="$(
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        bash "$manifest_script" verify "$repo_root"
)"

install -m 600 "$repo_root/deploy/production.public.env" "$runtime_dir/production.public.env"
install -m 600 "$repo_root/deploy/auth-public.env" "$runtime_dir/auth-public.env"

WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
WEKNORA_PRODUCTION_REVISION="$revision" \
    "$script_dir/prepare-runtime.sh"

# Images are built and pushed by the GitHub Actions release job. The server
# only pulls the exact digest references carried in production.env and never
# invokes Docker build.
printf '%s\n' "$ghcr_token" |
    DOCKER_CONFIG="$docker_config" docker login ghcr.io \
        --username "$ghcr_username" --password-stdin >/dev/null
DOCKER_CONFIG="$docker_config" WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    "$script_dir/compose.sh" --edge pull app frontend

# The fixed native Compose project replaces only the application/frontend
# services; named data services and volumes remain authoritative on the host.
DOCKER_CONFIG="$docker_config" WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
WEKNORA_PRODUCTION_REVISION="$revision" \
    "$script_dir/compose.sh" --edge up -d --no-build --no-deps --force-recreate app frontend

wait_for_healthy() {
    local container="$1"
    local deadline=$(( $(date +%s) + 240 ))
    local status image_revision
    while [ "$(date +%s)" -lt "$deadline" ]; do
        status="$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
        case "$status" in
            healthy) break ;;
            unhealthy|exited|dead) die "production container is not healthy: $container" ;;
        esac
        sleep 2
    done
    status="$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
    [ "$status" = healthy ] || die "production container health timed out: $container"
    image_revision="$(docker inspect "$container" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
    [ "$image_revision" = "$revision" ] || die "production image revision does not match requested SHA: $container"
}

wait_for_healthy weknora-v072-production-app
wait_for_healthy weknora-v072-production-frontend

app_port="$(weknora_production_require_env_value "$runtime_dir/production.env" WEKNORA_PRODUCTION_APP_PORT)"
frontend_port="$(weknora_production_require_env_value "$runtime_dir/production.env" WEKNORA_PRODUCTION_FRONTEND_PORT)"
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 "http://127.0.0.1:${app_port}/health" >/dev/null
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 "http://127.0.0.1:${frontend_port}/health" >/dev/null
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/health >/dev/null
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/ >/dev/null
curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/auth/start >/dev/null

# Health and revision checks pass before the serving pointer changes. The
# atomic current activation is the only source activation operation here.
[ -L "$current_link" ] || [ ! -e "$current_link" ] || die 'current release path is not a symlink'
next_link="$runtime_dir/current.next.$$"
ln -s "$repo_root" "$next_link"
mv -Tf "$next_link" "$current_link"

# Immutable releases leave old app/frontend images behind. Reclaim only images
# that no running container uses; named volumes and live images are untouched.
docker image prune -a -f >/dev/null

printf '%s\n' "simple release green: $release_id source_bundle_sha256=$source_bundle_sha256"
