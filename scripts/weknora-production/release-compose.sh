#!/usr/bin/env bash
# Narrow Compose adapter for the immutable candidate.  The only identity this
# module derives from the caller's release is the full SHA; project, service,
# container, image, network and listener names are all computed here.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -gt 0 ] || weknora_production_die 'an explicit transactional Compose command is required'
for command_name in docker; do
    weknora_production_require_command "$command_name"
done

repo_root="$(weknora_production_repo_root)"
runtime_dir="${WEKNORA_PRODUCTION_RUNTIME_DIR:-}"
candidate_dir="${WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR:-}"
source_root="${WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT:-$repo_root}"
[ -n "$runtime_dir" ] || weknora_production_die 'transactional Compose runtime directory is unavailable'
[ -d "$runtime_dir" ] || weknora_production_die 'transactional Compose runtime directory is unavailable'
[ -n "$candidate_dir" ] || weknora_production_die 'transactional Compose candidate directory is unavailable'
[ -d "$candidate_dir" ] || weknora_production_die 'transactional Compose candidate directory is unavailable'
[ -d "$source_root" ] || weknora_production_die 'transactional Compose source root is unavailable'

revision="$(weknora_production_revision)"
project="$(weknora_production_release_project)"
internal_network="$(weknora_production_release_internal_network)"
release_runtime="$candidate_dir"
release_env="$release_runtime/production.env"
compose_file="$repo_root/integration/weknora-production/compose.release.yaml"

weknora_production_require_file "$release_env"
weknora_production_require_file "$compose_file"

app_image="$(weknora_production_release_image web)"
frontend_image="$(weknora_production_release_image frontend)"
web_container="$(weknora_production_release_container web)"
app_port="${WEKNORA_RELEASE_APP_PORT:-$(weknora_production_release_port app)}"
frontend_port="${WEKNORA_RELEASE_FRONTEND_PORT:-$(weknora_production_release_port frontend)}"

case "$app_port:$frontend_port" in
    *[!0-9:]*|:*) weknora_production_die 'transactional Compose listener is invalid' ;;
esac

export WEKNORA_PRODUCTION_REVISION="$revision"
export WEKNORA_RELEASE_PROJECT="$project"
export WEKNORA_RELEASE_RUNTIME_DIR="$release_runtime"
export WEKNORA_RELEASE_SOURCE_ROOT="$source_root"
export WEKNORA_RELEASE_APP_IMAGE="$app_image"
export WEKNORA_RELEASE_FRONTEND_IMAGE="$frontend_image"
export WEKNORA_RELEASE_WEB_CONTAINER="$web_container"
export WEKNORA_RELEASE_APP_PORT="$app_port"
export WEKNORA_RELEASE_FRONTEND_PORT="$frontend_port"
export WEKNORA_PRODUCTION_INTERNAL_NETWORK="$internal_network"

exec env \
    DOCKER_DEFAULT_PLATFORM=linux/amd64 \
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
    WEKNORA_RELEASE_PROJECT="$project" \
    WEKNORA_RELEASE_RUNTIME_DIR="$release_runtime" \
    WEKNORA_RELEASE_SOURCE_ROOT="$source_root" \
    WEKNORA_RELEASE_APP_IMAGE="$app_image" \
    WEKNORA_RELEASE_FRONTEND_IMAGE="$frontend_image" \
    WEKNORA_RELEASE_WEB_CONTAINER="$web_container" \
    WEKNORA_RELEASE_APP_PORT="$app_port" \
    WEKNORA_RELEASE_FRONTEND_PORT="$frontend_port" \
    WEKNORA_PRODUCTION_INTERNAL_NETWORK="$internal_network" \
    docker compose --project-name "$project" --env-file "$release_env" \
        -f "$compose_file" "$@"
