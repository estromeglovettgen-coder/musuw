#!/usr/bin/env bash
# Compatibility entry point for repository CI. The active production seam is
# the direct SHA-only runner and its two restricted server gate verbs.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

workflow_path="$script_dir/../.github/workflows/deploy-production.yml"
fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

test -f "$workflow_path" || fail 'production release workflow is missing'
grep -Fq 'default: staging-only' "$workflow_path" || fail 'manual release default is not staging-only'
grep -Fq '          - staging-only' "$workflow_path" || fail 'staging-only release mode is missing'
grep -Fq '          - promote' "$workflow_path" || fail 'promote release mode is missing'
grep -Fq 'default: not-confirmed' "$workflow_path" || fail 'manual promotion does not default Paddle E2E to unconfirmed'
grep -Fq '          - full-sandbox-e2e-green' "$workflow_path" || fail 'full Sandbox E2E attestation is missing'
if grep -Eq '^[[:space:]]*- full$' "$workflow_path"; then
    fail 'unsupported full release mode remains in the workflow'
fi
grep -Fq "github.event_name == 'workflow_dispatch'" "$workflow_path" || fail 'production promotion is not manual-only'
grep -Fq "inputs.release_mode == 'promote'" "$workflow_path" || fail 'production promotion lacks an explicit promote gate'
grep -Fq "inputs.staging_e2e_result == 'full-sandbox-e2e-green'" "$workflow_path" || fail 'production promotion is not gated by full Sandbox E2E attestation'
grep -Fq 'required_reviewers' "$workflow_path" || fail 'production promotion does not verify a protected reviewer gate'
if grep -Fq 'staging_acceptance' "$workflow_path"; then
    fail 'automatic staging smoke verification still claims full acceptance'
fi
grep -Fq 'staging_deployment' "$workflow_path" || fail 'staging deployment evidence is missing'
if grep -A12 '^  deploy:$' "$workflow_path" | grep -Fq 'github.event_name == '\''workflow_run'\'''; then
    fail 'workflow_run is still allowed to promote production'
fi
grep -Fq 'if [ -z "$mode" ]; then mode=staging-only; fi' "$workflow_path" || fail 'workflow_run does not default to staging-only'
grep -Fq 'musuw-staging-gate verify' "$workflow_path" || fail 'staging acceptance does not use the fixed remote verify gate'
if grep -Fq 'bash scripts/weknora-staging/verify-deployed.sh' "$workflow_path"; then
    fail 'server-local staging verifier is being executed on the GitHub runner'
fi

bash "$script_dir/weknora-production/deploy-ci-seams-contract.test.sh"
bash "$script_dir/weknora-production/musuw-deploy-gate-simulation.test.sh"
bash "$script_dir/weknora-production/tunnel-compose-contract.test.sh"
bash "$script_dir/weknora-production/tunnel-token-contract.test.sh"
bash "$script_dir/weknora-production/postgres-healthcheck-contract.test.sh"
printf '%s\n' 'WeKnora workflow simulation green: direct SHA-only deployment seam'
