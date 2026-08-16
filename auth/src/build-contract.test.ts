import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("auth static build configuration", () => {
  it("fails instead of emitting a login shell with no public identity configuration", () => {
    const result = spawnSync(
      process.execPath,
      [resolve("node_modules/vite/bin/vite.js"), "build"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { PATH: process.env["PATH"] ?? "" },
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Authentication configuration is unavailable");
  });
});
