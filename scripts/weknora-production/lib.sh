#!/usr/bin/env bash
# Shared non-secret helpers. Every caller parses .env files as data; none
# evaluates or sources an operator-provided file.
set -euo pipefail

weknora_production_repo_root() {
    cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

weknora_production_runtime_dir() {
    local repo_root
    repo_root="$(weknora_production_repo_root)"
    printf '%s' "${WEKNORA_PRODUCTION_RUNTIME_DIR:-$repo_root/.runtime/weknora-production}"
}

weknora_production_die() {
    printf '%s\n' "$1" >&2
    exit 1
}

weknora_production_require_command() {
    command -v "$1" >/dev/null 2>&1 || weknora_production_die "required command is unavailable"
}

weknora_production_require_file() {
    [ -f "$1" ] && [ -r "$1" ] || weknora_production_die "required production input is unavailable"
}

weknora_production_file_mode() {
    stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

weknora_production_require_secret_file() {
    local secret_path="$1"
    local mode
    weknora_production_require_file "$secret_path"
    [ ! -L "$secret_path" ] && [ -O "$secret_path" ] || weknora_production_die 'production secret file ownership is unsafe'
    mode="$(weknora_production_file_mode "$secret_path")"
    case "$mode" in
        400|600) ;;
        *) weknora_production_die 'production secret file permissions are unsafe' ;;
    esac
}

weknora_production_read_secret() {
    local secret_path="$1"
    local secret_value
    weknora_production_require_secret_file "$secret_path"
    secret_value="$(tr -d '\r\n' < "$secret_path")"
    [ -n "$secret_value" ] || weknora_production_die 'required production secret is empty'
    printf '%s' "$secret_value"
}

weknora_production_env_value() {
    local env_file="$1"
    local requested_key="$2"
    awk -v requested_key="$requested_key" '
        /^[[:space:]]*($|#)/ { next }
        /^[A-Za-z_][A-Za-z0-9_]*=/ {
            key = $0
            sub(/=.*/, "", key)
            if (key == requested_key) {
                value = $0
                sub(/^[^=]*=/, "", value)
                print value
                exit
            }
        }
    ' "$env_file"
}

weknora_production_require_env_value() {
    local env_file="$1"
    local requested_key="$2"
    local value
    value="$(weknora_production_env_value "$env_file" "$requested_key")"
    [ -n "$value" ] || weknora_production_die 'required production non-secret setting is unavailable'
    printf '%s' "$value"
}

weknora_production_require_unique_env_keys() {
    local env_file="$1"
    local duplicate_key

    weknora_production_require_file "$env_file"
    duplicate_key="$(awk '
        /^[[:space:]]*($|#)/ { next }
        /^[A-Za-z_][A-Za-z0-9_]*=/ {
            key = $0
            sub(/=.*/, "", key)
            if (seen[key]++) {
                print key
                exit
            }
        }
    ' "$env_file")"
    [ -z "$duplicate_key" ] || weknora_production_die "duplicate production setting is not allowed: $duplicate_key"
}

weknora_production_safe_id() {
    case "$1" in
        ''|*[!A-Za-z0-9._-]*|.*|*-|*.) return 1 ;;
        *..*) return 1 ;;
        *) [ "${#1}" -le 128 ] ;;
    esac
}

weknora_production_image_tag() {
    # Full SHA tags remain within Docker's tag limit and avoid mutable aliases.
    weknora_production_revision
}

weknora_production_release_id() {
    local candidate="${WEKNORA_PRODUCTION_RELEASE_ID:-${WEKNORA_DEPLOY_RELEASE_ID:-}}"
    [ -n "$candidate" ] || candidate='weknora-v072-production'
    weknora_production_safe_id "$candidate" || weknora_production_die 'production release id is unsafe'
    printf '%s' "$candidate"
}

# Keep the validation branch compact and data-only at call sites while retaining
# the historical `local` fallback for a checkout without Git metadata.
weknora_production_revision() {
    local candidate="${WEKNORA_PRODUCTION_REVISION:-${WEKNORA_DEPLOY_REVISION:-${GITHUB_SHA:-}}}"
    local repo_root git_revision runtime_file

    if [ -z "$candidate" ]; then
        runtime_file="$(weknora_production_runtime_dir)/production.env"
        if [ -r "$runtime_file" ]; then
            candidate="$(weknora_production_env_value "$runtime_file" WEKNORA_PRODUCTION_REVISION || true)"
        fi
    fi

    if [ -z "$candidate" ]; then
        repo_root="$(weknora_production_repo_root)"
        if command -v git >/dev/null 2>&1; then
            git_revision="$(git -C "$repo_root" rev-parse --verify HEAD 2>/dev/null || true)"
            candidate="$git_revision"
        fi
    fi
    [ -n "$candidate" ] || candidate='local'
    if [ "$candidate" != 'local' ]; then
        if ! [[ "$candidate" =~ ^[0-9a-fA-F]+$ ]]; then
            weknora_production_die 'production revision is unsafe'
        fi
        case "${#candidate}" in
            40|64) ;;
            *) weknora_production_die 'production revision must be a full 40- or 64-character SHA' ;;
        esac
    fi
    printf '%s' "$candidate"
}

