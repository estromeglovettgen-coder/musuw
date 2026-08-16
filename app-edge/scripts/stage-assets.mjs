import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appEdgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(process.env.MUSUW_SOURCE_ROOT ?? path.join(appEdgeRoot, ".."));
const frontendDist = path.join(sourceRoot, "weknora", "frontend", "dist");
const authDist = path.join(sourceRoot, "auth", "dist");
const publicRoot = path.join(appEdgeRoot, "public");

async function listFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, entryRelative));
    } else if (entry.isFile()) {
      files.push(entryRelative);
    }
  }
  return files;
}

async function manifest(root) {
  const files = (await listFiles(root)).sort();
  const hash = createHash("sha256");
  for (const relative of files) {
    hash.update(relative.replaceAll(path.sep, "/"));
    hash.update("\0");
    hash.update(await readFile(path.join(root, relative)));
  }
  return { files: files.length, sha256: hash.digest("hex") };
}

async function assertRealDist(root, label) {
  const indexPath = path.join(root, "index.html");
  const index = await readFile(indexPath);
  if (index.length === 0) throw new Error(`${label} dist/index.html is empty`);
  const result = await manifest(root);
  if (result.files === 0 || result.sha256.length !== 64) {
    throw new Error(`${label} dist manifest is empty or invalid`);
  }
  return result;
}

async function stage() {
  const frontend = await assertRealDist(frontendDist, "frontend");
  const auth = await assertRealDist(authDist, "auth");
  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(publicRoot, { recursive: true });
  await cp(frontendDist, publicRoot, { recursive: true, force: true, errorOnExist: false });
  await cp(authDist, path.join(publicRoot, "auth"), { recursive: true, force: true, errorOnExist: false });
  const output = await assertRealDist(publicRoot, "staged frontend");
  const outputAuth = await manifest(path.join(publicRoot, "auth"));
  if (outputAuth.files === 0 || outputAuth.sha256.length !== 64) {
    throw new Error("staged auth manifest is empty or invalid");
  }
  process.stdout.write(`${JSON.stringify({
    staged: { frontend: frontendDist, auth: authDist, output: publicRoot },
    manifests: { frontend, auth, output, outputAuth },
  })}\n`);
}

stage().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
