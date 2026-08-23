import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import test from "node:test";
import { comparisonGroups } from "../src/data/homeContent.js";
import { getStorefrontCopy } from "../src/i18n.js";
import { getPublicDocument } from "../src/legalContent.js";

const root = new URL("../", import.meta.url).pathname;

test("review-ready home hides inherited marquee, testimonials, and footer social links", async (t) => {
  const server = await createServer({
    root,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  t.after(() => server.close());

  const [{ HomePage }, { SiteFooter }, { LegalPage }] = await Promise.all([
    server.ssrLoadModule("/src/HomePage.jsx"),
    server.ssrLoadModule("/src/components/SiteChrome.jsx"),
    server.ssrLoadModule("/src/LegalPage.jsx"),
  ]);
  const copy = getStorefrontCopy("en");
  const home = renderToStaticMarkup(React.createElement(HomePage, { copy }));
  const footer = renderToStaticMarkup(React.createElement(SiteFooter, { copy }));
  const contact = renderToStaticMarkup(
    React.createElement(LegalPage, {
      copy,
      locale: "en",
      document: getPublicDocument("en", "/contact"),
    }),
  );
  const contactZh = renderToStaticMarkup(
    React.createElement(LegalPage, {
      copy: getStorefrontCopy("zh-CN"),
      locale: "zh-CN",
      document: getPublicDocument("zh-CN", "/contact"),
    }),
  );

  assert.doesNotMatch(home, /customer-(?:strip|ticker|track)/);
  assert.doesNotMatch(home, /testimonials-section|testimonial-(?:shell|card)/);
  assert.match(home, /id="feature"/);
  assert.match(home, /id="use-cases"/);
  assert.match(home, /id="pricing"/);
  assert.match(home, /id="faq"/);
  assert.equal((home.match(/class="feature-story/g) ?? []).length, 3);
  assert.match(home, /Grounded Dialogue/);
  assert.match(home, /Source Library and Upload/);
  assert.match(home, /Wiki and Graph/);
  assert.doesNotMatch(home, /Living Knowledge Base/);
  assert.doesNotMatch(home, /View Plans/);
  assert.equal((home.match(/class="comparison-group-head"/g) ?? []).length, 6);
  assert.match(home, /Workspace limits/);
  assert.doesNotMatch(footer, /social-links|x\.com\/greeenyang|support@didren\.com/);
  assert.match(footer, /© 2026 Musuw\./);
  assert.match(contact, /contact-(?:page|layout|cards|card)/);
  assert.match(contact, /Support/);
  assert.match(contact, /Billing and refunds/);
  assert.match(contact, /Privacy and security/);
  assert.match(contact, /Merchant review/);
  assert.match(contactZh, /客户支持/);
  assert.match(contactZh, /账单与退款/);
  assert.match(contactZh, /隐私与安全/);
  assert.match(contactZh, /支付审核/);
  assert.match(contactZh, /© 2026 Musuw\./);
});

test("hidden storefront sections and their source modules remain available for later reconsideration", () => {
  const homePage = readFileSync(join(root, "src/HomePage.jsx"), "utf8");
  const homeSections = readFileSync(join(root, "src/components/HomeSections.jsx"), "utf8");
  const homeContent = readFileSync(join(root, "src/data/homeContent.js"), "utf8");

  assert.doesNotMatch(homePage, /<CustomerStrip\b|<TestimonialsSection\b/);
  assert.match(homeSections, /visibleFeatureIndexes\s*=\s*\[0,\s*3,\s*2\]/);
  assert.match(homeSections, /export function CustomerStrip\s*\(/);
  assert.match(homeSections, /export function TestimonialsSection\s*\(/);
  assert.match(homeContent, /export const testimonials\s*=\s*\[/);
});

test("comparison rows expose only enforced consumer plan facts", () => {
  const rows = comparisonGroups.flatMap((group) => group.rows);
  const labels = rows.map(([label]) => label);
  assert.deepEqual(
    comparisonGroups.map(({ title }) => title),
    [
      "Workspace limits",
      "Source ingestion",
      "Model access",
      "AI allowance and grounded answers",
      "Connected knowledge",
      "Account and data controls",
    ],
  );
  assert.deepEqual(labels, [
    "Storage",
    "Knowledge bases",
    "Documents per knowledge base",
    "Document upload and parsing",
    "Video upload",
    "Platform-approved model catalog",
    "Monthly AI credit allowance",
    "Grounded dialogue",
    "Exact citations",
    "Wiki",
    "Source-version history",
    "Knowledge graph",
    "Portable export",
    "Deletion controls",
  ]);
  assert.deepEqual(rows[0].slice(1), ["5 GiB", "20 GiB", "40 GiB", "80 GiB"]);
  assert.deepEqual(rows[1].slice(1), ["1", "No plan-specific cap", "No plan-specific cap", "No plan-specific cap"]);
  assert.deepEqual(rows[2].slice(1), ["10", "No plan-specific cap", "No plan-specific cap", "No plan-specific cap"]);
  assert.deepEqual(rows[3].slice(1), [true, true, true, true]);
  assert.deepEqual(rows[4].slice(1), [false, true, true, true]);
  assert.deepEqual(rows[5].slice(1), [
    "One least-cost model per capability",
    "Expanded platform-approved catalog",
    "Expanded platform-approved catalog",
    "Expanded platform-approved catalog",
  ]);
  assert.deepEqual(rows[6].slice(1), ["$1.00", "$1.25", "$2.50", "$5.00"]);
  rows.slice(7).forEach((row) => assert.deepEqual(row.slice(1), [true, true, true, true]));
  assert.doesNotMatch(JSON.stringify(comparisonGroups), /shared workspace administration|priority support|advanced knowledge tools/i);
});

test("both storefront locales use the annual billing badge and truthful paid-plan catalog", () => {
  for (const locale of ["en", "zh-CN"]) {
    const copy = getStorefrontCopy(locale);
    assert.ok(copy.pricing.save);
    assert.match(copy.pricing.save, locale === "en" ? /^Save on annual billing$/ : /按年付费/);
    assert.doesNotMatch(JSON.stringify(copy.pricing.plans), /all configured|全部已配置/i);
    assert.match(JSON.stringify(copy.pricing.plans), /platform-approved|平台批准/i);
    const allowanceFeatures = copy.pricing.plans.map((plan) => plan.features[1]);
    assert.deepEqual(
      allowanceFeatures,
      locale === "en"
        ? [
            "$1.00 monthly AI credit allowance",
            "$1.25 monthly AI credit allowance",
            "$2.50 monthly AI credit allowance",
            "$5.00 monthly AI credit allowance",
          ]
        : ["$1.00 每月 AI 额度", "$1.25 每月 AI 额度", "$2.50 每月 AI 额度", "$5.00 每月 AI 额度"],
    );
  }
});
