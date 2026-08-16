import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appEdgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appEdgeRoot, "..");
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "deploy-app-edge-staging.yml");
const workflow = await readFile(workflowPath, "utf8");
const bundleCheck = await readFile(path.join(appEdgeRoot, "scripts", "verify-bundle.mjs"), "utf8");

function requireContract(condition, message) {
  if (!condition) throw new Error(`staging workflow contract: ${message}`);
}

requireContract(workflow.includes("  pull_request:"), "must check pull_request events");
requireContract(!workflow.includes("pull_request_target"), "must not use pull_request_target");
requireContract(workflow.includes("permissions:\n  contents: read\n  actions: read"), "must grant only read-only contents/actions permissions");

const deployMarker = "\n  deploy:\n";
const deployIndex = workflow.indexOf(deployMarker);
requireContract(deployIndex > 0, "must define a separate deploy job");
const verify = workflow.slice(0, deployIndex);
const deploy = workflow.slice(deployIndex);

// PR checks are intentionally secret-free. A fork PR can execute this entire
// section, but it cannot satisfy the manual, canonical-repository deploy gate.
requireContract(!verify.includes("secrets."), "verify job must not read secrets");
requireContract(verify.includes("persist-credentials: false"), "verify checkout must not persist the GitHub token");
requireContract(deploy.includes("persist-credentials: false"), "deploy checkout must not persist the GitHub token");
requireContract(
  deploy.includes("github.event_name == 'workflow_dispatch' && inputs.deploy == true") &&
    deploy.includes("github.repository == 'estromeglovettgen-coder/musuw'") &&
    deploy.includes("github.ref == 'refs/heads/main'"),
  "deploy job must require manual deploy=true from canonical main",
);
const ciGateIndex = deploy.indexOf("actions/runs?head_sha=");
const cloudflareCredentialIndex = deploy.indexOf("CLOUDFLARE_API_TOKEN");
requireContract(ciGateIndex >= 0, "deploy must query Actions runs for the requested SHA");
requireContract(
  deploy.includes(".name == \"CI\"") &&
    deploy.includes(".head_sha == $sha") &&
    deploy.includes(".conclusion == \"success\""),
  "deploy must require a successful CI run with the exact requested SHA",
);
requireContract(
  cloudflareCredentialIndex < 0 || ciGateIndex < cloudflareCredentialIndex,
  "the exact-SHA CI gate must run before Cloudflare credentials are exposed",
);
requireContract(deploy.includes("--env staging"), "deploy must target staging");
requireContract(!deploy.includes("--env production"), "workflow must never deploy production");
requireContract(!deploy.includes("app.musuw.com/*"), "workflow must not alter the production route");
requireContract(deploy.includes("secrets.CLOUDFLARE_API_TOKEN") && deploy.includes("secrets.CLOUDFLARE_ACCOUNT_ID"), "deploy must use scoped Cloudflare secrets only after the gate");
requireContract(deploy.includes("GH_READ_TOKEN: ${{ github.token }}"), "main ancestry fetch must use the read-only workflow token");
requireContract(deploy.includes('git -c http.extraheader="AUTHORIZATION: bearer $GH_READ_TOKEN" fetch --no-tags origin main'), "main ancestry fetch must not persist credentials");
requireContract(deploy.includes("MUSUW_AUTH_STAGING_PUBLIC_ENV: ${{ secrets.MUSUW_AUTH_STAGING_PUBLIC_ENV }}"), "deploy must source auth public env from the dedicated staging repository secret");
requireContract(!deploy.includes("MUSUW_AUTH_PUBLIC_ENV: ${{ secrets.MUSUW_AUTH_PUBLIC_ENV }}"), "staging deploy must not reuse the production auth public env secret");
requireContract(deploy.includes("auth_env=\"$RUNNER_TEMP/musuw-auth-public.env\""), "auth public env must use RUNNER_TEMP");
requireContract(deploy.includes("chmod 600 \"$auth_env\""), "auth public env file must be mode 0600");
requireContract(deploy.includes("trap cleanup EXIT") && deploy.includes("rm -f \"$auth_env\""), "auth public env temp file must be removed on every exit");
for (const key of ["VITE_AUTH_PUBLIC_ORIGIN", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_WEKNORA_OAUTH_CLIENT_ID"]) {
  requireContract(deploy.includes(`expected[\"${key}\"] = 1`), `auth public env parser must require ${key}`);
}
requireContract(deploy.includes("if (lines != 4) bad = 1"), "auth public env parser must require exactly four assignments");
requireContract(
  deploy.includes('test "$auth_public_origin" = "https://staging-app.musuw.com"'),
  "staging auth public origin must be exact",
);
requireContract(deploy.includes("npm --prefix auth run build"), "deploy must rebuild auth with the canonical public environment");
requireContract(deploy.includes("npm --prefix app-edge run bundle:check"), "deploy must scan the staged bundle");
requireContract(bundleCheck.includes("ci-placeholder") && bundleCheck.includes("example.supabase"), "bundle scan must reject CI/example placeholders");

process.stdout.write("app-edge staging workflow contract green\n");
