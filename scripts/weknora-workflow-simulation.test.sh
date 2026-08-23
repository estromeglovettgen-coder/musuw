#!/usr/bin/env bash
# Compatibility entry point for repository CI. The active production seam is
# the direct SHA-only runner and its two restricted server gate verbs.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
bash "$script_dir/weknora-production/deploy-ci-seams-contract.test.sh"
bash "$script_dir/weknora-production/musuw-deploy-gate-simulation.test.sh"
bash "$script_dir/weknora-production/tunnel-compose-contract.test.sh"
bash "$script_dir/weknora-production/tunnel-token-contract.test.sh"
bash "$script_dir/weknora-production/postgres-healthcheck-contract.test.sh"
printf '%s\n' 'WeKnora workflow simulation green: direct SHA-only deployment seam'
