# Local database admin

Musuw uses the official DbGate Community `7.2.5` image as a local database
console. It provides native table editing, SQL queries, ER diagrams, profiling
and chart views; Musuw adds no custom admin frontend, API or metadata database.

```bash
# Local test database on port 15432
scripts/musuw-admin test

# Production through the existing root SSH configuration
scripts/musuw-admin production

scripts/musuw-admin status
scripts/musuw-admin stop
```

The browser URL is always <http://127.0.0.1:4186>. Starting either environment
stops the previous one. DbGate has no login because it is bound only to
`127.0.0.1`; never publish or proxy this port.

`test` reads the existing ignored `.runtime/weknora/candidate.env` and does not
copy its password. `production` reads the existing protected database password,
discovers `weknora-v072-production-postgres` through the existing root SSH
configuration (including its `IdentityFile` and `known_hosts`), and opens a
temporary loopback tunnel. If the SSH config has more than one root target,
select the existing alias explicitly:

```bash
MUSUW_ADMIN_PRODUCTION_SSH_TARGET=your-existing-alias \
  scripts/musuw-admin production
```

The root alias currently present on this development machine is not authorized
by the server. Until an authorized root alias and key are added to the existing
SSH config, `production` exits without leaving a container or tunnel.

No DbGate volume is persisted. `stop` removes the transient container, its
in-memory state and the SSH tunnel. Starting the console itself only connects;
manual edits made in DbGate are immediate writes to the selected database.
