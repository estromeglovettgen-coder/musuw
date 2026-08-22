# Musuw 密钥与官方集成清单

最后核对：2026-08-22（America/Phoenix）。本文件只记录位置、账号、用途、
状态和轮换边界，**绝不记录任何密钥值**。密钥值不得写入仓库、普通 shell
环境文件、浏览器、截图、日志、工单或交接消息。

## 1. 本机 macOS Keychain

运营台只由服务端调用 `/usr/bin/security` 读取下列项。浏览器得到的始终是
字段白名单投影。`present` 只表示该 service/account 项存在，不代表本文公开
了它的值。

| Service | TEST 账号 | PRODUCTION 账号 | 当前状态与用途 |
| --- | --- | --- | --- |
| `com.musuw.local-admin.platform-key` | `musuw-admin-test` | `musuw-admin-production` | 两项 present；capability-scoped WeKnora 管理 API。只含 entitlement、状态/配额、OpenRouter 额度、用户调查、运行队列和审计；settings/API-key management 仍不放行。 |
| `com.musuw.local-admin.paddle-api-key` | `musuw-admin-test` | `musuw-admin-production` | 两项 present；分别对应 Sandbox 与 Live。订阅和交易官方读取均已返回 HTTP 200。当前两把轮换后密钥的供应商到期日为 2026-11-20；旧的已暴露密钥已撤销。 |
| `com.musuw.local-admin.paddle-webhook-secret` | `musuw-admin-test` | — | TEST present；用于本地签名 webhook。PRODUCTION 权威副本只在服务器保护文件中，本机运营台不需要该值。旧 Sandbox destination secret 已轮换。 |
| `com.musuw.local-admin.supabase-secret-key` | `musuw-admin-test` | `musuw-admin-production` | 两项 present；使用 Supabase secret-key 类型，不使用 legacy `service_role` 文本值。Auth Admin 读取已分别验证。 |
| `com.musuw.local-admin.r2-access-key-id` | — | `musuw-admin-production` | PRODUCTION present；TEST 故意 absent，因为 TEST 产品使用本地存储。 |
| `com.musuw.local-admin.r2-secret-access-key` | — | `musuw-admin-production` | PRODUCTION present；与上一项组成 R2 S3 凭据，只供服务端使用。 |
| `com.musuw.local-admin.langfuse-public-key` | `musuw-admin-test` | `musuw-admin-production` | 两项 present；当前同一个 `Musuw` 项目 key pair 以两个账号保存，运行时由 environment/release 隔离。 |
| `com.musuw.local-admin.langfuse-secret-key` | `musuw-admin-test` | `musuw-admin-production` | 两项 present；JP Cloud 官方 API 查询与 trace 写入。 |

安全地检查某一项是否存在（不要加 `-w`）：

```sh
security find-generic-password \
  -s com.musuw.local-admin.platform-key \
  -a musuw-admin-test >/dev/null
```

退出码 `0` 表示存在。禁止使用会把值输出到终端的命令，也禁止在浏览器
开发者工具、DOM snapshot 或截图中查看供应商 secret。

## 2. 本机 ignored runtime

这些路径受 `.gitignore` 保护且当前权限为 `0600`：

| 路径 | 内容边界 |
| --- | --- |
| `.runtime/musuw-admin/production.env` | PRODUCTION 运营进程的数据库/后端连接与非密钥定位信息；可能包含敏感连接串，只能由本机进程读取。供应商 API key 仍来自 Keychain。 |
| `.runtime/weknora/candidate.env` | TEST WeKnora 与依赖服务的本机运行配置。 |
| `.runtime/weknora/auth-public.env` | 可进入浏览器构建的 Supabase publishable/OIDC 公共值；仍不提交。 |
| `.runtime/weknora/paddle-sandbox.env` | Paddle Sandbox client token、价格 ID 等公共运行配置；服务端 API key/webhook secret 会被启动脚本忽略并改从 Keychain 读取。 |
| `.runtime/weknora/secrets/oidc_client_id` | TEST 原生 OIDC client ID，文件模式 `0600`。 |
| `.runtime/weknora/secrets/oidc_client_secret` | TEST 原生 OIDC client secret，文件模式 `0600`。 |

