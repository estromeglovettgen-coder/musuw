## MODIFIED Requirements

### Requirement: TEST and PRODUCTION remain process-isolated environments

The local operations console SHALL run exactly one selected TEST or PRODUCTION
process and one read-only database pool at a time. The browser MAY request the
opposite fixed target through an exact loopback control endpoint. The endpoint
MUST require the current SameSite operator session, exact Origin and Host, CSRF
token, valid target configuration, and a single in-flight switch. It MUST
restart through the existing launcher with fixed no-shell arguments and a
clean target-specific environment. The browser MUST NOT supply datasource
URLs, credentials, arbitrary commands, or mix both environments in one
process. PRODUCTION runtime values MUST come from its separate ignored runtime
file and the database connection MUST remain read-only.

#### Scenario: Operator switches environments once

- **WHEN** the operator clicks the alternate TEST or PRODUCTION environment
- **THEN** the console starts the existing isolated target process, polls its
  health, and reloads the same console page when that target is ready

#### Scenario: Switch request is not locally authorized

- **WHEN** a request lacks the session, exact Origin/Host, CSRF token, valid
  opposite target, production confirmation, or configured target runtime
- **THEN** it fails closed without starting a child process or changing the
  current environment

#### Scenario: Production tunnel ownership is verified before restart

- **WHEN** an authorized switch targets PRODUCTION, regardless of whether the
  configured local database port already accepts TCP connections
- **THEN** the existing launcher validates the pinned `musuw-tokyo` restricted
  SSH alias, BatchMode/strict host-key configuration, the fixed PostgreSQL
  container through `sudo -n docker inspect`, and its ControlMaster tunnel
  before probing the database; an unowned listener or failed preparation
  returns an actionable 503 and leaves the current environment running

#### Scenario: Target startup failure restores the previous console

- **WHEN** the target process fails its post-restart `/healthz` check after the
  previous process has been stopped
- **THEN** the launcher preserves the target failure log and makes one direct
  attempt to restore the previous target without recursive rebuilds; a healthy
  rollback leaves the console serving the previous environment

### Requirement: Operators can manage the real consumer model policy

The system SHALL expose exactly five model-policy rows to an authorized
SystemAdmin/platform key: Agent (`rag`), Rerank, Wiki, Vision, and ASR. Each
row SHALL contain the current Free default, ordered paid model IDs, and safe
display metadata from active builtin OpenRouter models of the scene's native
type. Chat, Embedding, TTS, model parameters, endpoints, and credentials MUST
NOT appear. Updates SHALL change exactly one policy field through the existing
system-setting service and SHALL reject unsupported scenes, empty or duplicate
paid lists, wrong native types, unsafe rows, unknown fields, and forged IDs.

#### Scenario: Operator opens the model matrix

- **WHEN** the operator opens Models in the loopback console
- **THEN** five rows load from the real catalog and current system settings,
  with no placeholder IDs or sensitive model configuration

#### Scenario: Operator submits an invalid model

- **WHEN** an update contains a Chat/Embedding scene, unknown ID, wrong native
  type, duplicate paid ID, arbitrary field, or non-builtin/non-OpenRouter row
- **THEN** the request returns 400 and no policy setting is changed

#### Scenario: Operator selects an expanded cost-conscious model

- **WHEN** a current free or low-cost OpenRouter model has been reconciled into
  the active builtin catalog for the row's native type
- **THEN** the matrix exposes its real display metadata and model ID, accepts it
  through the same strict policy update, and the runtime sends that exact model
  through the existing metered OpenRouter transport
