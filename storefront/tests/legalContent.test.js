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
  assert.deepEqual(PUBLIC_DOCUMENT_PATHS, requiredRoutes);
  for (const route of requiredRoutes) {
    for (const locale of ["en", "zh-CN"]) {
      const document = getPublicDocument(locale, route);
      assert.equal(document.path, route);
      assert.ok(document.title.length >= 4);
      assert.ok(document.summary.length >= 30);
      assert.match(document.updated, /^2026-08-01$/);
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

test("policies identify the operator, support channel, refund promise, and conditional sellers", async () => {
  const { getPublicDocument } = await import("../src/legalContent.js");
  const flatten = (locale, route) => JSON.stringify(getPublicDocument(locale, route));

  for (const locale of ["en", "zh-CN"]) {
    const all = requiredRoutes.map((route) => flatten(locale, route)).join("\n");
    assert.match(all, /Hangzhou Didren Technology Co\., Ltd\./);
    assert.match(all, /杭州地底人科技有限公司/);
    assert.match(all, /support@didren\.com/);

    const refund = flatten(locale, "/refund-policy");
    assert.match(refund, locale === "zh-CN" ? /30\s*个?日|30\s*天/ : /30 calendar days/i);
    assert.match(refund, locale === "zh-CN" ? /续费/ : /renewal/i);
    assert.match(refund, locale === "zh-CN" ? /强制性.*消费者|法定.*权利/ : /mandatory consumer rights/i);

    const subscription = flatten(locale, "/subscription-policy");
    assert.match(subscription, locale === "zh-CN" ? /自动续费/ : /automatically renew/i);
    assert.match(subscription, locale === "zh-CN" ? /取消/ : /cancel/i);

    const terms = flatten(locale, "/terms");
    assert.match(terms, /Paddle/);

    const privacy = flatten(locale, "/privacy");
    for (const concept of locale === "zh-CN"
      ? [/收集/, /用途|目的/, /保留/, /跨境/, /权利/, /删除/]
      : [/collect/i, /purpose/i, /retain/i, /international/i, /rights/i, /delete/i]) {
      assert.match(privacy, concept);
    }

    const cookies = flatten(locale, "/cookies");
    assert.match(cookies, /Cloudflare Web Analytics/);
    assert.match(cookies, locale === "zh-CN" ? /不使用 Cookie|浏览器存储/ : /cookie-free|browser storage/i);
    assert.match(cookies, locale === "zh-CN" ? /不.*跨.*追踪/ : /does not track.*across/i);
  }
});

test("the application and footer expose direct document routes", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const chrome = await readFile(new URL("../src/data/homeContent.js", import.meta.url), "utf8");
  const siteChrome = await readFile(new URL("../src/components/SiteChrome.jsx", import.meta.url), "utf8");
  const i18n = await readFile(new URL("../src/i18n.js", import.meta.url), "utf8");
  const legacyCompanyToken = ["Didi", "ren"].join("");
  const legacyDomain = ["didi", "ren.com"].join("");

  assert.match(app, /getPublicDocument/);
  assert.match(app, /LegalPage/);
  assert.match(siteChrome, /support@didren\.com/);
  assert.match(i18n, /Hangzhou Didren Technology Co\., Ltd\./);
  assert.doesNotMatch(`${siteChrome}\n${i18n}`, new RegExp(`${legacyCompanyToken}|${legacyDomain}`, "i"));
  for (const route of ["/terms", "/privacy", "/refund-policy", "/security", "/contact"]) {
    assert.match(chrome, new RegExp(route.replace("/", "\\/")));
  }
});

test("account security guidance matches Google-only sign-in", async () => {
  const { getPublicDocument } = await import("../src/legalContent.js");
  const english = JSON.stringify(getPublicDocument("en", "/security"));
  const chinese = JSON.stringify(getPublicDocument("zh-CN", "/security"));

  assert.match(english, /Google account.*multi-factor authentication/i);
  assert.match(chinese, /Google 账户.*多因素认证/);
  assert.doesNotMatch(`${english}\n${chinese}`, /strong,? unique password|唯一强密码/i);
});
