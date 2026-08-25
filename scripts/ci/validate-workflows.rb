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
expected_runner = "${{ vars.MUSUW_ACTIONS_RUNNER || 'ubuntu-latest' }}"
documents.each do |name, document|
  assert_hash(document, name)
  assert_trigger(document, name)
  permissions = document["permissions"]
  assert_hash(permissions, "#{name}.permissions")
  expected_permissions = case name
  when "deploy-storefront.yml"
    { "contents" => "read", "actions" => "read" }
  when "deploy-production.yml"
    { "contents" => "read", "actions" => "read" }
  else
    { "contents" => "read" }
  end
  fail_contract "#{name} grants permissions outside its contract" unless permissions == expected_permissions
  walk_uses(document).each do |reference|
    ref = reference.split("@", 2).last
    fail_contract "#{name} has an unpinned action #{reference}" unless ref.match?(%r{\Av\d+(?:\.\d+(?:\.\d+)?)?\z|\A[0-9a-f]{40}\z})
  end
  document.fetch("jobs").each do |job_name, job|
    next unless job.is_a?(Hash)
    next if name == "deploy-production.yml"

    fail_contract "#{name}.jobs.#{job_name} must retain the existing runner-variable fallback" unless job["runs-on"] == expected_runner
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

expected_npm_cache_policy = "${{ vars.MUSUW_ACTIONS_RUNNER == '' && 'npm' || '' }}"
{
  "frontend" => "weknora/frontend/package-lock.json",
  "auth" => "auth/package-lock.json",
  "storefront" => "storefront/package-lock.json",
  "repository-contracts" => "package-lock.json"
}.each do |job_name, dependency_path|
  setup_node = Array(ci.dig("jobs", job_name, "steps")).find { |step| step.is_a?(Hash) && step["uses"].to_s.start_with?("actions/setup-node@") }
  fail_contract "self-hosted #{job_name} CI must reuse its persistent npm cache without restoring or uploading a duplicate Actions cache" unless setup_node&.dig("with", "cache") == expected_npm_cache_policy && setup_node&.dig("with", "cache-dependency-path") == dependency_path
end

go_steps = Array(ci.dig("jobs", "go", "steps"))
setup_go = go_steps.find { |step| step.is_a?(Hash) && step["uses"].to_s.start_with?("actions/setup-go@") }
expected_go_cache_policy = "${{ vars.MUSUW_ACTIONS_RUNNER == '' }}"
fail_contract "self-hosted Go CI must reuse its persistent local cache without restoring or uploading a duplicate Actions cache" unless setup_go&.dig("with", "cache") == expected_go_cache_policy && setup_go&.dig("with", "cache-dependency-path") == "weknora/go.sum"

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
%w[build deploy].each do |job_name|
  setup_node = Array(storefront.dig("jobs", job_name, "steps")).find { |step| step.is_a?(Hash) && step["uses"].to_s.start_with?("actions/setup-node@") }
  fail_contract "self-hosted storefront #{job_name} must reuse its persistent npm cache without restoring or uploading a duplicate Actions cache" unless setup_node&.dig("with", "cache") == expected_npm_cache_policy && setup_node&.dig("with", "cache-dependency-path") == "storefront/package-lock.json"
end
fail_contract "storefront deploy must listen for completed CI workflow runs on main" unless storefront_workflow_run.dig("workflows") == ["CI"] && storefront_workflow_run.dig("types") == ["completed"] && storefront_workflow_run.dig("branches") == ["main"]
fail_contract "storefront deploy must retain a manual workflow_dispatch" unless storefront_on.key?("workflow_dispatch")
fail_contract "storefront deploy must have a build dependency" unless storefront.dig("jobs", "deploy", "needs") == "build"
fail_contract "storefront deploy must not cancel after Cloudflare mutation" unless storefront.dig("concurrency", "cancel-in-progress") == false
fail_contract "storefront deploy must use its isolated production environment" unless storefront.dig("jobs", "deploy", "environment") == "storefront-production"
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
%w[target deployed_at health_result worker_version_id auth_handoff ci_workflow_run].each do |field|
  fail_contract "storefront release evidence omits #{field}" unless storefront_text.include?(field)
end
fail_contract "storefront deploy must capture a pre-deploy version" unless storefront_text.include?("previous_version_id") && storefront_text.include?("versions")
fail_contract "storefront deploy/smoke failure must rollback and re-probe" unless storefront_text.include?("wrangler rollback") && storefront_text.include?("automatic Cloudflare rollback") && storefront_text.scan("https://musuw.com").length >= 2 && storefront_text.scan("https://www.musuw.com").length >= 2
fail_contract "storefront smoke must verify the product auth handoff reachability" unless storefront_text.include?("https://app.musuw.com/auth/start")

