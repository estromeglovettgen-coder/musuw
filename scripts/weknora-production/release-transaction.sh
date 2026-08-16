#!/usr/bin/env bash
# A serialized, reversible production release transaction.
#
# This is the implementation behind the fixed SSH preflight/promote/run
# protocol.  The caller supplies only a validated release id and full SHA via
# the deploy seam.  Every Compose project, service/container identity, image
# tag and candidate port below is derived from that SHA; no caller-selected
# role, project, container, volume, secret or filesystem path is accepted.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 0 ] || weknora_production_die 'release transaction accepts no arguments'
for command_name in docker curl jq mktemp date readlink ln mv cp install find grep awk head df cmp sync sha256sum sort stat; do
    weknora_production_require_command "$command_name"
done
if ! command -v flock >/dev/null 2>&1 && ! command -v lockf >/dev/null 2>&1; then
    weknora_production_die 'kernel file-lock command is unavailable'
fi

repo_root="$(weknora_production_repo_root)"
runtime_dir="$(weknora_production_runtime_dir)"
revision="$(weknora_production_revision)"
[ "${#revision}" -eq 40 ] || weknora_production_die 'transactional runtime requires a full 40-character compiled Git revision'
release_id="$(weknora_production_release_id)"
project="$(weknora_production_release_project)"
edge_network='musnow-production_edge'
edge_alias='web'
release_root='/opt/weknora/releases'
current_link='/opt/weknora/current'
transaction_root="$runtime_dir/release-transactions"
state_file="$transaction_root/$release_id.json"
snapshot_dir="$transaction_root/$release_id"
snapshot_file="$snapshot_dir/snapshot.json"
snapshot_config_dir="$snapshot_dir/config"
candidate_dir="$snapshot_dir/candidate"
ledger_file="$runtime_dir/release-ledger-v2.json"
lock_file="$runtime_dir/release-transaction.lock"
lock_held=false
rollback_running=false
transaction_committed=false
edge_cutover=false
worker_started=false
old_stopped=false

transaction_test_fault() {
    local phase="$1"
    # Fault injection exists only for the local restricted-gate harness.  The
    # production gate and workflow do not forward either control variable.
    if [ "${MUSUW_DEPLOY_GATE_TEST_MODE:-0}" = 1 ] && \
       [ -n "${MUSUW_DEPLOY_GATE_ROOT:-}" ] && \
       [ "${WEKNORA_PRODUCTION_TRANSACTION_TEST_FAULT:-}" = "$phase" ]; then
        weknora_production_die "test-only release transaction fault: $phase"
    fi
}

transaction_test_crash() {
    local phase="$1"
    # Replacing the shell models an abrupt process exit: EXIT traps do not run,
    # but the kernel closes the inherited lock descriptor automatically.
    if [ "${MUSUW_DEPLOY_GATE_TEST_MODE:-0}" = 1 ] && \
       [ -n "${MUSUW_DEPLOY_GATE_ROOT:-}" ] && \
       [ "${WEKNORA_PRODUCTION_TRANSACTION_TEST_FAULT:-}" = "$phase" ]; then
        exec /bin/sh -c 'exit 137'
    fi
}

transaction_test_legacy_tree_drift() {
    local old_source
    if [ "${MUSUW_DEPLOY_GATE_TEST_MODE:-0}" = 1 ] && \
       [ -n "${MUSUW_DEPLOY_GATE_ROOT:-}" ] && \
       [ "${WEKNORA_PRODUCTION_TRANSACTION_TEST_FAULT:-}" = legacy_tree_drift ]; then
        old_source="$(jq -r '.source_target' "$snapshot_file")"
        printf '%s\n' test-only-legacy-tree-drift >> "$old_source/weknora/migrations/versioned/000001_fixture.up.sql"
        weknora_production_die 'test-only legacy predecessor tree drift'
    fi
}

# Local contract simulations mount the server under /opt/weknora and retain
# the exact production paths.  This optional prefix is accepted only by the
# existing restricted-gate test mode; the production SSH gate never forwards
# it.
if [ "${MUSUW_DEPLOY_GATE_TEST_MODE:-0}" = 1 ] && [ -n "${MUSUW_DEPLOY_GATE_ROOT:-}" ]; then
    gate_root="$(cd "$MUSUW_DEPLOY_GATE_ROOT" && pwd -P)"
    release_root="$gate_root/opt/weknora/releases"
    current_link="$gate_root/opt/weknora/current"
fi

