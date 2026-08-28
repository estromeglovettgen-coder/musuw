#!/usr/bin/env bash
# TDD contract for the isolated staging release seam. This test is intentionally
# written before the implementation: it only inspects checked-in text and
# renders Compose with synthetic values; it never contacts Docker, SSH, Paddle,
# Cloudflare, or a live filesystem.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
staging_root="$repo_root/integration/weknora-staging"
server_root="$script_dir/server"

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

required_files=(
    "$staging_root/compose.yaml"
    "$staging_root/compose.edge.yaml"
    "$staging_root/app-entrypoint.sh"
    "$staging_root/staging.env.example"
    "$staging_root/auth-public.env.example"
    "$script_dir/lib.sh"
    "$script_dir/capacity-preflight.sh"
    "$script_dir/capacity-preflight.test.sh"
    "$script_dir/prepare-runtime.sh"
    "$script_dir/compose.sh"
    "$script_dir/verify-static.sh"
    "$script_dir/release-ci.sh"
    "$script_dir/verify-deployed.sh"
    "$repo_root/scripts/weknora-staging-deploy.sh"
    "$server_root/musuw-staging-deploy-gate"
    "$server_root/musuw-staging-deploy-ssh-gate"
    "$server_root/bootstrap-musuw-staging-deploy.sh"
    "$server_root/verify-musuw-staging-deploy-gate.sh"
)
for required in "${required_files[@]}"; do
    [ -f "$required" ] || fail "staging contract file is missing: $required"
    [ ! -L "$required" ] || fail "staging contract file is a symlink: $required"
done

grep -Fq 'weknora-v072-staging' "$staging_root/compose.yaml" || fail 'staging project identity is not fixed'
grep -Fq '127.0.0.1:${WEKNORA_STAGING_FRONTEND_PORT:-4192}:8080' "$staging_root/compose.yaml" || fail 'staging frontend port is not loopback 4192'
grep -Fq '127.0.0.1:${WEKNORA_STAGING_APP_PORT:-18092}:8080' "$staging_root/compose.yaml" || fail 'staging app port is not loopback 18092'
grep -Fq 'MUSUW_DEPLOYMENT_ENVIRONMENT: staging' "$staging_root/compose.yaml" || fail 'staging deployment selector is missing'
grep -Fq 'MUSUW_PADDLE_ENVIRONMENT: sandbox' "$staging_root/compose.yaml" || fail 'staging Paddle selector is not Sandbox'
grep -Fq 'OPENROUTER_WORKSPACE_ID: ${OPENROUTER_WORKSPACE_ID:?set OPENROUTER_WORKSPACE_ID}' "$staging_root/compose.yaml" || fail 'staging OpenRouter workspace is not required'
grep -Fq 'OPENROUTER_WORKSPACE_ID=00000000-0000-4000-8000-000000000001' "$staging_root/staging.env.example" || fail 'staging OpenRouter workspace fixture is missing'
grep -Fq 'openrouter-workspace-id' "$script_dir/prepare-runtime.sh" || fail 'staging OpenRouter workspace is not pinned by the server runtime'
grep -Fq 'MUSUW_STAGING_R2_BUCKET=musuw-staging' "$staging_root/staging.env.example" || fail 'staging R2 bucket is not the commissioned bucket'
grep -Fq 'MUSUW_SUPABASE_URL=https://achfnnicetupvtoqiwqd.supabase.co' "$staging_root/auth-public.env.example" || fail 'staging Supabase project is not the commissioned test project'
if grep -Fq '/opt/weknora-production/app-entrypoint.sh' "$staging_root/compose.yaml"; then
    fail 'staging Compose mounts an unused production app entrypoint'
fi
if grep -Fq 'integration/weknora-production/app-entrypoint.sh' "$script_dir/source-manifest.sh"; then
    fail 'staging source manifest carries an unused production app entrypoint'
