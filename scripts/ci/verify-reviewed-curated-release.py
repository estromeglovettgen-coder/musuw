#!/usr/bin/env python3
"""Limit one reviewed creator-marketplace/curated-import release to its evidence.

The workflow separately verifies green CI, main ancestry, the live production
baseline, matching staged image digests and the server-production reviewer.
This guard does not assert full Paddle Sandbox lifecycle acceptance.
"""
import sys


REVIEWED_RELEASE = (
    "19faaa073c1018ab8ebf699b841585feed38f728",
    "16d503fb9fc1c6ca4653e90406117eab457650b4",
    "36318675629",
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