case "$repo_root" in
    "$release_root"/*/source) ;;
    *) weknora_production_die 'transaction source is outside the approved release root' ;;
esac
[ -d "$runtime_dir" ] && [ ! -L "$runtime_dir" ] || weknora_production_die 'production runtime directory is unavailable'
[ "$(weknora_production_file_mode "$runtime_dir")" = 700 ] || weknora_production_die 'production runtime directory permissions are unsafe'
[ -d "$runtime_dir/secrets" ] && [ ! -L "$runtime_dir/secrets" ] || weknora_production_die 'production secret directory is unavailable'

mkdir -p "$transaction_root"
chmod 700 "$transaction_root"

safe_container_id() {
    [[ "$1" =~ ^[0-9a-fA-F]{12,64}$ ]]
}

safe_container_name() {
    [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]
}

safe_image_ref() {
    case "$1" in
        ''|*[[:space:]]*|*';'*|*'|'*) return 1 ;;
        *) return 0 ;;
    esac
}

json_file_hash() {
    local path="$1"
    if [ -f "$path" ] && [ ! -L "$path" ]; then
        weknora_production_sha256_file "$path"
    else
        printf 'null'
    fi
}

has_predecessor_manifest() {
    local root="$1"
    [ -f "$root/deploy/source-manifest.sha256" ] && [ ! -L "$root/deploy/source-manifest.sha256" ] && \
        [ -f "$root/deploy/release-manifest.json" ] && [ ! -L "$root/deploy/release-manifest.json" ] && \
        [ -f "$root/deploy/release-manifest.json.sha256" ] && [ ! -L "$root/deploy/release-manifest.json.sha256" ]
}

has_any_predecessor_manifest() {
    local root="$1"
    [ -e "$root/deploy/source-manifest.sha256" ] || \
        [ -e "$root/deploy/release-manifest.json" ] || \
        [ -e "$root/deploy/release-manifest.json.sha256" ]
}

legacy_tree_snapshot_json() {
    local root="$1" records sorted path relative kind mode bytes content_sha record
    local file_count=0 total_bytes=0 entry_count=0 digest records_json paths_json
    records="$snapshot_dir/legacy-tree.records"
    sorted="$snapshot_dir/legacy-tree.records.sorted"
    : > "$records"
    while IFS= read -r -d '' path; do
        relative="${path#"$root/"}"
        if [ -L "$path" ]; then
            weknora_production_die "legacy predecessor contains a symbolic link: $relative"
        elif [ -d "$path" ]; then
            kind='directory'
            mode="$(weknora_production_file_mode "$path")"
            bytes=0
            content_sha='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        elif [ -f "$path" ]; then
            kind='file'
            mode="$(weknora_production_file_mode "$path")"
            bytes="$(wc -c < "$path" | tr -d ' ')"
            content_sha="$(sha256sum "$path" | awk '{print $1}')"
            file_count=$((file_count + 1))
            total_bytes=$((total_bytes + bytes))
        else
            weknora_production_die "legacy predecessor contains a special file: $relative"
        fi
        record="$(jq -cn --arg kind "$kind" --arg path "$relative" --arg mode "$mode" --arg size "$bytes" --arg content_sha "$content_sha" \
            '{kind:$kind,path:$path,mode:($mode|tonumber),size:($size|tonumber),content_sha256:$content_sha}')"
        printf '%s\0' "$record" >> "$records"
        entry_count=$((entry_count + 1))
    done < <(find "$root" -mindepth 1 -print0)
    [ "$entry_count" -gt 0 ] || weknora_production_die 'legacy predecessor source tree is empty'
    LC_ALL=C sort -z "$records" > "$sorted"
    digest="$(sha256sum "$sorted" | awk '{print $1}')"
    records_json="$(jq -Rs 'split("\u0000") | map(select(length > 0) | fromjson)' "$sorted")"
    paths_json="$(jq -c '[.[].path]' <<<"$records_json")"
    jq -cn --arg status 'legacy_content_digest_only' --arg digest "$digest" \
        --argjson file_count "$file_count" --argjson bytes "$total_bytes" --argjson paths "$paths_json" \
        '{status:$status,digest:$digest,file_count:$file_count,bytes:$bytes,paths:$paths}'
}

verify_strict_predecessor_manifests() {
    local root="$1" expected_revision="$2" source_manifest release_manifest release_checksum
    local expected_bundle actual_bundle expected_count expected_bytes actual_count actual_bytes
    local line checksum relative source_path actual_checksum bytes
    has_predecessor_manifest "$root" || weknora_production_die 'v2 predecessor manifests are incomplete'
    [[ "$expected_revision" =~ ^[0-9a-fA-F]{40}$ ]] || weknora_production_die 'v2 predecessor revision is unavailable'
    source_manifest="$root/deploy/source-manifest.sha256"
    release_manifest="$root/deploy/release-manifest.json"
    release_checksum="$root/deploy/release-manifest.json.sha256"
    expected_revision="$(jq -er '.revision | strings | select(test("^[0-9a-fA-F]{40}$"))' "$release_manifest")" || \
        weknora_production_die 'v2 predecessor release manifest revision is invalid'
    [ "$expected_revision" = "$2" ] || weknora_production_die 'v2 predecessor release manifest revision drifted'
    expected_bundle="$(jq -er '.source_bundle_sha256 | strings | select(test("^[0-9a-fA-F]{64}$"))' "$release_manifest")" || \
        weknora_production_die 'v2 predecessor source bundle hash is invalid'
    actual_bundle="$(sha256sum "$source_manifest" | awk '{print $1}')"
    [ "$expected_bundle" = "$actual_bundle" ] || weknora_production_die 'v2 predecessor source manifest hash drifted'
    actual_checksum="$(sha256sum "$release_manifest" | awk '{print $1}')"
    [ "$(awk '{print $1}' "$release_checksum")" = "$actual_checksum" ] || weknora_production_die 'v2 predecessor release manifest checksum drifted'
    expected_count="$(jq -er '.source_file_count | numbers' "$release_manifest")"
    expected_bytes="$(jq -er '.source_bytes | numbers' "$release_manifest")"
    actual_count=0
    actual_bytes=0
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        checksum="${line%%  *}"
        relative="${line#"$checksum  "}"
        [[ "$checksum" =~ ^[0-9a-fA-F]{64}$ ]] || weknora_production_die 'v2 predecessor source manifest line is invalid'
        case "$relative" in
            ''|/*|*..*|*"$'\n'"*) weknora_production_die 'v2 predecessor source manifest path is unsafe' ;;
        esac
        source_path="$root/$relative"
        [ -f "$source_path" ] && [ ! -L "$source_path" ] || weknora_production_die 'v2 predecessor source manifest input is unavailable'
        actual_checksum="$(sha256sum "$source_path" | awk '{print $1}')"
        [ "$checksum" = "$actual_checksum" ] || weknora_production_die 'v2 predecessor source input hash drifted'
        bytes="$(wc -c < "$source_path" | tr -d ' ')"
        actual_bytes=$((actual_bytes + bytes))
        actual_count=$((actual_count + 1))
    done < "$source_manifest"
    [ "$actual_count" -eq "$expected_count" ] && [ "$actual_bytes" -eq "$expected_bytes" ] || \
        weknora_production_die 'v2 predecessor source manifest size drifted'
}

container_format() {
    local ref="$1"
    local format="$2"
    docker inspect "$ref" --format "$format"
}

container_exists() {
    docker inspect "$1" >/dev/null 2>&1
}

container_id_for_name() {
    local name="$1" id
    id="$(container_format "$name" '{{.Id}}' 2>/dev/null || true)"
    safe_container_id "$id" || return 1
    printf '%s' "$id"
}

container_on_edge() {
    local ref="$1" networks
    networks="$(container_format "$ref" '{{json .NetworkSettings.Networks}}')"
    jq -e --arg network "$edge_network" 'has($network)' <<<"$networks" >/dev/null
}

container_on_network() {
    local ref="$1" network="$2" networks
    networks="$(container_format "$ref" '{{json .NetworkSettings.Networks}}')"
    jq -e --arg network "$network" 'has($network)' <<<"$networks" >/dev/null
}

container_has_alias() {
    local ref="$1" alias="$2" networks
    networks="$(container_format "$ref" '{{json .NetworkSettings.Networks}}')"
    jq -e --arg network "$edge_network" --arg alias "$alias" \
        '((.[$network].Aliases // []) | index($alias)) != null' <<<"$networks" >/dev/null
}

edge_owner() {
    local endpoint_id aliases
    local -a owners=()
    docker network inspect "$edge_network" >/dev/null
    while IFS= read -r endpoint_id; do
        [ -n "$endpoint_id" ] || continue
        safe_container_id "$endpoint_id" || weknora_production_die 'public edge contains an unsafe endpoint identity'
        if container_has_alias "$endpoint_id" "$edge_alias"; then
            owners+=("$endpoint_id")
        fi
    done < <(docker network inspect "$edge_network" --format '{{range $id, $_ := .Containers}}{{$id}}{{"\n"}}{{end}}')
    [ "${#owners[@]}" -eq 1 ] || weknora_production_die 'public edge must have exactly one web alias owner'
    printf '%s' "${owners[0]}"
}

edge_aliases_json() {
    local ref="$1" networks
    networks="$(container_format "$ref" '{{json .NetworkSettings.Networks}}')"
    jq -c --arg network "$edge_network" '.[$network].Aliases // []' <<<"$networks"
}

edge_aliases_valid() {
    jq -e --arg alias "$edge_alias" \
        'type == "array" and length > 0 and index($alias) != null and all(.[]; type == "string" and test("^[A-Za-z0-9][A-Za-z0-9_.-]*$"))' \
        <<<"$1" >/dev/null
}

atomic_state_update() {
    local phase="$1"
    local event="$2"
    local tmp now
    tmp="$(mktemp "$state_file.XXXXXX")"
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq --arg phase "$phase" --arg event "$event" --arg now "$now" \
        '.phase = $phase | .updated_at = $now | .events = ((.events // []) + [{at:$now,event:$event}])' \
        "$state_file" > "$tmp"
    chmod 600 "$tmp"
    mv -f "$tmp" "$state_file"
    sync >/dev/null 2>&1 || true
}

require_role_identity() {
    local role="$1" name="$2"
    case "$role" in prepare|web|frontend|worker) ;; *) return 1 ;; esac
    safe_container_name "$name"
}

image_snapshot_json() {
    local ref="$1" image_ref image_id inspected_id repo_digest revision_label
    local id_status repo_digest_status revision_label_status
    image_ref="$(container_format "$ref" '{{.Config.Image}}' 2>/dev/null || true)"
    image_id="$(container_format "$ref" '{{.Image}}' 2>/dev/null || true)"
    inspected_id=''
    if [ -n "$image_id" ] && safe_image_ref "$image_id"; then
        inspected_id="$(docker image inspect "$image_id" --format '{{.Id}}' 2>/dev/null || true)"
    fi
    if [[ "$inspected_id" =~ ^sha256:[0-9a-fA-F]{64}$ ]] && [ "$inspected_id" = "$image_id" ]; then
        image_id="$inspected_id"
        id_status='verified'
    else
        image_id=''
        id_status='unavailable'
    fi
    [ "$id_status" = verified ] || weknora_production_die 'container image content ID is unavailable or unsafe'

    repo_digest=''
    if [ -n "$image_ref" ] && safe_image_ref "$image_ref"; then
        repo_digest="$(docker image inspect "$image_ref" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
    fi
    if [[ "$repo_digest" =~ ^[^[:space:]@]+@sha256:[0-9a-fA-F]{64}$ ]]; then
        repo_digest_status='verified'
    elif [ -z "$repo_digest" ]; then
        repo_digest_status='unavailable'
    else
        repo_digest=''
        repo_digest_status='invalid'
    fi

    revision_label=''
    if [ -n "$image_ref" ] && safe_image_ref "$image_ref"; then
        revision_label="$(docker image inspect "$image_ref" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || true)"
    fi
    if [[ "$revision_label" =~ ^[0-9a-fA-F]{40}$ ]]; then
        revision_label_status='verified'
    elif [ -z "$revision_label" ]; then
        revision_label_status='legacy_unverified'
    else
        revision_label_status='invalid'
    fi
    jq -cn \
        --arg id "$image_id" --arg id_status "$id_status" \
        --arg repo_digest "$repo_digest" --arg repo_digest_status "$repo_digest_status" \
        --arg revision_label "$revision_label" --arg revision_label_status "$revision_label_status" \
        '{id:(if $id == "" then null else $id end),id_status:$id_status,
          repo_digest:(if $repo_digest == "" then null else $repo_digest end),
          repo_digest_status:$repo_digest_status,
          revision_label:(if $revision_label == "" then null else $revision_label end),
          revision_label_status:$revision_label_status}'
}

capture_container_json() {
    local id="$1" name service service_project image running health image_json
    safe_container_id "$id" || return 1
    name="$(container_format "$id" '{{.Name}}' 2>/dev/null || true)"
    name="${name#/}"
    service="$(container_format "$id" '{{ index .Config.Labels "com.docker.compose.service" }}' 2>/dev/null || true)"
    service_project="$(container_format "$id" '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || true)"
    image="$(container_format "$id" '{{.Config.Image}}' 2>/dev/null || true)"
    running="$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)"
    health="$(container_format "$id" '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)"
    safe_container_name "$name" || return 1
    image_json="$(image_snapshot_json "$id")"
    jq -cn \
        --arg id "$id" --arg name "$name" --arg service "$service" --arg project "$service_project" \
        --arg image "$image" --arg running "$running" --arg health "$health" --argjson image_state "$image_json" \
        '{id:$id,name:$name,service:$service,project:$project,image:(if $image == "" then null else $image end),running:($running == "true"),health:$health,image_state:$image_state}'
}

capture_project_ids() {
    local project_name="$1" id service
    [ -n "$project_name" ] || return 0
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        safe_container_id "$id" || continue
        service="$(container_format "$id" '{{ index .Config.Labels "com.docker.compose.service" }}' 2>/dev/null || true)"
        case "$service" in
            app|web|frontend|worker|prepare) printf '%s\n' "$id" ;;
        esac
    done < <(docker ps -aq --filter "label=com.docker.compose.project=$project_name" 2>/dev/null || true)
}

capture_project_worker_ids() {
    local project_name="$1" id service
    [ -n "$project_name" ] || return 0
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        safe_container_id "$id" || continue
        service="$(container_format "$id" '{{ index .Config.Labels "com.docker.compose.service" }}' 2>/dev/null || true)"
        [ "$service" = worker ] || continue
        printf '%s\n' "$id"
    done < <(docker ps -aq --filter "label=com.docker.compose.project=$project_name" 2>/dev/null || true)
}

json_unique_ids() {
    local ids="$1" id out='[]'
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        safe_container_id "$id" || continue
        out="$(jq -cn --argjson old "$out" --arg id "$id" 'if ($old | index($id)) then $old else $old + [$id] end')"
    done <<<"$ids"
    printf '%s' "$out"
}

copy_config_snapshot() {
    local file_name
    mkdir -p "$snapshot_config_dir"
    chmod 700 "$snapshot_config_dir"
    for file_name in production.public.env auth-public.env production.env; do
        [ -f "$runtime_dir/$file_name" ] && [ ! -L "$runtime_dir/$file_name" ] || \
            weknora_production_die "current production configuration is unavailable: $file_name"
        install -m 600 "$runtime_dir/$file_name" "$snapshot_config_dir/$file_name"
    done
    if [ -f "$ledger_file" ] && [ ! -L "$ledger_file" ]; then
        install -m 600 "$ledger_file" "$snapshot_config_dir/release-ledger-v2.json"
    fi
}

write_snapshot() {
    local old_id old_name old_project old_image old_running old_aliases
    local old_source old_revision old_config_json ids id json old_json='[]'
    local ledger_present=false ledger_project ledger_source ledger_edge_id ledger_worker_ids
    local live_worker_lines live_worker_ids predecessor_provenance predecessor_manifest_sha
    local predecessor_tree_json predecessor_tree ledger_tree_json
    local ledger_web_id ledger_frontend_id ledger_web_image ledger_frontend_image live_web_json live_frontend_json
    old_id="$(edge_owner)"
    old_name="$(container_format "$old_id" '{{.Name}}')"
    old_name="${old_name#/}"
    old_project="$(container_format "$old_id" '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || true)"
    old_image="$(container_format "$old_id" '{{.Config.Image}}' 2>/dev/null || true)"
    old_running="$(container_format "$old_id" '{{.State.Running}}' 2>/dev/null || true)"
    old_aliases="$(edge_aliases_json "$old_id")"
    safe_container_id "$old_id" || weknora_production_die 'public edge owner identity is unsafe'
    safe_container_name "$old_name" || weknora_production_die 'public edge owner name is unsafe'
    edge_aliases_valid "$old_aliases" || weknora_production_die 'public edge owner aliases are unsafe'
    [ "$old_running" = true ] || weknora_production_die 'public edge owner is not running'

    old_source="$(readlink -f "$current_link" 2>/dev/null || true)"
    case "$old_source" in
        "$release_root"/*/source) ;;
        *) weknora_production_die 'current production source target is outside the approved release root' ;;
    esac
    [ -d "$old_source" ] || weknora_production_die 'current production source target is unavailable'
    old_revision="$(git -C "$old_source" rev-parse HEAD 2>/dev/null || true)"
    old_config_json="$(jq -cn \
        --arg production_public_env_sha "$(json_file_hash "$runtime_dir/production.public.env")" \
        --arg auth_public_env_sha "$(json_file_hash "$runtime_dir/auth-public.env")" \
        --arg production_env_sha "$(json_file_hash "$runtime_dir/production.env")" \
        --arg ledger_sha "$(json_file_hash "$ledger_file")" \
        '{production_public_env_sha:$production_public_env_sha,auth_public_env_sha:$auth_public_env_sha,production_env_sha:$production_env_sha,ledger_sha:$ledger_sha}')"

    # A v2 ledger is evidence only after a prior transaction committed. A
    # missing ledger is recorded as the exact observed legacy project/IDs; no
    # name, project, image, or state is fabricated or renamed.
    previous_project=''
    previous_revision=''
    previous_worker_ids='[]'
    if [ -f "$ledger_file" ] && jq -e '.schema == 2 and .current' "$ledger_file" >/dev/null 2>&1; then
        ledger_present=true
        previous_project="$(jq -r '.current.project // empty' "$ledger_file")"
        previous_revision="$(jq -r '.current.revision // empty' "$ledger_file")"
        ledger_project="$previous_project"
        ledger_source="$(jq -r '.current.source // empty' "$ledger_file")"
        ledger_edge_id="$(jq -r '.current.frontend_id // empty' "$ledger_file")"
        ledger_worker_ids="$(jq -c '.current.worker_ids // (if .current.worker_id then [.current.worker_id] else [] end)' "$ledger_file")"
        [ -n "$ledger_project" ] && [ -n "$previous_revision" ] && [ -n "$ledger_source" ] || \
            weknora_production_die 'v2 release ledger identity is incomplete'
        [ "$old_project" = "$ledger_project" ] || weknora_production_die 'live edge owner project drifted from the release ledger'
        [ "$old_source" = "$ledger_source" ] || weknora_production_die 'live source target drifted from the release ledger'
        [ "$old_id" = "$ledger_edge_id" ] || weknora_production_die 'live public edge owner drifted from the release ledger'
        ledger_value="$(jq -r '.current.config_sha256.production_public_env // empty' "$ledger_file")"
        actual_value="$(jq -r '.production_public_env_sha' <<<"$old_config_json")"
        [ -n "$ledger_value" ] && [ "$ledger_value" = "$actual_value" ] || \
            weknora_production_die 'live production public configuration drifted from the release ledger'
        ledger_value="$(jq -r '.current.config_sha256.auth_public_env // empty' "$ledger_file")"
        actual_value="$(jq -r '.auth_public_env_sha' <<<"$old_config_json")"
        [ -n "$ledger_value" ] && [ "$ledger_value" = "$actual_value" ] || \
            weknora_production_die 'live auth public configuration drifted from the release ledger'
        ledger_value="$(jq -r '.current.config_sha256.production_env // empty' "$ledger_file")"
        actual_value="$(jq -r '.production_env_sha' <<<"$old_config_json")"
        [ -n "$ledger_value" ] && [ "$ledger_value" = "$actual_value" ] || \
            weknora_production_die 'live production configuration drifted from the release ledger'
    fi
    live_worker_lines="$(capture_project_worker_ids "${previous_project:-$old_project}")"
    live_worker_ids="$(json_unique_ids "$live_worker_lines")"
    if [ "$ledger_present" = true ]; then
        old_revision="$previous_revision"
        jq -n -e --argjson live "$live_worker_ids" --argjson ledger "$ledger_worker_ids" \
            '($live | sort) == ($ledger | sort)' >/dev/null || \
            weknora_production_die 'live worker ownership drifted from the release ledger'
        previous_worker_ids="$live_worker_ids"
    fi
    mkdir -p "$snapshot_dir"
    chmod 700 "$snapshot_dir"
    if [ "$ledger_present" = true ]; then
        verify_strict_predecessor_manifests "$old_source" "$old_revision"
        predecessor_tree_json="$(legacy_tree_snapshot_json "$old_source")"
        predecessor_tree="$(jq -c '{digest,file_count,bytes,paths}' <<<"$predecessor_tree_json")"
        ledger_tree_json="$(jq -c '.current.source_tree // empty' "$ledger_file")"
        [ -n "$ledger_tree_json" ] || weknora_production_die 'v2 release ledger source tree digest is unavailable'
        jq -n -e --argjson expected "$ledger_tree_json" --argjson actual "$predecessor_tree" \
            '$expected == $actual' >/dev/null || weknora_production_die 'v2 predecessor source tree drifted from the release ledger'
        predecessor_manifest_sha="$(json_file_hash "$old_source/deploy/source-manifest.sha256")"
        predecessor_provenance="$(jq -cn --arg status 'v2_manifest_verified' --arg revision "$old_revision" --arg manifest_sha "$predecessor_manifest_sha" --argjson tree "$predecessor_tree" \
            '{status:$status,revision:$revision,source_manifest_sha256:$manifest_sha,tree:$tree}')"
    else
        has_any_predecessor_manifest "$old_source" && weknora_production_die 'legacy predecessor has partial release manifests; refusing to normalize it'
        predecessor_manifest_sha='null'
        predecessor_provenance="$(legacy_tree_snapshot_json "$old_source")"
    fi
    ids="$(capture_project_ids "${previous_project:-$old_project}")"
    ids="$(printf '%s\n%s\n' "$ids" "$old_id")"
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        json="$(capture_container_json "$id" 2>/dev/null || true)"
        [ -n "$json" ] || continue
        old_json="$(jq -cn --argjson all "$old_json" --argjson entry "$json" 'if any($all[]; .id == $entry.id) then $all else $all + [$entry] end')"
    done <<<"$ids"
    [ "$(jq 'length' <<<"$old_json")" -gt 0 ] || weknora_production_die 'live runtime snapshot contains no application owner'

    if [ "$ledger_present" = true ]; then
        ledger_web_id="$(jq -r '.current.web_id // empty' "$ledger_file")"
        ledger_frontend_id="$(jq -r '.current.frontend_id // empty' "$ledger_file")"
        ledger_web_image="$(jq -c '.current.image_state.web // empty' "$ledger_file")"
        ledger_frontend_image="$(jq -c '.current.image_state.frontend // empty' "$ledger_file")"
        [ -n "$ledger_web_id" ] && [ -n "$ledger_frontend_id" ] && [ -n "$ledger_web_image" ] && [ -n "$ledger_frontend_image" ] || \
            weknora_production_die 'v2 release ledger live image identity is incomplete'
        live_web_json="$(jq -c --arg id "$ledger_web_id" '[.[] | select(.id == $id and .service == "web")][0]' <<<"$old_json")"
        live_frontend_json="$(jq -c --arg id "$ledger_frontend_id" '[.[] | select(.id == $id and .service == "frontend")][0]' <<<"$old_json")"
        jq -e 'type == "object"' <<<"$live_web_json" >/dev/null || weknora_production_die 'live web container identity drifted from the release ledger'
        jq -e 'type == "object"' <<<"$live_frontend_json" >/dev/null || weknora_production_die 'live frontend container identity drifted from the release ledger'
        jq -n -e --argjson expected "$ledger_web_image" --argjson actual "$(jq -c '.image_state' <<<"$live_web_json")" \
            '$expected == $actual' >/dev/null || weknora_production_die 'live web image provenance drifted from the release ledger'
        jq -n -e --argjson expected "$ledger_frontend_image" --argjson actual "$(jq -c '.image_state' <<<"$live_frontend_json")" \
            '$expected == $actual' >/dev/null || weknora_production_die 'live frontend image provenance drifted from the release ledger'
    fi

    copy_config_snapshot
    jq -n \
        --arg schema 'musuw.release-snapshot.v2' \
        --arg release_id "$release_id" --arg revision "$revision" --arg project "$project" \
        --arg old_source "$old_source" --arg old_revision "$old_revision" \
        --arg edge_network "$edge_network" --arg edge_alias "$edge_alias" \
        --arg old_edge_id "$old_id" --arg old_edge_name "$old_name" --arg old_edge_project "$old_project" \
        --arg old_edge_image "$old_image" --argjson old_edge_aliases "$old_aliases" \
        --argjson config "$old_config_json" --argjson old_containers "$old_json" \
        --argjson previous_workers "$previous_worker_ids" \
        --arg previous_project "$previous_project" --arg previous_revision "$previous_revision" \
        --arg source_manifest_sha "$predecessor_manifest_sha" \
        --argjson predecessor_provenance "$predecessor_provenance" \
        --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{schema:$schema,release_id:$release_id,revision:$revision,project:$project,source_target:$old_source,current_revision:(if $old_revision == "" then null else $old_revision end),source_manifest_sha:(if $source_manifest_sha == "null" then null else $source_manifest_sha end),predecessor_provenance:$predecessor_provenance,config:$config,edge:{network:$edge_network,alias:$edge_alias,owner_id:$old_edge_id,owner_name:$old_edge_name,owner_project:$old_edge_project,owner_image:$old_edge_image,aliases:$old_edge_aliases},old_containers:$old_containers,previous:{project:(if $previous_project == "" then null else $previous_project end),revision:(if $previous_revision == "" then null else $previous_revision end),worker_ids:$previous_workers},captured_at:$at}' \
        > "$snapshot_file"
    chmod 600 "$snapshot_file"
}

