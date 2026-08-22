# Musuw 本地运营中台

Musuw 运营中台是仓库内的 TDesign Vue Next 多入口应用，复用腾讯
TDesign 的组件与交互规范，不再运行 Appsmith，也不维护第二套业务
CRUD、权限系统或数据同步层。服务只监听 `127.0.0.1:4186`，不会部署到
公网。

```sh
scripts/musuw-admin test
scripts/musuw-admin status
scripts/musuw-admin logs
scripts/musuw-admin stop
```

入口：<http://127.0.0.1:4186>

启动器先执行前端类型检查和生产构建，再启动本机 Node 服务。旧
`musuw-appsmith` 容器会被删除；Docker volume `musuw_appsmith_stacks`
和镜像暂时保留，便于确认无遗漏后恢复或单独清理，但它们已不再参与运行。

## 页面和数据权威

固定左栏包含七个页面：

- **概览**：用户、空间、知识库、文档、配额、最近文档和官方服务状态。
- **用户**：搜索与套餐/状态筛选、完整详情抽屉、provider-backed
  entitlement 和严格脱敏的支持调查。
- **知识库与文档**：知识库、文档、解析状态、错误、原文件大小、索引
  计量、存储后端和物理引用。
- **账单**：由 Paddle 签名事件形成的 Musuw 镜像，以及 Paddle 官方 API
  返回的 Sandbox/Live 订阅和交易。Paddle 不可用时明确显示 unavailable，
  不把它伪装成 0 条记录。
- **身份**：WeKnora 账号镜像和正确的 Supabase 项目标识。只有服务端查询
  适配器实际调用 Supabase Admin API 成功后才宣称官方数据 available；仅检测
  到一个凭据不会冒充连接成功。
- **存储**：分开显示 `file_size`、`storage_size`、
  `tenant.storage_used`、套餐配额、WeKnora 后端和物理对象引用。
  “数据库有引用”不会被描述成“R2 HEAD 已成功”。
- **日志与追踪**：直接复用 WeKnora 的运行队列与系统审计组件。
  Langfuse 查询未配置时显示 unavailable；不会绘制虚假空图表。

数据权威保持单一：

- PostgreSQL 连接强制 `default_transaction_read_only=on`，只负责运营查询。
- 用户/空间状态、配额和 OpenRouter 额度写入仅调用 WeKnora
  capability-scoped 管理 API，继续经过服务端校验与系统审计。
- 队列操作直接复用 WeKnora 原生运行队列 API 和确认框。
- Paddle 订阅/交易来自官方 API；套餐状态仍只由签名 webhook 和现有
  billing 服务维护。
- Supabase、Cloudflare R2 和 Paddle 的复杂高风险操作优先打开各自官方
  Console，不在 Musuw 里复制一套供应商控制台。

## 当前 TEST 能力状态

- WeKnora scoped management API：available。平台密钥只从 macOS Keychain
  的 `com.musuw.local-admin.platform-key` / `musuw-admin-test` 项读取，
  不进入环境文件、页面 JavaScript、日志或仓库。
- Paddle Sandbox：available。只从 ignored runtime 读取最小权限凭据，
  浏览器只接收经过字段白名单的订阅/交易投影。
- Supabase Auth Admin：unavailable，因为本机没有 Auth Admin 服务端凭据，且
  当前运营服务没有启用官方查询适配器。
  项目必须显示为 Musuw Staging `achfnnicetupvtoqiwqd` 与 Musuw Production
  `phtveqtlswzokwsztsvu`，不能使用别的组织或伪造空用户列表。
- Cloudflare R2 operator：unavailable，因为本机运营服务没有独立 R2
  operator credential，也没有启用对象清单适配器。生产 `musuw-production` 桶已通过 Cloudflare 官方
  Console 只读核对；中台不会把 WeKnora 对象引用冒充成官方对象清单。
- Langfuse query：unavailable，因为没有查询凭据，也没有启用查询适配器。
  WeKnora request ID、处理 span、运行队列和审计仍可使用。

## TEST / PRODUCTION 切换

环境在进程启动时锁定，浏览器内不能切换 datasource：

```sh
scripts/musuw-admin test

MUSUW_ADMIN_PRODUCTION_UNLOCK=I_UNDERSTAND_THIS_IS_LIVE \
  scripts/musuw-admin production
```

PRODUCTION 还要求本机 ignored 文件
`.runtime/musuw-admin/production.env` 提供独立数据库、后端和供应商配置。
缺文件、缺解锁短语或数据库不是只读时都 fail closed；TEST 凭据不会自动
复制到 PRODUCTION。自动测试不得写生产数据。

## 写操作与安全边界

- 用户管理只接受 `active`/`inactive`、正数存储配额，以及当前套餐范围内
  的 OpenRouter 额度重置/调整；套餐和 Paddle 字段不能由表单修改。
- 用户管理必须逐字输入 `UPDATE:<tenant_id>`；运行队列动作使用 TDesign
  原生确认框。
- 所有浏览器写请求同时要求本机会话、`SameSite=Strict` cookie、精确
  Origin 和 CSRF token。仅打开 API URL 不会创建会话。
- Node 代理精确允许 entitlement、用户调查、租户白名单更新、OpenRouter
  额度、运行队列和审计路由。系统设置和平台密钥管理仍返回 404；越权
  mutation 返回 403。
- 支持调查永远不返回 prompt、message content、attachments、provider
  keys、span payload 或 dead-letter payload。
- CSP、`frame-ancestors 'none'`、`X-Frame-Options: DENY`、host allowlist、
  12 秒上游超时和有限分页均由服务端强制执行。

## 验证

```sh
npm run admin:build
npm run admin:test
npm run admin:e2e
```

浏览器验收覆盖七页导航、真实非空数据、搜索/筛选、详情抽屉、明确的
provider unavailable 状态、危险动作确认、CSRF、审计、404/403 边界、
敏感字段脱敏和 WCAG A/AA 严重问题扫描。
