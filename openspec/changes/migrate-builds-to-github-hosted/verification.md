# Hosted production delivery verification

## Local and contract verification

- `go test -race -count=1 ./internal/handler` passed after moving production revision reporting to the existing validated runtime revision.
- `ruby scripts/ci/validate-workflows.rb` passed.
- `bash scripts/weknora-production/verify-static.sh` passed.
- `bash scripts/weknora-production/deploy-ci-seams-contract.test.sh` passed.
- `bash scripts/ci/secret-scan.sh` passed.
- `openspec validate migrate-builds-to-github-hosted --strict` passed.

## Hosted cold activation baseline

- Revision `c025140a92e9489c6969c4b8edec93bdad8456bc` passed [CI run 33140608230](https://github.com/estromeglovettgen-coder/musuw/actions/runs/33140608230).
- The same revision passed [Storefront run 33140734078](https://github.com/estromeglovettgen-coder/musuw/actions/runs/33140734078).
- The same revision passed [Production run 33140734082](https://github.com/estromeglovettgen-coder/musuw/actions/runs/33140734082) using only GitHub-hosted Ubuntu jobs and the restricted Tokyo release command.
- The intentional cold source-changing image build took 8 minutes 2 seconds; the restricted deployment took 42 seconds.
- Post-deploy checks confirmed healthy application and frontend containers, exact revision labels, the same validated runtime revision inside the application container, public health success, and Paddle public configuration still `configured=true` in `live` mode.

## Warm-cache acceptance

Pending: a documentation-only follow-up revision must pass CI, Storefront, image digest validation, the restricted Tokyo deployment, and public health while demonstrating that the source compilation layer is reused instead of repeating the cold Go build.
