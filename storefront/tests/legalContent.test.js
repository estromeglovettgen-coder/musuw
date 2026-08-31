import assert from "node:assert/strict";
import test from "node:test";

const requiredRoutes = [
  "/terms",
  "/privacy",
  "/refund-policy",
  "/subscription-policy",
  "/acceptable-use",
  "/cookies",
  "/security",
  "/contact"
];

test("every merchant-review document is public and complete in English and Chinese", async () => {
  const {
    LEGAL_OPERATOR,
    PUBLIC_DOCUMENT_PATHS,
    getPublicDocument,
    getPublicDocumentMeta
  } = await import("../src/legalContent.js");

  assert.equal(LEGAL_OPERATOR.englishName, "Hangzhou Didren Technology Co., Ltd.");
  assert.equal(LEGAL_OPERATOR.supportEmail, "support@didren.com");
  assert.equal(LEGAL_OPERATOR.supportPhone, "+86 19176942082");
  assert.deepEqual(PUBLIC_DOCUMENT_PATHS, requiredRoutes);
  for (const route of requiredRoutes) {
    for (const locale of ["en", "zh-CN"]) {
      const document = getPublicDocument(locale, route);
      assert.equal(document.path, route);
      assert.ok(document.title.length >= 4);
      assert.ok(document.summary.length >= 30);
      assert.equal(
        document.updated,
        ["/privacy", "/subscription-policy"].includes(route)
          ? "2026-08-30"
          : ["/terms", "/refund-policy"].includes(route)
            ? "2026-08-29"
            : "2026-08-27",
      );
      assert.ok(document.sections.length >= 3, `${route} needs substantive sections in ${locale}`);
      assert.ok(document.sections.every((section) => section.heading && section.blocks?.length));

      const meta = getPublicDocumentMeta(locale, route);
      assert.match(meta.title, /musuw/);
      assert.ok(meta.description.length >= 30);
    }
  }

  assert.equal(getPublicDocument("en", "/missing"), null);
  assert.equal(getPublicDocumentMeta("en", "/missing"), null);
});

