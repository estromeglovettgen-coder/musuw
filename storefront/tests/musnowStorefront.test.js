import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  articles,
  benefits,
  comparisonGroups,
  customerMarks,
  features,
  priceBooks,
  plans,
  testimonials,
  workflows,
} from "../src/data/homeContent.js";
import { getStorefrontCopy } from "../src/i18n.js";
import { getPublicDocument, PUBLIC_DOCUMENT_PATHS } from "../src/legalContent.js";

const root = new URL("../", import.meta.url).pathname;

function collectStrings(value, result = []) {
  if (typeof value === "string") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, result));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, result));
  }
  return result;
}

test("public copy presents the exact lowercase musuw brand without stale names or fabricated proof", () => {
  for (const locale of ["en", "zh-CN"]) {
    const copy = getStorefrontCopy(locale);
    const allCopy = collectStrings(copy).join("\n");

    assert.match(copy.meta.title, /musuw/);
    assert.doesNotMatch(allCopy, /Musnow/);
    assert.match(copy.meta.description, locale === "zh-CN" ? /知识/ : /knowledge/i);
    assert.match(allCopy, locale === "zh-CN" ? /精确引用|准确引用/ : /exact citations?/i);
    assert.match(allCopy, locale === "zh-CN" ? /知识图谱/ : /knowledge graph/i);
    assert.match(allCopy, locale === "zh-CN" ? /导出/ : /export/i);
    assert.doesNotMatch(allCopy, /ClientHub|client portal/);
    assert.doesNotMatch(allCopy, /1,000\+|4\.8\s+Trusted|深受服务团队信赖/);
    assert.doesNotMatch(allCopy, /2028/);
  }

  const dataSource = readFileSync(join(root, "src/data/homeContent.js"), "utf8");
  assert.doesNotMatch(dataSource, /Jonathan Hayes|Clearframe Agency|Portivio|ClientHub/);
});

test("public capability copy matches the simplified Query, Knowledge Base, and Wiki product path", () => {
  const englishDefaults = collectStrings({
    benefits,
    comparisonGroups,
    customerMarks,
    features,
    plans,
    testimonials,
    workflows,
  }).join("\n");
  const publicDocuments = ["en", "zh-CN"]
    .flatMap((locale) => PUBLIC_DOCUMENT_PATHS.map((path) => getPublicDocument(locale, path)))
    .map((document) => collectStrings(document).join("\n"))
    .join("\n");
  const allVisibleCopy = [
    englishDefaults,
    collectStrings(getStorefrontCopy("en")).join("\n"),
    collectStrings(getStorefrontCopy("zh-CN")).join("\n"),
    publicDocuments,
  ].join("\n");

  assert.doesNotMatch(
    allVisibleCopy,
    /reviewable (?:changes|knowledge|high-impact changes)|answer review|saved-answer review|review decisions|accept(?:ed)?,? or reject|accepted, rejected|review before acceptance|review contradictions|review high-impact changes|change control|visible diffs|可审查变更|可审查的重要变更|可以审核的知识|答案(?:保存与)?审核|审查决定|接受或拒绝|接受、拒绝|接受前先审核|审核相互矛盾的信息|审核高影响变化|变化控制/i,
  );

  const english = collectStrings(getStorefrontCopy("en")).join("\n");
  assert.match(english, /upload(?:ing)?.*pars(?:e|ing)|pars(?:e|ing).*upload/i);
  assert.match(english, /retrieval.*questions?|questions?.*retrieval/i);
  assert.match(english, /graph (?:view )?(?:inside|within) Wiki|in-Wiki graph/i);
  assert.match(english, /exact (?:source |evidence )?citations?/i);

  const chinese = collectStrings(getStorefrontCopy("zh-CN")).join("\n");
  assert.match(chinese, /上传.*解析|解析.*上传/);
  assert.match(chinese, /检索.*问答|问答.*检索/);
  assert.match(chinese, /Wiki 内.*图谱|图谱.*Wiki/);
  assert.match(chinese, /精确(?:证据)?引用/);
});

