import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_LOGIN_URL,
  APP_URL,
  createProductLoginUrl,
} from "../src/productHandoff.js";

test("general product actions enter the formal Musuw authentication entry without authority fields", () => {
  assert.equal(APP_URL, "https://app.musuw.com/");
  assert.equal(APP_LOGIN_URL, "https://app.musuw.com/auth/start");
  assert.equal(createProductLoginUrl(), APP_LOGIN_URL);
});

test("pricing actions carry only the bounded local plan and billing period", () => {
  assert.equal(
    createProductLoginUrl({ plan: "personal", billingPeriod: "monthly" }),
    "https://app.musuw.com/auth/start?plan=personal&period=monthly",
  );
  assert.equal(
    createProductLoginUrl({ plan: "pro", billingPeriod: "yearly" }),
    "https://app.musuw.com/auth/start?plan=pro&period=yearly",
  );
});

test("unsupported or authority-bearing checkout intent fails closed", () => {
  for (const value of [
    { plan: "organization", billingPeriod: "monthly" },
    { plan: "personal", billingPeriod: "weekly" },
    { plan: "price_123", billingPeriod: "monthly" },
    { plan: "personal", billingPeriod: "monthly", priceId: "pri_123" },
  ]) {
    assert.throws(() => createProductLoginUrl(value), /checkout intent/i);
  }
});
