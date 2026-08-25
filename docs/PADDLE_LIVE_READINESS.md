# Paddle Live 申请与切换准备清单

最后核验：2026-08-24（America/Phoenix）。本文件只记录公开页面、资源类别、
操作顺序和非敏感验证结论；不得加入审核账号凭据、个人/企业核验资料、
Paddle 资源 ID、credential 值、网络地址或供应商响应原文。

## 当前结论

| 阶段 | 当前结论 | 仍需完成 |
| --- | --- | --- |
| 网站域名送审 | **可开始准备，尚不应表述为“完整合规/必然获批”** | 所有公开产品、价格、法律与联系页面已上线；但 Paddle Seller Handbook 要求同时公开 buyer-support email 和 phone，当前没有经 owner 核验并授权公开的真实 support phone。域名审核页面没有把 phone 列为独立表单硬门槛，但缺失仍是明确审核风险。 |
| Paddle account verification | **只能由 owner 在 Dashboard 完成** | 域名审核、真实 business/individual information、identity verification。企业/个人资料不能从代码推断或代填。 |
| Live 配置与首次真实销售 | **当前明确禁止** | Live 仍为 `not-authorized`。六个 Live 价格、Live client-side token、Live API key、Live notification destination/secret、Live default payment link 和 Dashboard 商业设置都必须在获批后按下文顺序建立并整体验证。 |

固定生产现在仍是完整的 **Paddle Sandbox** 单元。生产 preflight 和 app
entrypoint 会拒绝缺项、混合环境以及一整套形状正确的 Live 输入。不要为了
“准备审核”解除这道锁；Live 切换必须是获批后的独立、可审查代码变更。

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
> in Paddle Sandbox while account and domain verification are pending; no Live
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

1. **先提交域名。** 提交主域与 app 子域，保持 HTTPS、公开产品/价格/功能、
   导航可达的 Terms/Refund/Privacy 和 operator/brand 信息。登录域可能被要求
   提供测试账号。
2. **完成真实 account verification。** owner 在 Paddle 直接提交适用的
   business/individual 和 identity 信息。business verification 对 individual
   或 sole trader 是否适用由 Paddle 当前流程决定；仓库不能判断或代填。
3. **补齐真实 support phone。** 这不是当前 Domain Review 帮助页列出的独立
   表单字段，但 Seller Handbook 明确要求 buyer-support email 与 phone 都在
   网站清楚可见。没有 owner 提供并授权的真实号码时不得编造。
4. **获批后设置 Live 基础商业选项。** 在 Dashboard 确认 balance currency、
   默认 tax-inclusive/exclusive 行为及要启用的 payment methods。balance currency
   应结合真实 payout account 选择；Paddle 仍负责买家本地币种转换、税额和各
   地区实际可用的付款方式，应用不得按 UI 语言自行推断。
5. **由 owner 填写 payout settings。** 银行/收款方式、阈值和法定资料是私密
   财务信息；它们阻断收款交付，不属于代码可代办项。
6. **只在 Live 可用后建立 Live catalog。** 建立 Plus、Pro、Max 各 monthly 与
   yearly 共六个 active recurring prices；确认产品描述和 `saas` taxable category
   与当前售卖内容一致。Sandbox 与 Live 是不同 catalog，所有 Live ID 都会不同，
   不复制测试垃圾或 Sandbox ID。
7. **创建最小权限 Live credentials。** client-side token 只供 Paddle.js；API key
   只授予运行时实际调用的 catalog-read、subscription read/update、customer
   portal session 与验证能力。值只进入既有 secret store/受保护运行文件，绝不
   进入仓库、公开 env、日志或审核材料。
8. **创建独立 Live notification destination。** 指向 app webhook；至少订阅
   `subscription.created`、`subscription.activated`、`subscription.trialing`、
   `subscription.updated`、`subscription.past_due`、`subscription.paused`、
   `subscription.resumed`、`subscription.canceled` 和 `transaction.completed`。
   destination-specific signing secret 只进 server secret store。保留 Sandbox
   destination，不混用、不覆盖。
9. **域名获批后设置 Live default payment link 为 `/pay`。** `/checkout` 需要
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
| 六个 Live recurring prices | Live 结账和 webhook 映射硬阻断 | 未创建且本次禁止创建。 |
| Live client-side token 与 API key | Paddle.js/API 技术硬阻断 | 未授权；获批后分别创建，不能混用。 |
| Live webhook destination 与 signing secret | 可靠履约/entitlement 硬阻断 | 未授权；获批后新建并做 exact-destination 签名证明。 |
| Live default payment link | Paddle transaction 技术硬阻断 | 页面 `/pay` 已有；Dashboard Live 绑定须等域名获批。 |
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
- 本次没有提交域名/Live 申请，没有创建或删除 Live provider resource，没有
  更改 Dashboard provider state，没有真实收费、退款、commit、push 或 deploy。

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
