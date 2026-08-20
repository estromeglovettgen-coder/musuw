#!/usr/bin/env bash
# Validate the candidate before Docker is allowed to create or attach a volume.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose="$repo_root/scripts/weknora-candidate/compose.sh"
secret_dir="$repo_root/.runtime/weknora/secrets"
config_json="$(mktemp)"
trap 'rm -f "$config_json"' EXIT

for secret in "$secret_dir/oidc_client_id" "$secret_dir/oidc_client_secret"; do
    if [ ! -O "$secret" ] || [ ! -r "$secret" ]; then
        printf '%s\n' 'candidate backend secret ownership or readability is unsafe' >&2
        exit 1
    fi
    mode="$(stat -f '%Lp' "$secret")"
    case "$mode" in
        400|600) ;;
        *)
            printf '%s\n' 'candidate backend secret permissions are unsafe' >&2
            exit 1
            ;;
    esac
done

if [ "$(stat -f '%Lp' "$secret_dir")" != '700' ]; then
    printf '%s\n' 'candidate OIDC secret directory permissions are unsafe' >&2
    exit 1
fi

"$compose" config --format json > "$config_json"

# No legacy business service can be smuggled into this overlay.  Other
# upstream opt-in services may appear in config, but only the selected native
# profiles can be started by compose.sh.
if jq -e '.services | has("web") or has("backend") or has("musnow")' "$config_json" >/dev/null; then
    printf '%s\n' 'candidate topology contains a legacy business service' >&2
    exit 1
fi

for required_service in frontend app docreader postgres redis neo4j searxng-init searxng; do
    if ! jq -e --arg service "$required_service" '.services | has($service)' "$config_json" >/dev/null; then
        printf '%s\n' 'candidate topology is missing a required native service' >&2
        exit 1
    fi
done

active_volume_sources=()
while IFS= read -r volume_source; do
    [ -n "$volume_source" ] && active_volume_sources+=("$volume_source")
done < <(
    jq -r '
      .services
      | with_entries(select(.key == "frontend" or .key == "app" or .key == "docreader" or .key == "postgres" or .key == "redis" or .key == "neo4j" or .key == "searxng-init" or .key == "searxng"))
      | to_entries[]
      | .value.volumes[]?
      | select(.type == "volume")
      | .source
    ' "$config_json" | sort -u
)

if [ "${#active_volume_sources[@]}" -eq 0 ]; then
    printf '%s\n' 'candidate topology resolved no active named volumes' >&2
    exit 1
fi

for source in "${active_volume_sources[@]}"; do
    volume_name="$(jq -r --arg source "$source" '.volumes[$source].name // empty' "$config_json")"
    case "$volume_name" in
        weknora-v072-candidate-*|musnow-weknora-v072-rehearsal-20260814-*) ;;
        *)
            printf '%s\n' 'candidate volume target is not isolated from live runtime' >&2
            exit 1
            ;;
    esac
done

if ! grep -Fq 'COPY weknora/frontend/dist' "$repo_root/integration/weknora-candidate/Dockerfile.frontend" ||
   ! grep -Fq 'COPY auth/dist' "$repo_root/integration/weknora-candidate/Dockerfile.frontend" ||
   grep -Eq '^COPY[[:space:]].*(legacy/|backend/|web/)' "$repo_root/integration/weknora-candidate/Dockerfile.frontend"; then
    printf '%s\n' 'candidate frontend build inputs are not native-only' >&2
    exit 1
fi

# The candidate app must compile v0.7.2 locally and only inherit the official
# v0.7.1 runtime OS layer by immutable digest. This prevents the old business
# binary from being selected by accident while avoiding a second large runtime
# package installation.
runtime_dockerfile="$repo_root/integration/weknora-candidate/Dockerfile.app.runtime"
if ! grep -Fq 'FROM wechatopenai/weknora-app@sha256:d88bef9912f6abb8bc7c22144ee7f314016055b8075bda4ea8fbb28af41c3bcf' "$runtime_dockerfile" ||
   ! grep -Fq 'ARG COMMIT_ID_ARG=3d5d8bfcdfeeea266b292b71cea616847af28d0f' "$runtime_dockerfile" ||
   ! grep -Fq 'COPY --from=builder /src/WeKnora ./WeKnora' "$runtime_dockerfile" ||
   ! grep -Fq 'COPY --from=builder /src/migrations/ ./migrations/' "$runtime_dockerfile" ||
   ! grep -Fq 'COPY --from=builder /src/scripts/ ./scripts/' "$runtime_dockerfile" ||
   ! grep -Fq 'COPY --from=builder /src/config/ ./config/' "$runtime_dockerfile"; then
    printf '%s\n' 'candidate app runtime derivation is not pinned or does not replace native artifacts' >&2
    exit 1
fi

printf '%s\n' 'candidate topology is green: official WeKnora services, isolated volumes, Neo4j and SearXNG only'
printf 'candidate volume targets:'
for source in "${active_volume_sources[@]}"; do
    jq -r --arg source "$source" '.volumes[$source].name' "$config_json" | tr '\n' ' '
done
printf '\n'
