#!/usr/bin/env python3
"""Limit the reviewed login/performance release to its exact recorded evidence.

The workflow separately verifies green CI, main ancestry, the live production
baseline, matching staged image digests and the server-production reviewer.
This guard does not assert full Paddle Sandbox lifecycle acceptance.
"""
import sys


# Exact candidate and successful staging run from the completed targeted
# acceptance in docs/LOGIN_EXPERIENCE_RELEASE_20260928.md.
# This permission cannot be reused for a different release or baseline.
REVIEWED_RELEASE: tuple[str | None, str, str | None] = (
    "627dcce5433ac9e01a4339bfefa600c5e9784d1d",
    "cce10cdce69731a9b2142e9176a3dcaffafab948",
    "36500677060",
)


def main(args: list[str]) -> int:
    if tuple(args) != REVIEWED_RELEASE:
        print(
            "curated release rejected: candidate, production baseline or "
            "staging run is not the reviewed tuple",
            file=sys.stderr,
        )
        return 1
    print(
        "reviewed-curated-release scope matched; "
        "acceptance=limited; full_sandbox_e2e=false; owner_review=required"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
