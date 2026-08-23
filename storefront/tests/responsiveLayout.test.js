import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

function mediaBlock(styles, query) {
  const start = styles.indexOf(`@media (${query})`);
  assert.notEqual(start, -1, `${query} media block must remain present`);
  const bodyStart = styles.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    if (styles[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return styles.slice(bodyStart + 1, index);
  }
  throw new Error(`unterminated ${query} media block`);
}

function cssRule(styles, selector) {
  return styles.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`, "s"))?.[0] ?? "";
}

test("storefront responsive media and final CTA rules stay bounded", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  const baseArticleImage = styles.match(/\.article-image\s*\{[^}]*\}/s)?.[0] ?? "";
  const baseArticleImageImage = styles.match(/\.article-image img\s*\{[^}]*\}/s)?.[0] ?? "";
  const reviewReady = styles.slice(styles.lastIndexOf("/* Review-ready storefront compositions"));
  const mobile = mediaBlock(reviewReady, "max-width: 767px");
  const tablet = mediaBlock(reviewReady, "max-width: 1080px");

  assert.match(baseArticleImage, /aspect-ratio:\s*1\.25\s*;/s);
  assert.match(baseArticleImageImage, /height:\s*100%\s*;/s);
  assert.match(mobile, /\.article-image\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9\s*;/s);

  assert.match(tablet, /\.final-cta-bg\s*\{[^}]*position:\s*absolute\s*;[^}]*inset:\s*0\s*;/s);
  const card = cssRule(tablet, "\\.final-cta-card");
  const copy = cssRule(tablet, "\\.final-cta-copy");
  const visual = cssRule(tablet, "\\.final-cta-visual");
  const frame = cssRule(tablet, "\\.final-cta-dashboard-frame");
  assert.match(card, /display:\s*grid\s*;/s);
  assert.match(card, /height:\s*auto\s*;/s);
  assert.match(card, /grid-template-columns:\s*minmax\(0,\s*0\.82fr\)\s+minmax\(0,\s*1\.18fr\)\s*;/s);
  assert.match(copy, /height:\s*auto\s*;/s);
  assert.match(copy, /min-width:\s*0\s*;/s);
  assert.match(visual, /height:\s*auto\s*;/s);
  assert.match(visual, /min-height:\s*0\s*;/s);
  assert.match(frame, /height:\s*auto\s*;/s);
  assert.match(frame, /aspect-ratio:\s*3\s*\/\s*2\s*;/s);
  assert.match(mobile, /\.final-cta-dashboard-frame\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10\s*;/s);
});

test("comparison group headings keep the plan columns aligned before the desktop breakpoint", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  const desktopStart = styles.indexOf("@media (min-width: 1081px)");
  assert.notEqual(desktopStart, -1);
  const baseStyles = styles.slice(0, desktopStart);
  const groupHead = cssRule(baseStyles, "\\.comparison-group-head");

  assert.match(groupHead, /display:\s*grid\s*;/s);
  assert.match(
    groupHead,
    /grid-template-columns:\s*minmax\(260px,\s*1\.8fr\)\s+repeat\(4,\s*minmax\(100px,\s*0\.65fr\)\)\s*;/s,
  );
});
