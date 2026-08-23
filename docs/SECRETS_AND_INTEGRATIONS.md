# Musuw 密钥与官方集成清单

最后核对：2026-08-23（America/Phoenix）。本文件只记录变量名、服务/账号标签、
文件名、权限、消费者和健康证明，**绝不记录密钥值、邮件地址、完整主机/IP、
hash 或供应商响应内容**。

完整的、可机器校验的去重注册表见
[`docs/external-credentials-registry.yaml`](external-credentials-registry.yaml)。
所有项目的密钥都只在这个注册表登记一次；其他仓库只保留指向当前权威来源的
索引，不复制值。

## 1. 当前硬边界

- 当前产品阶段只使用 **Paddle Sandbox**。Paddle Live 尚未申请、尚未授权，
  不能因为本地存在一个 production Keychain 项或某个旧运行文件而视为可用。
- Sandbox 的环境选择、client token、六个价格 ID、API key、webhook secret、
  notification destination 和默认套餐链接必须属于同一个 Sandbox 账户。
  Live 与 Sandbox 不可混用。
- 生产公开环境中的 `MUSUW_PADDLE_ENVIRONMENT` 必须是 `sandbox`；
  `scripts/ci/verify-external-credentials-registry.sh` 和生产静态校验会挡住
  Live-shaped 的 client token/API key、缺失价格目录或混合环境。即使一整套
  Live 前缀彼此匹配，固定生产 preflight 与 app entrypoint 也会拒绝；未来启用
  Live 必须先获授权并经过代码审查，不能只改环境变量。
- 浏览器只能接收 publishable/client/catalog 值；server secret、management/admin、
  webhook signing、SSH/deploy 和 OAuth secret 只能从 Keychain、GitHub Environment
  或服务器 `0600` 文件进入受控进程。

## 2. 本机 macOS Keychain（只检查存在性）

运营台通过 `/usr/bin/security` 读取下列项；浏览器得到的始终是字段白名单投影。
`present` 只表示 service/account 项存在，不代表读出或授权了它的值。

| Service | TEST 账号 | PRODUCTION 账号 | 边界与用途 |
| --- | --- | --- | --- |
| `com.musuw.local-admin.platform-key` | `musuw-admin-test` | `musuw-admin-production` | capability-scoped WeKnora 管理 API；不开放 settings/API-key management。 |
| `com.musuw.local-admin.paddle-api-key` | `musuw-admin-test` present | `musuw-admin-production` present-but-unauthorized | TEST 只对应 Paddle Sandbox；PRODUCTION 项存在性不是 Live 授权，当前不得用于 Tokyo。 |
| `com.musuw.local-admin.paddle-webhook-secret` | `musuw-admin-test` present | —（本机未登记） | TEST Sandbox notification destination；当前没有获授权的 Live destination。 |
| `com.musuw.local-admin.supabase-secret-key` | `musuw-admin-test` | `musuw-admin-production` | Supabase secret-key 类型，只供 Auth Admin/运营台。 |
| `com.musuw.local-admin.r2-access-key-id` | — | `musuw-admin-production` | R2 S3 访问标识；TEST 使用本地存储。 |
| `com.musuw.local-admin.r2-secret-access-key` | — | `musuw-admin-production` | R2 S3 server secret；只供服务端。 |
| `com.musuw.local-admin.langfuse-public-key` | `musuw-admin-test` | `musuw-admin-production` | Langfuse 项目 public key；按 environment 隔离。 |
| `com.musuw.local-admin.langfuse-secret-key` | `musuw-admin-test` | `musuw-admin-production` | Langfuse 项目 secret key；只供服务端。 |

安全地检查某一项是否存在（不要加 `-w`）：

```sh
security find-generic-password \
  -s com.musuw.local-admin.platform-key \
  -a musuw-admin-test >/dev/null
```

退出码 `0` 仅表示存在。禁止使用会把值输出到终端的命令，也禁止在开发者工具、
DOM snapshot、截图、日志或交接消息中查看供应商 secret。

## 3. 本机 ignored runtime

这些路径受 `.gitignore` 保护；密钥文件当前约定为 `0600`，但文档仍只记录路径和
用途，不记录内容：

