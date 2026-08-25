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
- **账单**：由 Paddle 签名事件形成的 Musuw 镜像，以及启动时明确选定的
  Paddle 环境通过官方 API 返回的订阅和交易。订阅与交易按能力独立读取；某一项缺少
  权限时只把该项标为 unavailable，已授权数据继续展示，也不会把 403
  伪装成 0 条记录或整页失败。
- **身份**：Musuw 账号镜像和正确的 Supabase 项目标识。只有服务端查询
  适配器实际调用 Supabase Admin API 成功后才宣称官方数据 available；仅检测
  到一个凭据不会冒充连接成功。
- **存储**：分开显示 `file_size`、`storage_size`、
  `tenant.storage_used`、套餐配额、Musuw 后端和物理对象引用。
  “数据库有引用”不会被描述成“R2 HEAD 已成功”。
- **日志与追踪**：直接复用 Musuw 的运行队列与系统审计组件。
  Langfuse 查询未配置时显示 unavailable；不会绘制虚假空图表。

数据权威保持单一：

- PostgreSQL 连接强制 `default_transaction_read_only=on`，只负责运营查询。
- 用户/空间状态、配额和 OpenRouter 额度写入仅调用 Musuw
  capability-scoped 管理 API，继续经过服务端校验与系统审计。
- 队列操作直接复用 Musuw 原生运行队列 API 和确认框。
- Paddle 订阅/交易来自官方 API；套餐状态仍只由签名 webhook 和现有
  billing 服务维护。
- Supabase、Cloudflare R2 和 Paddle 的复杂高风险操作优先打开各自官方
  Console，不在 Musuw 里复制一套供应商控制台。

## 当前能力状态

- Musuw scoped management API：TEST 与 PRODUCTION 均 available。平台密钥
  只从 macOS Keychain 对应环境账号读取，不进入页面 JavaScript、日志或仓库。
- Paddle：当前固定产品运行时和可接受的支付证据是 Sandbox。历史上某个
  Live-shaped 运营台配置能够读取 provider API，只证明该读取调用当时可达，
  不证明 account/domain approval、Live 授权或可售状态。浏览器只接收字段
  白名单投影；套餐仍只由签名 webhook 更新，退款、支付和供应商级配置继续
  交给 Paddle 官方后台。
- Supabase Auth Admin：Musuw Staging `achfnnicetupvtoqiwqd` 与 Musuw
  Production `phtveqtlswzokwsztsvu` 已分别在 TEST/PRODUCTION 进程通过官方
  Admin API。单个进程只读取所选环境凭据；另一项目仅显示 ref 与未选择状态。
  服务端不返回 `user_metadata`、令牌或密钥。
- Cloudflare R2：PRODUCTION 通过官方 S3 API 读取 `musuw-production/weknora/`
  清单；TEST 的产品运行时使用本地存储，所以明确显示“不适用”，不要求或
  伪造一组 TEST R2 凭据。
- Langfuse：TEST 与 PRODUCTION 均连接 JP Cloud 的 `Musuw` 项目。生产应用
  已产生真实 trace；运营台只展示 observation ID、trace ID、类型、模型、
  用量、环境、release 和时间，不返回 input、output、prompt、content 或附件。

密钥位置、账号、远端文件、权限边界和安全的“只检查存在性”命令统一记录在
[`docs/SECRETS_AND_INTEGRATIONS.md`](SECRETS_AND_INTEGRATIONS.md)。该文档不含
任何密钥值。

## 2026-08-22 真实浏览器验收（Paddle 状态已被当前边界取代）

- PRODUCTION 七页当时以真实数据渲染；所选 Paddle provider 配置的订阅与交易
  读取返回可用但为空，不把真实空页伪装成失败。该历史读取不能再标注为
  “Paddle Live 已连接/授权”；当前固定产品支付环境是完整 Sandbox，Live 为
  `not-authorized`。其他 Supabase、R2 与 Langfuse 验收结论不受此更正影响。
- TEST 七页全部通过：7 位用户；Paddle Sandbox 返回 2 个订阅、27 个交易；
  Supabase 与 Langfuse 可用；R2 以“TEST 本地存储”显示为不适用。
- Chrome 实际打开用户完整详情、严格脱敏调查、文档详情和 `UPDATE:<tenant>`
  二次确认表单。确认按钮在输入精确短语前禁用；验收没有提交生产业务写入。
- 一次低成本 PRODUCTION 对话经过消费者、WeKnora、模型和 Langfuse，随后
  运营台通过官方 API 读取到 5 条安全 observation 元数据，且页面搜索不到
  原始 prompt。
- Playwright 3/3 通过，覆盖真实运营流程、404/403/CSRF/脱敏边界和全部七页
  WCAG A/AA serious/critical 扫描。浏览器与自动化均无控制台错误。

## TEST / PRODUCTION 切换

环境在进程启动时锁定，浏览器内不能切换 datasource：

```sh
scripts/musuw-admin test

MUSUW_ADMIN_PRODUCTION_UNLOCK=I_UNDERSTAND_THIS_IS_LIVE \
  scripts/musuw-admin production
```

这里的解锁短语表示运营台将读取真实生产业务数据，不代表 Paddle Live
provider 已获批或允许用于结账。

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

浏览器验收覆盖七页导航、真实非空数据、搜索/筛选、详情抽屉、按能力拆分
的 provider available/unavailable/not-applicable 状态、危险动作确认、CSRF、
审计、404/403 边界、敏感字段脱敏，以及全部七页的 WCAG A/AA 严重问题扫描。
