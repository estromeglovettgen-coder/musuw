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
import { applyHomepagePlanPresentation } from "../src/planPresentation.js";

const root = new URL("../", import.meta.url).pathname;

test("review-ready home keeps the original template while focusing on the second-brain story", async (t) => {
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
  assert.doesNotMatch(home, /id="use-cases"/);
  assert.match(home, /id="blog"/);
  assert.match(home, /id="pricing"/);
  assert.match(home, /id="faq"/);
  assert.equal((home.match(/class="feature-story/g) ?? []).length, 3);
  assert.match(home, /Grounded answers/);
  assert.match(home, /AI-organized Wiki/);
  assert.match(home, /Knowledge graph/);
  assert.match(home, /Knowledge compounds/);
  assert.match(home, /A second brain/);
  assert.doesNotMatch(home, /Source Library and Upload|Living Knowledge Base/);
  assert.equal((home.match(/class="comparison-group-head"/g) ?? []).length, 6);
  assert.match(home, /Advanced models/);
  assert.match(home, /100 GiB/);
  assert.match(home, /<video/);
  assert.doesNotMatch(home, /hero-float/);
  assert.match(home, />Features</);
  assert.match(home, />Examples</);
  assert.match(home, />Pricing</);
  assert.match(home, />Security</);
  assert.match(home, />Contact</);
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

test("hidden storefront sections and their source modules remain available for later reconsideration", () => {
  const homePage = readFileSync(join(root, "src/HomePage.jsx"), "utf8");
  const homeSections = readFileSync(join(root, "src/components/HomeSections.jsx"), "utf8");
  const homeContent = readFileSync(join(root, "src/data/homeContent.js"), "utf8");

  assert.doesNotMatch(homePage, /<CustomerStrip\b|<TestimonialsSection\b|<WorkflowSection\b/);
  assert.match(homeSections, /visibleFeatureIndexes\s*=\s*\[0,\s*3,\s*2\]/);
  assert.match(homeSections, /export function CustomerStrip\s*\(/);
  assert.match(homeSections, /export function TestimonialsSection\s*\(/);
  assert.match(homeSections, /export function WorkflowSection\s*\(/);
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
  assert.doesNotMatch(JSON.stringify(comparisonGroups), /shared workspace administration|priority support|advanced knowledge tools/i);
});

test("homepage plan copy exposes user-facing capacity and model access without provider-dollar amounts", () => {
  for (const locale of ["en", "zh-CN"]) {
    const rawCopy = getStorefrontCopy(locale);
    const copy = applyHomepagePlanPresentation(rawCopy);
    assert.ok(copy.pricing.save);
    assert.equal(copy.pricing.plans.length, 4);
    assert.deepEqual(
      copy.pricing.plans.map((plan) => plan.features[0]),
      locale === "en"
        ? ["1 GiB storage", "10 GiB storage", "30 GiB storage", "100 GiB storage"]
        : ["1 GiB 存储空间", "10 GiB 存储空间", "30 GiB 存储空间", "100 GiB 存储空间"],
    );
    assert.match(copy.pricing.plans[0].features.join(" "), locale === "en" ? /Standard models/ : /标准模型/);
    copy.pricing.plans.slice(1).forEach((plan) => {
      assert.match(plan.features.join(" "), locale === "en" ? /Advanced models/ : /高级模型/);
    });
    assert.doesNotMatch(copy.pricing.plans.flatMap((plan) => plan.features).join(" "), /\$\d/);
  }
});