| 路径 | 内容边界 |
| --- | --- |
| `.runtime/musuw-admin/production.env` | 运营进程的连接与非密钥定位信息；供应商 secret 仍来自 Keychain。 |
| `.runtime/weknora/candidate.env` | TEST WeKnora 与依赖服务运行配置；不得作为生产权威。 |
| `.runtime/weknora/auth-public.env` | Supabase publishable/OIDC 公共值；不提交。 |
| `.runtime/weknora/paddle-sandbox.env` | Paddle Sandbox environment、client token、六个价格 ID；API key/webhook secret 由 Keychain 注入。 |
| `.runtime/weknora/secrets/*` | OIDC、数据库、Redis、AES、JWT 等服务运行 secret；仅本机受控进程读取。 |

旧的 `candidate`/迁移目录若出现 Live-shaped Paddle 公开值，只能归类为历史审计
材料，不能覆盖 Sandbox 权威源。部署前必须重新生成公开环境并运行静态校验。

仓库顶层 `.env.example` 中的 `DEEPSEEK_*`、`MUSNOW_*` 和旧 Paddle fallback
变量只是空模板/兼容名，不是当前生产 authority；任何仍引用它们的测试或旧快照
都必须迁移到本注册表登记的 `MUSUW_*`/provider-specific source，不能在生产环境
填值。

## 4. 生产服务器保护文件

服务器通过受限 SSH alias 访问；保护目录为 `/opt/weknora/runtime/secrets`，目录
模式 `0700`，宿主机文件模式 `0600`，Compose 以只读 secret mount 进入容器。只
记录文件名和消费者：

| 文件 | 用途 | 当前边界 |
| --- | --- | --- |
| `db_password` / `redis_password` | PostgreSQL、Redis | 内部运行 secret。 |
| `system_aes_key` / `jwt_secret` | 敏感字段加密、会话签名 | 内部运行 secret。 |
| `neo4j_auth` / `searxng_secret` | Neo4j、SearXNG | 内部运行 secret。 |
| `oidc_client_id` / `oidc_client_secret` | Supabase OIDC | server-only OAuth client。 |
| `openrouter_management_api_key` | child-key provisioning、usage/limit 权威 | server-only management key。 |
| `paddle_api_key` | Paddle 官方 API | **当前必须是 Sandbox API key**；Live 未授权。 |
| `paddle_webhook_secret` | 签名 webhook | **当前必须对应 Sandbox notification destination**。 |
| `r2_access_key_id` / `r2_secret_access_key` | Cloudflare R2 S3 存储 | server-only；不进浏览器/Worker。 |
| `langfuse_public_key` / `langfuse_secret_key` | Langfuse trace 写入 | server-only；observability 投影排除内容。 |

`integration/weknora-production/app-entrypoint.sh` 只在容器启动时读取这些挂载；
`scripts/weknora-production/prepare-runtime.sh` 生成不含 server secret 值的
`production.env`。任何生产公开 env 都必须从受控的 Sandbox public contract
生成，不能手工把 candidate/Tokyo 文件复制过去。

安全地只检查文件与权限：

```sh
ssh musuw-tokyo \
  'test -f /opt/weknora/runtime/secrets/paddle_api_key &&
   test "$(stat -c %a /opt/weknora/runtime/secrets/paddle_api_key)" = 600'
```

不要运行 `cat`、`sed`、`xxd`、`base64`、`env` 或任何会显示内容的检查。

## 5. 提供商矩阵与真实消费者

