# Video source storage and automatic model routing

## Decision

Musuw will keep one durable copy of an imported video and may run multiple
parse attempts against that copy. The default experience automatically chooses
the first compatible model from a server-owned, cheapest-first candidate list.
Users do not need to choose a model during a normal import.

This is an incremental change to the current WeKnora-based implementation. It
does not introduce another object store, upload service, video platform, parser,
or workflow engine.

## Product outcome

- A local upload or social-video import stores the source at most once.
- Resolving or downloading a social link is never repeated merely because a
  model was incompatible or a parse attempt failed.
- After the real file size is known, automatic mode selects the cheapest model
  that is available to the tenant and supports the stored video's input mode
  and size.
- An incompatible model is skipped before inference; it is not called merely to
  discover a documented size limitation.
- Reparse always reads the existing stored source. It does not create another
  object and does not resolve the source link again.
- If no available model is compatible, the source remains stored and viewable,
  with an actionable status instead of a generic parse failure.

## Minimal architecture

```text
local file ---------------------> private object storage
                                       |
social link -> resolve once -> stream once
                                       |
                               stable source reference
                                       |
                       automatic compatibility selection
                                       |
                       one parse attempt against the source
                                       |
                         parsed knowledge and trace state
```

The Go application remains the control plane for authorization, entitlements,
quota checks, metadata, short-lived object URLs, and task dispatch. Large file
bytes use the existing direct/multipart object-storage path. URL-capable models
read a short-lived source URL; bounded inline input remains available only for
models and files that safely fit it.

The existing knowledge record and stored `file_path` should be reused as the
source authority where that is safe. Do not add a new source-asset subsystem or
table unless inspection proves the existing record cannot provide idempotent
ownership and reuse.

## Limits

Two limits have different meanings and must not be collapsed:

1. **Source storage limit**: the configurable maximum object size Musuw will
   retain, additionally bounded by the tenant's remaining storage entitlement.
2. **Model parse limit**: the end-to-end size a particular model and configured
   transport are verified to accept.

Model limits are parsing capabilities, not reasons to discard an already
acquired source. A social-link resolver may need to be called before the exact
size is known; once that cost has been incurred, any source within the storage
limit should be persisted before model routing.

Only verified capabilities may be advertised. The effective limit must reflect
the complete Musuw call path, including URL versus inline transport and the
fixed provider route, rather than a model marketing claim in isolation.

## Automatic and manual selection

Automatic mode is the default. Keep its implementation deliberately small:

- Maintain one server-side allowlist ordered from lowest to highest expected
  cost.
- For the stored source, skip candidates unavailable to the tenant or unable to
  accept its input mode and exact byte size.
- Select the first compatible candidate and call only that model.
- Record the selected model and the reason for the decision in the task trace.

Do not build a general scoring, bidding, or dynamic pricing engine.

Manual selection may remain as an advanced action. A manually selected model is
pinned: Musuw must not silently replace it. If it is incompatible, preserve the
source and offer automatic selection or another compatible model. A model's
user-facing option may show its verified limit, for example `Model name (up to
300 MB)`.

The minimum safe model capability contract is:

- `video_input_mode`: `url`, `base64`, or unsupported;
- `video_max_bytes`: verified raw source byte limit.

Expose these as safe model metadata from the backend. Do not make the browser
interpret provider-specific `extra_config`, and do not duplicate capability
numbers in frontend constants.

## Source identity and reuse

Before resolving a submitted social link, look for an existing source owned by
the same tenant using a normalized submitted URL or recorded alias. After a
successful resolve, persist the platform's stable content identifier when one
is available and use it for subsequent deduplication.

At minimum, repeated submission of the exact same normalized link must reuse a
healthy stored object. Alternate share links for the same item may still require
one resolve before their canonical identity is known; after that resolve, reuse
the existing object instead of storing a duplicate.

Resolver responses and expiring third-party download URLs are metadata, not the
durable source. The private stored object is the reparse authority.

## States and errors

Source acquisition and parsing have separate outcomes, even if the first
implementation stores them on the existing knowledge/trace records:

- acquiring source;
- source stored, waiting for model;
- parsing;
- completed;
- source stored, parse failed;
- source acquisition failed.

Model incompatibility is not a document-parser failure. User-facing errors must
state what happened and whether the source is safe. Examples:

- `The original video has been saved. No currently available model supports its size.`
- `The original video has been saved. The selected model supports up to 300 MB; this video is 428 MB.`
- `Video parsing returned no usable result. The original video is safe and can be parsed again.`
- `The source video could not be acquired and was not saved.`