write_initial_state() {
    local candidate_app_port candidate_frontend_port old_project old_id old_aliases old_containers
    candidate_app_port="$(weknora_production_release_port app)"
    candidate_frontend_port="$(weknora_production_release_port frontend)"
    old_project="$(jq -r '.edge.owner_project' "$snapshot_file")"
    old_id="$(jq -r '.edge.owner_id' "$snapshot_file")"
    old_aliases="$(jq -c '.edge.aliases' "$snapshot_file")"
    old_containers="$(jq -c '[.old_containers[].id]' "$snapshot_file")"
    jq -n \
        --arg schema 'musuw.release-transaction.v2' --arg phase snapshot \
        --arg release_id "$release_id" --arg revision "$revision" --arg project "$project" \
        --arg candidate_dir "$candidate_dir" --arg snapshot_file "$snapshot_file" \
        --arg app_port "$candidate_app_port" --arg frontend_port "$candidate_frontend_port" \
        --arg old_id "$old_id" --arg old_project "$old_project" --argjson old_aliases "$old_aliases" \
        --argjson old_containers "$old_containers" \
        --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{schema:$schema,phase:$phase,release_id:$release_id,revision:$revision,project:$project,candidate_dir:$candidate_dir,snapshot_file:$snapshot_file,candidate:{app_port:($app_port|tonumber),frontend_port:($frontend_port|tonumber),web_container:(""),frontend_container:(""),worker_container:(""),prepare_container:("")},old:{edge_owner_id:$old_id,edge_project:$old_project,edge_aliases:$old_aliases,container_ids:$old_containers,stopped_ids:[]},events:[{at:$at,event:"snapshot"}],created_at:$at,updated_at:$at}' \
        > "$state_file"
    chmod 600 "$state_file"
    sync >/dev/null 2>&1 || true
}