production = documents.fetch("deploy-production.yml")
production_on = root_key(production, "on")
production_workflow_run = production_on.fetch("workflow_run", {})
fail_contract "production deploy must listen for completed CI workflow runs on main" unless production_workflow_run.dig("workflows") == ["CI"] && production_workflow_run.dig("types") == ["completed"] && production_workflow_run.dig("branches") == ["main"]
fail_contract "production deploy must retain a manual exact-SHA dispatch" unless production_on.key?("workflow_dispatch")
fail_contract "production deploy must not publish from a tag or ordinary push trigger" if production_on.key?("push")
fail_contract "production deploy must not cancel an active release" unless production.dig("concurrency", "cancel-in-progress") == false
production_authorize = production.dig("jobs", "authorize")
production_build = production.dig("jobs", "build")
production_deploy = production.dig("jobs", "deploy")
assert_hash(production_authorize, "deploy-production.yml.jobs.authorize")
assert_hash(production_build, "deploy-production.yml.jobs.build")
assert_hash(production_deploy, "deploy-production.yml.jobs.deploy")
fail_contract "production authorization must remain on the trusted lightweight release runner" unless production_authorize["runs-on"] == "musuw-release"
fail_contract "production image build must run on the isolated native x64 build runner" unless production_build["runs-on"] == "musuw-build-x64"
fail_contract "production build must follow authorization" unless production_build["needs"] == "authorize"
fail_contract "production deploy must wait for authorization and immutable images" unless Array(production_deploy["needs"]) == %w[authorize build]
fail_contract "production deploy must remain on the restricted Mac runner" unless production_deploy["runs-on"] == "musuw-release"
fail_contract "production deploy must use its isolated server environment" unless production.dig("jobs", "deploy", "environment") == "server-production"
fail_contract "production build runner must not receive the production environment" if production_build.key?("environment")
fail_contract "production package write and artifact read must be scoped to the image-build job" unless production_build["permissions"] == { "actions" => "read", "contents" => "read", "packages" => "write" }
fail_contract "production deploy must receive only read access to GHCR" unless production_deploy["permissions"] == { "contents" => "read", "packages" => "read" }
fail_contract "production authorization must not receive package write" if production.dig("jobs", "authorize", "permissions", "packages") == "write"
production_dispatch = production_on.fetch("workflow_dispatch")
assert_hash(production_dispatch, "deploy-production.yml.workflow_dispatch")
production_input = production_dispatch.dig("inputs", "immutable_ref")
assert_hash(production_input, "deploy-production.yml.workflow_dispatch.inputs.immutable_ref")
fail_contract "production immutable_ref input must be required" unless production_input["required"] == true && production_input["type"] == "string"
production_text = File.read(File.join(WORKFLOW_DIR, "deploy-production.yml"))
production_build_steps = Array(production_build["steps"])
production_deploy_steps = Array(production_deploy["steps"])
production_authorize_steps = Array(production_authorize["steps"])
fail_contract "production build must use only inline run steps so the regional runner never pre-downloads an action" unless production_build_steps.all? { |step| step.is_a?(Hash) && step.key?("run") && !step.key?("uses") }
production_authorize_checkout = production_authorize_steps.find { |step| step.is_a?(Hash) && step.fetch("uses", "").start_with?("actions/checkout@") }
production_source_bundle = production_authorize_steps.find { |step| step.is_a?(Hash) && step["id"] == "source_bundle" }
production_source_upload = production_authorize_steps.find { |step| step.is_a?(Hash) && step["id"] == "source_artifact" }
production_source_cleanup = production_authorize_steps.find { |step| step.is_a?(Hash) && step["name"] == "Remove the temporary authorized source bundle" }
production_build_checkout = production_build_steps.find { |step| step.is_a?(Hash) && step.fetch("uses", "").start_with?("actions/checkout@") }
production_source_archive = production_build_steps.find { |step| step.is_a?(Hash) && step["id"] == "source" }
production_deploy_checkout = production_deploy_steps.find { |step| step.is_a?(Hash) && step.fetch("uses", "").start_with?("actions/checkout@") }
production_node_setup = production_build_steps.find { |step| step.is_a?(Hash) && step["id"] == "node" }
production_native_preflight = production_build_steps.find { |step| step.is_a?(Hash) && step["name"] == "Assert native AMD64 build execution" }
production_static_build = production_build_steps.find { |step| step.is_a?(Hash) && step["name"] == "Build production browser bundles on native x64" }
production_buildx = production_build_steps.find { |step| step.is_a?(Hash) && step["id"] == "buildx" }
production_images = production_build_steps.find { |step| step.is_a?(Hash) && step["id"] == "images" }
production_registry_login = production_build_steps.find { |step| step.is_a?(Hash) && step["name"] == "Log in to GitHub Container Registry" }
production_build_cleanup = production_build_steps.find { |step| step.is_a?(Hash) && step["name"] == "Remove temporary registry credentials and builder container" }
production_pin_images = production_deploy_steps.find { |step| step.is_a?(Hash) && step["name"] == "Pin approved GHCR image refs in the server input" }
fail_contract "production browser build must cap the Node heap below the 4 GB host RAM" unless production_static_build&.dig("env", "NODE_OPTIONS") == "--max-old-space-size=3072"
fail_contract "production authorization must retain its full-history checkout for main ancestry proof" unless production_authorize_checkout&.dig("with", "fetch-depth") == 0 && production_authorize_checkout&.dig("with", "persist-credentials") == true
expected_authorize_outputs = {
  "release_sha" => "${{ steps.resolve.outputs.release_sha }}",
  "ci_workflow_run" => "${{ steps.resolve.outputs.ci_workflow_run }}",
  "source_artifact_id" => "${{ steps.source_artifact.outputs.artifact-id }}",
  "source_artifact_name" => "${{ steps.source_bundle.outputs.artifact_name }}",
  "source_artifact_digest" => "${{ steps.source_artifact.outputs.artifact-digest }}",
  "source_archive_digest" => "${{ steps.source_bundle.outputs.archive_digest }}"
}
fail_contract "production authorization must expose the exact immutable source artifact identity" unless production_authorize["outputs"] == expected_authorize_outputs
source_bundle_run = production_source_bundle&.fetch("run", "").to_s
expected_source_projection_excludes = [
  ":(exclude)weknora/website-docs/**",
  ":(exclude)weknora/docs/images/**"
].freeze
normalized_source_bundle_run = source_bundle_run.gsub(/\\\n[ \t]*/, " ").gsub(/[ \t]+/, " ")
expected_source_projection_pipeline = 'git archive --format=tar --prefix=musuw-source/ "$RELEASE_SHA" -- . ' \
  "':(exclude)weknora/website-docs/**' ':(exclude)weknora/docs/images/**' | gzip -n > \"$archive\""