fi
grep -Fq 'S3_BUCKET_NAME: ${MUSUW_STAGING_R2_BUCKET:?set MUSUW_STAGING_R2_BUCKET}' "$staging_root/compose.yaml" || fail 'staging R2 bucket is not runtime-selected'
grep -Fq 'WEKNORA_REDIS_NAMESPACE: weknora-v072-staging' "$staging_root/compose.yaml" || fail 'staging Redis namespace is not isolated'
grep -Fq 'NEO4J_ENABLE: "false"' "$staging_root/compose.yaml" || fail 'staging must disable Neo4j'
grep -Fq 'MUSUW_STAGING_SECRET_DIR' "$staging_root/compose.yaml" || fail 'staging secret root is not explicit'
grep -Fq '/opt/weknora/staging-runtime/secrets' "$staging_root/compose.yaml" || fail 'staging secret root is not the fixed server path'
grep -Fq 'image: ${WEKNORA_STAGING_APP_IMAGE:?set WEKNORA_STAGING_APP_IMAGE}' "$staging_root/compose.yaml" || fail 'staging app image is not immutable input'
grep -Fq 'image: ${WEKNORA_STAGING_FRONTEND_IMAGE:?set WEKNORA_STAGING_FRONTEND_IMAGE}' "$staging_root/compose.yaml" || fail 'staging frontend image is not immutable input'
grep -Fq 'musuw_paddle_validate_configuration' "$staging_root/app-entrypoint.sh" || fail 'staging entrypoint does not call generic Paddle validator'
grep -Fq 'sandbox' "$staging_root/app-entrypoint.sh" || fail 'staging entrypoint does not select Paddle Sandbox'
if grep -Fq 'musuw_paddle_validate_production_launch' "$staging_root/app-entrypoint.sh"; then
    fail 'staging entrypoint calls production Live-only wrapper'
fi
if grep -Eq 'tikhub_api_key|TIKHUB_API_KEY' "$staging_root/app-entrypoint.sh" "$staging_root/compose.yaml" "$script_dir/prepare-runtime.sh"; then
    fail 'staging runtime reads or mounts TikHub credentials'
fi
if grep -Eq '^\s+build:' "$staging_root/compose.yaml" &&
   ! grep -Eq '^\s+build: !reset null$' "$staging_root/compose.yaml"; then
    fail 'staging overlay still permits a server-side build'
fi

for service in frontend app postgres redis docreader; do
    grep -A160 -E "^  ${service}:" "$staging_root/compose.yaml" | grep -Eq 'cpus:|mem_limit:|pids_limit:' ||
        fail "staging ${service} does not declare CPU/memory/pids limits"
done
grep -Fq 'WEKNORA_STAGING_APP_CPUS:-0.75' "$staging_root/compose.yaml" || fail 'staging app CPU default is too high or missing'
grep -Fq 'WEKNORA_STAGING_APP_MEMORY:-768m' "$staging_root/compose.yaml" || fail 'staging app memory default is too high or missing'
grep -Fq 'WEKNORA_STAGING_FRONTEND_CPUS:-0.125' "$staging_root/compose.yaml" || fail 'staging frontend CPU default is too high or missing'
grep -Fq 'WEKNORA_STAGING_FRONTEND_MEMORY:-128m' "$staging_root/compose.yaml" || fail 'staging frontend memory default is too high or missing'
grep -Fq 'WEKNORA_STAGING_DOCREADER_CPUS:-0.25' "$staging_root/compose.yaml" || fail 'staging docreader CPU default is too high or missing'
grep -Fq 'WEKNORA_STAGING_DOCREADER_MEMORY:-384m' "$staging_root/compose.yaml" || fail 'staging docreader memory default is too high or missing'
grep -Fq 'WEKNORA_STAGING_POSTGRES_CPUS:-0.25' "$staging_root/compose.yaml" || fail 'staging postgres CPU default is too high or missing'
grep -Fq 'WEKNORA_STAGING_POSTGRES_MEMORY:-384m' "$staging_root/compose.yaml" || fail 'staging postgres memory default is too high or missing'
grep -Fq 'WEKNORA_STAGING_REDIS_CPUS:-0.125' "$staging_root/compose.yaml" || fail 'staging Redis CPU default is too high or missing'
grep -Fq 'WEKNORA_STAGING_REDIS_MEMORY:-128m' "$staging_root/compose.yaml" || fail 'staging Redis memory default is too high or missing'

