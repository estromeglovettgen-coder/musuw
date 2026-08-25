import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

function cssRule(styles, selector) {
  return styles.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`, "s"))?.[0] ?? "";
}

test("homepage journey stylesheet is imported after the legacy storefront styles", () => {
  const main = readFileSync(join(root, "src/main.jsx"), "utf8");
  const baseIndex = main.indexOf('import "./styles.css"');
  const journeyIndex = main.indexOf('import "./home-journey.css"');

  assert.ok(baseIndex >= 0);
  assert.ok(journeyIndex > baseIndex);
});

test("homepage journey keeps proof, scenarios, pricing, and mobile layouts bounded", () => {
  const styles = readFileSync(join(root, "src/home-journey.css"), "utf8");

  assert.match(cssRule(styles, "\\.hero-proof-main"), /width:\s*min\(88%,\s*980px\)/);
  assert.match(cssRule(styles, "\\.journey-use-case-grid"), /grid-template-columns:\s*repeat\(3/);
  assert.match(cssRule(styles, "\\.journey-pricing-grid"), /grid-template-columns:\s*repeat\(4/);
  assert.match(cssRule(styles, "\\.journey-included-grid"), /grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /@media \(max-width:\s*840px\)/);
  assert.match(styles, /@media \(max-width:\s*767px\)/);
  assert.match(styles, /@media \(max-width:\s*430px\)/);
  assert.match(
    styles,
    /@media \(max-width:\s*767px\)[\s\S]*?\.journey-pricing-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width:\s*767px\)[\s\S]*?\.journey-included-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
});

test("homepage no longer renders the full plan comparison table", () => {
  const homePage = readFileSync(join(root, "src/HomePage.jsx"), "utf8");
  const sections = readFileSync(join(root, "src/components/HomeSections.jsx"), "utf8");

  assert.doesNotMatch(homePage, /ComparisonSection|ComparisonTable/);
  assert.doesNotMatch(sections, /comparisonGroups|comparison-table|comparison-row/);
  assert.match(sections, /IncludedInEveryPlanSection/);
});