replace_env_key() {
    local file="$1" key="$2" value="$3" tmp found=0
    tmp="$(mktemp "$file.XXXXXX")"
    awk -v key="$key" -v value="$value" '
        $0 ~ "^[[:space:]]*" key "=" { if (!found) { print key "=" value; found=1 }; next }
        { print }
        END { if (!found) print key "=" value }
    ' "$file" > "$tmp"
    chmod 600 "$tmp"
    mv -f "$tmp" "$file"
}

prepare_candidate_runtime() {
    mkdir -p "$candidate_dir"
    chmod 700 "$candidate_dir"
    # Candidate configuration is part of the verified release manifest.  The
    # current runtime files are rollback material only and must never seed a
    # new release because they can drift independently of the promoted source.
    weknora_production_require_file "$repo_root/deploy/production.public.env"
    weknora_production_require_file "$repo_root/deploy/auth-public.env"
    install -m 600 "$repo_root/deploy/production.public.env" "$candidate_dir/production.public.env"
    install -m 600 "$repo_root/deploy/auth-public.env" "$candidate_dir/auth-public.env"
    [ "$(weknora_production_require_env_value "$candidate_dir/production.public.env" WEKNORA_PRODUCTION_RELEASE_ID)" = 'weknora-v072-production' ] || \
        weknora_production_die 'candidate application release identity is not the stable production identity'
    replace_env_key "$candidate_dir/production.public.env" WEKNORA_PRODUCTION_FRONTEND_PORT "$(jq -r '.candidate.frontend_port' "$state_file")"
    replace_env_key "$candidate_dir/production.public.env" WEKNORA_PRODUCTION_APP_PORT "$(jq -r '.candidate.app_port' "$state_file")"
    replace_env_key "$candidate_dir/production.public.env" WEKNORA_PRODUCTION_REVISION "$revision"
    WEKNORA_PRODUCTION_RUNTIME_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_PUBLIC_ENV="$candidate_dir/production.public.env" \
    WEKNORA_PRODUCTION_AUTH_PUBLIC_ENV="$candidate_dir/auth-public.env" \
    WEKNORA_PRODUCTION_SECRET_DIR="$runtime_dir/secrets" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/prepare-runtime.sh" >/dev/null
    [ -f "$candidate_dir/production.env" ] || weknora_production_die 'candidate runtime configuration was not prepared'
}

assert_additive_compatible_migrations() {
    local old_source="$1" new_source="$2" old_max path relative
    weknora_production_require_additive_versioned_migrations "$old_source" "$new_source"
    old_max="$(weknora_production_latest_versioned_migration "$old_source")"
    while IFS= read -r -d '' path; do
        relative="${path#"$new_source/weknora/migrations/versioned/"}"
        [[ "$relative" =~ ^[0-9]{6}_.*\.up\.sql$ ]] || continue
        [ "$((10#${relative:0:6}))" -gt "$old_max" ] || continue
        # Forward-compatible migrations may add fields/indexes/tables, but a
        # release cannot remove or rewrite data while old web/worker code is
        # still serving during the edge handoff.
        if grep -Eiq '(^|[[:space:];])(drop[[:space:]]+(table|column|index|schema)|truncate[[:space:]]+table|alter[[:space:]]+table[^;]*(drop|rename|type)|rename[[:space:]]+table)' "$path"; then
            weknora_production_die 'release migration is not forward-compatible with the retained runtime'
        fi
    done < <(find "$new_source/weknora/migrations/versioned" -type f -print0)
}

set_state_identity() {
    local web frontend prepare worker
    web="$(weknora_production_release_container web)"
    frontend="$(weknora_production_release_container frontend)"
    prepare="$(weknora_production_release_container prepare)"
    worker="$(weknora_production_release_container worker)"
    jq --arg web "$web" --arg frontend "$frontend" --arg prepare "$prepare" --arg worker "$worker" \
        '.candidate.web_container=$web | .candidate.frontend_container=$frontend | .candidate.prepare_container=$prepare | .candidate.worker_container=$worker' \
        "$state_file" > "$state_file.tmp"
    chmod 600 "$state_file.tmp"
    mv -f "$state_file.tmp" "$state_file"
}

wait_for_container_health() {
    local ref="$1" deadline status running
    deadline=$(( $(date +%s) + 300 ))
    while [ "$(date +%s)" -lt "$deadline" ]; do
        running="$(container_format "$ref" '{{.State.Running}}' 2>/dev/null || true)"
        [ "$running" = true ] || { sleep 2; continue; }
        status="$(container_format "$ref" '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)"
        case "$status" in
            healthy|none) return 0 ;;
            unhealthy|exited|dead) return 1 ;;
        esac
        sleep 2
    done
    return 1
}

readyz_json() {
    local url="$1"
    curl -fsS --connect-timeout 5 "$url"
}

assert_readyz() {
    local url="$1" role="$2" expected_accepting="$3" body
    body="$(readyz_json "$url")" || weknora_production_die "runtime readyz failed: $url"
    assert_readyz_body "$body" "$role" "$expected_accepting" || \
        weknora_production_die "runtime readyz marker is not the requested role/revision: $url"
}