test("consumer pricing matches the enforced storage and exact monthly AI credit allowances", () => {
  for (const locale of ["en", "zh-CN"]) {
    const pricing = getStorefrontCopy(locale).pricing;
    assert.match(
      pricing.intro.body,
      locale === "zh-CN" ? /存储空间.*模型权限.*每月 AI 额度/ : /storage.*model access.*monthly AI allowance/i,
    );
    assert.equal(pricing.plans.length, 4);
    const freeFeatures = pricing.plans[0].features.join(" ");
    assert.match(freeFeatures, /5 GiB.*\$1\.00/);
    assert.match(
      freeFeatures,
      locale === "zh-CN" ? /1 个知识库.*10 篇文档/ : /1 knowledge base.*10 documents/i,
    );
  }

  assert.match(plans[1].features.join(" "), /20 GiB.*\$1\.25.*Expanded platform-approved catalog/i);
  assert.match(plans[2].features.join(" "), /40 GiB.*\$2\.50.*Expanded platform-approved catalog/i);
  assert.match(plans[3].features.join(" "), /80 GiB.*\$5\.00.*Expanded platform-approved catalog/i);
});

test("regional price books expose exact monthly and annual totals for all four plans", () => {
  assert.deepEqual(priceBooks.USD, [
    { monthly: 0, yearlyTotal: 0 },
    { monthly: 5, yearlyTotal: 49 },
    { monthly: 10, yearlyTotal: 99 },
    { monthly: 20, yearlyTotal: 199 },
  ]);
  assert.deepEqual(priceBooks.CNY, [
    { monthly: 0, yearlyTotal: 0 },
    { monthly: 29, yearlyTotal: 289 },
    { monthly: 59, yearlyTotal: 589 },
    { monthly: 129, yearlyTotal: 1289 },
  ]);
  assert.equal(plans[0].key, "free");
  assert.equal(plans[3].key, "max");
  assert.notEqual(plans[3].available, false);
});

test("existing homepage structure points only to real musuw product evidence", () => {
  const homePage = readFileSync(join(root, "src/HomePage.jsx"), "utf8");
  const sectionOrder = [
    "HeroScene",
    "FeaturesSection",
    "WorkflowSection",
    "BenefitsSection",
    "PricingSection",
    "ComparisonSection",
    "BlogPreviewSection",
    "FAQSection",
    "FinalCTA"
  ];
  let previousIndex = -1;
  for (const section of sectionOrder) {
    const index = homePage.indexOf(`<${section}`);
    assert.ok(index > previousIndex, `${section} must remain in the approved homepage order`);
    previousIndex = index;
  }

  const expectedAssets = new Set([
    "/images/musuw-query-citation.jpg",
    "/images/musuw-knowledge-base.jpg",
    "/images/musuw-wiki-page.jpg",
    "/images/musuw-wiki-graph.jpg"
  ]);
  const evidenceSources = [
    "index.html",
    "src/data/homeContent.js",
    "src/components/HeroScene.jsx",
    "src/components/HomeSections.jsx"
  ].map((path) => readFileSync(join(root, path), "utf8")).join("\n");
  const referencedAssets = new Set(
    [...evidenceSources.matchAll(/\/images\/(musuw-[a-z-]+\.jpg)/g)]
      .map((match) => `/images/${match[1]}`)
  );
  assert.deepEqual(
    [...referencedAssets].sort(),
    [...expectedAssets].sort(),
    "homepage evidence closure must contain only current Query, Knowledge Base, Wiki page, and in-Wiki graph captures"
  );
  for (const asset of expectedAssets) {
    const file = join(root, "public", asset.replace(/^\//, ""));
    assert.ok(existsSync(file), `${asset} must exist in public assets`);
    assert.ok(statSync(file).size > 10_000, `${asset} must contain a real product screenshot`);
  }

  for (const component of ["src/components/HeroScene.jsx", "src/components/HomeSections.jsx"]) {
    const source = readFileSync(join(root, component), "utf8");
    assert.doesNotMatch(
      source,
      /hero-dashboard-hd|activity-card-hd|deliverable-card-hd|project-list|approval-detail/,
      `${component} must not display ClientHub assets`
    );
  }
});

test("decorative hero transforms cannot create horizontal page scrolling", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  const htmlRule = styles.match(/html\s*\{[\s\S]*?\}/)?.[0] ?? "";
  const bodyRule = styles.match(/body\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(htmlRule, /overflow-x:\s*clip/);
  assert.match(bodyRule, /overflow-x:\s*clip/);
});
