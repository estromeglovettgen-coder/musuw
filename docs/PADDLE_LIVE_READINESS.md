# Paddle Live 申请与切换准备清单

最后核验：2026-08-24（America/Phoenix）。本文件只记录公开页面、资源类别、
操作顺序和非敏感验证结论；不得加入审核账号凭据、个人/企业核验资料、
Paddle 资源 ID、credential 值、网络地址或供应商响应原文。

## 当前结论

| 阶段 | 当前结论 | 仍需完成 |
| --- | --- | --- |
| 网站域名送审 | **`app.musuw.com` 已通过** | 所有公开产品、价格、法律与联系页面已上线；主域若未显示 approved，仍须单独确认。Paddle Seller Handbook 要求同时公开 buyer-support email 和 phone，当前没有经 owner 核验并授权公开的真实 support phone；Domain Review 页面没有把 phone 列为独立表单硬门槛，但缺失仍是审核风险。 |
| Paddle account verification | **审核中** | owner 已按 Paddle 要求提交股权/经营主体材料；等待 Paddle 结论，不重复提交、不从代码推断或代填企业/个人资料。 |
| Live 配置与首次真实销售 | **当前明确禁止** | Live 已有 catalog、credentials 和 notification destination，但尚未形成可运行单元：default payment link 为空、尚无 Live notification delivery、payout 未完成，固定生产仍拒绝 Live。不得把“资源已存在”表述成“可收费”。 |

固定生产现在仍是完整的 **Paddle Sandbox** 单元。生产 preflight 和 app
entrypoint 会拒绝缺项、混合环境以及一整套形状正确的 Live 输入。不要为了
“准备审核”解除这道锁；Live 切换必须是获批后的独立、可审查代码变更。

## 现有资源优先与禁止乱建

- 每次操作先盘点现有 Live 资源，再复用符合环境、权限和用途的 active 资源。
- 当前已有可选的 active Live API keys、active client-side tokens、完整六价格
  catalog，以及一个 active notification destination；默认路径不是再创建一套。
- 只读权限表已确认其中一个较小权限的 active API key 覆盖当前应用所需的
  `price.read`、`product.read`、`subscription.write` 和
  `customer_portal_session.write`；`subscription.write` 按 Paddle 权限规则同时
  包含 read。Paddle.js 使用 client-side token，webhook 使用 destination secret，
  不需要为它们给 server API key 追加权限。该候选当前仍同时拥有多项无关读写
  权限，因此“可复用且功能充分”不等于“已经最小权限”；本轮不编辑它，也不以
  缩权为理由新建重复 key。正式接入前先盘点其既有消费者，再把拟保留权限、
  影响和回滚写入同一份变更表。
- Paddle 官方 Live MCP 曾通过 OAuth 完成本轮只读 inventory；随后 OAuth 刷新
  健康检查失败，恢复连接前不得把它写成持续可调用。连接健康时，products/prices、
  client-side tokens、notification destinations 和 checkout domains 的盘点应优先
  由 MCP 一次完成，不再逐页手工点击。当前卖家 MCP 不提供现有 API key 权限
  清单或 account settings/default payment link 方法，所以这两类核验仍以
  Dashboard 为准；payout 和 account verification 同样保持 owner/Dashboard 路径，
  不自研绕过。重新授予持久 OAuth 访问必须在实际操作前另行确认。
- revoked credential 只保留为历史记录，不复活、不删除，也不作为运行时候选。
- 只有现有资源经官方能力和实际调用范围核验后确实不适用，才可以提出新增或
  替换；在执行前必须给 owner 展示资源用途、权限、消费者、secret 落点、切换、
  回滚和旧资源处置的完整变更表并取得确认。
- 不因 Paddle onboarding 提示词包含 “create” 就机械创建重复 key、token、
  destination、product 或 price；提示词必须先与现有 Dashboard inventory 对账。

## 两个域名与两个支付路由

### `musuw.com`

- 公开官网、产品说明、功能与限制、Free/Plus/Pro/Max 价格比较、FAQ、Contact
  以及 Terms、Privacy、Refund、Subscription、Acceptable Use 等法律页面。
- 这里解释卖什么、交付什么及购买政策；套餐 CTA 先进入应用的认证/套餐流程。
- 官网本身不持有 Paddle server credential，也不授予付费 entitlement。

### `app.musuw.com`