`candidate.env` 和生成源文件中的数据库、Redis、AES、JWT 等本地依赖凭据也
是敏感运行状态；它们不是供应商控制台密钥，不得复制到文档或提交。

## 3. PRODUCTION 服务器保护文件

服务器：SSH alias `musuw-production`，保护目录
`/opt/weknora/runtime/secrets`。目录模式为 `0700`；以下文件全部 present，
宿主机模式为 `0600`，进入容器时 Compose 以 `0400` 只读 secret 挂载：

| 文件 | 用途 |
| --- | --- |
| `db_password` | PostgreSQL |
| `redis_password` | Redis |
| `system_aes_key` | WeKnora 敏感字段加密 |
| `jwt_secret` | WeKnora 会话签名 |
| `neo4j_auth` | Neo4j |
| `oidc_client_id` / `oidc_client_secret` | Supabase OIDC |
| `searxng_secret` | SearXNG |
| `openrouter_management_api_key` | OpenRouter child-key 管理与官方额度权威 |
| `paddle_api_key` / `paddle_webhook_secret` | Paddle Live 官方 API 与签名事件 |
| `r2_access_key_id` / `r2_secret_access_key` | Cloudflare R2 S3 访问 |
| `langfuse_public_key` / `langfuse_secret_key` | Langfuse trace 写入与官方查询 |

`integration/weknora-production/app-entrypoint.sh` 只在容器启动时读取这些挂载，
并把所需值导出到应用进程。`scripts/weknora-production/prepare-runtime.sh`
会拒绝缺失、符号链接、错误权限和错误前缀，并且生成的 `production.env`
明确不允许包含 server secret。

安全地只检查文件与权限：

```sh
ssh musuw-production \
  'test -f /opt/weknora/runtime/secrets/paddle_api_key &&
   test "$(stat -c %a /opt/weknora/runtime/secrets/paddle_api_key)" = 600'
```

不要运行 `cat`、`sed`、`xxd`、`base64`、`env` 或任何会显示内容的检查。

## 4. 官方服务权威与已验证状态

| 服务 | TEST | PRODUCTION | 单一权威与边界 |
| --- | --- | --- | --- |
| WeKnora | available | available | capability-scoped 管理 API；业务 mutation 禁止裸 SQL。 |
| Paddle | Sandbox：2 subscriptions / 27 transactions | Live：0 / 0，均 HTTP 200 | Paddle 订阅、交易、退款、支付方式和门户；Musuw 只保存签名 webhook 镜像。 |
| Supabase Auth | Staging ref `achfnnicetupvtoqiwqd`，7 users | Production ref `phtveqtlswzokwsztsvu`，8 users | Supabase Auth Admin；不返回 metadata、session token 或 key。不得再使用 `fofa11111` 组织。 |
| Cloudflare R2 | 不适用：本地存储 | `musuw-production/weknora/`，40 objects / 10,220,178 bytes | R2 官方 S3 API。原文件、索引计量、租户计量和物理对象是四个不同口径。 |
| Langfuse | available | available，已读到 5 条真实生产 observations | JP Cloud `Musuw` 项目。运营投影排除 input/output/prompt/content/attachments。 |
| OpenRouter | TEST 既有链路 | 服务器 `openrouter_management_api_key` present | 官方 child keys 与 usage/limit 是额度权威；Musuw 不维护第二套 usage ledger。 |

浏览器公开值（Supabase publishable key、Paddle client token、price IDs、项目
ref、R2 bucket 名称）不是 server secret，但也不得与 server secret 混淆或用来
宣称 Admin 能力。任何“已连接”必须来自一次成功的官方 API 调用。

## 5. 轮换与交接规则

1. 在供应商后台创建替代凭据并先验证最小真实能力。
2. 用 Keychain 或远端 `0600` 文件原子替换，不经过聊天、剪贴文档或普通 env。
3. 重启对应服务，验证官方 API、真实消费者和错误态。
4. 撤销旧凭据；记录“已撤销/到期日/能力”，仍不记录值。
5. 若任何值曾出现在终端输出、DOM snapshot、截图、日志或 git diff，立即按
   已泄露处理并轮换，不能只删除视觉证据。
