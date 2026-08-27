import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import test from "node:test";
import { comparisonGroups } from "../src/data/homeContent.js";
import { applyHomepageMarketingRefresh } from "../src/homepageMarketingRefresh.js";
import { getStorefrontCopy } from "../src/i18n.js";
import { getPublicDocument } from "../src/legalContent.js";
import { applyHomepagePlanPresentation } from "../src/planPresentation.js";

const root = new URL("../", import.meta.url).pathname;

function homepageCopy(locale) {
  return applyHomepageMarketingRefresh(
    applyHomepagePlanPresentation(getStorefrontCopy(locale)),
  );
}

test("commercial home keeps the smooth template and presents the approved product hierarchy", async (t) => {
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
  const footer = renderToStaticMarkup(
    React.createElement(SiteFooter, { copy: homepageCopy("en") }),
  );
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
  const comparison = home.match(/<section class="comparison-section"[\s\S]*?<\/section>/)?.[0] ?? "";

  assert.doesNotMatch(home, /customer-(?:strip|ticker|track)/);
  assert.doesNotMatch(home, /testimonials-section|testimonial-(?:shell|card)/);
  assert.match(home, /id="feature"/);
  assert.match(home, /id="platform"/);
  assert.match(home, /id="pricing"/);
  assert.match(home, /id="faq"/);
  assert.doesNotMatch(home, /id="blog"|id="use-cases"/);
  assert.equal((home.match(/class="feature-story/g) ?? []).length, 3);
  assert.equal((home.match(/class="benefit-item platform-card"/g) ?? []).length, 6);
  assert.match(home, /RAG \+ Agent/);
  assert.match(home, /AI Wiki/);
  assert.match(home, /Knowledge Graph/);
  assert.match(home, /30\+ leading models/);
  assert.match(home, /Web and video import/);
  assert.match(home, /Knowledge that maintains itself/);
  assert.match(home, /Turn scattered sources/);
  assert.match(home, /into knowledge that works\./);
  assert.equal((comparison.match(/class="comparison-feature-row"/g) ?? []).length, 5);
  assert.doesNotMatch(comparison, /comparison-group-head|Monthly AI usage|Model catalog|Document upload and parsing|>\$0\.40</);
  for (const label of [
    "Storage",
    "Knowledge bases",
    "Documents / knowledge base",
    "Video import",
    "Advanced models",
  ]) {
    assert.match(comparison, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(home, /billing-discount-badge/);
  assert.match(home, /Save ~17%/);
  assert.match(home, /100 GiB/);
  assert.match(home, /<video/);
  assert.doesNotMatch(home, /hero-float/);
  assert.match(home, />Features</);
  assert.match(home, />Platform</);
  assert.match(home, />Pricing</);
  assert.match(home, />Security</);
  assert.match(home, />Contact</);
  assert.doesNotMatch(home, />Examples</);
  assert.doesNotMatch(home, />\$1\.00</);
  assert.doesNotMatch(footer, /social-links|x\.com\/greeenyang|support@didren\.com/);
  assert.match(footer, />© 2026 musuw\. All rights reserved\.<\/span>/);
  assert.match(contact, /contact-(?:page|layout|cards|card)/);
  assert.match(contact, /Support/);
  assert.match(contact, /Billing and refunds/);
  assert.match(contact, /Privacy and security/);
  assert.match(contact, /Merchant review/);
  assert.match(contactZh, /客户支持/);
  assert.match(contactZh, /账单与退款/);
  assert.match(contactZh, /隐私与安全/);
  assert.match(contactZh, /支付审核/);
  assert.match(contactZh, />© 2026 musuw\. All rights reserved\.<\/span>/);
});

test("legacy sections remain available without entering the public homepage", () => {
  const homePage = readFileSync(join(root, "src/HomePage.jsx"), "utf8");
  const homeSections = readFileSync(join(root, "src/components/HomeSections.jsx"), "utf8");
  const refreshSections = readFileSync(join(root, "src/components/HomeRefreshSections.jsx"), "utf8");
  const homeContent = readFileSync(join(root, "src/data/homeContent.js"), "utf8");

  assert.doesNotMatch(
    homePage,
    /<CustomerStrip\b|<TestimonialsSection\b|<WorkflowSection\b|<BlogPreviewSection\b/,
  );
  assert.match(homeSections, /visibleFeatureIndexes\s*=\s*\[0,\s*3,\s*2\]/);
  assert.match(refreshSections, /PUBLIC_COMPARISON_CAPABILITIES/);
  assert.match(refreshSections, /export function PlatformSection\s*\(/);
  assert.match(refreshSections, /export function MarketingPricingSection\s*\(/);
  assert.match(refreshSections, /export function MarketingComparisonSection\s*\(/);
  assert.match(homeSections, /export function CustomerStrip\s*\(/);
  assert.match(homeSections, /export function TestimonialsSection\s*\(/);
  assert.match(homeSections, /export function WorkflowSection\s*\(/);
  assert.match(homeSections, /export function BlogPreviewSection\s*\(/);
  assert.match(homeContent, /export const testimonials\s*=\s*\[/);
});

test("comparison rows retain the approved plan facts behind the public presentation", () => {
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
    "Advanced model access",
    "Monthly AI credit allowance",
    "Grounded dialogue",
    "Exact citations",
    "Wiki",
    "Source-version history",
    "Knowledge graph",
    "Portable export",
    "Deletion controls",
  ]);
  assert.deepEqual(rows[0].slice(1), ["1 GiB", "10 GiB", "30 GiB", "100 GiB"]);
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
  assert.deepEqual(rows[6].slice(1), [false, true, true, true]);
  assert.deepEqual(rows[7].slice(1), ["$0.40", "$1.25", "$2.50", "$5.00"]);
  rows.slice(8).forEach((row) => assert.deepEqual(row.slice(1), [true, true, true, true]));
});

test("homepage pricing copy is aligned, localized, and provider-cost free", () => {
  for (const locale of ["en", "zh-CN"]) {
    const copy = homepageCopy(locale);
    assert.equal(copy.pricing.plans.length, 4);
    assert.match(copy.pricing.yearlyDiscount, /17%/);
    assert.deepEqual(
      copy.pricing.plans.map((plan) => plan.features[0]),
      locale === "en"
        ? ["1 GiB storage", "10 GiB storage", "30 GiB storage", "100 GiB storage"]
        : ["1 GiB 存储空间", "10 GiB 存储空间", "30 GiB 存储空间", "100 GiB 存储空间"],
    );
    copy.pricing.plans.forEach((plan) => {
      assert.doesNotMatch(plan.description, /\n/);
      assert.ok(plan.description.length <= 40, `${locale} ${plan.name} description must stay on one line`);
    });
    assert.match(copy.pricing.plans[0].features.join(" "), locale === "en" ? /Standard models/ : /标准模型/);
    copy.pricing.plans.slice(1).forEach((plan) => {
      assert.match(plan.features.join(" "), locale === "en" ? /Advanced models/ : /高级模型/);
    });
    assert.doesNotMatch(copy.pricing.plans.flatMap((plan) => plan.features).join(" "), /\$\d/);
  }
});
