#!/usr/bin/env bash
# Static validator for docs/external-credentials-registry.yaml.
# This is intentionally metadata-only: it never reads a credential, calls a
# provider, scans history/session data, or parses git objects/blobs.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
registry="$repo_root/docs/external-credentials-registry.yaml"
production_public_env="$repo_root/integration/weknora-production/production.env.example"
secrets_doc="$repo_root/docs/SECRETS_AND_INTEGRATIONS.md"
deployment_doc="$repo_root/docs/DEPLOYMENT.md"
readme="$repo_root/README.md"
agents="$repo_root/AGENTS.md"

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

[ -f "$registry" ] || fail 'external credentials registry is missing'
[ -f "$production_public_env" ] || fail 'production public env contract is missing'

grep -Fqx 'schema_version: 1' "$registry" || fail 'registry schema version is not 1'
grep -Fqx 'registry_status: metadata-only' "$registry" || fail 'registry is not metadata-only'
grep -Eq '^entries:' "$registry" || fail 'registry has no entries section'
grep -Eq '^repository_index:' "$registry" || fail 'registry has no repository index section'
ruby -ryaml -e '
  data = YAML.safe_load(File.read(ARGV.fetch(0)), aliases: false)
  abort "registry YAML root is not a mapping" unless data.is_a?(Hash)
  abort "registry entries are not a sequence" unless data["entries"].is_a?(Array)
  abort "registry repository index is not a sequence" unless data["repository_index"].is_a?(Array)
' "$registry" || fail 'registry is not valid safe YAML'

entry_count="$(grep -c '^  - id:' "$registry")"
[ "$entry_count" -ge 10 ] || fail 'registry does not contain enough credential entries'

# Every entry has the stable metadata fields needed to assign ownership and
# prove a health/rotation boundary without storing a secret value.
for field in provider environment credential_class status authority source consumers owner permission rotation revocation health; do
    field_count="$(awk -v wanted="$field" '
        /^entries:/ { inside = 1; next }
        /^repository_index:/ { inside = 0 }
        inside && $0 ~ "^    " wanted ":" { count++ }
        END { print count + 0 }
    ' "$registry")"
    [ "$field_count" -eq "$entry_count" ] || fail "registry entry field count mismatch: $field"
done

# Values are forbidden. Keep this check narrow enough to allow variable names,
# service labels, and safe descriptive text while rejecting common accidental
# secret/value forms, e-mail addresses, URLs, complete hosts, IPs, and hashes.
if grep -qE '^[[:space:]]+(value|secret|token|email|ip|host):[[:space:]]*[^[:space:]][^[:space:]]*' "$registry"; then
    fail 'registry contains a value-bearing field'
fi
if grep -qE 'https?://|(^|[^[:alnum:]])([0-9]{1,3}\.){3}[0-9]{1,3}([^[:alnum:]]|$)|(^|[^[:alnum:]])[A-Fa-f0-9]{40,}([^[:alnum:]]|$)' "$registry"; then
    fail 'registry contains a URL, complete IP address, or hash'
fi
if grep -qE '(^|[=:][[:space:]]*)(sk-[[:alnum:]_-]{8,}|pk-[[:alnum:]_-]{8,}|live_[[:alnum:]_-]{8,}|test_[[:alnum:]_-]{8,}|pdl_[[:alnum:]_-]{8,}|pri_[[:alnum:]_-]{8,}|gh[pousr]_[[:alnum:]_-]{12,}|github_pat_[[:alnum:]_-]{12,}|AIza[[:alnum:]_-]{16,}|eyJ[[:alnum:]_-]{16,})' "$registry"; then
    fail 'registry contains a recognizable credential-shaped value'
fi
if grep -qE '(^|[[:space:]])[[:alnum:]_.-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}([[:space:]]|$)' "$registry"; then
    fail 'registry contains an email address'
fi

# Paddle is the current launch-stage blocker. Keep both environments visible,
# but require every Live entry to remain explicitly unauthorized.
awk '
    function check() {
        if (entry != "" && provider == "paddle" && environment == "live" && status != "not-authorized") {
            printf "Paddle Live entry is not blocked: %s\n", entry > "/dev/stderr"
            bad = 1
        }
    }
    /^  - id:/ {
        check()
        entry = $3
        provider = ""
        environment = ""
        status = ""
        next
    }
    /^    provider:/ { provider = $2; next }
    /^    environment:/ { environment = $2; next }
    /^    status:/ { status = $2; next }
    END {
        check()
        exit bad
    }
' "$registry" || fail 'Paddle Live authorization boundary is invalid'

grep -Fq 'id: paddle.sandbox.public-client' "$registry" || fail 'Paddle Sandbox public client entry is missing'
grep -Fq 'id: paddle.sandbox.price-catalog' "$registry" || fail 'Paddle Sandbox catalog entry is missing'
grep -Fq 'id: paddle.sandbox.api-key' "$registry" || fail 'Paddle Sandbox API key entry is missing'
grep -Fq 'id: paddle.sandbox.webhook-secret' "$registry" || fail 'Paddle Sandbox webhook entry is missing'
grep -Fq 'id: paddle.live.public-client' "$registry" || fail 'Paddle Live audit entry is missing'
grep -Fq 'id: paddle.live.price-catalog' "$registry" || fail 'Paddle Live catalog audit entry is missing'
grep -Fq 'id: paddle.live.api-key' "$registry" || fail 'Paddle Live API audit entry is missing'
grep -Fq 'id: paddle.live.webhook-secret' "$registry" || fail 'Paddle Live webhook audit entry is missing'

# The checked-in production contract must agree with the registry's current
# launch boundary. A future Live launch requires a separate reviewed change.
grep -Fqx 'MUSUW_PADDLE_ENVIRONMENT=sandbox' "$production_public_env" || fail 'production public env is not Sandbox-only'
grep -Fq 'MUSUW_PADDLE_CLIENT_TOKEN=test_' "$production_public_env" || fail 'production public env is not using a Sandbox client-token class'
grep -Fq 'current launch stage uses Paddle Sandbox' "$production_public_env" || fail 'production public env does not document the Live authorization boundary'

# Keep the operator-facing entry points linked to one registry instead of
# copying values or inventing per-project lists.
for doc in "$secrets_doc" "$deployment_doc" "$readme" "$agents"; do
    [ -f "$doc" ] || fail "operator document is missing: $doc"
done
grep -Fq 'external-credentials-registry.yaml' "$secrets_doc" || fail 'secrets document does not link the central registry'
grep -Fq 'external-credentials-registry.yaml' "$deployment_doc" || fail 'deployment document does not link the central registry'
grep -Fq 'external-credentials-registry.yaml' "$readme" || fail 'README does not link the central registry'
grep -Fq 'external-credentials-registry.yaml' "$agents" || fail 'AGENTS does not link the central registry'
grep -Fq 'Sandbox' "$deployment_doc" || fail 'deployment document has no Paddle Sandbox boundary'
grep -Fq 'Sandbox' "$readme" || fail 'README has no Paddle Sandbox boundary'
grep -Fq 'Sandbox' "$agents" || fail 'AGENTS has no Paddle Sandbox boundary'

printf '%s\n' 'external credential registry verification green'
