# Musuw

Musuw is a consumer knowledge workspace built from the complete upstream
[WeKnora v0.7.2](https://github.com/Tencent/WeKnora/tree/v0.7.2) source tree.
Users enter through Musuw's Google or email-OTP sign-in, then use a single,
preconfigured knowledge workspace. Model credentials and infrastructure remain
server-side.

## Active source

| Path | Responsibility |
| --- | --- |
| [`weknora/`](weknora/) | Application source, including the API, workspace UI, document processing, RAG, Wiki, graph, and built-in model support. |
| [`auth/`](auth/) | Musuw's public Google/email-OTP entry and the handoff to WeKnora's native OIDC session. |
| [`storefront/`](storefront/) | Source for the public homepage at `musuw.com`; its product actions enter the app at `app.musuw.com/auth/start`. |
| [`integration/`](integration/) | Runtime composition for the local candidate and production release. |
| [`scripts/`](scripts/) | The small local, preview, and release entry points. |
| [`third_party/weknora/`](third_party/weknora/) | The v0.7.2 source provenance record. |

The vendored application is the authority. Keep changes small and local to the
existing WeKnora modules; do not introduce a second product runtime, API, or
authentication system.

## Local use

For everyday work, run the application on the host with hot reload:

```bash
npm run dev
# http://localhost:4190
```

This starts Docker only for PostgreSQL, Redis, DocReader, Neo4j, and SearXNG.
The Go API, authentication shell, and workspace UI run directly from this
checkout. `npm run dev:down` stops both host processes and those dependency
containers while preserving their data volumes.

Use `npm run preview` only for a production-like full Docker rebuild and
`npm run release` only to update the server.

## Provenance and licenses

- [WeKnora source provenance](third_party/weknora/active-upstream-source.json)
- [v0.7.2 local-delta provenance](third_party/weknora/v0.7.2-provenance.json)
- [WeKnora license and upstream notices](weknora/LICENSE)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Historical migration notes, legacy runtime specifications, acceptance captures,
and prior project handoffs intentionally do not live in this working tree.
