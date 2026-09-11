#!/usr/bin/env python3
"""Tests for the immutable UI-only release scope gate."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("verify-ui-release-scope.py")
SOURCE_ROOT = SCRIPT.resolve().parents[2]


class UiReleaseScopeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix="musuw-ui-scope-")
        self.repo = Path(self.temp_dir.name)
        self.git("init", "--quiet")
        self.git("config", "user.email", "ui-scope@example.test")
        self.git("config", "user.name", "UI scope test")
        self.write("README.md", "fixture\n")
        self.write(
            "package.json",
            json.dumps({"name": "fixture", "scripts": {"test": "true"}}, indent=2) + "\n",
        )
        self.base = self.commit("base")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def git(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            ["git", *args],
            cwd=self.repo,
            text=True,
            capture_output=True,
            check=False,
        )
        if check and result.returncode != 0:
            self.fail(f"git {' '.join(args)} failed: {result.stderr}")
        return result

    def write(self, relative: str, content: str) -> None:
        path = self.repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit(self, message: str) -> str:
        self.git("add", "--all")
        self.git("commit", "--quiet", "-m", message)
        return self.git("rev-parse", "HEAD").stdout.strip()

    def run_scope(self, baseline: str, candidate: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), baseline, candidate],
            cwd=self.repo,
            text=True,
            capture_output=True,
            check=False,
        )

    def assert_scope_passes(self, result: subprocess.CompletedProcess[str]) -> None:
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertRegex(
            result.stdout,
            r"^count=\d+ baseline=[0-9a-f]{40} candidate=[0-9a-f]{40}\n?$",
        )
        self.assertNotIn("weknora/", result.stdout)
        self.assertNotIn("storefront/", result.stdout)

    def assert_scope_rejects(self, result: subprocess.CompletedProcess[str]) -> None:
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_unchanged_commit_is_allowed(self) -> None:
        self.assert_scope_passes(self.run_scope(self.base, self.base))

    def test_all_declared_ui_categories_are_allowed(self) -> None:
        paths = [
            "weknora/frontend/src/assets/example.css",
            "weknora/frontend/src/components/Example.vue",
            "weknora/frontend/src/i18n/locales/example.ts",
            "weknora/frontend/src/views/chat/example.vue",
            "weknora/frontend/src/views/knowledge/example.vue",
            "weknora/frontend/e2e/example.spec.ts",
            "e2e/session-batch-manage.spec.ts",
            "playwright.session-batch.config.ts",
            ".github/workflows/ci.yml",
            "third_party/weknora/upgrades/81142df/resolution-ledger.tsv",
            "third_party/weknora/upgrades/81142df/resolution-overrides.tsv",
            "third_party/weknora/upgrades/81142df/resolution-summary.json",
            "storefront/example.js",
        ]
        for index, path in enumerate(paths):
            self.write(path, f"fixture {index}\n")
        candidate = self.commit("allowed UI changes")
        self.assert_scope_passes(self.run_scope(self.base, candidate))

    def test_package_json_allows_only_batch_script_change(self) -> None:
        package = {"name": "fixture", "scripts": {"test": "true", "app:e2e:batch": "playwright test"}}
        self.write("package.json", json.dumps(package, indent=2) + "\n")
        candidate = self.commit("add batch acceptance script")
        self.assert_scope_passes(self.run_scope(self.base, candidate))

    def test_reviewed_presentation_and_delivery_content_is_allowed(self) -> None:
        for path in (
            "auth/src/AuthShowcase.tsx",
            "auth/src/LiquidEther.tsx",
            "auth/e2e/background-stability.spec.ts",
            "e2e/billing-entitlement.spec.ts",
            ".github/workflows/deploy-production.yml",
            "docs/STAGING_OPERATIONS.md",
        ):
            self.write(path, (SOURCE_ROOT / path).read_text(encoding="utf-8"))
        candidate = self.commit("reviewed UI and delivery content")
        self.assert_scope_passes(self.run_scope(self.base, candidate))

    def test_reviewed_paths_reject_unreviewed_content_and_deletion(self) -> None:
        baseline = self.base
        for path in ("auth/src/AuthShowcase.tsx", ".github/workflows/deploy-production.yml"):
            with self.subTest(path=path):
                self.write(path, "unreviewed executable content\n")
                candidate = self.commit("unreviewed content at a reviewed path")
                self.assert_scope_rejects(self.run_scope(baseline, candidate))
                baseline = candidate
        path = "auth/src/LiquidEther.tsx"
        self.write(path, (SOURCE_ROOT / path).read_text(encoding="utf-8"))
        baseline = self.commit("reviewed renderer")
        self.git("rm", path)
        candidate = self.commit("delete renderer")
        self.assert_scope_rejects(self.run_scope(baseline, candidate))

    def test_ui_exception_does_not_allow_auth_flow_payment_or_runtime_changes(self) -> None:
        baseline = self.base
        for path in (
            "auth/src/AuthApp.tsx", "auth/src/authClient.ts", "auth/src/config.ts",
            "auth/package.json", "auth/package-lock.json", "auth/vite.config.ts",
            "weknora/frontend/src/api/billing.ts",
            "weknora/frontend/src/components/BillingDrawer.vue",
            "weknora/internal/handler/knowledge.go",
            "weknora/migrations/unsafe.sql",
            "integration/weknora-production/compose.yaml",
            "scripts/weknora-production/release-ci.sh",
        ):
            with self.subTest(path=path):
                self.write(path, "unreviewed runtime change\n")
                candidate = self.commit("runtime change")
                self.assert_scope_rejects(self.run_scope(baseline, candidate))
                baseline = candidate

    def test_reviewed_path_still_rejects_symlink(self) -> None:
        link = self.repo / "auth/src/AuthShowcase.tsx"
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to("../../README.md")
        candidate = self.commit("reviewed path replaced by symlink")
        self.assert_scope_rejects(self.run_scope(self.base, candidate))

    def test_reviewed_content_rejects_executable_mode_changes(self) -> None:
        self.git("config", "core.filemode", "true")
        path = "scripts/weknora-workflow-simulation.test.sh"
        self.write(path, (SOURCE_ROOT / path).read_text(encoding="utf-8"))
        target = self.repo / path
        target.chmod(0o644)
        baseline = self.commit("reviewed content")
        for mode in (0o755, 0o644):
            with self.subTest(mode=oct(mode)):
                target.chmod(mode)
                candidate = self.commit("change executable mode only")
                self.assert_scope_rejects(self.run_scope(baseline, candidate))
                baseline = candidate

    def test_package_json_rejects_any_other_change(self) -> None:
        package = {"name": "changed", "scripts": {"test": "true", "app:e2e:batch": "playwright test"}}
        self.write("package.json", json.dumps(package, indent=2) + "\n")
        candidate = self.commit("change package metadata")
        self.assert_scope_rejects(self.run_scope(self.base, candidate))

    def test_backend_billing_lock_dependency_and_build_paths_are_rejected(self) -> None:
        paths = [
            "weknora/backend/api.go",
            "auth/server.ts",
            "weknora/locks/release.lock",
            "weknora/frontend/src/views/knowledge/billing/Panel.vue",
            "weknora/frontend/package.json",
            "package-lock.json",
            "scripts/build-runtime-config.sh",
        ]
        for index, path in enumerate(paths):
            self.write(path, f"rejected {index}\n")
        candidate = self.commit("out of scope changes")
        self.assert_scope_rejects(self.run_scope(self.base, candidate))

    def test_frontend_sensitive_names_are_rejected_even_under_allowed_tree(self) -> None:
        for index, term in enumerate(("billing", "payment", "checkout", "entitlement", "subscription", "auth", "openrouter")):
            self.write(f"weknora/frontend/src/components/{term}-surface-{index}.vue", "rejected\n")
        candidate = self.commit("sensitive frontend changes")
        self.assert_scope_rejects(self.run_scope(self.base, candidate))

    def test_changed_symlink_is_rejected(self) -> None:
        link = self.repo / "weknora/frontend/src/assets/link"
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to("../../../../README.md")
        candidate = self.commit("symlink")
        self.assert_scope_rejects(self.run_scope(self.base, candidate))

    def test_changed_submodule_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="musuw-ui-submodule-") as nested_dir:
            nested = Path(nested_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=nested, check=True)
            subprocess.run(["git", "config", "user.email", "nested@example.test"], cwd=nested, check=True)
            subprocess.run(["git", "config", "user.name", "nested"], cwd=nested, check=True)
            (nested / "README.md").write_text("nested\n", encoding="utf-8")
            subprocess.run(["git", "add", "README.md"], cwd=nested, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "nested"], cwd=nested, check=True)
            nested_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=nested, text=True).strip()
        path = "weknora/frontend/src/assets/submodule"
        self.git("update-index", "--add", "--cacheinfo", f"160000,{nested_sha},{path}")
        self.git("commit", "--quiet", "-m", "submodule")
        candidate = self.git("rev-parse", "HEAD").stdout.strip()
        self.assert_scope_rejects(self.run_scope(self.base, candidate))

    def test_baseline_must_be_ancestor_and_shas_must_be_full_existing_commits(self) -> None:
        self.write("weknora/frontend/src/assets/candidate.css", "candidate\n")
        candidate = self.commit("candidate")
        self.assert_scope_rejects(self.run_scope(candidate, self.base))
        self.assert_scope_rejects(self.run_scope(self.base[:7], candidate))
        self.assert_scope_rejects(self.run_scope("0" * 40, candidate))
        self.assert_scope_rejects(self.run_scope(self.base, "f" * 40))


if __name__ == "__main__":
    unittest.main(verbosity=2)