test("policies identify the operator, support channel, Paddle terms, and mandatory rights", async () => {
  const { getPublicDocument } = await import("../src/legalContent.js");
  const flatten = (locale, route) => JSON.stringify(getPublicDocument(locale, route));

  for (const locale of ["en", "zh-CN"]) {
    const all = requiredRoutes.map((route) => flatten(locale, route)).join("\n");
    assert.match(all, /Hangzhou Didren Technology Co\., Ltd\./);
    assert.match(all, /杭州地底人科技有限公司/);
    assert.match(all, /support@didren\.com/);

    const contactPage = flatten(locale, "/contact");
    assert.match(contactPage, /\+86 19176942082/);
    assert.match(contactPage, /tel:\+8619176942082/);
    assert.doesNotMatch(all, locale === "zh-CN" ? /3\s*个工作日/ : /three business days/i);

    const refund = flatten(locale, "/refund-policy");
    assert.match(
      refund,
      locale === "zh-CN"
        ? /不提供自愿退款.*最终交易且不予退款|最终交易且不予退款.*不提供自愿退款/
        : /does not offer voluntary refunds.*final and non-refundable/i,
    );
    assert.match(refund, locale === "zh-CN" ? /Paddle.*退款|退款.*Paddle/ : /Paddle.*Refund|Refund.*Paddle/i);
    assert.match(refund, locale === "zh-CN" ? /强制性.*消费者|法定.*权利/ : /mandatory consumer rights/i);

    const subscription = flatten(locale, "/subscription-policy");
    assert.match(subscription, locale === "zh-CN" ? /自动续费/ : /automatically renew/i);
    assert.match(subscription, locale === "zh-CN" ? /取消/ : /cancel/i);
    assert.match(
      subscription,
      locale === "zh-CN"
        ? /账户注销.*停止后续自动续费|停止后续自动续费.*账户注销/
        : /account closure.*stops future automatic renewals|stops future automatic renewals.*account closure/i,
    );
    assert.match(
      subscription,
      locale === "zh-CN" ? /账户注销.*不会自动退款|不会自动退款.*账户注销/ : /account closure.*does not automatically refund|does not automatically refund.*account closure/i,
    );
    assert.match(
      subscription,
      locale === "zh-CN"
        ? /不提供自愿.*最终交易且不予退款/
        : /does not offer voluntary.*final and non-refundable/i,
    );

    const terms = flatten(locale, "/terms");
    assert.match(terms, /Paddle/);
    assert.match(terms, /Merchant of Record|商户记录方/);
    assert.doesNotMatch(
      `${terms}\n${refund}\n${subscription}`,
      locale === "zh-CN"
        ? /30\s*个?日历日|30\s*天退款保证|退款保证/
        : /30[- ](?:calendar[- ]day|day)|30 calendar days/i,
    );
    assert.match(
      terms,
      locale === "zh-CN"
        ? /Paddle 负责所有客户服务咨询并处理退货/
        : /Paddle provides all customer service inquiries and handles returns/,
    );
    for (const href of [
      "https://www.paddle.com/legal/buyer-terms",
      "https://www.paddle.com/legal/refund-policy",
      "https://paddle.net/"
    ]) {
      assert.match(terms, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    const privacy = flatten(locale, "/privacy");
    for (const concept of locale === "zh-CN"
      ? [/收集/, /用途|目的/, /保留/, /跨境/, /权利/, /删除/]
      : [/collect/i, /purpose/i, /retain/i, /international/i, /rights/i, /delete/i]) {
      assert.match(privacy, concept);
    }
    assert.match(
      privacy,
      locale === "zh-CN"
        ? /客服渠道|support@didren\.com/
        : /support channel|support@didren\.com/i,
    );
    assert.match(
      privacy,
      locale === "zh-CN"
        ? /获授权的运营人员.*受限内部功能/
        : /authorized operations staff.*restricted/i,
    );
    assert.doesNotMatch(
      privacy,
      locale === "zh-CN" ? /设置.*用户信息.*删除账号/ : /Settings.*Profile.*Delete account/i,
    );
    assert.doesNotMatch(
      privacy,
      locale === "zh-CN"
        ? /标准化邮箱/
        : /exact normalized current account email/i,
    );
    assert.match(
      privacy,
      locale === "zh-CN"
        ? /Paddle.*商户记录方|商户记录方.*Paddle/
        : /Paddle.*Merchant of Record|Merchant of Record.*Paddle/i,
    );
    assert.match(
      privacy,
      locale === "zh-CN"
        ? /发票.*交易记录|交易记录.*发票/
        : /invoices?.*transaction records?|transaction records?.*invoices?/i,
    );
    assert.match(
      privacy,
      locale === "zh-CN"
        ? /税务.*会计.*反欺诈.*拒付|反欺诈.*拒付.*争议/
        : /tax.*accounting.*fraud.*chargeback|fraud.*chargeback.*dispute/i,
    );
    assert.match(
      privacy,
      locale === "zh-CN" ? /各自.*留存期限/ : /own retention periods/i,
    );
    for (const provider of ["Supabase", "Resend", "Google", "Cloudflare", "OpenRouter", "Langfuse", "Paddle"]) {
      assert.match(privacy, new RegExp(provider));
    }

    const acceptableUse = flatten(locale, "/acceptable-use");
    assert.match(
      acceptableUse,
      locale === "zh-CN"
        ? /网页导入.*私人知识索引.*不是流媒体下载.*内容再分发/
        : /URL imports.*private knowledge indexing.*not a streaming downloader.*content redistribution/i
    );
    assert.match(
      acceptableUse,
      locale === "zh-CN"
        ? /视频上传.*私人知识分析.*不是面向公众的视频托管.*流媒体.*再分发/
        : /Video uploads.*private knowledge analysis.*not a public video hosting.*streaming.*redistribution/i
    );

    const security = flatten(locale, "/security");
    assert.doesNotMatch(
      security,
      locale === "zh-CN" ? /准备上线|正准备提供/ : /prepared for launch|being prepared to provide/i
    );

    const cookies = flatten(locale, "/cookies");
    assert.match(cookies, /Cloudflare/);
    assert.match(
      cookies,
      locale === "zh-CN" ? /不加载.*分析|未加载.*分析/ : /does not load.*analytics/i
    );
    assert.match(cookies, locale === "zh-CN" ? /浏览器存储/ : /browser storage/i);
    assert.match(cookies, locale === "zh-CN" ? /不.*跨.*追踪/ : /does not.*use cross-site behavioral tracking/i);
  }
});

test("privacy policy links to the named providers' own notices", async () => {
  const { getPublicDocument } = await import("../src/legalContent.js");
  for (const locale of ["en", "zh-CN"]) {
    const privacy = JSON.stringify(getPublicDocument(locale, "/privacy"));
    for (const href of [
      "https://supabase.com/privacy",
      "https://resend.com/legal/privacy-policy",
      "https://policies.google.com/privacy",
      "https://www.cloudflare.com/privacypolicy/",
      "https://openrouter.ai/privacy",
      "https://langfuse.com/privacy",
      "https://langfuse.com/security/data-regions",
      "https://www.paddle.com/legal/privacy"
    ]) {
      assert.match(privacy, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("the application and footer expose direct document routes", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const chrome = await readFile(new URL("../src/data/homeContent.js", import.meta.url), "utf8");
  const siteChrome = await readFile(new URL("../src/components/SiteChrome.jsx", import.meta.url), "utf8");
  const legalContent = await readFile(new URL("../src/legalContent.js", import.meta.url), "utf8");
  const i18n = await readFile(new URL("../src/i18n.js", import.meta.url), "utf8");
  const legacyCompanyToken = ["Didi", "ren"].join("");
  const legacyDomain = ["didi", "ren.com"].join("");

  assert.match(app, /getPublicDocument/);
  assert.match(app, /LegalPage/);
  assert.match(legalContent, /support@didren\.com/);
  assert.doesNotMatch(`${siteChrome}\n${i18n}`, new RegExp(`${legacyCompanyToken}|${legacyDomain}`, "i"));
  for (const route of ["/terms", "/privacy", "/refund-policy", "/security", "/contact"]) {
    assert.match(chrome, new RegExp(route.replace("/", "\\/")));
  }
});

test("account security guidance matches Google and email-code sign-in", async () => {
  const { getPublicDocument } = await import("../src/legalContent.js");
  const english = JSON.stringify(getPublicDocument("en", "/security"));
  const chinese = JSON.stringify(getPublicDocument("zh-CN", "/security"));

  assert.match(english, /Google account.*email inbox.*multi-factor authentication/i);
  assert.match(chinese, /Google 账户.*邮箱.*多因素认证/);
  assert.doesNotMatch(`${english}\n${chinese}`, /strong,? unique password|唯一强密码/i);
});