Use structured application error codes and safe fields such as model display
name, actual bytes, maximum bytes, and retryability. Preserve underlying
provider diagnostics in server-side logs and traces only.

## User-interface language boundary

No end-user UI copy may expose infrastructure or integration vendor names. This
includes source-resolution vendors, model gateways, cloud/object-storage
vendors, provider routes, internal parsers, and internal service/error names.

Use product language such as:

- `video source service`;
- `video parsing service`;
- `file storage`;
- `temporary service issue`;
- `original video saved`.

User-selectable model display names and their verified capabilities may appear
because they are part of an intentional product choice. Operational logs,
administrator-only diagnostics, configuration, and internal documentation may
retain the real integration names.

Audit both translated strings and raw API errors before rendering. The backend
must return a safe public message; the frontend must not surface an upstream
response body verbatim.

## Source viewing

For large original videos, authorize the request in Musuw and return a
short-lived, read-only object URL so the browser can use native range requests.
Keep the bucket private and the URL short-lived. Preserve the current permission
decision deliberately: granting source viewing gives the viewer access to the
source bytes and should not be described as technically preventing download.

Do not add a custom video player. Use the browser's native player. Keep the
existing application proxy only as a compatibility fallback for storage
backends that cannot issue safe temporary URLs.

## First implementation sequence

1. Inspect the active upload, social-import, reparse, model-list, entitlement,
   and trace paths; verify each candidate model's real end-to-end limits.
2. Add the small safe capability contract and the ordered automatic candidate
   list on the server.
3. Persist/reuse the original source independently of parse success; prevent an
   exact repeated link from causing another resolve or stored object.
4. Route after actual size is known, record the chosen model, and make reparse
   reuse the stored source. Keep manual pinning as an advanced option if the
   current product already exposes it.
5. Replace generic parser errors and provider-leaking messages with structured,
   actionable public states while retaining full internal diagnostics.
6. Add short-lived direct source viewing for large video and the exact CORS and
   range behavior it requires.
7. Run targeted unit/integration tests, then exercise local upload, social-link
   import, oversized-default routing, no-compatible-model, parse failure,
   reparse, repeated-link reuse, permissions, and dark/light UI on staging.

## Acceptance scenarios

- A video larger than the cheapest model's limit is stored once and routed to
  the first compatible candidate without calling the incompatible model.
- A failed parse leaves the original source intact; reparse uses the same object
  and performs no new social-link resolve or download.
- Re-submitting the same normalized social link does not consume another
  resolution call or store another source object when the existing source is
  healthy.
- No-compatible-model is a recoverable stored-source state, not
  `DOCREADER_PARSE_FAILED`.
- Manual selection, when used, is never silently replaced.
- Upload, parse, reparse, and source-view UI never reveals infrastructure or
  integration provider names; internal observability retains enough detail to
  diagnose failures.
- Large upload and viewing traffic does not pass through the Go application on
  the normal object-storage path.

## Explicitly deferred

Do not add these unless implementation evidence proves they are required for
the acceptance scenarios:

- a second object store or video platform;
- a Worker or application proxy for normal large-file bytes;
- tus or a new upload server;
- a generic workflow/model-routing engine;
- a custom media player;
- a new document parser;
- URL-based DocReader ingestion for ordinary documents;
- a new source-asset database subsystem;
- automatic cross-model replacement after a user manually pins a model.

The existing R2/S3 multipart path is the first choice. A mature client upload
library may replace the current browser orchestration only if real 1 GB testing
shows that retry, cancellation, or session recovery is inadequate; it is not a
prerequisite to this design.

## Relevant implementation areas

- `weknora/internal/handler/direct_upload.go`
- `weknora/internal/application/service/knowledge_create.go`
- `weknora/internal/application/service/knowledge_tikhub.go`
- `weknora/internal/application/service/video_ingestion.go`
- `weknora/internal/application/service/knowledge_process_config.go`
- `weknora/internal/models/vlm/remote_api.go`
- `weknora/internal/handler/dto/model.go`
- `weknora/config/builtin_models.yaml`
- `weknora/frontend/src/api/knowledge-base/`
- `weknora/frontend/src/views/knowledge/`

## Reference material

- Cloudflare R2 user-generated-content reference architecture:
  <https://developers.cloudflare.com/reference-architecture/diagrams/storage/storing-user-generated-content/>
- Cloudflare R2 upload and multipart behavior:
  <https://developers.cloudflare.com/r2/objects/upload-objects/>
- Cloudflare R2 presigned URLs:
  <https://developers.cloudflare.com/r2/api/s3/presigned-urls/>
- Uppy S3-compatible direct upload (optional fallback, no Companion required):
  <https://uppy.io/docs/aws-s3/>

