#!/usr/bin/env ruby
# frozen_string_literal: true

# Syntax and policy contract for the repository's delivery workflows. This is
# intentionally dependency-free so a clean GitHub runner can validate YAML
# before installing application dependencies.

require "psych"
require "json"

ROOT = File.expand_path("../..", __dir__)
WORKFLOW_DIR = File.join(ROOT, ".github", "workflows")
EXPECTED = %w[ci.yml deploy-storefront.yml deploy-production.yml].freeze

def fail_contract(message)
  warn "workflow contract: #{message}"
  exit 1
end

def parse_yaml(path)
  Psych.safe_load(File.read(path), aliases: false, permitted_classes: [], permitted_symbols: [])
rescue Psych::Exception => error
  fail_contract "#{path}: invalid YAML: #{error.message}"
end

def root_key(document, key)
  # Psych follows YAML 1.1 and parses the unquoted GitHub `on` key as true.
  document[key] || (key == "on" ? document[true] : nil)
end

def assert_hash(value, label)
  fail_contract "#{label} must be a mapping" unless value.is_a?(Hash)
end

def assert_trigger(document, label)
  trigger = root_key(document, "on")
  fail_contract "#{label} has no on trigger" if trigger.nil?
  fail_contract "#{label} uses pull_request_target" if trigger.to_s.include?("pull_request_target")
end

def walk_uses(value, result = [])
  case value
  when Hash
    value.each_value { |child| walk_uses(child, result) }
  when Array
    value.each { |child| walk_uses(child, result) }
  when String
    result << value if value.start_with?("actions/", "astral-sh/", "cloudflare/", "docker/") && value.include?("@")
  end
  result
end

paths = EXPECTED.map { |name| File.join(WORKFLOW_DIR, name) }
paths.each { |path| fail_contract "missing #{path}" unless File.file?(path) }

documents = paths.to_h { |path| [File.basename(path), parse_yaml(path)] }
documents.each do |name, document|
  assert_hash(document, name)
  assert_trigger(document, name)
  permissions = document["permissions"]
  assert_hash(permissions, "#{name}.permissions")
  expected_permissions = case name
  when "deploy-storefront.yml"
    { "contents" => "read", "actions" => "read" }
  when "deploy-production.yml"
    { "contents" => "read", "actions" => "read", "packages" => "write" }
  else
    { "contents" => "read" }
  end
  fail_contract "#{name} grants permissions outside its contract" unless permissions == expected_permissions
  walk_uses(document).each do |reference|
    ref = reference.split("@", 2).last
    fail_contract "#{name} has an unpinned action #{reference}" unless ref.match?(%r{\Av\d+(?:\.\d+(?:\.\d+)?)?\z|\A[0-9a-f]{40}\z})
  end
end

