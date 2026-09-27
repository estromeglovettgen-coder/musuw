#!/usr/bin/env python3
"""The limited-evidence release guard accepts only its reviewed tuple."""
from pathlib import Path
import subprocess
import sys
import unittest


SCRIPT = Path(__file__).with_name("verify-reviewed-curated-release.py")
CANDIDATE = "19faaa073c1018ab8ebf699b841585feed38f728"
BASELINE = "16d503fb9fc1c6ca4653e90406117eab457650b4"
STAGING_RUN = "36318675629"


class ReviewedCuratedRelease(unittest.TestCase):
    def invoke(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_accepts_only_the_reviewed_tuple_without_full_e2e_claim(self) -> None:
        result = self.invoke(CANDIDATE, BASELINE, STAGING_RUN)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("full_sandbox_e2e=false", result.stdout)
        self.assertIn("acceptance=limited", result.stdout)

    def test_rejects_different_candidate_baseline_or_staging_run(self) -> None:
        for args in (
            ("main", BASELINE, STAGING_RUN),
            ("a" * 40, BASELINE, STAGING_RUN),
            (CANDIDATE, "b" * 40, STAGING_RUN),
            (CANDIDATE, BASELINE, "36318675630"),
            (CANDIDATE, BASELINE),
            (CANDIDATE, BASELINE, STAGING_RUN, "extra"),
        ):
            with self.subTest(args=args):
                result = self.invoke(*args)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