- 认证后的 SaaS 产品、知识处理、套餐比较和 Paddle.js 结账所在域名。
- `/checkout` 是已认证用户从 `/plans` 选择一个 server-owned 价格后的正常
  新订阅结账页。它显式调用 Paddle Checkout，不能作为交易 payment-link 的
  通用入口。
- `/pay` 是公开的 Paddle default-payment-link 页面。它只初始化 Paddle.js，
  不读取交易查询参数，也不自行调用 `Checkout.open()`；Paddle.js 会在交易
  参数存在时自动打开对应交易。这一页应在 Live 域名获批后成为 Live default
  payment link。

Paddle 要求提交每个会启动 Checkout 的域名/子域名。应把公开售卖说明所在的
主域和实际启动 Checkout 的 app 子域一并提交，审核说明中使用上面的职责划分，
不要把 `/pay` 和 `/checkout` 混写。

## 可直接提交的无凭据审核说明

以下文字可粘贴到域名审核的产品/访问说明中；reviewer credential 必须通过
Paddle 授权的私密渠道另行提供，不能粘贴到本文件、issue、日志或截图：

> musuw is a hosted knowledge workspace. The public website explains the
> product, plan pricing, included features, support, and legal policies. The app
> domain hosts authenticated product access and Paddle.js. Normal new-plan
> checkout starts on the authenticated `/checkout` route after a user selects a
> server-owned plan. The public `/pay` route is reserved for Paddle transaction
> payment links and lets Paddle.js process the transaction query parameter.
> URL imports and video uploads are limited to private knowledge analysis of
> content the user owns or is authorized to use; musuw is not a public video
> hosting, streaming, downloading, or redistribution service. Production billing remains
> in Paddle Sandbox while account verification is in review. `app.musuw.com`
> is approved; any remaining main-domain review is tracked separately. No Live
> sale is represented by the reviewer fixture.

若 Paddle 要求登录测试账号，安全交付应只包含：

1. 公开登录入口；
2. 通过 Paddle review/support 的私密字段或 owner 认可的安全渠道提供的专用
   reviewer credential；
3. 说明该账号是英文、非管理员、Sandbox-paid reviewer fixture；
4. 建议查看已有英文知识、引用、Wiki/graph、模型/推理、视频分析、Plans 和
   Usage & billing；
5. 明确无需上传私人材料、无需输入真实支付资料，也不要尝试 Live 支付。

reviewer password 和 recovery material 只保留在既有 secret storage 与授权审核
渠道；不得出现在源码、构建产物、截图、DOM snapshot、终端或助手输出中。

## URL 与视频合规边界

- URL import 只为用户拥有或获授权内容建立私人知识索引，不是抓取、流媒体
  下载或内容再分发服务。
- Video upload 只为用户拥有或获授权内容进行私人知识分析，不是面向公众的
  视频托管、播放、下载或再分发服务。
- Acceptable Use Policy 同时禁止侵权、未经授权访问、绕过限制和支付滥用。
- 产品截图/审核视频只能展示虚构且无敏感信息的英文 fixture；不能暗示允许
  下载第三方流媒体，也不能把演示视频当作可售内容。

## Dashboard 与发布的准确顺序