grep -Fq 'staging-web' "$staging_root/compose.edge.yaml" || fail 'staging edge alias is missing'
grep -Fq 'musnow-production_edge' "$staging_root/compose.edge.yaml" || fail 'staging edge network is not the existing tunnel network'
grep -Fq 'noindex' "$script_dir/verify-deployed.sh" || fail 'staging deployed verification does not enforce noindex'

for fixed in \
    '/var/lib/musuw-staging-deploy' \
    '/opt/weknora-staging/releases' \
    '/opt/weknora-staging/current' \
    '/opt/weknora/staging-runtime'; do
    grep -Fq "$fixed" "$server_root/musuw-staging-deploy-gate" "$server_root/musuw-staging-deploy-ssh-gate" "$server_root/bootstrap-musuw-staging-deploy.sh" ||
        fail "staging gate does not pin fixed root: $fixed"
done

if grep -Eq '(^|[[:space:]])(eval|bash[[:space:]]+-c|sh[[:space:]]+-c)([[:space:]]|$)' \
    "$server_root/musuw-staging-deploy-gate" "$server_root/musuw-staging-deploy-ssh-gate"; then
    fail 'staging gate contains arbitrary shell execution'
fi
grep -Fq 'prepare|deploy)' "$server_root/musuw-staging-deploy-ssh-gate" || fail 'staging SSH prepare/deploy protocol is not fixed'
grep -Fq 'verify)' "$server_root/musuw-staging-deploy-ssh-gate" || fail 'staging SSH verify protocol is not fixed'
grep -Fq 'WEKNORA_STAGING_EXPECTED_APP_IMAGE' "$script_dir/verify-deployed.sh" || fail 'staging remote verification does not compare the runner app digest'
grep -Fq 'WEKNORA_STAGING_EXPECTED_FRONTEND_IMAGE' "$script_dir/verify-deployed.sh" || fail 'staging remote verification does not compare the runner frontend digest'
grep -Fq 'S3_BUCKET_NAME=musuw-staging' "$script_dir/verify-deployed.sh" || fail 'staging promotion verifier does not pin the R2 test bucket'
grep -Fq 'MUSUW_SUPABASE_URL=https://achfnnicetupvtoqiwqd.supabase.co' "$script_dir/verify-deployed.sh" || fail 'staging promotion verifier does not pin the Supabase test project'
grep -Fq 'MUSUW_AUTH_PUBLIC_ORIGIN=https://staging.app.musuw.com' "$script_dir/verify-deployed.sh" || fail 'staging promotion verifier does not pin the browser auth origin'
grep -Fq 'FRONTEND_BASE_URL=https://staging.app.musuw.com' "$script_dir/verify-deployed.sh" || fail 'staging promotion verifier does not pin the backend frontend origin'
grep -Fq 'openrouter-workspace-id' "$script_dir/verify-deployed.sh" || fail 'staging promotion verifier does not recheck the OpenRouter server pin'
grep -Fq 'source-manifest.sh' "$script_dir/release-ci.sh" || fail 'staging release helper does not verify source manifest'
grep -Fq 'capacity-preflight.sh' "$script_dir/release-ci.sh" || fail 'staging release helper has no production capacity preflight'
grep -Fq -- '--no-build' "$script_dir/release-ci.sh" || fail 'staging release helper permits build'
grep -Fq 'staging_mutated=1' "$script_dir/release-ci.sh" || fail 'staging release helper does not track a partial Compose mutation'
grep -Fq -- 'down --remove-orphans' "$script_dir/release-ci.sh" || fail 'staging release failure does not stop the partial stack'
grep -Fq 'same digest' "$script_dir/verify-deployed.sh" || fail 'staging verification does not document immutable digest parity'
grep -Fq 'remote_gate verify' "$repo_root/scripts/weknora-staging-deploy.sh" || fail 'staging runner does not invoke remote fixed verify'
grep -Fq 'musuw-staging-gate $verb $revision $expected_app $expected_frontend' "$repo_root/scripts/weknora-staging-deploy.sh" || fail 'staging runner does not send exact digest refs to remote verify'
grep -Fq 'musuw-staging-deploy@' "$repo_root/scripts/weknora-staging-deploy.sh" || fail 'staging runner target is not the dedicated account'

printf '%s\n' 'staging isolation contract green'