| 提供商/类别 | TEST/Sandbox | PROD/Live | 权威、消费者和健康证明 |
| --- | --- | --- | --- |
| Paddle | Sandbox public client/catalog、server API key、webhook destination 可用 | Live 全部 `not-authorized`；不得部署 | Paddle 控制台是唯一权威；frontend Paddle.js、billing config/checkout、portal/upgrade API 和 webhook 路由必须使用同一 Sandbox；健康证明只保留状态/count/price metadata。 |
| Supabase Auth | TEST public auth + Auth Admin | Production public auth + Auth Admin | Supabase dashboard/project 是权威；auth shell、OIDC discovery/callback、运营台 Auth Admin；不记录 session/token。 |
| OpenRouter | 候选运行时只读 metadata | production management key + encrypted tenant child key | 官方 usage/limit 是额度权威；entrypoint、entitlement service 和 model transport；tenant key 不进浏览器。 |
| Cloudflare Worker | 不适用 | GitHub `storefront-production` 只含 Worker-scoped account/token | GitHub Environment + Cloudflare dashboard；仅 Wrangler 部署，Worker 不拿 server/model/billing secret。 |
| Cloudflare R2 | 本地存储，故意无 TEST key | production protected files | R2 S3 API；应用只返回对象/计量 metadata。 |
| Langfuse | test Keychain pair | production protected pair | Langfuse 项目；trace health 只返回 count/status，排除 input/output/prompt/content/attachments。 |
| GitHub/GHCR/SSH | CI ephemeral token | `server-production` restricted SSH + pinned known hosts；GHCR token 为 job-only | GitHub Environment 和 workflow 是权威；固定 release gate、exact digest pull、health check。 |
| Tencent VectorDB / Alibaba Cloud | optional/independent inventory | Tokyo 当前无此 active consumer | 各自 provider dashboard；仅在明确启用的独立项目中使用，不能从示例变量推断已配置。 |
| Google OAuth / SMTP | Supabase/OAuth 与邮件设置待按项目确认 | 当前 Musuw 没有 direct Google secret consumer；SMTP 由 Supabase Auth 配置边界管理 | Supabase/Google/provider dashboard；只验证 discovery、callback、OTP delivery，不记录 token 或邮件内容。 |

Paddle 的 destination、domain 和默认链接含义也固定在中央注册表：Sandbox
notification destination → app webhook；storefront plan CTA → app billing route。
没有获授权的 Live destination/domain/default link，不得出现在部署输入或客服说明中。

## 6. 其他本地项目：只登记，不复制

受控盘点覆盖 `Documents/Codex` 下 62 个 git 根目录。重复的 WeKnora/Musuw 快照
只归并到当前 Musuw 权威；AiToEarn、Dify、Ditto、Khoj、Pascal、mus-system-health、
marketingskills、openai-codex-fixed 等独立项目在注册表的 `repository_index`
中按 provider/class/owner 去重列出。它们的 `.env.example`、CI、Compose 和源码
消费者只作为索引证据，**不会把值或副本搬到 Musuw**。

特别需要后续治理、但不属于 Musuw Tokyo 当前运行时的类别：

- AiToEarn 的 OSS/SMS/实名、Tencent TMS、Qwen、Google OAuth、Twitter、WeChat；
- Dify 的 DashScope、DeepSeek、Supabase Admin/Google OAuth；
- Ditto 的 Resend、S3-compatible storage、CLI API key；
- Khoj 的模型、搜索、Stripe、AWS、Twilio、Notion、邮件和 CI provider keys；
- Pascal 与 mus-system-health 的 Supabase/Google integrations。

独立项目应链接自己的 provider dashboard/secret store；不要把这些变量填入
Musuw 的 production env。AiToEarn 发现有 tracked env 文件，需由其 owner 单独
处理权限和轮换，不能在本仓库复制或“帮忙猜值”。

## 7. 轮换、撤销、交接与验证

1. 先在对应 provider 创建替代 credential，确认最小真实能力；Sandbox/Live
   分开验证，Live 当前不执行。
2. 只通过 Keychain、GitHub Environment 或远端 `0600` 文件原子替换，不经过聊天、
   剪贴板、普通 env、日志或截图。
3. 重启对应服务，验证真实消费者和错误态：Paddle checkout/portal/webhook、
   Auth callback、model request、R2 metadata、Langfuse redacted trace 或 release
   health。
4. 撤销旧 credential；登记状态、能力、权限和验证时间，仍不登记值。
5. 若值曾出现在终端输出、DOM snapshot、截图、日志或 git diff，立即按已泄露处理
   并轮换，不能只删除视觉证据。

本地校验入口：

```sh
bash scripts/ci/external-credentials-registry.test.sh
bash scripts/ci/verify-external-credentials-registry.sh
```

这两个脚本只检查注册表元数据、Sandbox-only 生产边界、文档链接和禁止值模式；
不会读取 Keychain secret、连接 provider、扫描 shell history/session 或解析 git
objects/blobs。
