#!/usr/bin/env bash
# Candidate-only network/model acceptance. This never changes SSRF policy or
# touches production services; it verifies that the local container can reach
# the two preconfigured DeepSeek chat models and the built-in OpenRouter
# reranker after the DNS refresh.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
candidate_env="$repo_root/.runtime/weknora/candidate.env"
app_container="weknora-v072-candidate-app"

if [ ! -r "$candidate_env" ]; then
    printf '%s\n' 'candidate runtime configuration is unavailable' >&2
    exit 1
fi
if ! docker inspect "$app_container" >/dev/null 2>&1; then
    printf '%s\n' 'candidate app container is unavailable' >&2
    exit 1
fi

# The exact failure reported by the UI is caused by fake-ip DNS returning an
# address in 198.18.0.0/15. Require a globally routable address instead of
# merely checking that DNS returned something for every built-in provider.
docker exec "$app_container" sh -ec '
    assert_public_ipv4() {
        host="$1"
        resolved="$(getent ahostsv4 "$host" | awk "NR == 1 { print \$1 }")"
        [ -n "$resolved" ]
        python3 - "$resolved" "$host" <<"PY"
import ipaddress
import sys

address = ipaddress.ip_address(sys.argv[1])
if address.version != 4 or not address.is_global:
    raise SystemExit(f"{sys.argv[2]} resolved to non-public address {address}")
print(f"{sys.argv[2]}={address}")
PY
    }

    assert_public_ipv4 api.deepseek.com
    assert_public_ipv4 openrouter.ai
'

# Exercise the provider seam used by RemoteAPIChat. The API key is read only
# inside the container and the response body is reduced to a boolean, so no
# credential or model output is printed by this acceptance check.
docker exec "$app_container" sh -ec '
    api_key="$(tr -d "\r\n" < /run/secrets/deepseek_api_key)"
    [ -n "$api_key" ]
    for model in deepseek-v4-flash deepseek-v4-pro; do
        payload="$(MODEL="$model" python3 - <<"PY"
import json
import os

print(json.dumps({
    "model": os.environ["MODEL"],
    "messages": [{"role": "user", "content": "Reply with OK only."}],
    "max_tokens": 64,
}))
PY
)"
        body="$(curl --fail --silent --show-error --max-time 60 \
            -H "Authorization: Bearer $api_key" \
            -H "Content-Type: application/json" \
            --data "$payload" \
            https://api.deepseek.com/chat/completions)"
        MODEL="$model" RESPONSE="$body" python3 - <<"PY"
import json
import os

response = json.loads(os.environ["RESPONSE"])
choices = response.get("choices")
model = os.environ.get("MODEL", "")
if not choices or not choices[0].get("message", {}).get("content"):
    raise SystemExit(model + " returned no assistant content")
print(model + " chat=ok")
PY
    done

    rerank_key="$(tr -d "\r\n" < /run/secrets/openrouter_api_key)"
    [ -n "$rerank_key" ]
    rerank_payload="$(python3 - <<"PY"
import json

print(json.dumps({
    "model": "cohere/rerank-4-fast",
    "query": "public resolver",
    "documents": ["global address", "private fake address"],
}))
PY
)"
    rerank_body="$(curl --fail --silent --show-error --max-time 60 \
        -H "Authorization: Bearer $rerank_key" \
        -H "Content-Type: application/json" \
        --data "$rerank_payload" \
        https://openrouter.ai/api/v1/rerank)"
    RESPONSE="$rerank_body" python3 - <<"PY"
import json
import os

response = json.loads(os.environ["RESPONSE"])
results = response.get("results")
if not isinstance(results, list) or not results:
    raise SystemExit("openrouter rerank returned no results")
print("openrouter rerank=ok")
PY
'

printf '%s\n' 'candidate DeepSeek Flash/Pro and OpenRouter rerank network checks passed'
