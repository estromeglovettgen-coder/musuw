# Musuw 本地运营后台

Musuw 使用官方 Appsmith Community Edition 作为本机运营后台，不维护第二套 CRUD、权限或数据同步实现。它只监听 `127.0.0.1:4186`，保留 Appsmith 自带登录，且不部署到公网。

```sh
scripts/musuw-admin test
scripts/musuw-admin status
scripts/musuw-admin stop
```

固定镜像为 `appsmith/appsmith-ce:v2.2` 的已校验 digest。容器可删除，应用配置保存在 Docker volume `musuw_appsmith_stacks`；仓库和镜像都不包含数据库、Paddle、Supabase 或 R2 密钥。

当前本机入口是 <http://127.0.0.1:4186>。Appsmith CE 要求本机管理员登录；保留原生登录比关闭认证更安全，也不会增加 Musuw 自研账户系统。

## 当前页面与数据边界

- `Dashboard`：TEST 用户、账号状态、套餐、存储和额度；PostgreSQL datasource 强制 Read only。
- `知识库与文档`：知识库、文档、大小和处理状态；仍由 WeKnora 数据模型提供，原生表格仅用于查看。
- `支付、身份与存储`：Paddle Sandbox 交易/订阅、Supabase Staging Auth 用户与 Cloudflare R2 对象。凭据只保存在本机 Appsmith 的服务端 datasource 中，不进入页面 JavaScript。

TEST 已接通本机 PostgreSQL、Paddle Sandbox 和 `musuw-production` R2 桶。Supabase Staging datasource 已按官方 Admin API 配置，但当前公网出口被其 Cloudflare 边缘以 HTTP 403 拒绝；同一官方 endpoint 重试一次仍为 403，因此页面保留明确不可用状态，不伪造成功。

生产环境默认锁定。本机没有可用的生产 SSH 权限或生产 datasource，因此 `production` 即使收到显式解锁短语也会安全失败，不会把 TEST datasource 冒充成生产。只有配置生产只读 datasource、红色环境警示和正式凭据后才应启用：

```sh
MUSUW_ADMIN_PRODUCTION_UNLOCK=I_UNDERSTAND_THIS_IS_LIVE \
  scripts/musuw-admin production
```

`production` 不会自动复制 TEST 密钥或把服务器秘密拉到仓库。自动测试只允许读取生产数据。

## 写操作约束

数据库 datasource 永远只读。用户、租户、套餐、知识库和文档的业务写操作必须调用现有 WeKnora 管理接口，以继续经过 RBAC、额度、不变量和审计日志；禁止用 Appsmith PostgreSQL query 绕过这些规则。

Paddle、Supabase Auth 与 R2 操作使用各自官方服务端接口：

- Paddle 退款要求两次输入完全相同的 `txn_` 交易 ID 和原因，先查询是否已有 adjustment，再调用官方 adjustment API；本轮只验证读取和阻断态，没有创建退款。
- Supabase 封禁/软删除要求输入 `BAN:<用户 UUID>` 或 `DELETE:<用户 UUID>`，动作进入 Supabase 官方审计日志；当前网络 403 时不可执行。
- TEST 只读展示 production R2 对象，任何删除提交都会在调用 API 前被拒绝。未来启用 PRODUCTION 后，删除仍只能作用于表格中当前选中的单个 `weknora/` 对象，并须逐字输入 `DELETE:<完整对象键>`；没有批量、前缀或桶删除入口。桶级最小权限凭据只存在于 Appsmith 服务端 datasource。

页面会展示官方响应或错误。生产写操作还必须经过显式环境解锁。测试不得修改生产数据。

## 本机安全检查

```sh
docker inspect musuw-appsmith --format '{{json .HostConfig.PortBindings}}'
scripts/musuw-admin status
git grep -nE 'pdl_(sdbx|live)_apikey_|service_role|R2_SECRET_ACCESS_KEY' -- . ':!docs/LOCAL_ADMIN.md'
```

预期端口只显示 `127.0.0.1:4186`，仓库扫描无真实秘密。Appsmith 初始管理员是产品要求，不应为“免登录”关闭认证。
