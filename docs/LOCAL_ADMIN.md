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
copy its password. `production` uses the local `musuw-production` SSH alias,
reads the existing protected database password, discovers
`weknora-v072-production-postgres`, and opens a temporary loopback tunnel. An
alternate existing root alias may be selected explicitly:

```bash
MUSUW_ADMIN_PRODUCTION_SSH_TARGET=your-existing-alias \
  scripts/musuw-admin production
```

The alias must point to the production host with an authorized root key. If SSH
cannot authenticate or the server does not complete its SSH handshake,
`production` exits without leaving a container or tunnel.

On this Mac, Clash Verge TUN must either be disabled or bypass the production
host. A TUN route for `8.0.0.0/8` can complete the public TCP connect without
delivering the final handshake to the ECS instance, which appears as an SSH
banner timeout.

No DbGate volume is persisted. `stop` removes the transient container, its
in-memory state and the SSH tunnel. Starting the console itself only connects;
manual edits made in DbGate are immediate writes to the selected database.

## Data-source boundaries

DbGate directly manages PostgreSQL. It therefore covers the Musuw application
database and can also connect to a Supabase project's direct or pooled
PostgreSQL endpoint when that project's database password is supplied. The
launcher intentionally preconfigures only one Musuw environment at a time and
does not persist additional credentials; use Supabase Studio for Auth users,
policies and other Supabase-owned resources.

Paddle and Cloudflare R2 are not PostgreSQL services and are not copied into a
second admin system:

- Paddle remains authoritative for customers, transactions, subscriptions,
  refunds and payment methods. DbGate exposes Musuw's synchronized plan,
  subscription, event and billing-period fields in `tenants`. Editing those
  mirror fields does not perform a Paddle operation.
- R2 remains authoritative for object bytes. DbGate exposes the related object
  path, size and storage-backend metadata in `knowledges` and
  `storage_backends`. Object operations belong in the Cloudflare dashboard or
  its S3-compatible API.

This keeps one local SQL console for application data while billing, Auth and
object storage stay in their official control planes, with no custom sync layer
or duplicated source of truth.
