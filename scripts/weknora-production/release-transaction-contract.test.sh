#!/usr/bin/env bash
# Read-only contract for the v2 transaction. It deliberately checks the deep
# seam and the irreversible-action guardrails without contacting Docker or a
# production host.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
transaction="$script_dir/release-transaction.sh"
compose="$script_dir/release-compose.sh"
compose_file="$repo_root/integration/weknora-production/compose.release.yaml"
entrypoint="$repo_root/integration/weknora-production/app-entrypoint.sh"
app_dockerfile="$repo_root/integration/weknora-production/Dockerfile.app.runtime"
makefile="$repo_root/weknora/Makefile"
lib="$script_dir/lib.sh"
source_manifest="$script_dir/source-manifest.sh"
ssh_gate="$script_dir/server/musuw-deploy-ssh-gate"
root_gate="$script_dir/server/musuw-deploy-gate"
production_workflow="$repo_root/.github/workflows/deploy-production.yml"
ci_workflow="$repo_root/.github/workflows/ci.yml"

fail() { printf '%s\n' "$1" >&2; exit 1; }

[ -x "$transaction" ] || fail 'release transaction is not executable'
[ -x "$compose" ] || fail 'release Compose adapter is not executable'
[ -f "$compose_file" ] || fail 'release Compose topology is missing'

bash -n "$transaction"
bash -n "$compose"
sh -n "$entrypoint"

grep -Fq 'musuw.release-snapshot.v2' "$transaction" || fail 'transaction does not persist the durable snapshot'
grep -Fq 'old_containers' "$transaction" || fail 'snapshot does not capture the old running container identities'
grep -Fq 'image_state' "$transaction" || fail 'snapshot does not capture old image ids/digests'
grep -Fq 'source_target' "$transaction" || fail 'snapshot does not capture the current source pointer'
grep -Fq 'config_sha' "$transaction" || fail 'transaction does not bind configuration hashes'
grep -Fq 'release-ledger-v2.json' "$transaction" || fail 'transaction does not persist the v2 ledger'
grep -Fq 'WEKNORA_PRODUCTION_RELEASE_ID="$release_id"' "$repo_root/scripts/weknora-production/server/musuw-deploy-gate" || fail 'forced gate does not preserve the safe release id for v2 ledger identity'
grep -Fq 'WEKNORA_PRODUCTION_TRANSACTION_TEST_FALLBACK:-0' "$repo_root/scripts/weknora-production/release-ci.sh" || fail 'legacy fallback is not explicitly test-only'
grep -Fq 'musuw-r-' "$lib" || fail 'release project is not derived from a short SHA'
if grep -Fq '40|64' "$lib" "$source_manifest" "$ssh_gate" "$root_gate"; then
    fail 'release/deploy revision validation accepts a 64-hex digest that split runtime roles reject'
fi
if grep -Fq '"$requested" =~ ^[0-9a-fA-F]{64}$' "$production_workflow"; then
    fail 'production workflow accepts a 64-hex revision that split runtime roles reject'
fi
grep -Fq 'COMMIT_ID_ARG: ${WEKNORA_PRODUCTION_REVISION:?set WEKNORA_PRODUCTION_REVISION}' "$compose_file" || fail 'release Compose does not pass the full SHA into the application image build'
grep -Fq 'COMMIT_ID=${COMMIT_ID_ARG}' "$app_dockerfile" || fail 'application Dockerfile does not preserve the release revision in its build environment'
grep -Fq 'make build-prod' "$app_dockerfile" || fail 'application Dockerfile bypasses the audited production linker target'
grep -Fq 'internal/handler.CommitID=$$COMMIT_ID' "$makefile" || fail 'production linker target does not inject the full compiled revision'
if grep -Eq 'weknora/scripts/(build_images|get_version)\.sh' "$transaction" "$compose" "$compose_file" "$app_dockerfile"; then
    fail 'dedicated production transaction unexpectedly routes through a generic short-SHA packaging helper'
fi
grep -Fq 'WEKNORA_RUNTIME_ROLE: prepare' "$compose_file" || fail 'prepare role is missing'
grep -Fq 'WEKNORA_RUNTIME_ROLE: web' "$compose_file" || fail 'web role is missing'
grep -Fq 'WEKNORA_RUNTIME_ROLE: worker' "$compose_file" || fail 'worker role is missing'
grep -Fq 'WEKNORA_RUNTIME_ROLE' "$entrypoint" || fail 'production entrypoint does not branch on the runtime role'
grep -Fq 'exec gosu appuser "$@"' "$entrypoint" || fail 'split runtime does not directly drop privileges after access validation'
grep -Fq 'exec "$upstream_entrypoint" "$@"' "$entrypoint" || fail 'all/default runtime does not preserve the upstream compatibility entrypoint'
grep -Fq 'test -w "$data_dir"' "$entrypoint" || fail 'split runtime does not fail closed on shared data write access'
if grep -Eq 'chown[[:space:]]+-R|cp[[:space:]]+-r' "$entrypoint"; then
    fail 'production split entrypoint contains recursive shared-volume mutation'
fi
grep -Fq '127.0.0.1:8081/readyz' "$compose_file" || fail 'worker healthcheck does not use the private loopback readiness probe'
grep -Fq 'external: true' "$compose_file" || fail 'candidate topology does not require external stable resources'
grep -Fq 'data-files:' "$compose_file" || fail 'candidate topology does not declare the stable external file volume'
grep -Fq 'APP_HOST: ${WEKNORA_RELEASE_WEB_CONTAINER:?set WEKNORA_RELEASE_WEB_CONTAINER}' "$compose_file" || fail 'frontend does not target its exact per-revision web identity'
if grep -A4 -E '^[[:space:]]+web:$' "$compose_file" | grep -Fq -- '- web'; then
    fail 'candidate web publishes a shared DNS alias on the external data network'