以下顺序以 Paddle 当前官方
[Account Verification](https://www.paddle.com/help/start/account-verification/what-is-account-verification)、
[Domain Review](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)、
[Go-live checklist](https://developer.paddle.com/build/go-live-checklist/) 和
[default payment link](https://developer.paddle.com/build/transactions/default-payment-link/)
为准。

1. **保持已通过的 app 域名，不重复提交。** `app.musuw.com` 已 approved；仅在
   主域尚未 approved 时单独提交/跟进。继续保持 HTTPS、公开产品/价格/功能、
   导航可达的 Terms/Refund/Privacy 和 operator/brand 信息。
2. **等待真实 account verification 结论。** owner 已提交 Paddle 要求的主体
   材料，当前为 in review。没有新的官方补件请求时不重复上传；仓库不能判断、
   代填或保存 business/individual/identity 材料。
3. **补齐真实 support phone。** 这不是当前 Domain Review 帮助页列出的独立
   表单字段，但 Seller Handbook 明确要求 buyer-support email 与 phone 都在
   网站清楚可见。没有 owner 提供并授权的真实号码时不得编造。
4. **获批后设置 Live 基础商业选项。** 在 Dashboard 确认 balance currency、
   默认 tax-inclusive/exclusive 行为及要启用的 payment methods。balance currency
   应结合真实 payout account 选择；Paddle 仍负责买家本地币种转换、税额和各
   地区实际可用的付款方式，应用不得按 UI 语言自行推断。
5. **由 owner 填写 payout settings。** 银行/收款方式、阈值和法定资料是私密
   财务信息；它们阻断收款交付，不属于代码可代办项。
6. **复用并核验现有 Live catalog。** Dashboard 已有 Plus、Pro、Max 三个 active
   products 及 monthly/yearly 共六个 active recurring prices。逐项确认产品说明、
   周期、币种/税类和运行时映射；不重复建立 product/price，不复制 Sandbox ID。
7. **从现有 active Live credentials 中选择最小充分权限组合。** client-side token
   只供 Paddle.js；API key 只需覆盖运行时实际调用的 catalog read、subscription
   read/update、customer portal session 与验证能力。优先复用现有 active 候选；
   credential 值只进入既有 secret store/受保护运行文件，绝不进入仓库、公开
   env、日志或审核材料。
8. **复用现有唯一 active Live notification destination。** 只读表单核验已确认
   当前九个订阅精确覆盖
   `subscription.created`、`subscription.activated`、`subscription.trialing`、
   `subscription.updated`、`subscription.past_due`、`subscription.paused`、
   `subscription.resumed`、`subscription.canceled` 和 `transaction.completed`。
   destination-specific signing secret 只进 server secret store。当前 Live log
   尚无投递证据，必须先完成签名交付验证；保留 Sandbox destination，不混用、
   不覆盖，也不为相同用途新建第二个 destination。
9. **经 owner 确认后设置 Live default payment link 为 `/pay`。** app 域名已获批，
   但 Dashboard 当前值仍为空。拟提交值为 `https://app.musuw.com/pay`；`/checkout` 需要
   已认证计划上下文，不适合 Paddle 生成的 transaction/update-payment 链接。
   Paddle 要求 default page 包含 Paddle.js；交易参数由 Paddle.js 自动处理。
10. **在真实边缘层处理 webhook 防护。** 当前应用已经对 raw body 验证 Paddle
    signature、幂等处理重复事件并只让签名 subscription 事件授予套餐。Paddle
    还建议 allowlist 其分环境 webhook source addresses；这是安全建议，不是
    account application 的表单硬门槛。Musuw 位于 Cloudflare/Tunnel 后，必须在
    能看到真实 provider source 的边缘层按 Paddle 当时的官方列表配置，不能在
    origin 盲信可伪造的 forwarded header，也不能复制一份会过期的地址到代码。
11. **原子准备整个 Live 单元。** 一次性准备 environment、client-side token、
    API key、destination secret 和六个 Live prices；任何缺失、重复或 Sandbox/
    Live 混合都应继续 fail closed。随后通过单独 review 修改固定生产的
    Sandbox-only wrapper；不能只改环境变量。
12. **配置 Retain/dunning。** Retain 只处理 Live 数据。应用现在会把已认证租户
    从签名 provider state 得到的合法 Paddle customer ID 传给
    `Paddle.Initialize()`，并在 SPA 后识别客户时用 `Paddle.Update()` 更新；它不
    接受浏览器提交的 internal tenant/customer claim，也不授予 entitlement。
    Dashboard 的恢复/重试设置仍须在 Live 中由 owner 确认。
13. **先做无真实收费的 Live 健康验证。** 验证 API authentication、六个价格
    全部解析且 recurring/active、默认链接页面加载、exact destination 的签名
    simulation 在五秒内得到成功响应、重复投递无重复副作用、未知价格/错误签名
    fail closed。完成这些之前不能把 Live 描述为 operational。
14. **最后才允许一次受控真实付款验收。** 这必须另获用户明确授权，并在当时
    记录退款/清理/回滚安排；本次任务不执行。

## 阻断级别速查

| 项目 | 阻断级别 | 当前状态 |
| --- | --- | --- |
| 公开产品、价格、功能、Terms/Refund/Privacy、HTTPS | 域名审核硬要求 | 已有公开页面；本地新增视频边界需正常发布后才算线上证据。 |
| 真实 support phone | Seller Handbook 合规要求/审批风险；不是 Domain Review 页面列出的独立提交字段 | 缺失，等待 owner 提供并授权；不可伪造。 |
| reviewer account | Paddle 对登录产品可能要求 | 现有专用英文 fixture；仅可由主交付线程通过安全渠道传凭据。 |
| business/identity information | account verification 硬阻断 | owner-only，不能从仓库推断。 |
| 六个 Live recurring prices | Live 结账和 webhook 映射硬阻断 | 已有 3 products/6 active recurring prices；仍须与运行时六映射逐项核验，禁止重复创建。 |
| Live client-side token 与 API key | Paddle.js/API 技术硬阻断 | 已有 active 候选；必须选择并复用最小充分权限组合，尚未接入固定生产。 |
| Live webhook destination 与 signing secret | 可靠履约/entitlement 硬阻断 | 已有唯一 active destination，九个所需事件已精确核对；尚无 Live delivery，须复用并完成 exact-destination 签名证明。 |
| Live default payment link | Paddle transaction 技术硬阻断 | 页面 `/pay` 与 app 域名审批已有；Dashboard 值仍为空，提交前需 owner 确认。 |
| tax mode、balance currency、payment methods | Live 商业配置硬阻断 | Dashboard owner decision；应用继续让 Paddle 决定买家税/币种/eligible methods。 |
| payout settings | 获得 payout 的硬阻断，不是代码项 | owner-only 私密资料。 |
| `pwCustomer` / Retain | 完整 Live Retain 准备阻断；Sandbox 不加载 Retain | 代码已本地补齐，尚未发布；Dashboard Live dunning 仍待配置。 |
| webhook source allowlist | 官方推荐的纵深防御，不是申请表硬门槛 | 待 Live edge 配置；signature verification 已有且仍是必须保留的主校验。 |
| 固定生产 Sandbox-only lock | 当前安全硬边界 | 保持启用；只有获批后的独立代码 review 才能修改。 |

## 当前非敏感证据

- 公网主域的首页、Terms、Privacy、Refund、Contact，以及 app 的首页、`/pay`
  和 `/checkout` 均返回成功；公开 Paddle config 只有环境、configured 状态和
  client-side token，当前环境仍为 Sandbox。
- 2026-08-24 通过 Paddle.js `PricePreview()` 对当前六个 Sandbox 映射做了
  只读核验：六项全部返回、互不重复、exact mapping、active、recurring、
  `saas` tax category，且都有 Paddle 格式化价格与 currency code；没有创建
  transaction 或 charge。
- 现有生产证据保留同一 Sandbox destination 的签名 lifecycle 与
  `transaction.completed` 成功投递、重复事件幂等和浏览器回调不授予套餐。
- 当前代码仍由 raw-body Paddle SDK verifier、server-owned price allowlist、
  tenant binding 和 signed webhook 共同决定 entitlement。
- 2026-08-24 Live Dashboard 只读盘点确认：app 域名已 approved；account verification
  in review；现有 3 products/6 active recurring prices、2 个 active API key 候选、
  2 个 active client-side token 和 1 个 active/九事件 notification destination。
  另有一个 revoked API key，仅保留历史；default payment link 为空，Live
  notification log 尚无投递。
- 同日 Paddle 官方 Live MCP 的只读 inventory 与上述 catalog、client-side token、
  notification destination 和 checkout domain 结论一致；调用只返回脱敏后的
  计数、状态和事件集合，没有返回 credential、destination URL 或资源 ID。
- 本轮只读盘点没有创建、撤销、删除或重建任何 Paddle resource，没有更改
  Dashboard state，也没有真实收费或退款。

## 官方依据

- [Paddle Account Verification](https://www.paddle.com/help/start/account-verification/what-is-account-verification)
- [Paddle Domain Review](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)
- [Paddle Seller Handbook](https://www.paddle.com/seller-guides/seller-handbook)
- [Paddle setup checklist](https://developer.paddle.com/build/set-up-checklist/)
- [Paddle go-live checklist](https://developer.paddle.com/build/go-live-checklist/)
- [Set your default payment link](https://developer.paddle.com/build/transactions/default-payment-link/)
- [Build a localized pricing page](https://developer.paddle.com/build/checkout/build-pricing-page/)
- [Paddle.Initialize and Retain](https://developer.paddle.com/paddle-js/methods/paddle-initialize/)
- [Paddle.Update](https://developer.paddle.com/paddle-js/methods/paddle-update/)
- [Handle webhook delivery](https://developer.paddle.com/webhooks/about/respond-to-webhooks/)