weknora_production_require_clean_checkout() {
    local repo_root="$1"
    local expected_revision="$2"
    local checkout_root head status_line status_code relative

    weknora_production_require_command git
    [ -d "$repo_root" ] || weknora_production_die 'production source checkout is unavailable'
    [ "$(git -C "$repo_root" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ] || \
        weknora_production_die 'production source must be a Git worktree'
    checkout_root="$(git -C "$repo_root" rev-parse --show-toplevel 2>/dev/null || true)"
    [ -n "$checkout_root" ] || weknora_production_die 'production Git checkout root is unavailable'
    checkout_root="$(cd "$checkout_root" && pwd -P)"
    repo_root="$(cd "$repo_root" && pwd -P)"
    [ "$checkout_root" = "$repo_root" ] || \
        weknora_production_die 'production source path is not the Git checkout root'

    case "$expected_revision" in
        ''|local|*[!0-9a-fA-F]*) weknora_production_die 'production release requires a full Git revision' ;;
    esac
    case "${#expected_revision}" in
        40|64) ;;
        *) weknora_production_die 'production release revision is not a full Git SHA' ;;
    esac
    head="$(git -C "$repo_root" rev-parse --verify HEAD 2>/dev/null || true)"
    [ -n "$head" ] || weknora_production_die 'production Git checkout has no HEAD'
    [ "$head" = "$expected_revision" ] || \
        weknora_production_die 'production Git HEAD does not match the requested release revision'

    # Build output is intentionally generated after this check and is ignored
    # by the source manifest. Every tracked source/index change must fail.
    if ! git -C "$repo_root" diff --quiet --ignore-submodules HEAD -- \
        . ':(exclude)**/dist/**' ':(exclude)**/node_modules/**' ':(exclude)**/.vite/**'; then
        weknora_production_die 'production Git checkout has modified tracked source'
    fi
    if ! git -C "$repo_root" diff --cached --quiet --ignore-submodules -- \
        . ':(exclude)**/dist/**' ':(exclude)**/node_modules/**' ':(exclude)**/.vite/**'; then
        weknora_production_die 'production Git index has staged source changes'
    fi
    while IFS= read -r status_line; do
        [ -n "$status_line" ] || continue
        status_code="${status_line:0:2}"
        relative="${status_line:3}"
        if [ "$status_code" = '??' ]; then
            case "$relative" in
                weknora/frontend/dist|weknora/frontend/dist/*|auth/dist|auth/dist/*|\
                */node_modules|*/node_modules/*|*/.vite|*/.vite/*) continue ;;
            esac
        fi
        weknora_production_die "production Git checkout has untracked or changed content: $relative"
    done < <(git -C "$repo_root" status --porcelain=v1 --untracked-files=all)
}

weknora_production_safe_remote_path() {
    case "$1" in
        /opt/weknora/releases|/opt/weknora/releases/*|/opt/weknora/runtime|/opt/weknora/runtime/*) return 0 ;;
        *) return 1 ;;
    esac
}

weknora_production_require_disk_reserve() {
    local minimum_free_kib="${WEKNORA_PRODUCTION_MIN_FREE_KIB:-12582912}"
    local docker_root path available_kib

    case "$minimum_free_kib" in
        ''|*[!0-9]*) weknora_production_die 'production minimum free capacity is invalid' ;;
    esac
    [ "$minimum_free_kib" -gt 0 ] || weknora_production_die 'production minimum free capacity is invalid'

    docker_root="$(docker info --format '{{.DockerRootDir}}')" || \
        weknora_production_die 'production Docker root directory is unavailable'
    [ -n "$docker_root" ] || weknora_production_die 'production Docker root directory is unavailable'

    for path in / "$docker_root"; do
        available_kib="$(df -Pk "$path" | awk 'NR == 2 { print $4 }')"
        case "$available_kib" in
            ''|*[!0-9]*) weknora_production_die 'production free capacity could not be determined' ;;
        esac
        [ "$available_kib" -ge "$minimum_free_kib" ] || \
            weknora_production_die "production capacity is below the required ${minimum_free_kib} KiB reserve"
    done
}

weknora_production_assert_exact_volume() {
    local role="$1"
    local value="$2"
    local expected="weknora-v072-production-${role}"
    [ "$value" = "$expected" ] || weknora_production_die 'production target volume is not the exact approved new volume'
}

weknora_production_require_clean_new_dir() {
    local directory="$1"
    [ ! -e "$directory" ] || weknora_production_die 'target artifact directory already exists'
    install -d -m 700 "$directory"
}

weknora_production_sha256_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

# The PostgreSQL runtime consumes only migrations/versioned. Daily releases may
# append a later version there, but the history already applied to customer
# data is immutable. Keep this validation shared so activation and staged
# runtime verification derive the same target version.
weknora_production_versioned_migration_version() {
    local migration_path="$1"
    local migration_name="${migration_path##*/}"

    if [[ "$migration_name" =~ ^([0-9]{6})_[A-Za-z0-9][A-Za-z0-9_.-]*\.(up|down)\.sql$ ]]; then
        printf '%s' "${BASH_REMATCH[1]}"
        return 0
    fi
    return 1
}