ci = documents.fetch("ci.yml")
ci_on = root_key(ci, "on")
fail_contract "ci.yml must run on pull requests" unless ci_on.key?("pull_request")
fail_contract "ci.yml must run on pushes to main" unless ci_on.dig("push", "branches") == ["main"]
fail_contract "ci.yml must cancel superseded runs" unless ci.dig("concurrency", "cancel-in-progress") == true
required_ci_paths = %w[openspec/** AGENTS.md README.md THIRD_PARTY_NOTICES.md SOURCE_MANIFEST* *PROVENANCE* docs/DEPLOYMENT.md]
%w[pull_request push].each do |trigger|
  configured = Array(ci_on.dig(trigger, "paths"))
  missing = required_ci_paths.reject { |path| configured.include?(path) }
  fail_contract "ci.yml #{trigger} paths omit delivery authority: #{missing.join(", ")}" unless missing.empty?
end
ci_text = File.read(File.join(WORKFLOW_DIR, "ci.yml"))
frontend_steps = Array(ci.dig("jobs", "frontend", "steps"))
frontend_build = frontend_steps.find { |step| step.is_a?(Hash) && step["name"] == "Build frontend" }
fail_contract "frontend build must pin NODE_OPTIONS to a 4096 MiB heap" unless frontend_build&.dig("env", "NODE_OPTIONS") == "--max-old-space-size=4096"
fail_contract "frontend tests must not inherit the build-only NODE_OPTIONS override" if ci.dig("jobs", "frontend", "env", "NODE_OPTIONS")

docreader_steps = Array(ci.dig("jobs", "docreader", "steps"))
setup_python = docreader_steps.find { |step| step.is_a?(Hash) && step["uses"].to_s.start_with?("actions/setup-python@") }
fail_contract "DocReader setup-python must not request the unavailable pip cache" if setup_python&.dig("with", "cache") == "pip"
fail_contract "DocReader setup-python must not retain a pip cache dependency path" if setup_python&.dig("with", "cache-dependency-path")
setup_uv = docreader_steps.find { |step| step.is_a?(Hash) && step["uses"].to_s.start_with?("astral-sh/setup-uv@") }
fail_contract "DocReader must use setup-uv's cache instead of setup-python pip cache" unless setup_uv&.dig("with", "enable-cache") == true
tracked_scan_path = File.join(ROOT, "scripts", "ci", "tracked-source-scan.mjs")
fail_contract "tracked publish-boundary scanner is missing" unless File.file?(tracked_scan_path)
fail_contract "tracked publish-boundary scanner is not executable" unless File.executable?(tracked_scan_path)
fail_contract "repository contracts do not run the tracked publish-boundary scanner" unless ci_text.include?("node scripts/ci/tracked-source-scan.mjs")
fail_contract "repository contracts reference excluded legacy architecture tests" if ci_text.include?("tests/architecture/")
fail_contract "canonical CI omits the direct deployment seam contract" unless ci_text.include?("bash scripts/weknora-production/deploy-ci-seams-contract.test.sh")
fail_contract "canonical CI omits the restricted gate simulation" unless ci_text.include?("bash scripts/weknora-production/musuw-deploy-gate-simulation.test.sh")
tracked_scan_text = File.read(tracked_scan_path)
%w[server desktop dist node_modules .runtime keys].each do |sentinel|
  fail_contract "tracked publish-boundary scanner does not cover #{sentinel}" unless tracked_scan_text.include?(sentinel)
end
source_manifest_text = File.read(File.join(ROOT, "scripts", "ci", "source-manifest.mjs"))
fail_contract "source manifest must count Git-tracked source instead of local dependency output" unless source_manifest_text.include?("ls-files")

storefront = documents.fetch("deploy-storefront.yml")
storefront_on = root_key(storefront, "on")
storefront_workflow_run = storefront_on.fetch("workflow_run", {})
fail_contract "storefront deploy must listen for completed CI workflow runs on main" unless storefront_workflow_run.dig("workflows") == ["CI"] && storefront_workflow_run.dig("types") == ["completed"] && storefront_workflow_run.dig("branches") == ["main"]
fail_contract "storefront deploy must retain a manual workflow_dispatch" unless storefront_on.key?("workflow_dispatch")
fail_contract "storefront deploy must have a build dependency" unless storefront.dig("jobs", "deploy", "needs") == "build"
fail_contract "storefront deploy must not cancel after Cloudflare mutation" unless storefront.dig("concurrency", "cancel-in-progress") == false
fail_contract "storefront deploy must use repository/org secrets, not environment-scoped secrets" if storefront.dig("jobs", "deploy", "environment")
storefront_dispatch = storefront_on.fetch("workflow_dispatch")
assert_hash(storefront_dispatch, "deploy-storefront.yml.workflow_dispatch")
storefront_input = storefront_dispatch.dig("inputs", "immutable_ref")
assert_hash(storefront_input, "deploy-storefront.yml.workflow_dispatch.inputs.immutable_ref")
fail_contract "storefront immutable_ref input must be required" unless storefront_input["required"] == true && storefront_input["type"] == "string"
storefront_text = File.read(File.join(WORKFLOW_DIR, "deploy-storefront.yml"))
wrangler_path = File.join(ROOT, "storefront", "wrangler.jsonc")
fail_contract "storefront wrangler config is missing" unless File.file?(wrangler_path)
wrangler_config = JSON.parse(File.read(wrangler_path).sub(%r{(^|\s)//.*$}, "\\1"))
fail_contract "storefront wrangler workers_dev must be disabled" unless wrangler_config["workers_dev"] == false
fail_contract "storefront wrangler preview_urls must be disabled" unless wrangler_config["preview_urls"] == false
fail_contract "storefront deploy must use Cloudflare credentials" unless storefront_text.include?("CLOUDFLARE_API_TOKEN") && storefront_text.include?("CLOUDFLARE_ACCOUNT_ID")
fail_contract "storefront deploy must annotate the Worker with the selected SHA" unless storefront_text.include?("--message") && storefront_text.include?("RELEASE_SHA") && storefront_text.include?("--tag")
fail_contract "storefront workflow_run must select workflow_run.head_sha and never github.sha" unless storefront_text.include?("github.event.workflow_run.head_sha") && !storefront_text.include?("github.sha")
fail_contract "storefront workflow_run must require canonical CI success" unless storefront_text.include?("github.repository == 'estromeglovettgen-coder/musuw'") && storefront_text.include?("github.event.workflow_run.name == 'CI'") && storefront_text.include?("github.event.workflow_run.conclusion == 'success'") && storefront_text.include?("github.event.workflow_run.head_branch == 'main'")
fail_contract "storefront dispatch must select an immutable checkout ref" unless storefront_text.include?("inputs.immutable_ref") && storefront_text.include?("git rev-parse HEAD")
fail_contract "storefront dispatch must require successful CI for the selected SHA" unless storefront_text.include?("actions/runs") && storefront_text.include?("workflow_dispatch") && storefront_text.include?(".name == \"CI\"") && storefront_text.include?(".conclusion == \"success\"")
fail_contract "storefront deploy must smoke-test both public aliases and locale" unless storefront_text.include?("https://musuw.com") && storefront_text.include?("https://www.musuw.com") && storefront_text.match?(/content-language/i) && storefront_text.include?("__MUSUW_LOCALE__")
fail_contract "storefront deploy must retain release evidence" unless storefront_text.include?("wrangler deployments list") && storefront_text.include?("upload-artifact") && storefront_text.include?("sha256")
fail_contract "storefront deploy must capture a pre-deploy version" unless storefront_text.include?("previous_version_id") && storefront_text.include?("versions")
fail_contract "storefront deploy/smoke failure must rollback and re-probe" unless storefront_text.include?("wrangler rollback") && storefront_text.include?("automatic Cloudflare rollback") && storefront_text.scan("https://musuw.com").length >= 2 && storefront_text.scan("https://www.musuw.com").length >= 2
fail_contract "storefront smoke must verify the product auth handoff reachability" unless storefront_text.include?("https://app.musuw.com/auth/start")

production = documents.fetch("deploy-production.yml")
production_on = root_key(production, "on")
fail_contract "production deploy must be manual or v* tag only" unless production_on.key?("workflow_dispatch") && production_on.dig("push", "tags") == ["v*"]
fail_contract "production deploy must have a rebuild dependency" unless production.dig("jobs", "deploy", "needs") == "rebuild"
fail_contract "production deploy must not cancel an active release" unless production.dig("concurrency", "cancel-in-progress") == false
fail_contract "production deploy must use repository/org secrets, not environment-scoped secrets" if production.dig("jobs", "deploy", "environment")
production_dispatch = production_on.fetch("workflow_dispatch")
assert_hash(production_dispatch, "deploy-production.yml.workflow_dispatch")
production_input = production_dispatch.dig("inputs", "immutable_ref")
assert_hash(production_input, "deploy-production.yml.workflow_dispatch.inputs.immutable_ref")
fail_contract "production immutable_ref input must be required" unless production_input["required"] == true && production_input["type"] == "string"
production_text = File.read(File.join(WORKFLOW_DIR, "deploy-production.yml"))
%w[WEKNORA_DEPLOY_KNOWN_HOSTS_FILE WEKNORA_DEPLOY_SSH_KEY WEKNORA_DEPLOY_REMOTE WEKNORA_DEPLOY_REVISION].each do |name|
  fail_contract "production deploy missing #{name} seam" unless production_text.include?(name)
end
fail_contract "production dispatch must be restricted to main" unless (production_text.include?("EVENT_REF") || production_text.include?("GITHUB_REF")) && production_text.include?("refs/heads/main") && production_text.include?("workflow_dispatch")
fail_contract "production deploy must resolve an immutable checkout input" unless production_text.include?("inputs.immutable_ref") && production_text.include?("git rev-parse HEAD")
fail_contract "production deploy must prove the revision belongs to origin/main" unless production_text.include?("origin/main") && production_text.include?("merge-base")
fail_contract "production tag releases must require annotated semver tags" unless production_text.include?("git cat-file -t") && production_text.include?("refs/tags/") && production_text.include?("v[0-9]+\\.[0-9]+\\.[0-9]+")
fail_contract "production deploy must require a successful CI run for the revision" unless production_text.include?("actions/runs") && production_text.include?("CI") && production_text.include?("conclusion")
fail_contract "production deploy must pin checkout to the resolved SHA" unless production_text.include?("ref: ${{ steps.resolve.outputs.release_sha }}") || production_text.include?("ref: ${{ needs.rebuild.outputs.release_sha }}")
fail_contract "production deploy must execute the direct SHA-only runner" unless production_text.include?("bash scripts/weknora-deploy.sh \"$WEKNORA_DEPLOY_REVISION\"") && production_text.include?("remote_gate prepare") && production_text.include?("remote_gate deploy")
fail_contract "production deploy must build and push both immutable GHCR images" unless production_text.include?("docker/build-push-action@") && production_text.include?("musuw-app:") && production_text.include?("musuw-frontend:") && production_text.include?("steps.build_app.outputs.digest") && production_text.include?("steps.build_frontend.outputs.digest")
fail_contract "production deploy must stream the short-lived GHCR token through the restricted runner" unless production_text.include?("WEKNORA_DEPLOY_GHCR_USERNAME") && production_text.include?("WEKNORA_DEPLOY_GHCR_TOKEN")
fail_contract "production rebuild must use the committed auth lockfile" unless production_text.include?("npm ci --prefix auth") && File.file?(File.join(ROOT, "auth", "package-lock.json"))
fail_contract "production rebuild must run the real static/release contracts" unless production_text.include?("scripts/weknora-production/verify-static.sh") && production_text.include?("deploy-ci-seams-contract.test.sh") && production_text.include?("compose.sh")
fail_contract "production deploy must assert the fixed release helper" unless production_text.include?("release-ci.sh") && production_text.include?("musuw-deploy-gate")
fail_contract "production deploy must retain release manifest/checksum evidence" unless production_text.include?("upload-artifact") && production_text.include?("sha256sum") && production_text.include?("source_manifest") && production_text.include?("source_bundle_sha256")
fail_contract "production success manifest must fail closed without server identity/checksum" unless production_text.include?("RELEASE_OUTCOME") && production_text.include?("test \"$server_release_id\" = \"$expected_release_id\"") && production_text.include?("=~ ^[0-9a-fA-F]{64}$")
fail_contract "production workflow must not use write permissions" if production_text.include?("contents: write") || production_text.include?("actions: write")

puts "workflow contract green: #{EXPECTED.join(", ")}"