assert_readyz_body() {
    local body="$1" role="$2" expected_accepting="$3" expected_dependencies
    case "$role" in
        web)
            expected_dependencies='["database","duckdb","http_listener","im_routes","redis","revision","storage","system_settings_subscriber"]'
            ;;
        worker)
            expected_dependencies='["asynq","audit_retention","database","datasource_scheduler","duckdb","housekeeping","im_background","interrupted_task_reset","redis","revision","storage","temporary_cleanup","wiki_recovery","worker_listener"]'
            ;;
        *) return 1 ;;
    esac
    jq -e --arg role "$role" --arg revision "$revision" --argjson accepting "$expected_accepting" --argjson expected_dependencies "$expected_dependencies" \
        'type == "object" and
         ((keys | sort) == ["accepting_traffic","dependencies","release_marker","revision","role","status"]) and
         .status == "ready" and .role == $role and .revision == $revision and
         .release_marker == $revision and .accepting_traffic == $accepting and
         (.dependencies | type == "object" and (keys | sort) == $expected_dependencies) and
         .dependencies.revision == "ready" and .dependencies.redis == "ready" and
         all(.dependencies[]; . == "ready" or . == "disabled")' \
        <<<"$body" >/dev/null
}

assert_candidate_static() {
    local frontend_port="$1" root_body auth_body oidc oidc_response oidc_body
    root_body="$(curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/")" || weknora_production_die 'candidate frontend static root is unavailable'
    auth_body="$(curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/auth/start")" || weknora_production_die 'candidate auth shell is unavailable'
    grep -Eq "<(div|main)[^>]+id=[\"'](app|root)[\"']" <<<"$root_body" || weknora_production_die 'candidate frontend static root is invalid'
    grep -Eq "<(div|main)[^>]+id=[\"'](app|root)[\"']" <<<"$auth_body" || weknora_production_die 'candidate auth static shell is invalid'
    oidc="$(curl -fsS --connect-timeout 5 "http://127.0.0.1:${frontend_port}/api/v1/auth/oidc/config")" || weknora_production_die 'candidate OIDC config is unavailable'
    jq -e '.success == true and .enabled == true' <<<"$oidc" >/dev/null || weknora_production_die 'candidate OIDC config is not enabled'

    # Construct only the provider URL and browser binding. Never follow the
    # provider or exchange a code during a release transaction.
    oidc_response="$(curl -fsS -i --connect-timeout 5 \
        --get --data-urlencode 'redirect_uri=https://app.musuw.com/api/v1/auth/oidc/callback' \
        "http://127.0.0.1:${frontend_port}/api/v1/auth/oidc/url")" || \
        weknora_production_die 'candidate OIDC authorization URL is unavailable'
    oidc_body="$(awk '
        body { line=$0; sub(/\r$/, "", line); print line; next }
        { line=$0; sub(/\r$/, "", line); if (line == "") body=1 }
    ' <<<"$oidc_response")"
    jq -e '
        .success == true and
        (.authorization_url | type == "string") and
        (.authorization_url | contains("code_challenge=")) and
        (.authorization_url | contains("code_challenge_method=S256"))
    ' <<<"$oidc_body" >/dev/null || weknora_production_die 'candidate OIDC URL does not prove S256 PKCE'
    grep -Eiq '^Set-Cookie:[[:space:]]*weknora_oidc_binding=[^;[:space:]]+;.*HttpOnly' <<<"$oidc_response" || \
        weknora_production_die 'candidate OIDC URL did not issue an HttpOnly browser binding cookie (#HttpOnly_)'
}

assert_global_worker_uniqueness() {
    local allowed id running
    allowed="$(jq -c '[(.previous.worker_ids // [])[]?, (.old_containers[]? | select(.service == "worker") | .id)] | unique' "$snapshot_file")"
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        safe_container_id "$id" || weknora_production_die 'running worker identity is unsafe'
        running="$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)"
        [ "$running" = true ] || continue
        jq -e --arg id "$id" --argjson allowed "$allowed" '($allowed | index($id)) != null' <<<"$allowed" >/dev/null || \
            weknora_production_die 'running worker ownership is not globally unique; refusing candidate cutover'
    done < <(docker ps -q --filter 'label=com.docker.compose.service=worker' 2>/dev/null || true)
}

stable_sidecar_container() {
    local service="$1" project_name="$2" id
    case "$service" in postgres|redis|docreader|neo4j) ;; *) return 1 ;; esac
    case "$service" in
        postgres) configured_id="${WEKNORA_PRODUCTION_POSTGRES_CONTAINER:-}" ;;
        redis) configured_id="${WEKNORA_PRODUCTION_REDIS_CONTAINER:-}" ;;
        docreader) configured_id="${WEKNORA_PRODUCTION_DOCREADER_CONTAINER:-}" ;;
        neo4j) configured_id="${WEKNORA_PRODUCTION_NEO4J_CONTAINER:-}" ;;
    esac
    if [ -n "${configured_id:-}" ]; then
        id="$configured_id"
        container_exists "$id" && printf '%s' "$id" && return 0
    fi
    id="$(docker ps -q --filter "label=com.docker.compose.service=$service" --filter "label=com.docker.compose.project=$project_name" 2>/dev/null | head -n 1 || true)"
    if safe_container_id "$id"; then printf '%s' "$id"; return 0; fi
    # The fixed native project name is an internal compatibility fact, not a
    # caller-provided path or identity.  It allows the first v2 release to
    # reuse the already-running sidecars without renaming them.
    id="$(docker ps -q --filter "label=com.docker.compose.service=$service" --filter 'label=com.docker.compose.project=weknora-v072-production' 2>/dev/null | head -n 1 || true)"
    safe_container_id "$id" && printf '%s' "$id"
}

assert_database_and_catalog() {
    local old_project postgres migration expected catalog_sql catalog_count
    old_project="$(jq -r '.edge.owner_project // ""' "$snapshot_file")"
    postgres="$(stable_sidecar_container postgres "$old_project")"
    [ -n "$postgres" ] || weknora_production_die 'stable PostgreSQL sidecar is unavailable'
    expected="$(weknora_production_latest_versioned_migration "$repo_root")"
    migration="$(docker exec "$postgres" sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version, dirty FROM schema_migrations ORDER BY version DESC LIMIT 1"')" || weknora_production_die 'database migration state could not be read'
    [ "$migration" = "${expected}|f" ] || weknora_production_die 'candidate database migration is not cleanly compatible'
    catalog_sql="SELECT count(*) FROM models WHERE deleted_at IS NULL AND is_builtin = true AND status = 'active' AND ((id = 'builtin-deepseek-v4-pro' AND type = 'KnowledgeQA') OR (id = 'builtin-deepseek-v4-flash' AND type = 'KnowledgeQA') OR (id = 'builtin-openrouter-embedding' AND type = 'Embedding') OR (id = 'builtin-openrouter-rerank' AND type = 'Rerank') OR (id = 'builtin-openrouter-vlm' AND type = 'VLLM') OR (id = 'builtin-openrouter-asr' AND type = 'ASR'));"
    catalog_count="$(docker exec -e PLATFORM_MODEL_CATALOG_SQL="$catalog_sql" "$postgres" sh -ec 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$PLATFORM_MODEL_CATALOG_SQL"')" || weknora_production_die 'platform model catalog could not be read'
    [ "$catalog_count" = 6 ] || weknora_production_die 'candidate platform model catalog is incomplete'
}

build_candidate() {
    local image image_id image_revision
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" build --pull web frontend
    for image in "$(weknora_production_release_image web)" "$(weknora_production_release_image frontend)"; do
        docker image inspect "$image" >/dev/null || weknora_production_die 'immutable candidate image is unavailable'
        image_id="$(docker image inspect "$image" --format '{{.Id}}' 2>/dev/null || true)"
        [[ "$image_id" =~ ^sha256:[0-9a-fA-F]{64}$ ]] || weknora_production_die 'candidate image content ID is missing or unsafe'
        image_revision="$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || true)"
        [ "$image_revision" = "$revision" ] || weknora_production_die 'candidate image revision label is missing or does not match the requested SHA'
    done
}

run_prepare_and_stage() {
    local web frontend prepare app_port frontend_port web_image frontend_image
    set_state_identity
    web="$(jq -r '.candidate.web_container' "$state_file")"
    frontend="$(jq -r '.candidate.frontend_container' "$state_file")"
    prepare="$(jq -r '.candidate.prepare_container' "$state_file")"
    app_port="$(jq -r '.candidate.app_port' "$state_file")"
    frontend_port="$(jq -r '.candidate.frontend_port' "$state_file")"
    # The prepare role may migrate/seed only the already-owned database.  It
    # never receives a new volume or secret object from this transaction.
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" run --no-deps --rm prepare
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" create --no-build web frontend
    connect_candidate_data_network web
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" start web frontend
    wait_for_container_health "$web" || weknora_production_die 'candidate web did not become healthy'
    wait_for_container_health "$frontend" || weknora_production_die 'candidate frontend did not become healthy'
    web_id="$(container_id_for_name "$web")"
    frontend_id="$(container_id_for_name "$frontend")"
    safe_container_id "$web_id" || weknora_production_die 'candidate web identity is unavailable'
    safe_container_id "$frontend_id" || weknora_production_die 'candidate frontend identity is unavailable'
    web_image="$(image_snapshot_json "$web_id")"
    frontend_image="$(image_snapshot_json "$frontend_id")"
    jq --arg web_id "$web_id" --arg frontend_id "$frontend_id" \
        --argjson web_image "$web_image" --argjson frontend_image "$frontend_image" \
        '.candidate.web_id=$web_id | .candidate.frontend_id=$frontend_id |
         .candidate.image_state={web:$web_image,frontend:$frontend_image}' "$state_file" > "$state_file.tmp"
    chmod 600 "$state_file.tmp"
    mv -f "$state_file.tmp" "$state_file"
    assert_readyz "http://127.0.0.1:${app_port}/readyz" web true
    assert_readyz "http://127.0.0.1:${frontend_port}/readyz" web true
    assert_candidate_static "$frontend_port"
    assert_database_and_catalog
}

