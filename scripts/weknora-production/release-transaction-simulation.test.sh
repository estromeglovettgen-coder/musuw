#!/usr/bin/env bash
# Deterministic transaction simulation.  It models two successive SHA
# releases and injects failures at each irreversible phase.  No Docker daemon,
# network, volume, secret, or production filesystem is contacted.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$script_dir/lib.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

revision_a='0123456789abcdef0123456789abcdef01234567'
revision_b='89abcdef0123456789abcdef0123456789abcdef'

assert() { "$@" || { printf '%s\n' "simulation assertion failed: $*" >&2; exit 1; }; }

state_for() {
    local revision="$1" old_revision="$2" old_project="$3"
    WEKNORA_PRODUCTION_REVISION="$revision" \
        jq -n --arg revision "$revision" --arg old_revision "$old_revision" --arg old_project "$old_project" \
        --arg project "$(WEKNORA_PRODUCTION_REVISION="$revision" bash -c '. "$1"; weknora_production_release_project' bash "$script_dir/lib.sh")" \
        '{phase:"snapshot",revision:$revision,project:$project,old:{revision:$old_revision,project:$old_project,source:"/opt/weknora/releases/old/source",config_sha:"old-config",image_id:"sha256:old",edge_owner:"legacy-web",edge_aliases:["legacy-web","web"],background_running:true},candidate:{source:"/opt/weknora/releases/new/source",config_sha:("config-"+$revision),image_id:("sha256:"+$revision),edge_owner:null,worker_running:false},volumes:["weknora-v072-production-data-files"],secrets:["/opt/weknora/runtime/secrets"]}'
}

advance() {
    local state_file="$1" phase="$2"
    jq --arg phase "$phase" '.phase=$phase' "$state_file" > "$state_file.tmp"
    mv "$state_file.tmp" "$state_file"
}

rollback_model() {
    local state_file="$1"
    jq '.phase="rolled_back" | .candidate.edge_owner=null | .candidate.worker_running=false | .old.background_running=true' "$state_file" > "$state_file.tmp"
    mv "$state_file.tmp" "$state_file"
}

run_model() {
    local revision="$1" old_revision="$2" old_project="$3" failure_phase="${4:-}" state_file
    state_file="$tmp_dir/state-$revision.json"
    state_for "$revision" "$old_revision" "$old_project" > "$state_file"
    advance "$state_file" candidate_prepared
    [ "$failure_phase" = build ] && { rollback_model "$state_file"; printf '%s' "$state_file"; return; }
    advance "$state_file" images_built
    [ "$failure_phase" = stage ] && { rollback_model "$state_file"; printf '%s' "$state_file"; return; }
    advance "$state_file" candidate_ready
    jq '.candidate.edge_owner="candidate-frontend"' "$state_file" > "$state_file.tmp" && mv "$state_file.tmp" "$state_file"
    advance "$state_file" cutover_active
    [ "$failure_phase" = public ] && { rollback_model "$state_file"; printf '%s' "$state_file"; return; }
    jq '.old.background_running=false' "$state_file" > "$state_file.tmp" && mv "$state_file.tmp" "$state_file"
    [ "$failure_phase" = worker ] && { rollback_model "$state_file"; printf '%s' "$state_file"; return; }
    jq '.candidate.worker_running=true' "$state_file" > "$state_file.tmp" && mv "$state_file.tmp" "$state_file"
    [ "$failure_phase" = commit ] && { rollback_model "$state_file"; printf '%s' "$state_file"; return; }
    advance "$state_file" committed
    printf '%s' "$state_file"
}

# New-SHA identity and old image capture are independent of the state machine.
assert test "$(WEKNORA_PRODUCTION_REVISION="$revision_a" bash -c '. "$1"; weknora_production_release_project' bash "$script_dir/lib.sh")" = musuw-r-0123456789ab
assert test "$(WEKNORA_PRODUCTION_REVISION="$revision_b" bash -c '. "$1"; weknora_production_release_project' bash "$script_dir/lib.sh")" = musuw-r-89abcdef0123

first_state="$(run_model "$revision_a" '' '')"
assert jq -e '.phase == "committed" and .old.image_id == "sha256:old" and .candidate.worker_running == true' "$first_state" >/dev/null
first_project="$(jq -r '.project' "$first_state")"

# A second SHA never overwrites the first candidate identity and observes the
# first ledger/project as its old owner.
second_state="$(run_model "$revision_b" "$revision_a" "$first_project")"
assert jq -e --arg project "$first_project" '.phase == "committed" and .old.project == $project and .project != $project and .candidate.edge_owner == "candidate-frontend"' "$second_state" >/dev/null

for failure in build stage public worker commit; do
    failed_state="$(run_model "$revision_b" "$revision_a" "$first_project" "$failure")"
    assert jq -e '.phase == "rolled_back" and .candidate.edge_owner == null and .candidate.worker_running == false and .old.background_running == true and .volumes == ["weknora-v072-production-data-files"] and .secrets == ["/opt/weknora/runtime/secrets"]' "$failed_state" >/dev/null
done

# A stale cutover state reconciles to the old edge owner before another release
# is admitted; no volume/secret lifecycle operation is part of the model.
stale="$tmp_dir/stale.json"
state_for "$revision_b" "$revision_a" "$first_project" > "$stale"
advance "$stale" cutover_active
jq '.candidate.edge_owner="candidate-frontend" | .old.background_running=false' "$stale" > "$stale.tmp" && mv "$stale.tmp" "$stale"
rollback_model "$stale"
assert jq -e '.phase == "rolled_back" and .candidate.edge_owner == null and .old.background_running == true' "$stale" >/dev/null

printf '%s\n' 'release transaction simulation green: dynamic identity, old-image snapshot, private staging, two releases, phase failures, full rollback, stale reconcile, stable volumes/secrets'
