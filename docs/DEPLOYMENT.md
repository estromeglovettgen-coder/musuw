# Musuw delivery workflow

GitHub is the only source of production code. The repository is
`estromeglovettgen-coder/musuw` and `main` is the release branch.

The two delivery targets are deliberately small:

- `storefront/` is the public marketing site and is deployed to the existing
  Cloudflare Worker `musuw-site` (`musuw.com` and `www.musuw.com`).
- GitHub Actions builds the `weknora/frontend/`, `auth/` and Go application
  production images, pushes the two app images to GHCR, and records their
  immutable digests. The production server only pulls those digests and runs
  the checked-in Compose file.

## Normal path

1. Push a change to a branch and open a pull request. CI runs the required
   frontend, auth, storefront, Go, source-boundary and secret checks.
2. Merge the reviewed change to `main`. The successful CI run identifies the
   resulting full 40-character SHA; branch names and dirty checkouts are never
   release identities.
3. The storefront workflow receives that successful CI result, checks the
   exact SHA,
   builds only `storefront/`, and deploys it to `musuw-site`. It then checks
   both public domains and the documented product handoff.
4. The production workflow receives the same successful CI result, builds the
   static bundles and app/frontend images on GitHub, pushes them to GHCR, pins
   their returned digests in the deployment input, and uploads the allowlisted
   source bundle through the restricted SSH gate. A manual full-SHA dispatch is
   retained for an exact rerun; tag and branch-name releases are rejected.
5. The server receives a short-lived GitHub token over the restricted stdin
   channel, logs in to GHCR using a temporary Docker config, pulls the exact
   digests, recreates only `app` and `frontend` with `--no-build`, and checks
   `/health`. The token and temporary config are removed at exit.
   A short maintenance window is expected. A failed command is reported as a
   failed release; correct the source and run the normal path again.

There is one server Compose project and one source path. Do not add parallel
projects, temporary runtime modes, extra release state, or a second deployment
protocol.

## Source and upload boundary

The release bundle is materialized from tracked files at the selected SHA. It
contains application source, lockfiles, the production Compose files, scripts,
safe examples and documentation only. It must not contain `.env` values,
private keys, dependency directories, generated output, logs, databases,
volumes or server runtime files.

The restricted SSH key and pinned `known_hosts` entry are supplied only to the
production job. The gate must reject a mutable ref, an unsafe path, an
unallowlisted file or an arbitrary shell command. Runtime secrets, database and
object-store data, Redis/Neo4j data and tunnel credentials stay on the server;
the upload never copies or prints their values.

## Cloudflare storefront

The Worker-scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are
secrets of the `storefront-production` GitHub Environment. The storefront job
receives no server, database, model, auth or billing credentials.
`storefront/wrangler.jsonc` is the deployment
configuration and the Worker serves only the public static site. Product
actions hand off to `https://app.musuw.com/auth/start`.

After deployment, check both domains, the HTML language signal and the auth
handoff. A Cloudflare command succeeding without these probes is not enough.

## Production server

The production job receives a restricted `musuw-deploy` SSH key, pinned host
keys, the selected full SHA and the two public environment files required by
the image build. It also uses the ephemeral workflow `GITHUB_TOKEN` for GHCR;
the server owns all private configuration and never stores that token.

The fixed production Compose file is the only runtime definition. The update
sequence is GitHub build/push → upload/verify SHA and manifest → GHCR login →
pull exact digests → `docker compose up -d --no-build --force-recreate app
frontend` → health checks. Keep named volumes and server-owned runtime files
in place; the server never builds images or prunes its build cache.

Useful checks after a release are:

```text
curl -fsS https://musuw.com/
curl -fsS https://www.musuw.com/
curl -fsS https://app.musuw.com/
curl -fsS https://app.musuw.com/health
curl -fsS https://app.musuw.com/auth/start
```

The public storefront and the server release are independent: a green
storefront job does not imply a green server job, and a server upload never
changes the Cloudflare Worker.

## Required repository settings

Keep the following values in the target-specific GitHub Environments or on the
server, never in the repository:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- workflow `GITHUB_TOKEN` package-write permission for the production job
- the restricted production SSH key and pinned `known_hosts`
- public build environment files for the application and auth shell
- all database, object-store, model, OIDC, Supabase service and tunnel secrets

The checked-in lockfiles are used by CI (`npm ci`). When a dependency changes,
regenerate its lockfile in the same change.