negative_source_pathspecs = source_bundle_run.scan(/:(?:\([^)]*exclude[^)]*\)|[!\^])[^\s'\"]+/)
fail_contract "production authorization must create one deterministic exact-SHA production source projection without executing source" unless production_source_bundle&.dig("env", "RELEASE_SHA") == "${{ steps.resolve.outputs.release_sha }}" && source_bundle_run.include?('archive="$bundle_dir/musuw-source.tar.gz"') && normalized_source_bundle_run.include?(expected_source_projection_pipeline) && negative_source_pathspecs == expected_source_projection_excludes && source_bundle_run.include?("shasum -a 256") && source_bundle_run.include?("archive_digest=") && !source_bundle_run.include?("provenance.json")
%w[weknora/docs/docs.go weknora/internal/assets/asr_test.wav weknora/frontend/packages/xlsx-0.20.2.tgz scripts/weknora-production/lib.sh].each do |required_path|
  fail_contract "production source projection does not prove retention of #{required_path}" unless source_bundle_run.include?(required_path)
end
fail_contract "production source bundle must validate safe members, required inputs, executable mode, size, and ambient tar state before upload" unless source_bundle_run.include?("unset TAR_OPTIONS") && source_bundle_run.include?("tar -tvzf") && source_bundle_run.include?("unsupported member type") && source_bundle_run.include?("scripts/weknora-production/build-static.sh") && source_bundle_run.include?('git ls-tree "$RELEASE_SHA"') && source_bundle_run.include?("100755") && source_bundle_run.include?("268435456")
fail_contract "production source bundle must clean its temporary tree on validation or output failure without masking the failure" unless source_bundle_run.include?("cleanup_failed_bundle") && source_bundle_run.include?('trap \'cleanup_failed_bundle "$?"\' EXIT') && source_bundle_run.include?('local status="$1"') && source_bundle_run.include?('exit "$status"') && source_bundle_run.include?("outputs could not be published") && source_bundle_run.include?("trap - EXIT")
fail_contract "production source artifact must use the existing official immutable upload action" unless production_source_upload&.fetch("uses", "").start_with?("actions/upload-artifact@v4") && production_source_upload&.dig("with", "name") == "${{ steps.source_bundle.outputs.artifact_name }}" && production_source_upload&.dig("with", "path") == "${{ steps.source_bundle.outputs.archive_path }}" && production_source_upload&.dig("with", "if-no-files-found") == "error" && production_source_upload&.dig("with", "compression-level") == 0 && production_source_upload&.dig("with", "retention-days") == 7
source_cleanup_run = production_source_cleanup&.fetch("run", "").to_s
fail_contract "production authorization must always remove its uploaded source bundle staging tree" unless production_source_cleanup&.fetch("if", nil) == "always()" && production_source_cleanup&.dig("env", "BUNDLE_DIR") == "${{ steps.source_bundle.outputs.bundle_dir }}" && source_cleanup_run.include?('"$RUNNER_TEMP"/musuw-source-bundle.*') && source_cleanup_run.include?('find "$BUNDLE_DIR" -depth -delete')
fail_contract "production build must not depend on Git or codeload for source delivery" if production_build_checkout || JSON.generate(production_build).match?(/git fetch|codeload\.github\.com|\/tarball\//)
fail_contract "production build must materialize the authorized SHA only from its same-run Actions artifact" unless production_source_archive&.dig("env", "RELEASE_SHA") == "${{ needs.authorize.outputs.release_sha }}" && production_source_archive&.dig("env", "SOURCE_ARTIFACT_ID") == "${{ needs.authorize.outputs.source_artifact_id }}" && production_source_archive&.dig("env", "SOURCE_ARTIFACT_NAME") == "${{ needs.authorize.outputs.source_artifact_name }}" && production_source_archive&.dig("env", "SOURCE_ARTIFACT_DIGEST") == "${{ needs.authorize.outputs.source_artifact_digest }}" && production_source_archive&.dig("env", "SOURCE_ARCHIVE_DIGEST") == "${{ needs.authorize.outputs.source_archive_digest }}" && production_source_archive&.dig("env", "GH_TOKEN") == "${{ github.token }}"
source_archive_run = production_source_archive&.fetch("run", "").to_s
fail_contract "production artifact metadata must bind id, name, current run, expiry, size, and outer digest" unless source_archive_run.include?("https://api.github.com/repos/estromeglovettgen-coder/musuw/actions/artifacts/$SOURCE_ARTIFACT_ID") && source_archive_run.include?("$GITHUB_RUN_ID") && source_archive_run.include?("expired") && source_archive_run.include?("size_in_bytes") && source_archive_run.include?("SOURCE_ARTIFACT_DIGEST")
fail_contract "production artifact download must refresh a trusted short-lived redirect and never forward the API token" unless source_archive_run.include?("/actions/artifacts/$SOURCE_ARTIFACT_ID/zip") && source_archive_run.include?("for attempt in 1 2 3") && source_archive_run.include?("--dump-header") && source_archive_run.include?("tolower(line)") && source_archive_run.include?(".blob.core.windows.net") && source_archive_run.scan("Authorization: Bearer $GH_TOKEN").length == 2 && !source_archive_run.match?(/curl[^\n]*(?:--location(?:-trusted)?|\s-L(?:\s|$))/)
normalized_source_archive_run = source_archive_run.gsub(/\\\n[ \t]*/, " ").gsub(/[ \t]+/, " ")
fail_contract "production source API requests must retain their short 15s connect and 30s total bounds" unless source_archive_run.scan("--connect-timeout 15").length == 3 && source_archive_run.scan("--max-time 30").length == 2
fail_contract "production blob transfer must use the exact bounded slow-link policy" unless source_archive_run.scan("--max-time 900").length == 1 && source_archive_run.scan("--speed-limit 1024").length == 1 && source_archive_run.scan("--speed-time 120").length == 1 && normalized_source_archive_run.include?("--connect-timeout 15 --max-time 900 --speed-limit 1024 --speed-time 120 --write-out")
fail_contract "production source token must be restricted to fixed canonical API requests" unless source_archive_run.include?("test \"$GITHUB_REPOSITORY\" = estromeglovettgen-coder/musuw") && source_archive_run.scan("https://api.github.com/repos/estromeglovettgen-coder/musuw/actions/artifacts/$SOURCE_ARTIFACT_ID").length == 2
fail_contract "production source requests must ignore persistent runner curl configuration" unless source_archive_run.scan("curl -q ").length == 3
fail_contract "production source archive must reject a mutable or malformed release identity" unless source_archive_run.include?("^[0-9a-f]{40}$")
fail_contract "production source artifact must validate one ZIP entry plus outer and inner SHA-256 digests" unless source_archive_run.include?("zipinfo") && source_archive_run.include?("musuw-source.tar.gz") && source_archive_run.include?("sha256sum") && source_archive_run.include?("SOURCE_ARCHIVE_DIGEST") && source_archive_run.include?("unzip -p")
fail_contract "production source archive must validate one safe top-level tree before extraction" unless source_archive_run.include?("archive-entries") && source_archive_run.include?("--strip-components=1") && source_archive_run.include?("top-level")
fail_contract "production source archive must reject special archive members before extraction" unless source_archive_run.include?("unset TAR_OPTIONS") && source_archive_run.include?("tar -tvzf") && source_archive_run.include?("unsupported member type")
%w[.nvmrc auth/package-lock.json weknora/frontend/package-lock.json weknora/docs/docs.go weknora/internal/assets/asr_test.wav weknora/frontend/packages/xlsx-0.20.2.tgz integration/weknora-production/Dockerfile.app.runtime integration/weknora-production/Dockerfile.frontend .github/buildkitd.production.toml scripts/weknora-production/build-static.sh scripts/weknora-production/lib.sh].each do |required_path|
  fail_contract "production source archive does not fail closed without #{required_path}" unless source_archive_run.include?(required_path)
end
fail_contract "production source archive must preserve executable release inputs" unless source_archive_run.include?("test -x") && source_archive_run.include?("scripts/weknora-production/build-static.sh")
fail_contract "production source archive must stage under RUNNER_TEMP and replace only the exact repository workspace" unless source_archive_run.include?("$RUNNER_TEMP/") && source_archive_run.include?('expected_workspace="$runner_workspace/${GITHUB_REPOSITORY##*/}"') && source_archive_run.include?('test "$workspace" = "$expected_workspace"') && source_archive_run.include?("$GITHUB_WORKSPACE")
fail_contract "production source replacement must preserve its prior workspace until post-move validation commits" unless source_archive_run.include?("previous_workspace_owned=false") && source_archive_run.include?('test ! -e "$previous_workspace" && test ! -L "$previous_workspace"') && source_archive_run.include?('if [ "$workspace_committed" != true ] && [ "$previous_workspace_owned" = true ]') && source_archive_run.index("workspace_swapped=true").to_i < source_archive_run.index("workspace_committed=true").to_i
fail_contract "production build must materialize source before Node or image construction" unless production_build_steps.index(production_source_archive).to_i < production_build_steps.index(production_node_setup).to_i && production_build_steps.index(production_source_archive).to_i < production_build_steps.index(production_images).to_i
fail_contract "production deploy must retain the exact-SHA Git checkout required by the source-manifest seam" unless production_deploy_checkout&.dig("with", "ref") == "${{ needs.authorize.outputs.release_sha }}" && production_deploy_checkout&.dig("with", "fetch-depth") == 0
node_setup_run = production_node_setup&.fetch("run", "").to_s
fail_contract "production browser build must select the exact checked-in Node version from the native runner toolcache" unless node_setup_run.include?(".nvmrc") && node_setup_run.include?('$RUNNER_TOOL_CACHE/node/$node_version/x64/bin') && node_setup_run.include?("node\" --version") && node_setup_run.include?("process.arch") && node_setup_run.include?("npm\" --version") && node_setup_run.include?("$GITHUB_PATH")
node_path_export = 'export PATH="$node_bin:$PATH"'
fail_contract "production Node validation must expose the selected toolcache directory before invoking npm's env-based Node launcher" unless node_setup_run.include?(node_path_export) && node_setup_run.index(node_path_export).to_i < node_setup_run.index('"$node_bin/npm" --version').to_i && node_setup_run.index(node_path_export).to_i < node_setup_run.index('>> "$GITHUB_PATH"').to_i
fail_contract "production Node selection must not download another runtime" if node_setup_run.match?(%r{https?://|\bcurl\b|\bwget\b})
fail_contract "production build must fail closed unless runner and Docker daemon are native x64" unless production_native_preflight&.dig("env", "RUNNER_ARCH") == "${{ runner.arch }}" && production_native_preflight["run"].to_s.include?("docker info") && production_native_preflight["run"].to_s.include?("x86_64")
fail_contract "production build must fail closed unless the regional Docker Hub mirror is configured" unless production_native_preflight["run"].to_s.include?("mirror.ccs.tencentyun.com") && production_native_preflight["run"].to_s.include?("RegistryConfig.Mirrors")
native_preflight_run = production_native_preflight&.fetch("run", "").to_s
fail_contract "production Buildx client state must use the exact persistent runner-workspace directory with private permissions" unless native_preflight_run.include?('buildx_config="$RUNNER_WORKSPACE/.musuw-production-buildx-config"') && native_preflight_run.include?('test ! -L "$buildx_config"') && native_preflight_run.include?('test -O "$buildx_config"') && native_preflight_run.include?('chmod 700 "$buildx_config"') && native_preflight_run.include?("stat -c '%a'") && native_preflight_run.include?('printf \'BUILDX_CONFIG=%s\\n\' "$buildx_config" >> "$GITHUB_ENV"')
fail_contract "production native preflight must run before dependency installation or construction" unless production_build_steps.index(production_native_preflight).to_i < production_build_steps.index(production_node_setup).to_i && production_build_steps.index(production_native_preflight).to_i < production_build_steps.index(production_static_build).to_i
image_build_run = production_images&.fetch("run", "").to_s
fail_contract "production application build must consume the existing regional apt mirror seam" unless image_build_run.include?("--build-arg APT_MIRROR_ARG=mirrors.cloud.tencent.com")
fail_contract "production workflow must not install QEMU emulation" if JSON.generate(production_build).include?("setup-qemu")
buildx_setup_run = production_buildx&.fetch("run", "").to_s
fail_contract "production Buildx must recover an interrupted fixed builder, retain its cache state, then recreate it from checked-in config" unless production_buildx&.dig("env", "BUILDER_NAME") == "musuw-production-native-amd64-v1" && buildx_setup_run.include?('test "$BUILDX_CONFIG" = "$RUNNER_WORKSPACE/.musuw-production-buildx-config"') && buildx_setup_run.include?('docker buildx inspect --builder "$BUILDER_NAME"') && buildx_setup_run.include?('docker buildx rm --force --keep-state "$BUILDER_NAME"') && buildx_setup_run.index('docker buildx rm --force --keep-state "$BUILDER_NAME"').to_i < buildx_setup_run.index("docker buildx create").to_i && buildx_setup_run.include?("docker buildx create") && buildx_setup_run.include?('--name "$BUILDER_NAME"') && buildx_setup_run.include?("--driver docker-container") && buildx_setup_run.include?("--buildkitd-config .github/buildkitd.production.toml") && buildx_setup_run.include?("docker buildx inspect --builder \"$BUILDER_NAME\" --bootstrap")
registry_login_run = production_registry_login&.fetch("run", "").to_s
fail_contract "production GHCR login must use the job token over stdin in an isolated Docker config" unless production_registry_login&.dig("env", "DOCKER_CONFIG") == "${{ runner.temp }}/musuw-production-docker-config" && production_registry_login&.dig("env", "GHCR_USERNAME") == "${{ github.actor }}" && production_registry_login&.dig("env", "GHCR_TOKEN") == "${{ github.token }}" && registry_login_run.include?("docker login ghcr.io") && registry_login_run.include?("--password-stdin")
cleanup_run = production_build_cleanup&.fetch("run", "").to_s
fail_contract "production builder cleanup must always log out and remove the container while retaining named cache and persistent Buildx client state" unless production_build_cleanup&.fetch("if", "").to_s == "always()" && production_build_cleanup&.dig("env", "DOCKER_CONFIG") == "${{ runner.temp }}/musuw-production-docker-config" && cleanup_run.include?('test "${BUILDX_CONFIG:-}" = "$RUNNER_WORKSPACE/.musuw-production-buildx-config"') && cleanup_run.include?("docker logout ghcr.io") && cleanup_run.include?('docker buildx rm --force --keep-state "$BUILDER_NAME"') && cleanup_run.include?('find "$DOCKER_CONFIG" -depth -delete') && !cleanup_run.include?('find "$BUILDX_CONFIG"')
fail_contract "production cleanup must run after both image builds" unless production_build_steps.index(production_images).to_i < production_build_steps.index(production_build_cleanup).to_i
production_build_steps.select { |step| step.fetch("run", "").to_s.include?("docker buildx") }.each do |step|
  fail_contract "every production Buildx step must bind or assert the isolated persistent BUILDX_CONFIG: #{step["name"]}" unless step["run"].to_s.include?("BUILDX_CONFIG")
end
buildkit_config_path = File.join(ROOT, ".github", "buildkitd.production.toml")
fail_contract "production BuildKit GC configuration is missing" unless File.file?(buildkit_config_path)
buildkit_config = File.read(buildkit_config_path)
fail_contract "production BuildKit cache must enable GC with bounded disk and concurrency" unless buildkit_config.include?("gc = true") && buildkit_config.include?('maxUsedSpace = "10GB"') && buildkit_config.include?('minFreeSpace = "12GB"') && buildkit_config.include?("max-parallelism = 2")
fail_contract "production BuildKit must pull Docker Hub bases through the regional mirror" unless buildkit_config.include?('[registry."docker.io"]') && buildkit_config.include?('mirrors = ["mirror.ccs.tencentyun.com"]')
daemon_config_path = File.join(ROOT, ".github", "docker-daemon.production-builder.json")
fail_contract "production builder Docker daemon configuration is missing" unless File.file?(daemon_config_path)
daemon_config = JSON.parse(File.read(daemon_config_path))
fail_contract "production builder daemon must route bootstrap pulls through the regional mirror" unless daemon_config["registry-mirrors"] == ["https://mirror.ccs.tencentyun.com"]
fail_contract "production builder daemon must not claim GC authority over the Docker-container cache" if daemon_config.key?("builder")
expected_image_outputs = {
  "app_digest" => "${{ steps.images.outputs.app_digest }}",
  "app_ref" => "${{ steps.images.outputs.app_ref }}",
  "frontend_digest" => "${{ steps.images.outputs.frontend_digest }}",
  "frontend_ref" => "${{ steps.images.outputs.frontend_ref }}"
}
fail_contract "production build must expose validated immutable image digests and refs" unless production_build["outputs"] == expected_image_outputs
fail_contract "production build must execute exactly two sequential native Buildx pushes with metadata files" unless image_build_run.scan("docker buildx build").length == 2 && image_build_run.scan("--platform linux/amd64").length == 2 && image_build_run.scan("--push").length == 2 && image_build_run.scan("--metadata-file").length == 2 && image_build_run.scan('--builder "$BUILDER_NAME"').length == 2
fail_contract "production image pushes must retain private-repository minimum provenance and the exact GitHub run attempt builder identity" unless image_build_run.include?('type=provenance,mode=min,inline-only=true,builder-id=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/attempts/$GITHUB_RUN_ATTEMPT') && image_build_run.include?('[[ "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]') && image_build_run.scan('--attest "$provenance"').length == 2
fail_contract "production image pushes must retain source and revision OCI labels" unless image_build_run.scan("org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY").length == 2 && image_build_run.scan("org.opencontainers.image.revision=$RELEASE_SHA").length == 2
%w[VERSION_ARG=0.7.2 COMMIT_ID_ARG= BUILD_TIME_ARG=production-native-x64-runner GO_VERSION_ARG=go1.26 REVISION_ARG=].each do |build_arg|
  fail_contract "production image build is missing #{build_arg}" unless image_build_run.include?(build_arg)
end
fail_contract "production image build must bind both exact immutable tags" unless image_build_run.include?("musuw-app") && image_build_run.include?("musuw-frontend") && image_build_run.include?('$app_repository:$RELEASE_SHA') && image_build_run.include?('$frontend_repository:$RELEASE_SHA')
fail_contract "production image metadata and remote immutable ref must strictly yield the pushed registry digest" unless image_build_run.include?('metadata["containerimage.digest"]') && image_build_run.include?('metadata["containerimage.descriptor"]') && image_build_run.include?('metadata["image.name"]') && image_build_run.include?("^sha256:[0-9a-f]{64}$") && image_build_run.include?('docker buildx imagetools inspect "$repository@$digest"')
fail_contract "production digest validator must fail explicitly inside command substitution instead of relying on Bash errexit" unless image_build_run.include?('test -f "$metadata_path" || return 1') && image_build_run.include?('digest="$(node - "$metadata_path" "$expected_tag" <<\'NODE\'') && image_build_run.include?(')" || return 1') && image_build_run.include?('docker buildx imagetools inspect "$repository@$digest" >/dev/null || return 1')
fail_contract "production remote immutable tag must resolve to the same validated digest and fail closed" unless image_build_run.include?('docker buildx imagetools inspect "$expected_tag"') && image_build_run.include?("--format '{{json .Manifest}}'") && image_build_run.include?("manifest.digest") && image_build_run.include?('test "$tag_digest" = "$digest" || return 1')
fail_contract "production image build must validate both image digests before publishing job outputs" unless image_build_run.include?("app_digest") && image_build_run.include?("frontend_digest") && image_build_run.include?("app_ref") && image_build_run.include?("frontend_ref")
fail_contract "production image build must not upload a separate registry cache over the constrained uplink" if image_build_run.include?("cache-from") || image_build_run.include?("cache-to") || image_build_run.include?("mode=max")
fail_contract "production deploy must consume the build job's immutable image refs" unless production_pin_images&.dig("env", "APP_IMAGE") == "${{ needs.build.outputs.app_ref }}" && production_pin_images&.dig("env", "FRONTEND_IMAGE") == "${{ needs.build.outputs.frontend_ref }}"
fail_contract "production deploy must not rebuild images or browser bundles" if JSON.generate(production_deploy).match?(/build-push-action|setup-buildx-action|Build production browser bundles/)
fail_contract "production image build must not reference any production secret" if JSON.generate(production_build).match?(/secrets\.|MUSUW_PRODUCTION_SSH|WEKNORA_DEPLOY_SSH|KNOWN_HOSTS/)
%w[VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_WEKNORA_OAUTH_CLIENT_ID].each do |public_name|
  fail_contract "production image build must receive public #{public_name} as a repository variable" unless JSON.generate(production_build).include?("vars.#{public_name}")
  fail_contract "production deploy must consume the same public #{public_name} repository variable" unless JSON.generate(production_deploy).include?("vars.#{public_name}")
end
fail_contract "production workflow must not retain a second auth-public secret source" if production_text.include?("MUSUW_AUTH_PUBLIC_ENV")
%w[WEKNORA_DEPLOY_KNOWN_HOSTS_FILE WEKNORA_DEPLOY_SSH_KEY WEKNORA_DEPLOY_REMOTE WEKNORA_DEPLOY_REVISION].each do |name|
  fail_contract "production deploy missing #{name} seam" unless production_text.include?(name)
end
fail_contract "production workflow_run must select the successful canonical CI head SHA" unless production_text.include?("github.event.workflow_run.head_sha") && production_text.include?("github.event.workflow_run.conclusion == 'success'") && production_text.include?("github.event.workflow_run.repository.full_name == 'estromeglovettgen-coder/musuw'")
fail_contract "production dispatch must be restricted to main" unless (production_text.include?("EVENT_REF") || production_text.include?("GITHUB_REF")) && production_text.include?("refs/heads/main") && production_text.include?("workflow_dispatch")
fail_contract "production deploy must resolve an immutable checkout input" unless production_text.include?("inputs.immutable_ref") && production_text.include?("git rev-parse HEAD")
fail_contract "production deploy must prove the revision belongs to origin/main" unless production_text.include?("origin/main") && production_text.include?("merge-base")
fail_contract "production release input must be a full 40-character SHA only" unless production_text.include?("^[0-9a-fA-F]{40}$") && !production_text.include?("refs/tags/") && !production_text.include?("git cat-file -t")
fail_contract "production deploy must require a successful CI run for the revision" unless production_text.include?("actions/runs") && production_text.include?("CI") && production_text.include?("conclusion")
fail_contract "production deploy must pin checkout to the resolved SHA" unless production_text.include?("ref: ${{ needs.authorize.outputs.release_sha }}")
fail_contract "production deploy must execute the direct SHA-only runner" unless production_text.include?("bash scripts/weknora-deploy.sh \"$WEKNORA_DEPLOY_REVISION\"") && production_text.include?("remote_gate prepare") && production_text.include?("remote_gate deploy")
fail_contract "production deploy must build and push both immutable GHCR images" unless image_build_run.scan("docker buildx build").length == 2 && image_build_run.include?("musuw-app") && image_build_run.include?("musuw-frontend") && image_build_run.include?("containerimage.digest")
fail_contract "production deploy must stream the short-lived GHCR token through the restricted runner" unless production_text.include?("WEKNORA_DEPLOY_GHCR_USERNAME") && production_text.include?("WEKNORA_DEPLOY_GHCR_TOKEN")
fail_contract "production image build must use the committed auth lockfile" unless production_text.include?("npm ci --prefix auth") && File.file?(File.join(ROOT, "auth", "package-lock.json"))
fail_contract "production deploy must assert the fixed release helper" unless production_text.include?("release-ci.sh") && production_text.include?("musuw-deploy-gate")
fail_contract "production deploy must retain release manifest/checksum evidence" unless production_text.include?("upload-artifact") && production_text.include?("sha256sum") && production_text.include?("source_manifest") && production_text.include?("source_bundle_sha256")
%w[target deployed_at health_result app_image frontend_image ci_workflow_run].each do |field|
  fail_contract "production release evidence omits #{field}" unless production_text.include?(field)
end
fail_contract "production success manifest must fail closed without server identity/checksum" unless production_text.include?("RELEASE_OUTCOME") && production_text.include?("test \"$server_release_id\" = \"$expected_release_id\"") && production_text.include?("=~ ^[0-9a-fA-F]{64}$")
fail_contract "production workflow must not use write permissions" if production_text.include?("contents: write") || production_text.include?("actions: write")

puts "workflow contract green: #{EXPECTED.join(", ")}"
