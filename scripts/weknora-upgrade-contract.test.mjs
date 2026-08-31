import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const weknoraRoot = path.join(repositoryRoot, "weknora");

const expectedPostgresMigrations = [
  "000094_knowledge_base_auto_tag_config",
  "000095_message_artifacts",
  "000096_tenant_sandbox_config",
  "000097_session_sandbox_config",
  "000098_memory",
  "000099_message_usage",
  "000100_tenant_skills",
  "000101_skill_install_transcript",
  "000102_skill_snapshot_planned_name",
  "000103_env_vars",
  "000104_skill_catalog",
];

const expectedSqliteMigrations = [
  "000013_knowledge_base_auto_tag_config",
  "000014_memory",
  "000015_messages_attachments_and_invitation_fields",
  "000016_task_queue_and_dead_letters",
  "000017_system_admin_and_settings",
  "000018_processing_spans_and_pending_subtasks",
  "000019_embed_channel_memory_flag",
  "000020_knowledge_multi_tags",
  "000021_principal_model",
  "000022_message_usage",
];

async function assertMigrationPairs(directory, expectedStems) {
  const names = new Set(await readdir(directory));
  for (const stem of expectedStems) {
    assert.ok(names.has(`${stem}.up.sql`), `missing ${stem}.up.sql`);
    assert.ok(names.has(`${stem}.down.sql`), `missing ${stem}.down.sql`);
  }

  const directionsByVersion = new Map();
  for (const name of names) {
    const match = /^(\d{6})_.+\.(up|down)\.sql$/.exec(name);
    if (!match) continue;
    const [, version, direction] = match;
    const directions = directionsByVersion.get(version) ?? new Set();
    assert.ok(
      !directions.has(direction),
      `migration version ${version} has more than one ${direction} meaning`,
    );
    directions.add(direction);
    directionsByVersion.set(version, directions);
  }

  for (const [version, directions] of directionsByVersion) {
    assert.deepEqual(
      [...directions].sort(),
      ["down", "up"],
      `migration version ${version} must have an up/down pair`,
    );
  }
}

test("the vendored kernel provenance pins the requested official commit", async () => {
  const provenance = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        "third_party/weknora/active-upstream-source.json",
      ),
      "utf8",
    ),
  );

  assert.equal(
    provenance.commit,
    "81142dfd17b2778087e95d3a317483a2fd909b91",
  );
  assert.equal(provenance.sourceDirectory, "weknora");
  assert.equal(provenance.import.latestMigration, 104);
});

test("Musuw migration meanings remain fixed and upstream migrations append", async () => {
  await assertMigrationPairs(
    path.join(weknoraRoot, "migrations/versioned"),
    expectedPostgresMigrations,
  );
  await assertMigrationPairs(
    path.join(weknoraRoot, "migrations/sqlite"),
    expectedSqliteMigrations,
  );

  const postgresNames = new Set(
    await readdir(path.join(weknoraRoot, "migrations/versioned")),
  );
  assert.ok(postgresNames.has("000080_default_searxng_provider.up.sql"));
  assert.ok(postgresNames.has("000093_complimentary_entitlements.up.sql"));
  assert.ok(!postgresNames.has("000080_knowledge_base_auto_tag_config.up.sql"));

  const sqliteNames = new Set(
    await readdir(path.join(weknoraRoot, "migrations/sqlite")),
  );
  assert.ok(sqliteNames.has("000003_consumer_plan_entitlements.up.sql"));
  assert.ok(sqliteNames.has("000012_complimentary_entitlements.up.sql"));
  assert.ok(!sqliteNames.has("000003_knowledge_base_auto_tag_config.up.sql"));
});

test("representative fixed-target capabilities are present at their owning modules", async () => {
  await Promise.all(
    [
      "internal/application/service/memory/service.go",
      "internal/sandbox/capabilities.go",
      "internal/agent/skills/env_resolver.go",
      "frontend/src/views/settings/MemorySettings.vue",
      "frontend/src/views/settings/SandboxSettings.vue",
      "frontend/src/views/settings/SkillSettings.vue",
      "docreader/parser/docx_merge.py",
      "packages/dsh-weknora/package.json",
    ].map((relativePath) => access(path.join(weknoraRoot, relativePath))),
  );
});
