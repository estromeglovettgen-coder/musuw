#!/usr/bin/env node
/**
 * Verify the checked-in WeKnora source identity without rebuilding historical
 * snapshots.  Local Musuw additions are allowed; the imported upstream floor
 * and its provenance fields must remain present and internally consistent.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const sourceRoot = resolve(repositoryRoot, "weknora");
const provenancePath = resolve(repositoryRoot, "third_party/weknora/v0.7.2-provenance.json");
const activeSourcePath = resolve(repositoryRoot, "third_party/weknora/active-upstream-source.json");

function fail(message) {
  throw new Error(`source manifest: ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${relative(repositoryRoot, path)}: ${error.message}`);
  }
}

function trackedSourceFiles() {
  let output;
  try {
    output = execFileSync("git", ["ls-files", "-z", "--", "weknora"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
  } catch (error) {
    fail(`cannot enumerate Git-tracked source: ${error.message}`);
  }
  return output.split("\0").filter(Boolean);
}

if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) fail("weknora source directory is missing");
const provenance = readJson(provenancePath);
const active = readJson(activeSourcePath);

for (const [label, value] of [["provenance", provenance], ["active source", active]]) {
  if (value?.schemaVersion !== 1) fail(`${label} schemaVersion must be 1`);
  if (value?.sourceDirectory !== "weknora") fail(`${label} sourceDirectory must be weknora`);
}

const upstream = provenance.upstream;
if (upstream?.tag !== "v0.7.2" || upstream?.commit !== active.commit || active.tag !== "v0.7.2") {
  fail("upstream tag/commit identity is inconsistent");
}
if (active.repository !== "https://github.com/Tencent/WeKnora.git") {
  fail("active upstream repository is not Tencent/WeKnora");
}
if (provenance.officialTrackedPathCount !== 2798) {
  fail("reviewed upstream file-count floor changed unexpectedly");
}
const trackedFiles = trackedSourceFiles();
const fileCount = trackedFiles.length;
if (fileCount < provenance.officialTrackedPathCount) {
  fail(`source tree is incomplete (${fileCount} files below ${provenance.officialTrackedPathCount})`);
}

const nestedGit = trackedFiles.filter((path) => path.split("/").includes(".git"));
if (nestedGit.length > 0) fail(`nested Git metadata is present: ${nestedGit.join(", ")}`);

const goMod = readFileSync(resolve(sourceRoot, "go.mod"), "utf8");
if (!/^module github\.com\/Tencent\/WeKnora$/mu.test(goMod)) {
  fail("active source go.mod module identity is unexpected");
}

console.log(
  `source manifest green: ${active.tag} ${active.commit} ` +
    `(${fileCount} active source files; ${provenance.officialTrackedPathCount} upstream floor)`,
);
