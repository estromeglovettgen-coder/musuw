# Server operations acceptance — 2026-09-16

## Released artifact

- PR: https://github.com/estromeglovettgen-coder/musuw/pull/67
- Released source: `8bf2f0a79e8d928cdb6a77df7543f0494a732b25`.
- Canonical PR CI `35084317887` and main CI `35085600112`: successful.
- Operations deployment: https://github.com/estromeglovettgen-coder/musuw/actions/runs/35086743923 — successful after retry of the deploy job using the original artifact.
- Bundle SHA-256: `f19dd75a5f9227f3a9040c1d37857a8bb06c071faf821b02a386213b0c985346`.
- Main production application remains `ced1b95fb70f545a41f02ac2af6b01834afdcae9`; unrelated automatic application/storefront releases for this merge were cancelled.

## Actual deployment and recovery

- Enabled systemd service `musuw-operations.service` runs as an unprivileged dedicated user and listens only on `127.0.0.1:4187`.
- Existing credentials are protected files; the database connection uses the existing read-only role. A prestart helper discovers the current PostgreSQL container address.
- Actual config, readiness, model-policy, overview and user reads returned HTTP 200; the users response contained 35 users.
- Requests without authentication returned 401, an invalid Host returned 421, a cross-origin write returned 403, and an out-of-scope API path returned 404. No customer records were changed.
- A real SIGKILL of the service process caused an observed outage and automatic recovery in 4.13 seconds (PID 936287 to 940149).
- Mac LaunchAgent `com.musuw.operations.production` now supervises an SSH HTTP forward, with RunAtLoad and KeepAlive enabled. The former database tunnel is disabled. Test-environment configuration is retained.
- Killing the Mac forwarding process caused an observed HTTP outage and automatic recovery in 1.02 seconds. Its PID changed from 10299 to 10360 while the server PID remained 940149.
- The existing Chrome tab at `http://127.0.0.1:4187/#/users` was reloaded onto the server build. It showed the management API connected and 35 users; a real filter action worked after reconnection without a loading error.
- Configuration reports the existing WeKnora, Paddle, Supabase, R2 and Langfuse providers available.

## Corrections discovered during deployment

The first server deployment failed readiness and safely stopped the new service and removed `current`, retaining the old Mac service. The Linux bundle's executable-module guard skipped startup through the `current` symlink. Setting `NODE_OPTIONS=--preserve-symlinks-main` in protected `production.env` fixed startup using Node's native behavior and the unchanged artifact. The actual Linux bundle reproduced the failure and successful entry into startup with this flag. Independent review found no blocker in this correction.

The first Mac migration restored the old local service when launchd rejected an immediate bootstrap after asynchronous bootout. The installer now waits, bounded to 15 seconds, for job removal before bootstrap. The two regression scenarios cover delayed removal and timeout; all 8 client tests pass with system Python 3.9.6. The corrected helper is installed in `~/Library/Application Support/MusuwOperations/operations-local-client.py`; the second migration succeeded. This source correction and the deployment record follow the released artifact and do not imply a replacement server build.

## Rollback and boundaries

Server deployment readiness failure exercised the real automatic rollback path. The deploy-gate test suite also covers restoration of a previous release and rejects invalid hashes and unsafe archives. Follow `integration/operations/README.md` for revisioned redeployment; preserve the required Node runtime flag.

For the Mac client, run `python3 "$HOME/Library/Application Support/MusuwOperations/operations-local-client.py" rollback`. The backup directory is recorded in `~/Library/Application Support/MusuwOperations/http-client-backup`. Failure rollback actually restored the old local service during the first installation attempt. Successful installation left the server service independent of the Mac process.

No server reboot, Mac sleep cycle, or production database container recreation was performed. Autostart configuration, live database readiness, actual server process recovery, actual client reconnection and the real browser read path were verified. Network outages can temporarily interrupt browser access; the server no longer depends on the Mac staying awake.

## Unrelated follow-up

The separate storefront Story browser workflow failed 8 pre-existing cases, also present in run `34700505595`; the storefront Git tree is unchanged (`a7c82991b75c926e90b994a8fd546d8a9495e5fb`). These concern a missing legacy demo selector and existing animation assertions. Canonical CI passed; the unrelated storefront failures were recorded in PR 67 and were not changed in this operational task.
