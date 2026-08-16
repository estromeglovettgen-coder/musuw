#!/usr/bin/env bash
# Verify only the fixed, non-secret v0.7.2/v79 transfer-bundle surface.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

[ "$#" -eq 1 ] || weknora_production_die 'usage: verify-bundle.sh <bundle-directory>'
bundle_dir="$(cd "$1" && pwd -P)"

for command in jq sha256sum tar; do
    weknora_production_require_command "$command"
done

required_files=(
    manifest.json
    SHA256SUMS
    postgres-v79.pg.dump
    data-files.tar
    data-files.manifest
    neo4j/neo4j.dump
)
for required_file in "${required_files[@]}"; do
    [ -f "$bundle_dir/$required_file" ] && [ -s "$bundle_dir/$required_file" ] || weknora_production_die 'bundle is missing a required non-secret artifact'
done

bundle_id="$(jq -er '.bundle_id | strings' "$bundle_dir/manifest.json")"
weknora_production_safe_id "$bundle_id" || weknora_production_die 'bundle manifest identity is unsafe'
case "$bundle_id" in
    weknora-v072-v79-*) ;;
    *) weknora_production_die 'bundle manifest identity is not approved' ;;
esac

jq -e '
  .format == "weknora-v0.7.2-v79-rehearsal-bundle/v1" and
  .source.version == "v0.7.2" and
  .source.revision == "3d5d8bfcdfeeea266b292b71cea616847af28d0f" and
  .source.migration.version == 79 and
  .source.migration.dirty == false and
  ((.data_files.file_count | type) == "number" and .data_files.file_count >= 0) and
  ((.data_files.logical_bytes | type) == "number" and .data_files.logical_bytes >= 0) and
  (.artifacts | keys | sort == ["data-files.manifest", "data-files.tar", "neo4j/neo4j.dump", "postgres-v79.pg.dump"])
' "$bundle_dir/manifest.json" >/dev/null || weknora_production_die 'bundle manifest contract is invalid'

expected_sum_paths=$'./manifest.json\n./postgres-v79.pg.dump\n./data-files.tar\n./data-files.manifest\n./neo4j/neo4j.dump'
actual_sum_paths="$(awk 'NF == 2 { print $2 }' "$bundle_dir/SHA256SUMS")"
[ "$actual_sum_paths" = "$expected_sum_paths" ] || weknora_production_die 'bundle checksum manifest has an unexpected surface'
(cd "$bundle_dir" && sha256sum -c SHA256SUMS >/dev/null) || weknora_production_die 'bundle checksum verification failed'

for artifact in postgres-v79.pg.dump data-files.tar data-files.manifest neo4j/neo4j.dump; do
    expected_hash="$(jq -er --arg artifact "$artifact" '.artifacts[$artifact]' "$bundle_dir/manifest.json")"
    actual_hash="$(weknora_production_sha256_file "$bundle_dir/$artifact")"
    [ "$actual_hash" = "$expected_hash" ] || weknora_production_die 'bundle artifact hash does not match its manifest'
done

manifest_count="$(wc -l < "$bundle_dir/data-files.manifest" | tr -d ' ')"
[ "$manifest_count" = "$(jq -er '.data_files.file_count' "$bundle_dir/manifest.json")" ] || weknora_production_die 'data-files count does not match its manifest'
tar -tf "$bundle_dir/data-files.tar" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ { invalid = 1 }
  END { exit invalid ? 1 : 0 }
' || weknora_production_die 'data-files archive contains an unsafe path'

printf '%s\n' "verified v79 rehearsal bundle: $bundle_id"