weknora_production_latest_versioned_migration() {
    local source_root="$1"
    local migration_root="$source_root/weknora/migrations/versioned"
    local migration_path version latest=''

    [ -d "$migration_root" ] || weknora_production_die 'versioned migration directory is unavailable'
    [ -z "$(find "$migration_root" -type l -print -quit)" ] || weknora_production_die 'versioned migration directory contains a symbolic link'

    while IFS= read -r -d '' migration_path; do
        [ "${migration_path%/*}" = "$migration_root" ] || weknora_production_die 'versioned migration directory contains a nested file'
        version="$(weknora_production_versioned_migration_version "$migration_path")" || \
            weknora_production_die 'versioned migration file name is invalid'
        if [ -z "$latest" ] || [ "$((10#$version))" -gt "$((10#$latest))" ]; then
            latest="$version"
        fi
    done < <(find "$migration_root" -type f -print0)

    [ -n "$latest" ] || weknora_production_die 'versioned migration directory is empty'
    printf '%s' "$((10#$latest))"
}

weknora_production_require_additive_versioned_migrations() {
    local old_source_root="$1"
    local new_source_root="$2"
    local old_migration_root="$old_source_root/weknora/migrations"
    local new_migration_root="$new_source_root/weknora/migrations"
    local old_migration_path new_migration_path relative_path version old_max

    [ -d "$old_migration_root" ] || weknora_production_die 'current migration directory is unavailable'
    [ -d "$new_migration_root" ] || weknora_production_die 'release migration directory is unavailable'
    [ -z "$(find "$old_migration_root" -type l -print -quit)" ] || weknora_production_die 'current migration directory contains a symbolic link'
    [ -z "$(find "$new_migration_root" -type l -print -quit)" ] || weknora_production_die 'release migration directory contains a symbolic link'

    # Every historical path must still exist with identical bytes. This checks
    # all migration backends, not only PostgreSQL, so a daily release cannot
    # silently rewrite or delete migration history elsewhere in the source.
    while IFS= read -r -d '' old_migration_path; do
        relative_path="${old_migration_path#"$old_migration_root"/}"
        new_migration_path="$new_migration_root/$relative_path"
        [ -f "$new_migration_path" ] || weknora_production_die 'migration history changed; an existing migration is missing'
        cmp -s "$old_migration_path" "$new_migration_path" || \
            weknora_production_die 'migration history changed; an existing migration bytes differ'
    done < <(find "$old_migration_root" -type f -print0)

    old_max="$(weknora_production_latest_versioned_migration "$old_source_root")"
    while IFS= read -r -d '' new_migration_path; do
        relative_path="${new_migration_path#"$new_migration_root"/}"
        [ -f "$old_migration_root/$relative_path" ] && continue

        case "$relative_path" in
            versioned/*) ;;
            *) weknora_production_die 'migration history changed; daily releases only allow additive versioned migrations' ;;
        esac
        [ "${relative_path#versioned/}" = "${relative_path##*/}" ] || \
            weknora_production_die 'versioned migration directory contains a nested file'
        version="$(weknora_production_versioned_migration_version "$new_migration_path")" || \
            weknora_production_die 'new versioned migration file name is invalid'
        [ "$((10#$version))" -gt "$old_max" ] || \
            weknora_production_die 'new versioned migration must be strictly after the current maximum'
    done < <(find "$new_migration_root" -type f -print0)
}
