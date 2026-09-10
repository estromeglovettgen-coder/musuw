#!/usr/bin/env python3
"""Fail-closed allowlist for the immutable UI release range."""
from __future__ import annotations
import json
import re
import subprocess
import sys
from pathlib import Path

SHA = re.compile(r"^[0-9a-fA-F]{40}$")
UI = ("weknora/frontend/src/assets/", "weknora/frontend/src/components/", "weknora/frontend/src/i18n/", "weknora/frontend/src/views/chat/", "weknora/frontend/src/views/knowledge/", "weknora/frontend/e2e/")
ROOT = {"e2e/session-batch-manage.spec.ts", "playwright.session-batch.config.ts", ".github/workflows/ci.yml", "scripts/ci/verify-ui-release-scope.py", "scripts/ci/verify-ui-release-scope.test.py", "third_party/weknora/upgrades/81142df/resolution-ledger.tsv", "third_party/weknora/upgrades/81142df/resolution-overrides.tsv", "third_party/weknora/upgrades/81142df/resolution-summary.json"}
PROTECTED = ("backend", "billing", "payment", "checkout", "entitlement", "subscription", "auth", "openrouter", "locks", "buildruntimeconfig", "build-runtime-config")

class Rejected(Exception):
    pass

def git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, check=False)

def resolve(repo: Path, value: str) -> str:
    if not SHA.fullmatch(value):
        raise Rejected("commit must be a full SHA")
    result = git(repo, "rev-parse", "--verify", f"{value}^{{commit}}")
    if result.returncode or result.stdout.decode().strip().lower() != value.lower():
        raise Rejected("commit cannot be resolved")
    return value.lower()

def changed(repo: Path, baseline: str, candidate: str) -> list[str]:
    result = git(repo, "diff", "--no-ext-diff", "--raw", "--no-renames", "--diff-filter=ACDMRTUXB", "-z", baseline, candidate)
    if result.returncode:
        raise Rejected("git diff failed")
    if not result.stdout:
        return []
    if not result.stdout.endswith(b"\0"):
        raise Rejected("malformed git diff")
    tokens = result.stdout[:-1].split(b"\0")
    if len(tokens) % 2:
        raise Rejected("malformed git diff")
    paths = []
    for i in range(0, len(tokens), 2):
        try:
            fields = tokens[i].decode("ascii").lstrip(":").split()
            path = tokens[i + 1].decode("utf-8")
        except UnicodeDecodeError as error:
            raise Rejected("non-utf8 git diff") from error
        if len(fields) != 5 or fields[-1] not in {"A", "C", "D", "M", "R", "T", "U", "X", "B"}:
            raise Rejected("unsupported git diff")
        if fields[0] in {"120000", "160000"} or fields[1] in {"120000", "160000"}:
            raise Rejected("symlink or submodule change")
        if not path:
            raise Rejected("empty git path")
        paths.append(path)
    return paths

def check_path(path: str) -> None:
    if path.startswith("/") or "\\" in path or any(part in {"", ".", ".."} for part in path.split("/")):
        raise Rejected("unsafe path")
    lowered = path.lower()
    if any(term in lowered for term in PROTECTED):
        raise Rejected("protected path")
    if path == "package.json" or path.startswith("storefront/") or path in ROOT or path.startswith(UI):
        return
    raise Rejected("path outside UI scope")

def package_ok(repo: Path, baseline: str, candidate: str) -> bool:
    before_result = git(repo, "show", f"{baseline}:package.json")
    after_result = git(repo, "show", f"{candidate}:package.json")
    if before_result.returncode or after_result.returncode:
        raise Rejected("package JSON missing")
    try:
        before, after = json.loads(before_result.stdout), json.loads(after_result.stdout)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise Rejected("invalid package JSON") from error
    if not isinstance(before, dict) or not isinstance(after, dict) or not isinstance(before.get("scripts"), dict) or not isinstance(after.get("scripts"), dict):
        raise Rejected("invalid package scripts")
    b_scripts, a_scripts = before["scripts"], after["scripts"]
    if not isinstance(a_scripts.get("app:e2e:batch"), str) or b_scripts.get("app:e2e:batch") == a_scripts.get("app:e2e:batch"):
        raise Rejected("batch script did not change")
    before["scripts"] = {k: v for k, v in b_scripts.items() if k != "app:e2e:batch"}
    after["scripts"] = {k: v for k, v in a_scripts.items() if k != "app:e2e:batch"}
    return before == after

def verify(repo: Path, baseline_arg: str, candidate_arg: str) -> tuple[str, str, int]:
    baseline, candidate = resolve(repo, baseline_arg), resolve(repo, candidate_arg)
    if git(repo, "merge-base", "--is-ancestor", baseline, candidate).returncode:
        raise Rejected("baseline is not an ancestor")
    paths = changed(repo, baseline, candidate)
    for path in paths:
        check_path(path)
    if "package.json" in paths and not package_ok(repo, baseline, candidate):
        raise Rejected("package changed outside batch script")
    return baseline, candidate, len(paths)

def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: verify-ui-release-scope.py BASELINE_SHA CANDIDATE_SHA", file=sys.stderr)
        return 2
    try:
        root_result = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, check=False)
        if root_result.returncode or not root_result.stdout.strip():
            raise Rejected("not a git repository")
        root = Path(root_result.stdout.decode().strip()).resolve()
        baseline, candidate, count = verify(root, argv[1], argv[2])
    except (OSError, Rejected) as error:
        print(f"ui release scope rejected: {error}", file=sys.stderr)
        return 1
    print(f"count={count} baseline={baseline} candidate={candidate}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