connect_candidate_data_network() {
    local role="$1" name id networks
    case "$role" in web|worker) ;; *) return 1 ;; esac
    name="$(jq -r ".candidate.${role}_container // empty" "$state_file")"
    safe_container_name "$name" || weknora_production_die 'candidate data-network identity is unsafe'
    id="$(container_id_for_name "$name")"
    safe_container_id "$id" || weknora_production_die 'candidate data-network container is unavailable'
    docker network inspect "$(weknora_production_release_internal_network)" >/dev/null
    container_on_network "$id" "$(weknora_production_release_internal_network)" && \
        weknora_production_die 'candidate is unexpectedly attached to the stable data network before transaction ownership'
    docker network connect --alias "$name" "$(weknora_production_release_internal_network)" "$id"
    networks="$(container_format "$id" '{{json .NetworkSettings.Networks}}')"
    jq -e --arg network "$(weknora_production_release_internal_network)" --arg name "$name" '
        has($network) and
        ((.[$network].Aliases // []) | index($name)) != null and
        ((.[$network].Aliases // []) | index("web")) == null
    ' <<<"$networks" >/dev/null || weknora_production_die 'candidate stable data-network aliases are not exact and isolated'
}

write_edge_phase() {
    local phase="$1"
    atomic_state_update "$phase" "$phase"
}

write_cutover_intent() {
    local old_id="$1" new_id="$2" aliases_json="$3" tmp now
    safe_container_id "$old_id" || return 1
    safe_container_id "$new_id" || return 1
    edge_aliases_valid "$aliases_json" || return 1
    tmp="$(mktemp "$state_file.XXXXXX")"
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq --arg old_id "$old_id" --arg new_id "$new_id" \
        --arg edge_network "$edge_network" --arg edge_alias "$edge_alias" \
        --argjson old_aliases "$aliases_json" --arg now "$now" '
        .candidate.frontend_id = $new_id |
        .cutover_intent = {
            edge_network:$edge_network,
            edge_alias:$edge_alias,
            expected_old_id:$old_id,
            expected_new_id:$new_id,
            old_aliases:$old_aliases
        } |
        .phase = "cutover_intent" |
        .updated_at = $now |
        .events = ((.events // []) + [{at:$now,event:"cutover_intent"}])
    ' "$state_file" > "$tmp"
    chmod 600 "$tmp"
    mv -f "$tmp" "$state_file"
    # No edge endpoint may change until the validated old/new ownership intent
    # is durably visible to EXIT rollback or a later stale-state reconcile.
    sync >/dev/null
}

cut_edge() {
    local old_id new_id current_old aliases_json owner_count
    old_id="$(jq -r '.old.edge_owner_id' "$state_file")"
    aliases_json="$(jq -c '.old.edge_aliases' "$state_file")"
    new_id="$(container_id_for_name "$(jq -r '.candidate.frontend_container' "$state_file")")"
    safe_container_id "$new_id" || weknora_production_die 'candidate frontend identity is unavailable'
    container_on_edge "$new_id" && weknora_production_die 'candidate frontend is already public'
    current_old="$(edge_owner)"
    [ "$current_old" = "$old_id" ] || weknora_production_die 'public edge owner changed during candidate staging'
    write_cutover_intent "$old_id" "$new_id" "$aliases_json" || \
        weknora_production_die 'candidate edge cutover intent could not be persisted'
    docker network disconnect "$edge_network" "$old_id"
    write_edge_phase old_detached
    docker network connect --alias "$edge_alias" "$edge_network" "$new_id"
    transaction_test_fault edge_after_connect
    edge_cutover=true
    write_edge_phase new_attached
    owner_count=0
    while IFS= read -r current_old; do
        [ -n "$current_old" ] || continue
        if container_has_alias "$current_old" "$edge_alias"; then owner_count=$((owner_count + 1)); fi
    done < <(docker network inspect "$edge_network" --format '{{range $id, $_ := .Containers}}{{$id}}{{"\n"}}{{end}}')
    [ "$owner_count" -eq 1 ] && container_has_alias "$new_id" "$edge_alias" || weknora_production_die 'candidate edge alias handoff is ambiguous'
    write_edge_phase cutover_active
    # Verify the private candidate route from the public listener before any
    # old background owner is stopped.
    assert_readyz "http://127.0.0.1:$(jq -r '.candidate.frontend_port' "$state_file")/readyz" web true
    unset aliases_json
}

public_probes() {
    local root_body ready
    ready="$(curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/readyz)" || weknora_production_die 'public release readyz probe failed'
    assert_readyz_body "$ready" web true || weknora_production_die 'public release marker does not identify the requested SHA'
    curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/health >/dev/null || weknora_production_die 'public release health probe failed'
    root_body="$(curl -fsS --connect-timeout 10 https://app.musuw.com/)" || weknora_production_die 'public frontend root probe failed'
    grep -Eq "<(div|main)[^>]+id=[\"'](app|root)[\"']" <<<"$root_body" || weknora_production_die 'public frontend root is not the candidate static shell'
    curl -fsS --connect-timeout 10 https://app.musuw.com/auth/start >/dev/null || weknora_production_die 'public auth shell probe failed'
}

container_ids_for_state() {
    local field="$1"
    jq -r "$field[]?" "$state_file" 2>/dev/null || true
}

record_stopped_old_id() {
    local id="$1"
    safe_container_id "$id" || return 1
    jq --arg id "$id" '.old.stopped_ids = ((.old.stopped_ids // []) + [$id] | unique)' "$state_file" > "$state_file.tmp"
    chmod 600 "$state_file.tmp"
    mv -f "$state_file.tmp" "$state_file"
    sync >/dev/null 2>&1 || true
}

stop_old_background() {
    local previous_project previous_workers id service
    previous_project="$(jq -r '.previous.project // empty' "$snapshot_file")"
    previous_workers="$(jq -c '.previous.worker_ids // []' "$snapshot_file")"
    if [ -n "$previous_project" ]; then
        # Later v2 releases stop only the old worker owner.  The old web stays
        # running and is therefore a complete rollback target if public probes
        # fail after the edge handoff.
        while IFS= read -r id; do
            [ -n "$id" ] || continue
            if container_exists "$id" && [ "$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)" = true ]; then
                record_stopped_old_id "$id"
                docker stop --time 60 "$id" >/dev/null
            fi
        done < <(jq -r '.[]' <<<"$previous_workers")
    else
        # First release normalization observes the legacy project exactly as
        # it exists.  Stop only its application owner roles (never sidecars or
        # their volumes/secrets) after the candidate is already public.
        while IFS= read -r id; do
            [ -n "$id" ] || continue
            service="$(container_format "$id" '{{ index .Config.Labels "com.docker.compose.service" }}' 2>/dev/null || true)"
            case "$service" in
                app|web|frontend|worker)
                    if container_exists "$id" && [ "$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)" = true ]; then
                        record_stopped_old_id "$id"
                        docker stop --time 60 "$id" >/dev/null
                    fi
                    ;;
                '')
                    # A legacy native/M35 owner may predate Compose service
                    # labels. The exact observed edge owner is still safe to
                    # stop after the candidate is public; no guessed name is
                    # introduced.
                    if [ "$id" = "$(jq -r '.old.edge_owner_id' "$state_file")" ] && container_exists "$id" && [ "$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)" = true ]; then
                        record_stopped_old_id "$id"
                        docker stop --time 60 "$id" >/dev/null
                    fi
                    ;;
            esac
        done < <(jq -r '.old_containers[].id' "$snapshot_file")
    fi
    old_stopped=true
    atomic_state_update old_background_stopped old_background_stopped
}

verify_running_container() {
    local id="$1" running health
    container_exists "$id" || return 1
    running="$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)"
    [ "$running" = true ] || return 1
    health="$(container_format "$id" '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)"
    case "$health" in unhealthy|exited|dead) return 1 ;; esac
    return 0
}

start_and_verify_candidate_worker() {
    local worker worker_id worker_ready worker_image
    worker="$(jq -r '.candidate.worker_container' "$state_file")"
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" create --no-build worker
    connect_candidate_data_network worker
    WEKNORA_PRODUCTION_RUNTIME_DIR="$runtime_dir" \
    WEKNORA_PRODUCTION_RELEASE_CANDIDATE_DIR="$candidate_dir" \
    WEKNORA_PRODUCTION_RELEASE_SOURCE_ROOT="$repo_root" \
    WEKNORA_PRODUCTION_REVISION="$revision" \
        "$script_dir/release-compose.sh" start worker
    worker_id="$(container_id_for_name "$worker")"
    safe_container_id "$worker_id" || weknora_production_die 'candidate worker identity is unavailable'
    worker_image="$(image_snapshot_json "$worker_id")"
    jq --arg worker_id "$worker_id" --argjson worker_image "$worker_image" \
        '.candidate.worker_id=$worker_id | .candidate.image_state.worker=$worker_image' "$state_file" > "$state_file.tmp"
    chmod 600 "$state_file.tmp"
    mv -f "$state_file.tmp" "$state_file"
    wait_for_container_health "$worker_id" || weknora_production_die 'candidate worker did not become healthy'
    verify_running_container "$worker_id" || weknora_production_die 'candidate worker process is not ready'
    worker_ready="$(docker exec "$worker_id" curl -fsS http://127.0.0.1:8081/readyz)" || weknora_production_die 'candidate worker readiness probe failed'
    assert_readyz_body "$worker_ready" worker false || weknora_production_die 'candidate worker readiness probe does not identify the requested role/revision/dependencies'
    worker_started=true
    atomic_state_update worker_verified worker_verified
}

atomic_commit() {
    local old_target target_link file_name tmp
    old_target="$(jq -r '.source_target' "$snapshot_file")"
    [ "$old_target" != "$repo_root" ] || weknora_production_die 'candidate source is already current'
    target_link="$current_link.next.$$"
    ln -s "$repo_root" "$target_link"
    mv -Tf "$target_link" "$current_link"
    for file_name in production.public.env auth-public.env production.env; do
        tmp="$(mktemp "$runtime_dir/$file_name.XXXXXX")"
        install -m 600 "$candidate_dir/$file_name" "$tmp"
        mv -f "$tmp" "$runtime_dir/$file_name"
    done
    atomic_state_update pointers_committed pointers_committed
}

write_ledger() {
    local web frontend worker prepare web_id frontend_id worker_id source_sha config_sha_json old_project old_revision
    local candidate_image_json predecessor_image_json source_tree_json source_tree
    web="$(jq -r '.candidate.web_container' "$state_file")"
    frontend="$(jq -r '.candidate.frontend_container' "$state_file")"
    worker="$(jq -r '.candidate.worker_container' "$state_file")"
    prepare="$(jq -r '.candidate.prepare_container' "$state_file")"
    web_id="$(jq -r '.candidate.web_id // empty' "$state_file")"
    frontend_id="$(jq -r '.candidate.frontend_id // empty' "$state_file")"
    worker_id="$(jq -r '.candidate.worker_id // empty' "$state_file")"
    candidate_image_json="$(jq -c '.candidate.image_state // {}' "$state_file")"
    jq -e --arg revision "$revision" '
        (.web.id_status == "verified" and .frontend.id_status == "verified" and .worker.id_status == "verified") and
        (.web.revision_label_status == "verified" and .frontend.revision_label_status == "verified" and .worker.revision_label_status == "verified") and
        (.web.revision_label == $revision and .frontend.revision_label == $revision and .worker.revision_label == $revision)
    ' <<<"$candidate_image_json" >/dev/null || weknora_production_die 'candidate image provenance is incomplete or does not identify the requested SHA'
    predecessor_image_json="$(jq -c '[.old_containers[] | {id:.id,name:.name,service:.service,project:.project,image:.image,image_state:.image_state}]' "$snapshot_file")"
    source_tree_json="$(legacy_tree_snapshot_json "$repo_root")"
    source_tree="$(jq -c '{digest,file_count,bytes,paths}' <<<"$source_tree_json")"
    source_sha="$(weknora_production_sha256_file "$repo_root/deploy/source-manifest.sha256" 2>/dev/null || true)"
    config_sha_json="$(jq -n \
        --arg production_public_env "$(weknora_production_sha256_file "$runtime_dir/production.public.env")" \
        --arg auth_public_env "$(weknora_production_sha256_file "$runtime_dir/auth-public.env")" \
        --arg production_env "$(weknora_production_sha256_file "$runtime_dir/production.env")" \
        '{production_public_env:$production_public_env,auth_public_env:$auth_public_env,production_env:$production_env}')"
    old_project="$(jq -r '.edge.owner_project // empty' "$snapshot_file")"
    old_revision="$(jq -r '.current_revision // empty' "$snapshot_file")"
    jq -n \
        --arg schema 'musuw.release-ledger.v2' --arg release_id "$release_id" --arg revision "$revision" --arg project "$project" \
        --arg source "$repo_root" --arg web "$web" --arg frontend "$frontend" --arg worker "$worker" --arg prepare "$prepare" \
        --arg web_id "$web_id" --arg frontend_id "$frontend_id" --arg worker_id "$worker_id" \
        --argjson candidate_image "$candidate_image_json" --argjson predecessor_image "$predecessor_image_json" --argjson source_tree "$source_tree" \
        --arg source_manifest_sha "$source_sha" --argjson config_sha "$config_sha_json" \
        --arg old_project "$old_project" --arg old_revision "$old_revision" \
        --arg committed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{schema:2,format:$schema,current:{release_id:$release_id,revision:$revision,project:$project,source:$source,web_container:$web,frontend_container:$frontend,worker_container:$worker,prepare_container:$prepare,web_id:$web_id,frontend_id:$frontend_id,worker_id:$worker_id,worker_ids:[$worker_id],image_state:$candidate_image,source_tree:$source_tree,source_manifest_sha256:$source_manifest_sha,config_sha256:$config_sha,committed_at:$committed_at},previous:{project:(if $old_project == "" then null else $old_project end),revision:(if $old_revision == "" then null else $old_revision end),image_state:$predecessor_image},updated_at:$committed_at}' \
        > "$ledger_file.tmp"
    chmod 600 "$ledger_file.tmp"
    mv -f "$ledger_file.tmp" "$ledger_file"
}

restore_old_edge() {
    local old_id new_id aliases_json owner
    old_id="$(jq -r '(.cutover_intent.expected_old_id // .old.edge_owner_id) // empty' "$state_file" 2>/dev/null || true)"
    aliases_json="$(jq -c '(.cutover_intent.old_aliases // .old.edge_aliases) // []' "$state_file" 2>/dev/null || printf '[]')"
    new_id="$(jq -r '(.cutover_intent.expected_new_id // .candidate.frontend_id) // empty' "$state_file" 2>/dev/null || true)"
    [ -n "$old_id" ] || return 0
    safe_container_id "$old_id" || return 1
    docker network inspect "$edge_network" >/dev/null || return 1
    while IFS= read -r owner; do
        [ -n "$owner" ] || continue
        [ "$owner" = "$old_id" ] || [ "$owner" = "$new_id" ] || return 1
    done < <(docker network inspect "$edge_network" --format '{{range $id, $_ := .Containers}}{{$id}}{{"\n"}}{{end}}' | while read -r id; do [ -n "$id" ] && container_has_alias "$id" "$edge_alias" && printf '%s\n' "$id"; done)
    if [ -n "$new_id" ] && container_exists "$new_id" && container_on_edge "$new_id"; then
        docker network disconnect "$edge_network" "$new_id"
    fi
    if ! container_on_edge "$old_id"; then
        local -a connect=(docker network connect)
        local alias
        while IFS= read -r alias; do connect+=(--alias "$alias"); done < <(jq -r '.[]' <<<"$aliases_json")
        connect+=("$edge_network" "$old_id")
        "${connect[@]}"
    elif ! container_has_alias "$old_id" "$edge_alias"; then
        docker network disconnect "$edge_network" "$old_id"
        local -a reconnect=(docker network connect)
        local alias
        while IFS= read -r alias; do reconnect+=(--alias "$alias"); done < <(jq -r '.[]' <<<"$aliases_json")
        reconnect+=("$edge_network" "$old_id")
        "${reconnect[@]}"
    fi
    container_on_edge "$old_id" && container_has_alias "$old_id" "$edge_alias"
}

restore_config_and_source() {
    local old_source file_name tmp
    old_source="$(jq -r '.source_target' "$snapshot_file")"
    tmp="$current_link.rollback.$$"
    ln -s "$old_source" "$tmp"
    mv -Tf "$tmp" "$current_link"
    for file_name in production.public.env auth-public.env production.env; do
        tmp="$(mktemp "$runtime_dir/$file_name.XXXXXX")"
        install -m 600 "$snapshot_config_dir/$file_name" "$tmp"
        mv -f "$tmp" "$runtime_dir/$file_name"
    done
    if [ -f "$snapshot_config_dir/release-ledger-v2.json" ]; then
        tmp="$(mktemp "$runtime_dir/release-ledger-v2.json.XXXXXX")"
        install -m 600 "$snapshot_config_dir/release-ledger-v2.json" "$tmp"
        mv -f "$tmp" "$ledger_file"
    else
        rm -f "$ledger_file"
    fi
}

verify_stopped_container() {
    local id="$1"
    container_exists "$id" || return 1
    [ "$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)" = false ]
}

candidate_id_for_role() {
    local role="$1" id name
    case "$role" in worker|frontend|web) ;; *) return 1 ;; esac
    id="$(jq -r ".candidate.${role}_id // empty" "$state_file" 2>/dev/null || true)"
    if safe_container_id "$id" && container_exists "$id"; then
        printf '%s' "$id"
        return 0
    fi
    name="$(jq -r ".candidate.${role}_container // empty" "$state_file" 2>/dev/null || true)"
    [ -n "$name" ] || return 1
    container_id_for_name "$name"
}

