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
import {
  applyHomepagePlanPresentation,
  HOMEPAGE_NAVIGATION,
} from "../src/planPresentation.js";
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
    const copy = applyHomepagePlanPresentation(getStorefrontCopy(locale));
    const allCopy = collectStrings(copy).join("\n");

    assert.match(copy.meta.title, /musuw/);
    assert.doesNotMatch(allCopy, /Musnow/);
    assert.match(copy.meta.description, locale === "zh-CN" ? /知识|第二大脑/ : /knowledge|second brain/i);
    assert.match(allCopy, locale === "zh-CN" ? /精确引用|原文引用/ : /exact (?:source )?citations?/i);
    assert.match(allCopy, locale === "zh-CN" ? /知识图谱/ : /knowledge graph/i);
    assert.match(allCopy, locale === "zh-CN" ? /知识复利|越用越强/ : /knowledge compounds?|gets better with use/i);
    assert.match(allCopy, locale === "zh-CN" ? /导出/ : /export/i);
    assert.doesNotMatch(allCopy, /ClientHub|client portal/);
    assert.doesNotMatch(allCopy, /1,000\+|4\.8\s+Trusted|深受服务团队信赖/);
    assert.doesNotMatch(allCopy, /2028/);
  }

  const dataSource = readFileSync(join(root, "src/data/homeContent.js"), "utf8");
  assert.doesNotMatch(dataSource, /Jonathan Hayes|Clearframe Agency|Portivio|ClientHub/);
});

test("public capability copy matches the grounded answer, AI Wiki, graph, and compounding product path", () => {
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
  const homepageEnglish = collectStrings(applyHomepagePlanPresentation(getStorefrontCopy("en"))).join("\n");
  const homepageChinese = collectStrings(applyHomepagePlanPresentation(getStorefrontCopy("zh-CN"))).join("\n");
  const allVisibleCopy = [englishDefaults, homepageEnglish, homepageChinese, publicDocuments].join("\n");

  assert.doesNotMatch(
    allVisibleCopy,
    /reviewable (?:changes|knowledge|high-impact changes)|answer review|saved-answer review|review decisions|accept(?:ed)?,? or reject|accepted, rejected|review before acceptance|review contradictions|review high-impact changes|change control|visible diffs|可审查变更|可审查的重要变更|可以审核的知识|答案(?:保存与)?审核|审查决定|接受或拒绝|接受、拒绝|接受前先审核|审核相互矛盾的信息|审核高影响变化|变化控制/i,
  );

  assert.match(homepageEnglish, /knowledge-base RAG/i);
  assert.match(homepageEnglish, /AI-organized Wiki/i);
  assert.match(homepageEnglish, /backlinks/i);
  assert.match(homepageEnglish, /save strong AI answers back into the knowledge base/i);
  assert.match(homepageEnglish, /exact source citations/i);

  assert.match(homepageChinese, /知识库 RAG/);
  assert.match(homepageChinese, /AI 整理的 Wiki/);
  assert.match(homepageChinese, /反向链接/);
  assert.match(homepageChinese, /回答重新保存进知识库/);
  assert.match(homepageChinese, /精确原文引用/);
});

test("consumer pricing presents public capacity and model access without provider-dollar amounts", () => {
  for (const locale of ["en", "zh-CN"]) {
    const pricing = applyHomepagePlanPresentation(getStorefrontCopy(locale)).pricing;
    assert.match(
      pricing.intro.body,
      locale === "zh-CN" ? /更多存储.*视频导入.*高级模型/ : /more storage.*video ingestion.*advanced models/i,
    );
    assert.equal(pricing.plans.length, 4);
    assert.deepEqual(
      pricing.plans.map((plan) => plan.features[0]),
      locale === "zh-CN"
        ? ["1 GiB 存储空间", "10 GiB 存储空间", "30 GiB 存储空间", "100 GiB 存储空间"]
        : ["1 GiB storage", "10 GiB storage", "30 GiB storage", "100 GiB storage"],
    );
    const freeFeatures = pricing.plans[0].features.join(" ");
    assert.match(freeFeatures, locale === "zh-CN" ? /标准模型/ : /Standard models/);
    pricing.plans.slice(1).forEach((plan) => {
      assert.match(plan.features.join(" "), locale === "zh-CN" ? /高级模型/ : /Advanced models/);
    });
    assert.doesNotMatch(pricing.plans.flatMap((plan) => plan.features).join(" "), /\$\d/);
  }

  assert.match(plans[0].features.join(" "), /1 GiB.*\$0\.40.*1 knowledge base.*10 documents/i);
  assert.match(plans[1].features.join(" "), /10 GiB.*\$1\.25.*Expanded platform-approved catalog/i);
  assert.match(plans[2].features.join(" "), /30 GiB.*\$2\.50.*Expanded platform-approved catalog/i);
  assert.match(plans[3].features.join(" "), /100 GiB.*\$5\.00.*Expanded platform-approved catalog/i);
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

test("existing homepage structure keeps the smooth hero and removes the repeated workflow section", () => {
  const homePage = readFileSync(join(root, "src/HomePage.jsx"), "utf8");
  const sectionOrder = [
    "HeroScene",
    "FeaturesSection",
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
  assert.doesNotMatch(homePage, /<WorkflowSection\b/);

  const heroSource = readFileSync(join(root, "src/components/HeroScene.jsx"), "utf8");
  assert.match(heroSource, /className="dashboard-scene"/);
  assert.match(heroSource, /sampleHeroVisibility/);
  assert.match(heroSource, /<video/);
  assert.match(heroSource, /musuw-overview\.webm/);
  assert.doesNotMatch(heroSource, /hero-float/);

  assert.deepEqual(
    HOMEPAGE_NAVIGATION.map(({ label }) => label),
    ["Features", "Examples", "Pricing", "Security", "Contact"],
  );

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
    "src/components/HomeSections.jsx",
    "src/planPresentation.js",
  ].map((path) => readFileSync(join(root, path), "utf8")).join("\n");
  const referencedAssets = new Set(
    [...evidenceSources.matchAll(/\/images\/(musuw-[a-z-]+\.jpg)/g)]
      .map((match) => `/images/${match[1]}`)
  );
  assert.deepEqual(
    [...referencedAssets].sort(),
    [...expectedAssets].sort(),
    "homepage evidence closure must contain only current Query, Knowledge Base, Wiki page, and graph captures"
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
