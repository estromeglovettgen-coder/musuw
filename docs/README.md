# Musuw documentation map

This directory contains the current Musuw operator documentation. Source code,
checked-in configuration, and these documents are authoritative; dated handoff
snapshots are not retained as operating instructions.

## Current operator documents

| Document | Purpose |
| --- | --- |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Immutable build, staging, promotion, rollback, and production delivery contract. |
| [`STAGING_OPERATIONS.md`](STAGING_OPERATIONS.md) | Staging environment operation and acceptance workflow. |
| [`SECRETS_AND_INTEGRATIONS.md`](SECRETS_AND_INTEGRATIONS.md) | Secret ownership, provider boundaries, and safe operator handling. |
| [`PADDLE_LIVE_READINESS.md`](PADDLE_LIVE_READINESS.md) | Paddle Live readiness and evidence requirements. |
| [`LOCAL_ADMIN.md`](LOCAL_ADMIN.md) | Loopback-only operations console. |
| [`external-credentials-registry.yaml`](external-credentials-registry.yaml) | Metadata-only credential inventory; never store secret values here. |

## Product and source documentation

- The repository [`README.md`](../README.md) and [`AGENTS.md`](../AGENTS.md)
  define the active Musuw source tree and local workflow.
- [`storefront/README.md`](../storefront/README.md) defines the public-site
  behavior and its responsive visual contract.
- [`weknora/website-docs/`](../weknora/website-docs/) is the canonical upstream
  WeKnora product documentation. Files under `weknora/docs/` are compatibility,
  generated API, or upstream historical material and must not override Musuw's
  local or deployment instructions.
- Active OpenSpec changes retain feature decisions and acceptance criteria.
  Completed changes should be archived with OpenSpec rather than treated as a
  current runbook.

When a document conflicts with current source or configuration, correct or
remove it in the same change. Do not add another dated handoff file as a second
source of truth.