stop_and_verify_candidate_role() {
    local role="$1" id running
    id="$(candidate_id_for_role "$role" 2>/dev/null || true)"
    [ -n "$id" ] || return 0
    safe_container_id "$id" || return 1
    running="$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)"
    if [ "$running" = true ]; then
        docker stop --time 60 "$id" >/dev/null
    fi
    verify_stopped_container "$id"
}

stop_candidate_worker() {
    stop_and_verify_candidate_role worker
}

stop_candidate_web_frontend() {
    stop_and_verify_candidate_role frontend && stop_and_verify_candidate_role web
}

restart_old_stopped() {
    local id
    while IFS= read -r id; do
        [ -n "$id" ] || continue
        safe_container_id "$id" || return 1
        container_exists "$id" || return 1
        if [ "$(container_format "$id" '{{.State.Running}}' 2>/dev/null || true)" != true ]; then
            docker start "$id" >/dev/null
        fi
        wait_for_container_health "$id" || return 1
        verify_running_container "$id" || return 1
    done < <(jq -r '.old.stopped_ids[]?' "$state_file" 2>/dev/null || true)
}

probe_restored_public_owner() {
    local expected_owner root_body
    expected_owner="$(jq -r '.old.edge_owner_id' "$state_file")"
    [ "$(edge_owner)" = "$expected_owner" ] || return 1
    curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/health >/dev/null || return 1
    root_body="$(curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/)" || return 1
    grep -Eq "<(div|main)[^>]+id=[\"'](app|root)[\"']" <<<"$root_body" || return 1
    curl -fsS --connect-timeout 10 --retry 6 --retry-delay 2 https://app.musuw.com/auth/start >/dev/null
}

