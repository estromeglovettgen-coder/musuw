import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appEdgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(appEdgeRoot, "public");
const forbidden = ["ci-placeholder", "example.supabase"];

async function files(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await files(root, child));
    else if (entry.isFile()) result.push(child);
  }
  return result;
}

const violations = [];
for (const relative of await files(publicRoot)) {
  const content = (await readFile(path.join(publicRoot, relative))).toString("utf8");
  for (const marker of forbidden) {
    if (content.includes(marker)) violations.push(`${relative}: ${marker}`);
  }
}

if (violations.length > 0) {
  throw new Error(`published bundle contains forbidden placeholder markers:\n${violations.join("\n")}`);
}
process.stdout.write("app-edge published bundle contract green\n");
