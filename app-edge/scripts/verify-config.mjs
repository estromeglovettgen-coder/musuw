import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await readFile(path.join(root, "wrangler.jsonc"), "utf8");

const required = [
  '"name": "musuw-app"',
  '"directory": "./public"',
  '"binding": "ASSETS"',
  '"run_worker_first": true',
  '"name": "musuw-app-staging"',
  '"workers_dev": true',
  '"name": "musuw-app"',
  '"pattern": "app.musuw.com/*"',
];
for (const marker of required) {
  if (!config.includes(marker)) throw new Error(`wrangler config missing ${marker}`);
}

const stagingStart = config.indexOf('"staging":');
const productionStart = config.indexOf('"production":');
if (stagingStart < 0 || productionStart < 0 || stagingStart > productionStart) {
  throw new Error("staging and production environments must be present in order");
}
const staging = config.slice(stagingStart, productionStart);
if (staging.includes('"pattern": "app.musuw.com/*"')) {
  throw new Error("staging environment must not target app.musuw.com");
}
if (!config.slice(productionStart).includes('"pattern": "app.musuw.com/*"')) {
  throw new Error("production environment must retain app.musuw.com route");
}
process.stdout.write("app-edge wrangler config contract green\n");
