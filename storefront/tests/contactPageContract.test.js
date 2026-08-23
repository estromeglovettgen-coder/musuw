import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

test("contact page uses a reference-style form hero and keeps legal details below it", () => {
  const page = readFileSync(join(root, "src/LegalPage.jsx"), "utf8");
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");

  assert.match(page, /className="contact-form-shell"/);
  assert.match(page, /className="contact-form"/);
  assert.match(page, /htmlFor="contact-first-name"/);
  assert.match(page, /htmlFor="contact-last-name"/);
  assert.match(page, /htmlFor="contact-email"/);
  assert.match(page, /htmlFor="contact-message"/);
  assert.match(page, /autoComplete="given-name"/);
  assert.match(page, /autoComplete="family-name"/);
  assert.match(page, /autoComplete="email"/);
  assert.match(page, /type="submit"/);
  assert.match(page, /contact-legal-strip/);
  assert.match(page, /mailto:/);
  assert.doesNotMatch(page, /Choose a contact route/);
  assert.doesNotMatch(page, /contact-card-grid/);
  assert.match(styles, /\.contact-form-shell\s*\{/);
  assert.match(styles, /\.contact-form\s*\{/);
  assert.match(styles, /\.contact-legal-strip\s*\{/);
  assert.match(styles, /@media \(max-width: 767px\)/);
});