verify_predecessor_snapshot() {
    local old_source status expected actual expected_tree actual_tree
    old_source="$(jq -r '.source_target' "$snapshot_file")"
    status="$(jq -r '.predecessor_provenance.status // empty' "$snapshot_file")"
    case "$status" in
        legacy_content_digest_only)
            expected="$(jq -c '.predecessor_provenance' "$snapshot_file")"
            actual="$(legacy_tree_snapshot_json "$old_source")"
            jq -n -e --argjson expected "$expected" --argjson actual "$actual" \
                '($expected.digest == $actual.digest) and
                 ($expected.file_count == $actual.file_count) and
                 ($expected.bytes == $actual.bytes) and
                 (($expected.paths | sort) == ($actual.paths | sort))' >/dev/null || return 1
            ;;
        v2_manifest_verified)
            # The strict verifier uses the production fail-closed die helper
            # for snapshot admission. During rollback, however, that helper
            # must not exit past the rollback guard: turn its controlled
            # failure into a normal return so rollback_transaction can leave
            # the state recoverable and emit its uniform diagnostic.
            if ! ( verify_strict_predecessor_manifests "$old_source" "$(jq -r '.predecessor_provenance.revision // empty' "$snapshot_file")" ); then
                return 1
            fi
            expected_tree="$(jq -c '.predecessor_provenance.tree // empty' "$snapshot_file")"
            [ -n "$expected_tree" ] || return 1
            actual_tree="$(legacy_tree_snapshot_json "$old_source" | jq -c '{digest,file_count,bytes,paths}')"
            jq -n -e --argjson expected "$expected_tree" --argjson actual "$actual_tree" '$expected == $actual' >/dev/null || return 1
            ;;
        *) return 1 ;;
    esac
}

rollback_transaction() {
    [ "$rollback_running" = false ] || return 1
    rollback_running=true
    snapshot_dir="$(dirname "$snapshot_file")"

    # The predecessor tree is part of the durable rollback contract. Refuse
    # to claim rollback if it changed after the snapshot was captured.
    if ! verify_predecessor_snapshot; then
        printf '%s\n' 'legacy predecessor tree changed; refusing to claim rollback' >&2
        rollback_running=false
        return 1
    fi

    # Background ownership is exclusive.  A candidate worker must be proven
    # stopped before any old worker can be restarted.  If that first step
    # fails, leave the candidate serving and the state recoverable rather than
    # create two active background owners.
    if ! stop_candidate_worker; then
        rollback_running=false
        return 1
    fi
    if ! restart_old_stopped; then
        rollback_running=false
        return 1
    fi
    if ! restore_old_edge; then
        rollback_running=false
        return 1
    fi
    if ! stop_candidate_web_frontend; then
        rollback_running=false
        return 1
    fi
    if ! restore_config_and_source; then
        rollback_running=false
        return 1
    fi
    if ! probe_restored_public_owner; then
        rollback_running=false
        return 1
    fi
    if ! atomic_state_update rolled_back rollback_complete; then
        rollback_running=false
        return 1
    fi
    rollback_running=false
    return 0
}

reconcile_stale_transactions() {
    local stale prior stale_snapshot stale_candidate
    while IFS= read -r stale; do
        [ -n "$stale" ] || continue
        [ "$stale" = "$state_file" ] && continue
        prior="$(jq -r '.phase // empty' "$stale" 2>/dev/null || true)"
        case "$prior" in
            committed|rolled_back|'') continue ;;
            *)
                # Rebind only to identities persisted in the stale state. No
                # caller path/project/container can enter this recovery seam.
                state_file="$stale"
                stale_snapshot="$(jq -r '.snapshot_file // empty' "$state_file")"
                stale_candidate="$(jq -r '.candidate_dir // empty' "$state_file")"
                [ -f "$stale_snapshot" ] || return 1
                [ -n "$stale_candidate" ] || return 1
                snapshot_file="$stale_snapshot"
                snapshot_config_dir="$(dirname "$stale_snapshot")/config"
                candidate_dir="$stale_candidate"
                rollback_transaction || return 1
                ;;
        esac
    done < <(find "$transaction_root" -maxdepth 1 -type f -name '*.json' -print 2>/dev/null | sort)
    # Restore the state paths for the new transaction after reconciling older
    # release ids.  This is what permits a failed SHA-A attempt to be safely
    # followed by a SHA-B attempt without fabricating ownership.
    state_file="$transaction_root/$release_id.json"
    snapshot_dir="$transaction_root/$release_id"
    snapshot_file="$snapshot_dir/snapshot.json"
    snapshot_config_dir="$snapshot_dir/config"
    candidate_dir="$snapshot_dir/candidate"
}

cleanup() {
    local status=$? failure_phase
    trap - EXIT
    if [ "$status" -ne 0 ] && [ "$transaction_committed" = false ] && [ -f "$state_file" ]; then
        failure_phase="$(jq -r '.phase // empty' "$state_file" 2>/dev/null || true)"
        case "$failure_phase" in
            committed|rolled_back) ;;
            *)
                printf '%s\n' 'release transaction failed; restoring durable snapshot and public edge' >&2
                rollback_transaction || printf '%s\n' 'release rollback did not complete; inspect release transaction state' >&2
                ;;
        esac
    fi
    if [ "$lock_held" = true ]; then
        # The lock is held by the kernel against FD 9. Never remove the lock
        # path: unlinking/recreating it would defeat crash-safe exclusion.
        exec 9>&- 2>/dev/null || true
    fi
    exit "$status"
}
trap cleanup EXIT

[ ! -L "$lock_file" ] || weknora_production_die 'production transaction lock path is unsafe'
exec 9>"$lock_file" || weknora_production_die 'production transaction lock file is unavailable'
chmod 600 "$lock_file"
if command -v flock >/dev/null 2>&1; then
    flock -n 9 || weknora_production_die 'another production release transaction is active'
else
    # macOS ships lockf rather than the Linux flock utility. It performs the
    # same kernel advisory lock against the inherited descriptor and leaves it
    # held by this shell after the helper exits.
    lockf -s -t 0 9 || weknora_production_die 'another production release transaction is active'
fi
lock_held=true

# Reconcile every interrupted SHA before admitting a new release. A stale
# release id must not be hidden by the next caller's id; each state is restored
# from the exact snapshot it persisted.
if [ -f "$state_file" ]; then
    prior_phase="$(jq -r '.phase // empty' "$state_file" 2>/dev/null || true)"
    case "$prior_phase" in
        committed|rolled_back) ;;
        '') weknora_production_die 'stale release transaction state is invalid' ;;
        *) rollback_transaction || weknora_production_die 'stale release transaction could not be reconciled' ;;
    esac
fi
reconcile_stale_transactions || weknora_production_die 'stale release transaction could not be reconciled'

if [ -e "$ledger_file" ] && ! jq -e '.schema == 2 and .current' "$ledger_file" >/dev/null 2>&1; then
    weknora_production_die 'release ledger is stale or invalid; refusing to fabricate v2 ownership'
fi
if [ -f "$ledger_file" ] && jq -e --arg revision "$revision" --arg project "$project" \
    '.current.revision == $revision or .current.project == $project' "$ledger_file" >/dev/null; then
    weknora_production_die 'requested revision is already the committed production release'
fi

write_snapshot
write_initial_state
transaction_test_crash crash_after_snapshot
transaction_test_legacy_tree_drift
prepare_candidate_runtime
atomic_state_update candidate_prepared candidate_prepared
assert_additive_compatible_migrations "$(jq -r '.source_target' "$snapshot_file")" "$repo_root"
build_candidate
atomic_state_update images_built images_built
# A preflight reserve can be consumed by the immutable image build. Recheck
# the same server-owned floor before prepare/stage or any public edge mutation.
weknora_production_require_disk_reserve
atomic_state_update disk_reserve_verified disk_reserve_verified
run_prepare_and_stage
atomic_state_update candidate_ready candidate_ready
assert_global_worker_uniqueness
cut_edge
public_probes
atomic_state_update public_green public_green
stop_old_background
start_and_verify_candidate_worker
atomic_commit
write_ledger
transaction_test_fault commit_after_ledger
atomic_state_update committed committed
transaction_committed=true

printf '%s\n' "production transactional release green: revision=$revision project=$project source_bundle_sha256=$(jq -r '.source_manifest_sha // "unavailable"' "$snapshot_file")"