fi
grep -Fq 'connect_candidate_data_network web' "$transaction" || fail 'transaction does not attach candidate web to stable data networking with an exact identity'
grep -Fq 'create --no-build web frontend' "$transaction" || fail 'candidate web starts before its exact data-network identity is attached'

grep -Fq '$repo_root/deploy/production.public.env' "$transaction" || fail 'candidate public configuration is not loaded from the manifest-bound source bundle'
grep -Fq '$repo_root/deploy/auth-public.env' "$transaction" || fail 'candidate auth configuration is not loaded from the manifest-bound source bundle'
if grep -Fq 'replace_env_key "$candidate_dir/production.public.env" WEKNORA_PRODUCTION_RELEASE_ID' "$transaction"; then
    fail 'transaction overwrites the stable application release identity'
fi
grep -Fq 'weknora_production_require_disk_reserve' "$transaction" || fail 'transaction does not recheck disk reserve after image build'
grep -Fq 'image revision label is missing or does not match' "$transaction" || fail 'candidate image provenance does not fail closed when the revision label is missing'
grep -Fq '/api/v1/auth/oidc/url' "$transaction" || fail 'candidate OIDC gate does not construct the authorization URL'
grep -Fq 'code_challenge_method=S256' "$transaction" || fail 'candidate OIDC gate does not require S256 PKCE'
grep -Fq '#HttpOnly_' "$transaction" || fail 'candidate OIDC gate does not require an HttpOnly binding cookie'
grep -Fq 'dependencies' "$transaction" || fail 'readyz gate ignores dependency state'
grep -Fq 'probe_restored_public_owner' "$transaction" || fail 'rollback does not publicly probe the restored owner'
grep -Fq 'stop_candidate_worker' "$transaction" || fail 'rollback does not stop the candidate worker before restarting the old background owner'
grep -Fq 'stop_candidate_web_frontend' "$transaction" || fail 'rollback does not stop and verify candidate traffic roles after restoring the edge'

transaction_line="$(grep -n '"$transaction_script"' "$repo_root/scripts/weknora-production/release-ci.sh" | tail -n 1 | cut -d: -f1)"
if tail -n "+$((transaction_line + 1))" "$repo_root/scripts/weknora-production/release-ci.sh" | grep -Fq 'curl '; then
    fail 'release-ci performs a post-commit public probe outside the transaction rollback scope'
fi
if rg -n 'WEKNORA_PRODUCTION_TRANSACTION_TEST_(FAULT|FALLBACK)' "$production_workflow" "$repo_root/scripts/weknora-production/server/musuw-deploy-gate" >/dev/null; then
    fail 'production workflow/server exposes a transaction test-only control'
fi
if rg -n 'WEKNORA_ENTRYPOINT_TEST_ROOT' "$production_workflow" "$repo_root/scripts/weknora-production/server/musuw-deploy-gate" "$repo_root/scripts/weknora-production/server/musuw-deploy-ssh-gate" >/dev/null; then
    fail 'production workflow/server exposes the entrypoint test-root control'
fi

if grep -Eq 'docker[[:space:]]+(volume|secret)[[:space:]]+(create|rm|remove|prune)|docker compose.*(down|rm.*-v)' "$transaction" "$compose"; then
    fail 'transaction contains destructive volume/secret lifecycle calls'
fi
if grep -Eq 'docker (image|container) rm|docker image prune' "$transaction"; then
    fail 'transaction deletes image/process state instead of retaining rollback evidence'
fi

grep -Fq 'network disconnect' "$transaction" || fail 'edge handoff does not detach the old owner'
grep -Fq 'network connect --alias' "$transaction" || fail 'edge handoff does not attach the candidate alias'
grep -Fq 'cutover_intent' "$transaction" || fail 'edge handoff has no durable pre-mutation intent'
intent_line="$(grep -n 'write_cutover_intent' "$transaction" | tail -n 1 | cut -d: -f1 || true)"
disconnect_line="$(grep -n 'docker network disconnect "$edge_network" "$old_id"' "$transaction" | head -n 1 | cut -d: -f1)"
[ -n "$intent_line" ] && [ -n "$disconnect_line" ] && [ "$intent_line" -lt "$disconnect_line" ] || \
    fail 'candidate edge identity is not persisted before the first edge mutation'
grep -Fq 'transaction_test_fault edge_after_connect' "$transaction" || fail 'actual harness cannot fault the post-connect/pre-state crash window'
grep -Fq 'public release marker' "$transaction" || fail 'public probe does not verify a release marker'
grep -Fq 'status == "ready"' "$transaction" || fail 'readyz gate does not require the runtime ready status'
grep -Fq 'restart_old_stopped' "$transaction" || fail 'rollback does not restart stopped old owners before edge restore'
grep -Fq 'assert_additive_compatible_migrations' "$transaction" || fail 'migration compatibility gate is missing'
for workflow in "$ci_workflow" "$production_workflow"; do
    for check in release-transaction-contract.test.sh release-transaction-simulation.test.sh release-transaction-actual.test.sh; do
        grep -Fq "bash scripts/weknora-production/$check" "$workflow" || fail "release workflow omits canonical transaction check: $check"
    done
done
if grep -Fq 'release-transaction-actual.test.sh' "$script_dir/release-transaction-simulation.test.sh"; then
    fail 'model simulation nests the actual fault harness and doubles canonical CI runtime'
fi

printf '%s\n' 'release transaction contract green'
