#!/bin/sh
# Split production roles must not run the upstream bind-mount bootstrap: it
# recursively changes ownership and merges skills into the shared data volume
# while the prior release is still live.  They validate access and drop
# privileges directly.  The all/default role retains the legacy entrypoint.
set -eu

runtime_role=$(printf '%s' "${WEKNORA_RUNTIME_ROLE:-}" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
[ -n "$runtime_role" ] || runtime_role=all
case "$runtime_role" in
    all|prepare|web|worker) ;;
    *)
        printf '%s\n' "invalid WEKNORA_RUNTIME_ROLE=\"${WEKNORA_RUNTIME_ROLE:-}\"; expected all, web, worker, or prepare" >&2
        exit 2
        ;;
esac

path_root=''
if [ -n "${WEKNORA_ENTRYPOINT_TEST_ROOT:-}" ]; then
    if [ "${MUSUW_DEPLOY_GATE_TEST_MODE:-0}" != 1 ]; then
        printf '%s\n' 'entrypoint test root requires restricted gate test mode' >&2
        exit 1
    fi
    case "$WEKNORA_ENTRYPOINT_TEST_ROOT" in /*) ;; *) exit 1 ;; esac
    [ -d "$WEKNORA_ENTRYPOINT_TEST_ROOT" ] && [ ! -L "$WEKNORA_ENTRYPOINT_TEST_ROOT" ] || exit 1
    path_root=$(cd "$WEKNORA_ENTRYPOINT_TEST_ROOT" && pwd -P)
fi

secret_dir="${path_root}/run/secrets"
data_dir="${path_root}/data/files"
skills_dir="${path_root}/app/skills/preloaded"
upstream_entrypoint="${path_root}/app/scripts/docker-entrypoint.sh"

read_required_secret() {
    secret_path="$1"
    secret_name="$2"
    if [ ! -r "$secret_path" ]; then
        printf '%s\n' "required ${secret_name} secret file is unavailable" >&2
        exit 1
    fi
    secret_value=$(tr -d '\r\n' < "$secret_path")
    if [ -z "$secret_value" ]; then
        printf '%s\n' "required ${secret_name} secret file is empty" >&2
        exit 1
    fi
    printf '%s' "$secret_value"
}

export DB_PASSWORD="$(read_required_secret "$secret_dir/db_password" database-password)"
export REDIS_PASSWORD="$(read_required_secret "$secret_dir/redis_password" redis-password)"
export SYSTEM_AES_KEY="$(read_required_secret "$secret_dir/system_aes_key" system-aes-key)"
export JWT_SECRET="$(read_required_secret "$secret_dir/jwt_secret" jwt-secret)"
export OIDC_AUTH_CLIENT_ID="$(read_required_secret "$secret_dir/oidc_client_id" oidc-client-id)"
export OIDC_AUTH_CLIENT_SECRET="$(read_required_secret "$secret_dir/oidc_client_secret" oidc-client-secret)"
export DEEPSEEK_API_KEY="$(read_required_secret "$secret_dir/deepseek_api_key" deepseek-api-key)"
export OPENROUTER_API_KEY="$(read_required_secret "$secret_dir/openrouter_api_key" openrouter-api-key)"

if [ "${#SYSTEM_AES_KEY}" -ne 32 ]; then
    printf '%s\n' 'required system-aes-key has an invalid length' >&2
    exit 1
fi

neo4j_auth="$(read_required_secret "$secret_dir/neo4j_auth" neo4j-auth)"
case "$neo4j_auth" in
    neo4j/?*) export NEO4J_PASSWORD="${neo4j_auth#neo4j/}" ;;
    *)
        printf '%s\n' 'required neo4j-auth secret has an invalid account format' >&2
        exit 1
        ;;
esac
unset neo4j_auth

if [ "$runtime_role" = all ]; then
    [ -x "$upstream_entrypoint" ] || {
        printf '%s\n' 'legacy application entrypoint is unavailable' >&2
        exit 1
    }
    exec "$upstream_entrypoint" "$@"
fi

for required_dir in "$data_dir" "$skills_dir"; do
    [ -d "$required_dir" ] && [ ! -L "$required_dir" ] || {
        printf '%s\n' "split runtime directory is unavailable or unsafe: $required_dir" >&2
        exit 1
    }
    gosu appuser test -r "$required_dir" && gosu appuser test -x "$required_dir" || {
        printf '%s\n' "split runtime directory is not readable/searchable by appuser: $required_dir" >&2
        exit 1
    }
done
gosu appuser test -w "$data_dir" || {
    printf '%s\n' "split runtime data directory is not writable by appuser: $data_dir" >&2
    exit 1
}

exec gosu appuser "$@"
